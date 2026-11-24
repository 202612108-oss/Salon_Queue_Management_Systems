import { Router } from 'express';
import { db } from '../db/index.js';
import { getIO } from '../sockets/index.js';
import { SOCKET_EVENTS } from '@salon/shared';
import { isValidStatusTransition } from '../rules/index.js';

const router = Router();

/**
 * GET /api/barber/details/:slug
 * Returns barber info, current assigned customer (Called or In Chair),
 * next up customers in line, and today's summary stats.
 */
router.get('/barber/details/:slug', (req, res) => {
  try {
    const slug = req.params.slug?.trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ error: 'MISSING_BARBER_SLUG' });
    }

    // 1. Fetch barber
    const barber = db.prepare(`
      SELECT 
        id, name, slug, avatar_url as avatarUrl, active, 
        working_today as workingToday, status, break_started_at as breakStartedAt
      FROM barbers
      WHERE LOWER(slug) = ? OR LOWER(name) = ?
      LIMIT 1
    `).get(slug, slug) as any;

    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: `Barber '${slug}' not found.` });
    }

    // 2. Fetch current active customer assigned to this barber (Called or In Chair)
    const currentEntry = db.prepare(`
      SELECT 
        q.id, q.token_number as tokenNumber, q.customer_name as customerName,
        q.customer_phone as customerPhone, q.status, q.called_at as calledAt,
        q.service_started_at as serviceStartedAt, q.total_duration_minutes as totalDurationMinutes,
        q.total_price as totalPrice
      FROM queue_entries q
      WHERE q.assigned_barber_id = ? AND q.status IN ('Called', 'In Chair')
      LIMIT 1
    `).get(barber.id) as any;

    let currentCustomer = null;
    if (currentEntry) {
      // Fetch selected services for this customer
      const services = db.prepare(`
        SELECT service_id as serviceId, name_en as nameEn, duration_minutes as durationMinutes, price
        FROM queue_entry_services
        WHERE entry_id = ?
      `).all(currentEntry.id) as any[];

      const now = Date.now();
      let elapsedSeconds = 0;
      if (currentEntry.status === 'In Chair' && currentEntry.serviceStartedAt) {
        elapsedSeconds = Math.max(0, Math.floor((now - new Date(currentEntry.serviceStartedAt).getTime()) / 1000));
      } else if (currentEntry.status === 'Called' && currentEntry.calledAt) {
        elapsedSeconds = Math.max(0, Math.floor((now - new Date(currentEntry.calledAt).getTime()) / 1000));
      }

      currentCustomer = {
        id: currentEntry.id,
        tokenNumber: currentEntry.tokenNumber,
        customerName: currentEntry.customerName,
        customerPhone: currentEntry.customerPhone,
        status: currentEntry.status,
        calledAt: currentEntry.calledAt,
        serviceStartedAt: currentEntry.serviceStartedAt,
        totalDurationMinutes: currentEntry.totalDurationMinutes,
        totalPrice: currentEntry.totalPrice,
        services,
        elapsedSeconds,
      };
    }

    // 3. Fetch next up customers in line (top 3 Waiting who chose this barber or Any Barber)
    const nextUpRows = db.prepare(`
      SELECT 
        q.id, q.token_number as tokenNumber, q.customer_name as customerName,
        q.preferred_barber_id as preferredBarberId, q.total_duration_minutes as totalDurationMinutes,
        (
          SELECT GROUP_CONCAT(name_en, ', ')
          FROM queue_entry_services s
          WHERE s.entry_id = q.id
        ) as servicesSummary
      FROM queue_entries q
      WHERE q.status = 'Waiting' AND (q.preferred_barber_id = ? OR q.preferred_barber_id IS NULL)
      ORDER BY q.joined_at ASC
      LIMIT 3
    `).all(barber.id) as any[];

    const nextUp = nextUpRows.map((r) => ({
      id: r.id,
      tokenNumber: r.tokenNumber,
      customerName: r.customerName,
      servicesSummary: r.servicesSummary || 'Standard Service',
      totalDurationMinutes: r.totalDurationMinutes,
      isDirectPreference: r.preferredBarberId === barber.id,
    }));

    // 4. Today's stats for this barber
    const completedCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_entries 
      WHERE assigned_barber_id = ? AND status = 'Done' AND date(completed_at) = date('now')
    `).get(barber.id) as { count: number };

    const avgTimeRows = db.prepare(`
      SELECT (strftime('%s', completed_at) - strftime('%s', service_started_at)) as durationSec
      FROM queue_entries
      WHERE assigned_barber_id = ? AND status = 'Done' AND date(completed_at) = date('now') AND service_started_at IS NOT NULL
    `).all(barber.id) as { durationSec: number }[];

    let avgServiceMinutes = 0;
    if (avgTimeRows.length > 0) {
      const totalSec = avgTimeRows.reduce((sum, r) => sum + Math.max(0, r.durationSec), 0);
      avgServiceMinutes = Math.round(totalSec / avgTimeRows.length / 60);
    }

    res.json({
      barber: {
        id: barber.id,
        name: barber.name,
        slug: barber.slug,
        avatarUrl: barber.avatarUrl,
        active: Boolean(barber.active),
        workingToday: Boolean(barber.workingToday),
        status: barber.status,
        breakStartedAt: barber.breakStartedAt,
      },
      currentCustomer,
      nextUp,
      todaySummary: {
        completedCount: completedCountRow.count,
        avgServiceMinutes,
      },
    });
  } catch (error: any) {
    console.error('Error fetching barber details:', error);
    res.status(500).json({ error: 'FAILED_FETCH_BARBER_DETAILS' });
  }
});

/**
 * POST /api/barber/:id/start
 * Starts service for the Called customer assigned to this barber.
 * Changes customer status from 'Called' to 'In Chair'.
 * Starts service timer and keeps barber Busy.
 */
router.post('/barber/:id/start', (req, res) => {
  try {
    const barberId = req.params.id;

    // Check barber exists
    const barber = db.prepare(`SELECT id, name, status FROM barbers WHERE id = ? AND active = 1`).get(barberId) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND' });
    }

    // Find Called customer assigned to this barber
    const entry = db.prepare(`
      SELECT id, token_number as tokenNumber, customer_name as customerName, status
      FROM queue_entries
      WHERE assigned_barber_id = ? AND status = 'Called'
      LIMIT 1
    `).get(barberId) as any;

    if (!entry) {
      return res.status(400).json({
        error: 'NO_CALLED_CUSTOMER',
        message: 'No customer is currently called for you to start.',
      });
    }

    const check = isValidStatusTransition(entry.status, 'In Chair', 'barber');
    if (!check.allowed) {
      return res.status(400).json({
        error: check.errorCode || 'INVALID_TRANSITION',
        message: check.errorMessage,
      });
    }

    const now = new Date().toISOString();

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Transition customer to 'In Chair'
      db.prepare(`
        UPDATE queue_entries
        SET status = 'In Chair', service_started_at = ?
        WHERE id = ?
      `).run(now, entry.id);

      // 2. Ensure barber status is Busy
      db.prepare(`
        UPDATE barbers
        SET status = 'Busy'
        WHERE id = ?
      `).run(barberId);

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    // Broadcast Socket.IO update
    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
      getIO().emit(SOCKET_EVENTS.SERVICE_STARTED, {
        entryId: entry.id,
        tokenNumber: entry.tokenNumber,
        customerName: entry.customerName,
        barberName: barber.name,
        serviceStartedAt: now,
      });
      getIO().emit(SOCKET_EVENTS.BARBER_STATUS_CHANGED, {
        barberId,
        barberName: barber.name,
        status: 'Busy',
      });
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      message: `Service started for ${entry.customerName} (${entry.tokenNumber}).`,
      entry: {
        id: entry.id,
        tokenNumber: entry.tokenNumber,
        customerName: entry.customerName,
        status: 'In Chair',
        serviceStartedAt: now,
      },
    });
  } catch (error: any) {
    console.error('Error starting service:', error);
    res.status(500).json({ error: 'FAILED_START_SERVICE' });
  }
});

/**
 * POST /api/barber/:id/done
 * Completes service for the customer In Chair.
 * Changes customer status from 'In Chair' to 'Done'.
 * Stops timer and frees barber back to 'Available'.
 */
router.post('/barber/:id/done', (req, res) => {
  try {
    const barberId = req.params.id;

    // Check barber exists
    const barber = db.prepare(`SELECT id, name, status FROM barbers WHERE id = ? AND active = 1`).get(barberId) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND' });
    }

    // Find In Chair customer assigned to this barber
    const entry = db.prepare(`
      SELECT id, token_number as tokenNumber, customer_name as customerName, status, service_started_at as serviceStartedAt
      FROM queue_entries
      WHERE assigned_barber_id = ? AND status = 'In Chair'
      LIMIT 1
    `).get(barberId) as any;

    if (!entry) {
      return res.status(400).json({
        error: 'NO_ACTIVE_SERVICE',
        message: 'No service is currently in progress.',
      });
    }

    const check = isValidStatusTransition(entry.status, 'Done', 'barber');
    if (!check.allowed) {
      return res.status(400).json({
        error: check.errorCode || 'INVALID_TRANSITION',
        message: check.errorMessage,
      });
    }

    const now = new Date().toISOString();

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Transition customer to 'Done'
      db.prepare(`
        UPDATE queue_entries
        SET status = 'Done', completed_at = ?
        WHERE id = ?
      `).run(now, entry.id);

      // 2. Free barber back to Available
      db.prepare(`
        UPDATE barbers
        SET status = 'Available'
        WHERE id = ?
      `).run(barberId);

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    // Broadcast Socket.IO update
    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
      getIO().emit(SOCKET_EVENTS.SERVICE_COMPLETED, {
        entryId: entry.id,
        tokenNumber: entry.tokenNumber,
        customerName: entry.customerName,
        barberName: barber.name,
        completedAt: now,
      });
      getIO().emit(SOCKET_EVENTS.BARBER_STATUS_CHANGED, {
        barberId,
        barberName: barber.name,
        status: 'Available',
      });
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      message: `Service completed for ${entry.customerName} (${entry.tokenNumber}). Barber is now Available.`,
      entry: {
        id: entry.id,
        tokenNumber: entry.tokenNumber,
        customerName: entry.customerName,
        status: 'Done',
        completedAt: now,
      },
    });
  } catch (error: any) {
    console.error('Error completing service:', error);
    res.status(500).json({ error: 'FAILED_COMPLETE_SERVICE' });
  }
});

/**
 * POST /api/barber/:id/status
 * Updates barber availability: 'Available' or 'On Break'.
 * Rule: Cannot go on break while serving a customer (status In Chair or Called).
 */
router.post('/barber/:id/status', (req, res) => {
  try {
    const barberId = req.params.id;
    const { status } = req.body;

    if (!status || !['Available', 'On Break'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be Available or On Break.' });
    }

    const barber = db.prepare(`SELECT id, name, status FROM barbers WHERE id = ? AND active = 1`).get(barberId) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND' });
    }

    // Rule R4: Cannot go On Break while holding a Called or In Chair customer
    if (status === 'On Break') {
      const activeCustomer = db.prepare(`
        SELECT id, token_number as tokenNumber 
        FROM queue_entries 
        WHERE assigned_barber_id = ? AND status IN ('Called', 'In Chair')
        LIMIT 1
      `).get(barberId) as any;

      if (activeCustomer) {
        return res.status(400).json({
          error: 'CANNOT_BREAK_WHILE_SERVING',
          message: 'Finish the current service first before going on break.',
        });
      }
    }

    const now = new Date().toISOString();
    const breakStartedAt = status === 'On Break' ? now : null;

    db.prepare(`
      UPDATE barbers
      SET status = ?, break_started_at = ?
      WHERE id = ?
    `).run(status, breakStartedAt, barberId);

    // Broadcast Socket.IO update
    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
      getIO().emit(SOCKET_EVENTS.BARBER_STATUS_CHANGED, {
        barberId,
        barberName: barber.name,
        status,
        breakStartedAt,
      });
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      status,
      breakStartedAt,
      message: status === 'On Break' ? `${barber.name} is now on break.` : `${barber.name} is now available.`,
    });
  } catch (error: any) {
    console.error('Error updating barber status:', error);
    res.status(500).json({ error: 'FAILED_UPDATE_BARBER_STATUS' });
  }
});

export default router;
