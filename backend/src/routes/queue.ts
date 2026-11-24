import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { getIO } from '../sockets/index.js';
import {
  validateCustomerName,
  validatePhoneNumber,
  validateServicesSelection,
  calculateServicesTotals,
  calculateEstimatedWaitTime,
  isOnlineJoiningAllowed,
  generateTokenNumber,
  isValidStatusTransition,
} from '../rules/index.js';

const router = Router();

/**
 * POST /api/queue/join
 * Registers a new customer into the queue (Online or Walk-in)
 */
router.post('/queue/join', (req, res) => {
  try {
    const { customerName, customerPhone, serviceIds, preferredBarberId, source = 'online' } = req.body;

    // 1. Validate customer name
    const nameCheck = validateCustomerName(customerName);
    if (!nameCheck.valid) {
      return res.status(400).json({ error: nameCheck.error || 'INVALID_NAME' });
    }

    // 2. Validate customer phone
    const phoneCheck = validatePhoneNumber(customerPhone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.error || 'INVALID_PHONE' });
    }
    const normalizedPhone = phoneCheck.normalized;

    // 3. Check online joining cutoff / closed / paused if joining online
    if (source === 'online') {
      const settingsRows = db.prepare('SELECT key, value FROM salon_settings').all() as { key: string; value: string }[];
      const settingsMap: Record<string, string> = {};
      for (const row of settingsRows) {
        settingsMap[row.key] = row.value;
      }
      const isOpen = settingsMap['is_open'] === '1';
      const isPaused = settingsMap['is_paused'] === '1';
      const closingTime = settingsMap['closing_time'] || '23:00';

      const joinCheck = isOnlineJoiningAllowed({ isOpen, isPaused, closingTime });
      if (!joinCheck.allowed) {
        return res.status(403).json({
          error: 'JOINING_CLOSED',
          reason: joinCheck.reason
        });
      }
    }

    // 4. Rule R5: One active queue entry per phone number
    const activeEntry = db.prepare(`
      SELECT id, token_number as tokenNumber, customer_name as customerName, status
      FROM queue_entries
      WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')
      LIMIT 1
    `).get(normalizedPhone) as { id: string; tokenNumber: string; customerName: string; status: string } | undefined;

    if (activeEntry) {
      return res.status(409).json({
        error: 'DUPLICATE_ACTIVE_ENTRY',
        message: 'This phone number is already active in the queue.',
        existingToken: activeEntry.tokenNumber,
        existingId: activeEntry.id,
      });
    }

    // 5. Validate selected services (1 to 3 services)
    const availableServices = (db.prepare(`
      SELECT id, name_en as nameEn, duration_minutes as durationMinutes, price, active
      FROM services
    `).all() as any[]).map(s => ({ ...s, active: Boolean(s.active) }));

    const servicesCheck = validateServicesSelection(serviceIds, availableServices);
    if (!servicesCheck.valid || !servicesCheck.selectedServices) {
      return res.status(400).json({ error: servicesCheck.error || 'INVALID_SERVICES' });
    }
    const selectedServices = servicesCheck.selectedServices;

    // 6. Validate preferred barber (if specified)
    let barberId: string | null = null;
    let preferredBarberName: string | null = null;
    if (preferredBarberId) {
      const barber = db.prepare(`
        SELECT id, name, active, working_today as workingToday
        FROM barbers
        WHERE id = ? AND active = 1 AND working_today = 1
      `).get(preferredBarberId) as { id: string; name: string } | undefined;

      if (!barber) {
        return res.status(400).json({ error: 'BARBER_UNAVAILABLE' });
      }
      barberId = barber.id;
      preferredBarberName = barber.name;
    }

    // 7. Calculate totals
    const { totalPrice, totalDurationMinutes } = calculateServicesTotals(selectedServices);

    // 8. Insert queue entry in immediate transaction for concurrency safety
    const entryId = crypto.randomUUID();
    const joinedAt = new Date().toISOString();
    let tokenNumber = '';

    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      // Re-check duplicate phone within write lock to prevent race conditions
      const duplicateWithinLock = db.prepare(`
        SELECT id, token_number as tokenNumber
        FROM queue_entries
        WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')
        LIMIT 1
      `).get(normalizedPhone) as { id: string; tokenNumber: string } | undefined;

      if (duplicateWithinLock) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          error: 'DUPLICATE_ACTIVE_ENTRY',
          message: 'This phone number is already active in the queue.',
          existingToken: duplicateWithinLock.tokenNumber,
          existingId: duplicateWithinLock.id,
        });
      }

      // Generate sequential daily token within transaction (strictly monotonic)
      const todayDate = joinedAt.split('T')[0];
      const countRow = db.prepare(`
        SELECT COUNT(*) as count, MAX(CAST(SUBSTR(token_number, 3) AS INTEGER)) as maxSeq
        FROM queue_entries
        WHERE date(joined_at) = date(?)
      `).get(todayDate) as { count: number; maxSeq: number | null };
      const nextSeq = Math.max(countRow.count, countRow.maxSeq || 0) + 1;
      tokenNumber = generateTokenNumber(nextSeq);

      db.prepare(`
        INSERT INTO queue_entries (
          id, token_number, customer_name, customer_phone,
          preferred_barber_id, assigned_barber_id, status, source,
          total_duration_minutes, total_price, joined_at
        ) VALUES (?, ?, ?, ?, ?, NULL, 'Waiting', ?, ?, ?, ?)
      `).run(
        entryId,
        tokenNumber,
        customerName.trim(),
        normalizedPhone,
        barberId,
        source,
        totalDurationMinutes,
        totalPrice,
        joinedAt
      );

      const insertService = db.prepare(`
        INSERT INTO queue_entry_services (entry_id, service_id, name_en, duration_minutes, price)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const srv of selectedServices) {
        insertService.run(entryId, srv.id, srv.nameEn, srv.durationMinutes, srv.price);
      }

      db.exec('COMMIT;');
    } catch (dbErr) {
      db.exec('ROLLBACK;');
      throw dbErr;
    }

    // 10. Calculate position and estimated wait
    const activeAhead = db.prepare(`
      SELECT id, status, total_duration_minutes as totalDurationMinutes, service_started_at as serviceStartedAt
      FROM queue_entries
      WHERE status IN ('Waiting', 'Called', 'In Chair') AND joined_at < ?
      ORDER BY joined_at ASC
    `).all(joinedAt) as any[];

    const workingBarbers = db.prepare(`
      SELECT COUNT(*) as count FROM barbers WHERE active = 1 AND working_today = 1 AND status != 'Off'
    `).get() as { count: number };

    const estimatedWait = calculateEstimatedWaitTime(activeAhead, workingBarbers.count);
    // Queue position counts all Waiting and Called customers ahead (docs/03-flows-rules.md Section 2.1)
    const position = activeAhead.filter(e => e.status === 'Waiting' || e.status === 'Called').length + 1;

    // 11. Broadcast Socket.IO event
    try {
      getIO().emit('queue:updated');
    } catch (e) {
      console.warn('Socket broadcast skipped:', e);
    }

    res.status(201).json({
      success: true,
      entry: {
        id: entryId,
        tokenNumber,
        customerName: customerName.trim(),
        customerPhone: normalizedPhone,
        preferredBarberId: barberId,
        preferredBarberName,
        status: 'Waiting',
        totalPrice,
        totalDurationMinutes,
        position,
        estimatedWaitMinutes: estimatedWait,
        joinedAt,
        services: selectedServices.map(s => ({
          serviceId: s.id,
          nameEn: s.nameEn,
          durationMinutes: s.durationMinutes,
          price: s.price,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error joining queue:', error);
    res.status(500).json({ error: 'FAILED_JOIN_QUEUE' });
  }
});

/**
 * GET /api/queue/:id
 * Returns a specific queue entry with updated position and wait estimate
 */
router.get('/queue/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare(`
      SELECT 
        q.id, q.token_number as tokenNumber, q.customer_name as customerName,
        q.customer_phone as customerPhone, q.preferred_barber_id as preferredBarberId,
        q.assigned_barber_id as assignedBarberId, q.status, q.source,
        q.total_duration_minutes as totalDurationMinutes, q.total_price as totalPrice,
        q.joined_at as joinedAt, q.called_at as calledAt, q.service_started_at as serviceStartedAt,
        q.completed_at as completedAt, q.cancelled_at as cancelledAt, q.no_show_at as noShowAt,
        b.name as assignedBarberName, pb.name as preferredBarberName,
        pb.status as preferredBarberStatus
      FROM queue_entries q
      LEFT JOIN barbers b ON q.assigned_barber_id = b.id
      LEFT JOIN barbers pb ON q.preferred_barber_id = pb.id
      WHERE q.id = ?
    `).get(id) as any;

    if (!entry) {
      return res.status(404).json({ error: 'QUEUE_ENTRY_NOT_FOUND', message: 'Queue entry not found.' });
    }

    const services = db.prepare(`
      SELECT service_id as serviceId, name_en as nameEn, duration_minutes as durationMinutes, price
      FROM queue_entry_services
      WHERE entry_id = ?
    `).all(id);

    // Calculate position and estimated wait
    let position: number | null = null;
    let estimatedWaitMinutes = 0;

    if (entry.status === 'Waiting') {
      const activeAhead = db.prepare(`
        SELECT id, status, total_duration_minutes as totalDurationMinutes, service_started_at as serviceStartedAt
        FROM queue_entries
        WHERE status IN ('Waiting', 'Called', 'In Chair') AND joined_at < ?
        ORDER BY joined_at ASC
      `).all(entry.joinedAt) as any[];

      const workingBarbers = db.prepare(`
        SELECT COUNT(*) as count FROM barbers WHERE active = 1 AND working_today = 1 AND status != 'Off'
      `).get() as { count: number };

      estimatedWaitMinutes = calculateEstimatedWaitTime(activeAhead, workingBarbers.count);
      // Queue position counts all Waiting and Called customers ahead (docs/03-flows-rules.md Section 2.1)
      position = activeAhead.filter(e => e.status === 'Waiting' || e.status === 'Called').length + 1;
    } else if (entry.status === 'Called') {
      position = 1;
      estimatedWaitMinutes = 0;
    } else if (entry.status === 'In Chair') {
      position = 0;
      estimatedWaitMinutes = 0;
    }

    res.json({
      ...entry,
      isPreferredBarberOnBreak: entry.preferredBarberStatus === 'On Break',
      services,
      position,
      estimatedWaitMinutes,
    });
  } catch (error: any) {
    console.error('Error fetching queue entry:', error);
    res.status(500).json({ error: 'FAILED_FETCH_QUEUE_ENTRY' });
  }
});

/**
 * POST /api/queue/:id/cancel
 * Cancels a queue entry.
 * Requirement: "Cancellation should only work while Waiting."
 */
router.post('/queue/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare(`
      SELECT id, status, customer_name as customerName, customer_phone as customerPhone, token_number as tokenNumber
      FROM queue_entries
      WHERE id = ?
    `).get(id) as any;

    if (!entry) {
      return res.status(404).json({ error: 'QUEUE_ENTRY_NOT_FOUND', message: 'Queue entry not found.' });
    }

    // Cancellation should only work while Waiting (validated via state machine)
    const transitionCheck = isValidStatusTransition(entry.status, 'Cancelled', 'customer');
    if (!transitionCheck.allowed) {
      return res.status(400).json({
        error: transitionCheck.errorCode || 'CANNOT_CANCEL_STATUS',
        message: transitionCheck.errorMessage || `Cancellation is only allowed while waiting. Current status: ${entry.status}.`,
        currentStatus: entry.status,
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries
      SET status = 'Cancelled', cancelled_at = ?
      WHERE id = ?
    `).run(now, id);

    // Broadcast Socket.IO event so other screens update live
    try {
      getIO().emit('queue:updated');
    } catch (e) {
      console.warn('Socket broadcast error:', e);
    }

    res.json({
      success: true,
      message: 'Queue spot has been cancelled.',
      entry: {
        id: entry.id,
        status: 'Cancelled',
        cancelledAt: now,
        tokenNumber: entry.tokenNumber,
      },
    });
  } catch (error: any) {
    console.error('Error cancelling queue entry:', error);
    res.status(500).json({ error: 'FAILED_CANCEL_QUEUE_ENTRY' });
  }
});

/**
 * GET /api/queue/by-phone/:phone
 * Checks if a phone number currently has an active queue entry
 */
router.get('/queue/by-phone/:phone', (req, res) => {
  try {
    const { phone } = req.params;
    const phoneCheck = validatePhoneNumber(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: 'INVALID_PHONE' });
    }

    const activeEntry = db.prepare(`
      SELECT id, token_number as tokenNumber, customer_name as customerName, status, joined_at as joinedAt
      FROM queue_entries
      WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')
      LIMIT 1
    `).get(phoneCheck.normalized) as any;

    res.json({ activeEntry: activeEntry || null });
  } catch (error: any) {
    console.error('Error fetching by phone:', error);
    res.status(500).json({ error: 'FAILED_FETCH_BY_PHONE' });
  }
});

export default router;
