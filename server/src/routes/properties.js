import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { q, neighborhood } = req.query;
  const where = [];
  const params = {};
  if (q) { where.push('(title LIKE @q OR neighborhood LIKE @q)'); params.q = `%${q}%`; }
  if (neighborhood) { where.push('neighborhood = @neighborhood'); params.neighborhood = neighborhood; }
  const sql = `SELECT * FROM properties ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY synced_at DESC, created_at DESC LIMIT 200`;
  res.json(db.prepare(sql).all(params));
});

const propertyInput = z.object({
  title: z.string().min(1),
  neighborhood: z.string().nullish(),
  type: z.string().nullish(),
  price: z.number().int().nullish(),
  url: z.string().nullish(),
});

router.post('/', (req, res) => {
  const parsed = propertyInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  const info = db.prepare(
    'INSERT INTO properties (title, neighborhood, type, price, url) VALUES (?, ?, ?, ?, ?)'
  ).run(d.title, d.neighborhood ?? null, d.type ?? null, d.price ?? null, d.url ?? null);
  res.status(201).json(db.prepare('SELECT * FROM properties WHERE id = ?').get(info.lastInsertRowid));
});

export default router;
