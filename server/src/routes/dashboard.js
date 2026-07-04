import { Router } from 'express';
import { db, STAGES } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const byStageRows = db.prepare('SELECT stage, COUNT(*) AS n FROM leads GROUP BY stage').all();
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const row of byStageRows) byStage[row.stage] = row.n;

  const bySource = db
    .prepare('SELECT source, COUNT(*) AS n FROM leads GROUP BY source ORDER BY n DESC')
    .all();

  const byLeadType = db
    .prepare(`SELECT lead_type, COUNT(*) AS n FROM leads WHERE lead_type IS NOT NULL GROUP BY lead_type ORDER BY n DESC`)
    .all();

  const total = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  const won = byStage.fechado ?? 0;
  const lost = byStage.perdido ?? 0;
  const decided = won + lost;

  const overdueTasks = db.prepare(`
    SELECT COUNT(*) AS n FROM tasks
    WHERE done = 0 AND due_at IS NOT NULL AND due_at < datetime('now')
  `).get().n;

  const last7days = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS n FROM leads
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY day ORDER BY day
  `).all();

  res.json({
    total,
    byStage,
    bySource,
    byLeadType,
    conversion: decided ? Math.round((won / decided) * 100) : null,
    won,
    lost,
    overdueTasks,
    last7days,
  });
});

export default router;
