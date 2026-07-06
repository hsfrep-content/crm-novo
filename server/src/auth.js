import crypto from 'node:crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';

// Login exclusivo via Google (Google Identity Services).
//
// Fluxo: o frontend obtém um ID token do Google e envia para
// POST /api/auth/google. Aqui o token é verificado contra o GOOGLE_CLIENT_ID
// e o e-mail é checado contra a lista de autorizados (ALLOWED_EMAILS).
// Aprovado, emitimos uma sessão própria (HMAC-SHA256 com APP_SECRET) em
// cookie httpOnly — o token do Google não é reutilizado depois disso.
//
// Caminho alternativo: e-mail + senha compartilhada (LOGIN_PASSWORD no .env),
// restrito à mesma allowlist. Útil enquanto o OAuth do Google não está
// configurado, ou como acesso de contingência.
//
// Sem GOOGLE_CLIENT_ID e sem LOGIN_PASSWORD o login fica DESATIVADO
// (modo aberto), e o frontend exibe um aviso permanente para configurá-lo.

const SESSION_COOKIE = 'advant_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const clientId = process.env.GOOGLE_CLIENT_ID || null;
const oauthClient = clientId ? new OAuth2Client(clientId) : null;
const loginPassword = process.env.LOGIN_PASSWORD || null;

export const authEnabled = Boolean(clientId || loginPassword);

// ALLOWED_EMAILS aceita e-mails e domínios: "ana@gmail.com, @aelimoveis.com.br"
const allowed = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function emailAllowed(email) {
  const lower = email.toLowerCase();
  return allowed.some((entry) =>
    entry.startsWith('@') ? lower.endsWith(entry) : lower === entry
  );
}

function sessionKey() {
  if (!process.env.APP_SECRET) throw new Error('APP_SECRET não definido.');
  return crypto.scryptSync(process.env.APP_SECRET, 'advant-session-salt', 32);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function createSessionToken(user) {
  const payload = b64url(
    JSON.stringify({ email: user.email, name: user.name, picture: user.picture ?? null, exp: Date.now() + SESSION_TTL_MS })
  );
  const sig = crypto.createHmac('sha256', sessionKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', sessionKey()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    // A allowlist vale também para sessões já emitidas: remover um e-mail
    // da lista revoga o acesso na próxima requisição.
    if (!emailAllowed(data.email)) return null;
    return { email: data.email, name: data.name, picture: data.picture };
  } catch {
    return null;
  }
}

function readSessionCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function requireAuth(req, res, next) {
  if (!authEnabled) return next(); // modo aberto (sem GOOGLE_CLIENT_ID)
  const user = verifySessionToken(readSessionCookie(req));
  if (!user) return res.status(401).json({ error: 'Sessão expirada — entre novamente.' });
  req.user = user;
  next();
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_MS,
  path: '/',
};

export const authRouter = Router();

// Público: diz ao frontend quais métodos de login estão ativos
authRouter.get('/config', (_req, res) => {
  res.json({ enabled: authEnabled, clientId, passwordLogin: Boolean(loginPassword) });
});

// ---- Login por e-mail + senha compartilhada ----

// Proteção contra força bruta: 8 tentativas erradas por IP a cada 10 minutos
const attempts = new Map();
function throttled(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt < now) attempts.delete(ip);
  const current = attempts.get(ip);
  return current && current.count >= 8;
}
function registerFailure(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

authRouter.post('/password', (req, res) => {
  if (!loginPassword) {
    return res.status(400).json({ error: 'Login por senha não está habilitado no servidor.' });
  }
  if (throttled(req.ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 10 minutos e tente de novo.' });
  }
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }
  if (allowed.length === 0) {
    return res.status(403).json({ error: 'Nenhum e-mail autorizado configurado (ALLOWED_EMAILS).' });
  }
  // Mensagem única para e-mail não autorizado e senha errada — não revela
  // quais e-mails existem na lista.
  if (!emailAllowed(email) || !safeEqual(password, loginPassword)) {
    registerFailure(req.ip);
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  attempts.delete(req.ip);
  const user = { email, name: email.split('@')[0], picture: null };
  res.cookie(SESSION_COOKIE, createSessionToken(user), cookieOptions);
  res.json({ user });
});

authRouter.post('/google', async (req, res) => {
  if (!oauthClient) return res.status(400).json({ error: 'Login com Google não configurado no servidor.' });
  const credential = req.body?.credential;
  if (typeof credential !== 'string' || !credential) {
    return res.status(400).json({ error: 'Credencial ausente.' });
  }
  let payload;
  try {
    const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Não foi possível validar sua conta Google. Tente novamente.' });
  }
  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: 'Conta Google sem e-mail verificado.' });
  }
  if (allowed.length === 0) {
    return res.status(403).json({ error: 'Nenhum e-mail autorizado configurado (ALLOWED_EMAILS).' });
  }
  if (!emailAllowed(payload.email)) {
    return res.status(403).json({ error: `A conta ${payload.email} não tem acesso a este CRM.` });
  }
  const user = { email: payload.email, name: payload.name ?? payload.email, picture: payload.picture ?? null };
  res.cookie(SESSION_COOKIE, createSessionToken(user), cookieOptions);
  res.json({ user });
});

authRouter.get('/me', (req, res) => {
  if (!authEnabled) return res.json({ user: null, open: true });
  const user = verifySessionToken(readSessionCookie(req));
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});
