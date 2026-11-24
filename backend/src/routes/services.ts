import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/services', (_req, res) => {
  try {
    const services = db.prepare(`
      SELECT 
        id, 
        name_en as nameEn, 
        name_gu as nameGu, 
        name_hi as nameHi, 
        duration_minutes as durationMinutes, 
        price, 
        active, 
        order_index as orderIndex
      FROM services
      WHERE active = 1
      ORDER BY order_index ASC
    `).all();

    res.json(services);
  } catch (error: any) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'FAILED_FETCH_SERVICES' });
  }
});

export default router;
