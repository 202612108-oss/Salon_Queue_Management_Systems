import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  try {
    const stmt = db.prepare('SELECT 1 as alive');
    const result = stmt.get() as { alive: number } | undefined;
    if (!result || result.alive !== 1) {
      dbStatus = 'degraded';
    }
  } catch (error) {
    dbStatus = 'error';
  }

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    service: 'salon-backend',
    version: '1.0.0',
    db: dbStatus,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

export default router;
