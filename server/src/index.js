import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import webhooksRouter from './routes/webhooks.js';
import leadsRouter from './routes/leads.js';
import propertiesRouter from './routes/properties.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Webhook público do Canal Pro (fora do prefixo /api)
app.use('/webhooks', webhooksRouter);

app.use('/api/leads', leadsRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);

// Em produção serve o build do frontend, se existir (deploy single-service)
const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api|webhooks).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

// JSON malformado no body → 400 limpo, nunca stack trace pro cliente
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido.' });
  }
  next(err);
});

app.use((err, _req, res, _next) => {
  console.error('[server] erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CRM backend rodando em http://localhost:${PORT}`);
});
