import { z } from 'zod';
import { db, getSetting, setSetting } from '../db.js';
import { decrypt } from '../crypto.js';

// Cliente HTTP dedicado da API Tecimob. Toda chamada à Tecimob passa por aqui —
// nenhum outro módulo (nem o frontend) fala com a API diretamente.
//
// Regras de resiliência:
//  - timeout explícito de 10s por chamada (AbortController)
//  - 429: backoff exponencial 1s -> 2s -> 4s, máximo 3 tentativas
//  - 401/403: erro tipado que o frontend converte em banner "reconecte em Configurações"
//  - 5xx: erro tipado; o CRM segue funcionando só com dados locais
//  - resposta validada com zod registro a registro: inválidos são logados e pulados
//  - paginação acumulativa e upsert por tecimob_id (nunca insert simples)

const BASE_URL = process.env.TECIMOB_BASE_URL || 'https://api.tecimob.com.br';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

export class TecimobError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code; // 'auth' | 'rate_limit' | 'timeout' | 'server' | 'no_key' | 'network'
    this.status = status;
  }
}

const propertySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1),
  neighborhood: z.string().nullish(),
  type: z.string().nullish(),
  price: z.union([z.number(), z.string()]).nullish(),
  url: z.string().nullish(),
});

const pageSchema = z.object({
  data: z.array(z.unknown()),
  meta: z
    .object({
      current_page: z.number().optional(),
      last_page: z.number().optional(),
      next_page_url: z.string().nullish(),
    })
    .partial()
    .optional(),
});

function getApiKey() {
  const encrypted = getSetting('tecimob_api_key');
  if (!encrypted) return null;
  return decrypt(encrypted);
}

export function hasApiKey() {
  return getSetting('tecimob_api_key') !== null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(pathname, { apiKey, attempt = 0 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(new URL(pathname, BASE_URL), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new TecimobError('Tecimob não respondeu em 10s.', 'timeout');
    }
    throw new TecimobError(`Falha de rede ao chamar a Tecimob: ${err.message}`, 'network');
  }
  clearTimeout(timer);

  if (response.status === 401 || response.status === 403) {
    throw new TecimobError('Chave de API inválida ou expirada.', 'auth', response.status);
  }
  if (response.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new TecimobError('Limite de requisições da Tecimob excedido.', 'rate_limit', 429);
    }
    await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s
    return request(pathname, { apiKey, attempt: attempt + 1 });
  }
  if (response.status >= 500) {
    throw new TecimobError('Tecimob instável no momento.', 'server', response.status);
  }
  if (!response.ok) {
    throw new TecimobError(`Resposta inesperada da Tecimob (${response.status}).`, 'server', response.status);
  }
  return response.json();
}

function recordSyncResult(patch) {
  const current = JSON.parse(getSetting('tecimob_status') || '{}');
  setSetting('tecimob_status', JSON.stringify({ ...current, ...patch }));
}

export function getTecimobStatus() {
  return {
    connected: hasApiKey(),
    ...JSON.parse(getSetting('tecimob_status') || '{}'),
  };
}

const upsertProperty = db.prepare(`
  INSERT INTO properties (tecimob_id, title, neighborhood, type, price, url, raw, synced_at)
  VALUES (@tecimob_id, @title, @neighborhood, @type, @price, @url, @raw, datetime('now'))
  ON CONFLICT(tecimob_id) DO UPDATE SET
    title = excluded.title,
    neighborhood = excluded.neighborhood,
    type = excluded.type,
    price = excluded.price,
    url = excluded.url,
    raw = excluded.raw,
    synced_at = excluded.synced_at
`);

export async function syncProperties() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new TecimobError('Nenhuma chave de API configurada.', 'no_key');
  }

  let page = 1;
  let imported = 0;
  let skipped = 0;
  const seen = new Set();

  try {
    // Paginação acumulativa: cada página é validada e gravada; páginas
    // seguintes nunca sobrescrevem o resultado das anteriores.
    for (;;) {
      const body = await request(`/api/properties?page=${page}`, { apiKey });
      const parsedPage = pageSchema.safeParse(body);
      const items = parsedPage.success ? parsedPage.data.data : Array.isArray(body) ? body : null;
      if (items === null) {
        throw new TecimobError('Resposta da Tecimob em formato inesperado.', 'server');
      }

      const writePage = db.transaction((rows) => {
        for (const row of rows) {
          const parsed = propertySchema.safeParse(row);
          if (!parsed.success) {
            skipped += 1;
            console.warn('[tecimob] registro inválido ignorado:', parsed.error.issues[0]?.message);
            continue;
          }
          const p = parsed.data;
          if (seen.has(p.id)) continue; // proteção contra item repetido entre páginas
          seen.add(p.id);
          upsertProperty.run({
            tecimob_id: p.id,
            title: p.title,
            neighborhood: p.neighborhood ?? null,
            type: p.type ?? null,
            price: p.price != null ? Math.round(Number(p.price)) || null : null,
            url: p.url ?? null,
            raw: JSON.stringify(row),
          });
          imported += 1;
        }
      });
      writePage(items);

      const meta = parsedPage.success ? parsedPage.data.meta : undefined;
      const hasNext =
        meta &&
        ((meta.current_page != null && meta.last_page != null && meta.current_page < meta.last_page) ||
          Boolean(meta.next_page_url));
      if (!hasNext || items.length === 0) break;
      page += 1;
    }

    recordSyncResult({
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      lastImported: imported,
      lastSkipped: skipped,
    });
    return { imported, skipped };
  } catch (err) {
    const code = err instanceof TecimobError ? err.code : 'unknown';
    recordSyncResult({ lastError: { code, message: err.message, at: new Date().toISOString() } });
    throw err;
  }
}
