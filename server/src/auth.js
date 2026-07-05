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
// Sem GOOGLE_CLIENT_ID configurado o login fica DESATIVADO (modo aberto),
// e o frontend exibe um aviso permanente para configurá-lo.

const SESSION_COOKIE = 'advant_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const clientId = process.env.GOOGLE_CLIENT_ID || null;
const oauthClient = clientId ? new OAuth2Client(clientId) : null;

export const authEnabled = Boolean(clientId);

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

// Público: diz ao frontend se o login está ativo e qual Client ID usar
authRouter.get('/config', (_req, res) => {
  res.json({ enabled: authEnabled, clientId });
});

authRouter.post('/google', async (req, res) => {
  if (!authEnabled) return res.status(400).json({ error: 'Login não configurado no servidor.' });
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
