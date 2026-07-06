import { useState } from 'react';
import { api } from '../api';
import { STAGES } from '../lib';
import { Modal, Field, Select, Button, Spinner } from './ui';

// Parser CSV com suporte a aspas e vírgulas dentro do campo
// (ex.: "Jana, Sagrada Massa"). Aceita ; como separador também.
function parseCsv(text) {
  const firstLine = text.slice(0, text.indexOf('\n'));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

// Detecta as colunas pelo cabeçalho (nome / telefone / e-mail, PT ou EN).
function mapColumns(rows) {
  if (!rows.length) return null;
  const header = rows[0].map((h) => h.toLowerCase());
  const find = (regex) => header.findIndex((h) => regex.test(h));
  let nameCol = find(/nome|name|contato|cliente/);
  let phoneCol = find(/telefone|celular|fone|phone|whats/);
  const emailCol = find(/e-?mail/);
  const hasHeader = nameCol !== -1 || phoneCol !== -1 || emailCol !== -1;
  if (!hasHeader) { nameCol = 0; phoneCol = rows[0].length > 1 ? 1 : -1; }
  if (nameCol === -1) nameCol = 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  return {
    leads: dataRows
      .map((r) => ({
        name: (r[nameCol] ?? '').trim(),
        phone: phoneCol !== -1 ? (r[phoneCol] ?? '').trim() || null : null,
        email: emailCol !== -1 ? (r[emailCol] ?? '').trim() || null : null,
      }))
      .filter((l) => l.name),
    hasHeader,
  };
}

const BATCH_SIZE = 500;

export default function ImportLeadsModal({ open, onClose, onImported }) {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [stage, setStage] = useState('importado');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function reset() {
    setParsed(null); setFileName(''); setResult(null); setError(null); setStage('importado');
  }

  async function onFile(e) {
    setError(null); setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const mapped = mapColumns(parseCsv(text.replace(/^﻿/, '')));
    if (!mapped || mapped.leads.length === 0) {
      setError('Não encontrei leads no arquivo. Confira se há uma coluna de nome.');
      setParsed(null);
      return;
    }
    setParsed(mapped);
  }

  async function runImport() {
    setImporting(true); setError(null);
    const totals = { imported: 0, duplicates: 0, invalid: 0 };
    try {
      for (let i = 0; i < parsed.leads.length; i += BATCH_SIZE) {
        const batch = parsed.leads.slice(i, i + BATCH_SIZE);
        const r = await api.leads.import(batch, { stage, source: 'importacao' });
        totals.imported += r.imported;
        totals.duplicates += r.duplicates;
        totals.invalid += r.invalid;
      }
      setResult(totals);
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Importar leads de planilha (CSV)">
      {!result ? (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Exporte sua lista como <strong>.csv</strong> com colunas de nome e telefone (RD Station,
            Excel, Google Sheets). Reimportar o mesmo arquivo não cria duplicatas — o telefone é a
            chave de deduplicação.
          </p>

          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-6 text-center transition-colors hover:border-accent-400 dark:border-zinc-700">
            <span className="text-sm font-medium">{fileName || 'Escolher arquivo CSV'}</span>
            <span className="text-xs text-zinc-400">clique para selecionar</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>

          {parsed && (
            <>
              <div className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                <strong>{parsed.leads.length} leads</strong> encontrados
                {parsed.hasHeader ? ' (cabeçalho detectado)' : ''}. Ex.:{' '}
                {parsed.leads.slice(0, 2).map((l) => l.name).join(', ')}…
              </div>
              <Field label="Etapa inicial no funil">
                <Select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full">
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
            </>
          )}

          {error && <p className="text-sm text-signal-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button onClick={runImport} disabled={!parsed || importing}>
              {importing && <Spinner />}
              {importing ? 'Importando…' : `Importar${parsed ? ` ${parsed.leads.length} leads` : ''}`}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Importação concluída
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-emerald-700/90 dark:text-emerald-300/90">
              <li><strong>{result.imported}</strong> leads importados</li>
              {result.duplicates > 0 && <li>{result.duplicates} duplicados ignorados (telefone já existia)</li>}
              {result.invalid > 0 && <li>{result.invalid} linhas inválidas ignoradas</li>}
            </ul>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { reset(); onClose(); }}>Fechar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
