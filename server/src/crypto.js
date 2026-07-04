import crypto from 'node:crypto';

// Criptografia AES-256-GCM para segredos guardados no banco (ex.: chave da API Tecimob).
// A chave é derivada de APP_SECRET (.env) via scrypt — o valor em texto puro nunca é persistido.

const APP_SECRET = process.env.APP_SECRET;

function deriveKey() {
  if (!APP_SECRET) {
    throw new Error('APP_SECRET não definido no .env — necessário para criptografar segredos.');
  }
  return crypto.scryptSync(APP_SECRET, 'crm-imob-static-salt', 32);
}

export function encrypt(plainText) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decrypt(payload) {
  const key = deriveKey();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
