import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/barbers', (_req, res) => {
  try {
    const barbers = db.prepare(`
      SELECT 
        b.id, 
        b.name, 
        b.slug, 
        b.avatar_url as avatarUrl, 
        b.active, 
        b.working_today as workingToday, 
        b.status,
        (SELECT COUNT(*) FROM queue_entries q WHERE q.preferred_barber_id = b.id AND q.status = 'Waiting') as customersWaitingCount
      FROM barbers b
      WHERE b.active = 1 AND b.working_today = 1
      ORDER BY b.name ASC
    `).all();

    res.json(barbers);
  } catch (error: any) {
    console.error('Error fetching barbers:', error);
    res.status(500).json({ error: 'FAILED_FETCH_BARBERS' });
  }
});

export default router;
