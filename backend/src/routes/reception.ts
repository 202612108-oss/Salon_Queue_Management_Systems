import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { getIO } from '../sockets/index.js';
import {
  selectNextCustomerToCall,
  isWaitOver60Minutes,
  isValidStatusTransition,
  validateCustomerName,
  validatePhoneNumber,
  validateServicesSelection,
  calculateServicesTotals,
  generateTokenNumber,
  BarberState,
  WaitingQueueEntry,
} from '../rules/index.js';

const router = Router();

/**
 * GET /api/reception/dashboard
 * Fetches all data for the tablet-friendly Reception Dashboard
 */
router.get('/reception/dashboard', (_req, res) => {
  try {
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];

    // 1. Top Section Metrics
    const settingsRow = db.prepare('SELECT value FROM salon_settings WHERE key = ?').get('salon_name') as { value: string } | undefined;
    const salonName = settingsRow?.value || 'Royal Cuts Lounge';

    const waitingCountStmt = db.prepare(`SELECT COUNT(*) as count FROM queue_entries WHERE status = 'Waiting'`);
    const totalWaiting = (waitingCountStmt.get() as { count: number }).count;

    const servedTodayStmt = db.prepare(`
      SELECT COUNT(*) as count FROM queue_entries 
      WHERE status = 'Done' AND date(completed_at) = date(?)
    `);
    const customersServedToday = (servedTodayStmt.get() as { count: number }).count;

    // Calculate average wait time (minutes) for entries today
    const waitTimesRows = db.prepare(`
      SELECT (strftime('%s', called_at) - strftime('%s', joined_at)) as waitSeconds
      FROM queue_entries
      WHERE called_at IS NOT NULL AND date(joined_at) = date(?)
    `).all(todayDate) as { waitSeconds: number }[];

    let averageWaitMinutes = 15; // default fallback
    if (waitTimesRows.length > 0) {
      const totalSec = waitTimesRows.reduce((sum, r) => sum + Math.max(0, r.waitSeconds), 0);
      averageWaitMinutes = Math.round(totalSec / waitTimesRows.length / 60);
    }

    // 2. Left Section: Barbers (Ravi, Amit, Imran)
    const barbersRows = db.prepare(`
      SELECT id, name, slug, active, working_today as workingToday, status, break_started_at as breakStartedAt
      FROM barbers
      WHERE active = 1
      ORDER BY name ASC
    `).all() as any[];

    const barbers = barbersRows.map(b => {
      // Find current active customer assigned to this barber (Called or In Chair)
      const currentEntry = db.prepare(`
        SELECT 
          q.id, q.token_number as tokenNumber, q.customer_name as customerName,
          q.status, q.called_at as calledAt, q.service_started_at as serviceStartedAt,
          q.total_duration_minutes as totalDurationMinutes,
          (
            SELECT GROUP_CONCAT(name_en, ', ')
            FROM queue_entry_services
            WHERE entry_id = q.id
          ) as serviceNames
        FROM queue_entries q
        WHERE q.assigned_barber_id = ? AND q.status IN ('Called', 'In Chair')
        LIMIT 1
      `).get(b.id) as any;

      // Count waiting customers who preferred this barber
      const waitCount = (db.prepare(`
        SELECT COUNT(*) as count FROM queue_entries
        WHERE preferred_barber_id = ? AND status = 'Waiting'
      `).get(b.id) as { count: number }).count;

      const isOccupied = Boolean(currentEntry);
      const isAvailable = b.workingToday === 1 && b.status === 'Available' && !isOccupied;

      // Compute elapsed service timer in seconds
      let elapsedSeconds = 0;
      if (currentEntry) {
        const timeRef = currentEntry.serviceStartedAt || currentEntry.calledAt;
        if (timeRef) {
          elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(timeRef).getTime()) / 1000));
        }
      }

      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        status: b.status,
        workingToday: Boolean(b.workingToday),
        isAvailable,
        isOccupied,
        waitingCount: waitCount,
        currentCustomer: currentEntry ? {
          id: currentEntry.id,
          tokenNumber: currentEntry.tokenNumber,
          customerName: currentEntry.customerName,
          serviceName: currentEntry.serviceNames || 'Salon Service',
          status: currentEntry.status,
          totalDurationMinutes: currentEntry.totalDurationMinutes,
          elapsedSeconds,
        } : null,
      };
    });

    // 3. Right Section: Live Waiting List (Waiting & Called)
    const queueRows = db.prepare(`
      SELECT 
        q.id, q.token_number as tokenNumber, q.customer_name as customerName,
        q.customer_phone as customerPhone, q.preferred_barber_id as preferredBarberId,
        q.assigned_barber_id as assignedBarberId, q.status, q.source,
        q.total_duration_minutes as totalDurationMinutes, q.total_price as totalPrice,
        q.joined_at as joinedAt, q.called_at as calledAt,
        b.name as assignedBarberName, pb.name as preferredBarberName
      FROM queue_entries q
      LEFT JOIN barbers b ON q.assigned_barber_id = b.id
      LEFT JOIN barbers pb ON q.preferred_barber_id = pb.id
      WHERE q.status IN ('Waiting', 'Called')
      ORDER BY CASE WHEN q.status = 'Called' THEN 0 ELSE 1 END, q.joined_at ASC, q.token_number ASC
    `).all() as any[];

    const waitingList = queueRows.map(row => {
      // Services summary string
      const services = db.prepare(`
        SELECT name_en as nameEn, duration_minutes as durationMinutes, price
        FROM queue_entry_services
        WHERE entry_id = ?
      `).all(row.id) as { nameEn: string; durationMinutes: number; price: number }[];

      const servicesSummary = services.map(s => s.nameEn).join(', ') || 'Service';

      // Waiting duration so far
      const joinedTime = new Date(row.joinedAt).getTime();
      const waitMinutesSoFar = Math.max(0, Math.floor((now.getTime() - joinedTime) / (1000 * 60)));
      const isOver60Min = isWaitOver60Minutes(row.joinedAt, now);

      return {
        id: row.id,
        tokenNumber: row.tokenNumber,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        preferredBarberId: row.preferredBarberId,
        preferredBarberName: row.preferredBarberName,
        assignedBarberId: row.assignedBarberId,
        assignedBarberName: row.assignedBarberName,
        status: row.status,
        source: row.source,
        servicesSummary,
        services,
        totalDurationMinutes: row.totalDurationMinutes,
        totalPrice: row.totalPrice,
        joinedAt: row.joinedAt,
        calledAt: row.calledAt,
        waitMinutesSoFar,
        isOver60Min,
      };
    });

    res.json({
      topSection: {
        salonName,
        totalWaiting,
        customersServedToday,
        averageWaitMinutes,
        currentTime: now.toISOString(),
      },
      barbers,
      waitingList,
    });
  } catch (error: any) {
    console.error('Error fetching reception dashboard:', error);
    res.status(500).json({ error: 'FAILED_RECEPTION_DASHBOARD' });
  }
});

/**
 * POST /api/reception/call-next
 * Calls the next eligible customer respecting barber preferences
 */
router.post('/reception/call-next', (req, res) => {
  try {
    const { barberId } = req.body || {};

    // 1. Fetch waiting entries in queue order
    const waitingRows = db.prepare(`
      SELECT id, token_number as tokenNumber, customer_name as customerName, preferred_barber_id as preferredBarberId, joined_at as joinedAt
      FROM queue_entries
      WHERE status = 'Waiting'
      ORDER BY joined_at ASC, token_number ASC
    `).all() as unknown as WaitingQueueEntry[];

    // 2. Fetch barbers state
    const barbersRows = db.prepare(`
      SELECT 
        b.id, b.name, b.working_today as workingToday, b.status,
        (
          SELECT COUNT(*) 
          FROM queue_entries q 
          WHERE q.assigned_barber_id = b.id AND q.status IN ('Called', 'In Chair')
        ) as occupiedCount,
        (
          SELECT COUNT(*)
          FROM queue_entries q
          WHERE q.assigned_barber_id = b.id AND q.status = 'Done' AND date(q.completed_at) = date('now')
        ) as servedCount
      FROM barbers b
      WHERE b.active = 1
    `).all() as any[];

    const barbersState: BarberState[] = barbersRows.map(b => ({
      id: b.id,
      name: b.name,
      workingToday: Boolean(b.workingToday),
      status: b.status,
      isOccupied: b.occupiedCount > 0,
      customersServedToday: b.servedCount,
    }));

    // 3. Apply Rule R3 via pure logic rules
    const result = selectNextCustomerToCall(waitingRows, barbersState, barberId || null);

    if (!result.entry || !result.assignedBarber) {
      const messages: Record<string, string> = {
        NO_WAITING_CUSTOMERS: 'No customers are waiting in the queue.',
        NO_AVAILABLE_BARBERS: 'All barbers are currently occupied or on break.',
        TARGET_BARBER_NOT_AVAILABLE: 'This barber is currently occupied or unavailable.',
        NO_ELIGIBLE_CUSTOMERS: 'No waiting customer can be served by an available barber right now.',
      };
      return res.status(400).json({
        error: result.failureReason || 'NO_ELIGIBLE_CUSTOMER',
        message: messages[result.failureReason || ''] || 'No eligible customer to call.',
        skippedEntries: result.skippedEntries,
      });
    }

    // 4. Update the selected entry to 'Called'
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries
      SET status = 'Called', called_at = ?, assigned_barber_id = ?
      WHERE id = ?
    `).run(now, result.assignedBarber.id, result.entry.id);

    // Update barber status to Busy if they were Available
    db.prepare(`
      UPDATE barbers
      SET status = 'Busy'
      WHERE id = ?
    `).run(result.assignedBarber.id);

    // Broadcast Socket.IO update
    try {
      getIO().emit('queue:updated');
      getIO().emit('customer:called', {
        entryId: result.entry.id,
        tokenNumber: result.entry.tokenNumber,
        customerName: result.entry.customerName,
        barberName: result.assignedBarber.name,
      });
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      calledCustomer: {
        id: result.entry.id,
        tokenNumber: result.entry.tokenNumber,
        customerName: result.entry.customerName,
      },
      assignedBarber: {
        id: result.assignedBarber.id,
        name: result.assignedBarber.name,
      },
      skippedEntries: result.skippedEntries,
    });
  } catch (error: any) {
    console.error('Error calling next customer:', error);
    res.status(500).json({ error: 'FAILED_CALL_NEXT' });
  }
});

/**
 * POST /api/reception/no-show/:id
 * Marks a Called customer as No-show and frees the barber
 * Enforces Rule R6: At least 10 minutes must have passed since calling
 */
router.post('/reception/no-show/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare(`
      SELECT id, token_number, status, called_at, assigned_barber_id
      FROM queue_entries
      WHERE id = ?
    `).get(id) as any;

    if (!entry) {
      return res.status(404).json({ error: 'ENTRY_NOT_FOUND', message: 'Queue entry not found.' });
    }

    // Enforce Rule R6 & state machine transition
    const transitionCheck = isValidStatusTransition(entry.status, 'No-show', 'receptionist', {
      calledAt: entry.called_at,
    });

    if (!transitionCheck.allowed) {
      return res.status(400).json({
        error: transitionCheck.errorCode || 'CANNOT_MARK_NO_SHOW',
        message: transitionCheck.errorMessage,
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries
      SET status = 'No-show', no_show_at = ?
      WHERE id = ?
    `).run(now, id);

    // Free the assigned barber if they have no other active customer
    if (entry.assigned_barber_id) {
      const activeCount = (db.prepare(`
        SELECT COUNT(*) as count FROM queue_entries
        WHERE assigned_barber_id = ? AND status IN ('Called', 'In Chair') AND id != ?
      `).get(entry.assigned_barber_id, id) as { count: number }).count;

      if (activeCount === 0) {
        db.prepare(`UPDATE barbers SET status = 'Available' WHERE id = ?`).run(entry.assigned_barber_id);
      }
    }

    try {
      getIO().emit('queue:updated');
    } catch (e) {}

    res.json({ success: true, message: `Token ${entry.token_number} marked as No-show.` });
  } catch (error: any) {
    console.error('Error marking no-show:', error);
    res.status(500).json({ error: 'FAILED_MARK_NO_SHOW' });
  }
});

/**
 * POST /api/reception/cancel/:id
 * Receptionist cancels a Waiting or Called customer
 * Disallows cancelling In Chair customers (must complete with Done)
 */
router.post('/reception/cancel/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare(`
      SELECT id, token_number, status, assigned_barber_id
      FROM queue_entries
      WHERE id = ?
    `).get(id) as any;

    if (!entry) {
      return res.status(404).json({ error: 'ENTRY_NOT_FOUND', message: 'Queue entry not found.' });
    }

    const transitionCheck = isValidStatusTransition(entry.status, 'Cancelled', 'receptionist');
    if (!transitionCheck.allowed) {
      return res.status(400).json({
        error: transitionCheck.errorCode || 'CANNOT_CANCEL',
        message: transitionCheck.errorMessage,
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries
      SET status = 'Cancelled', cancelled_at = ?
      WHERE id = ?
    `).run(now, id);

    // Free the assigned barber if reserved
    if (entry.assigned_barber_id) {
      const activeCount = (db.prepare(`
        SELECT COUNT(*) as count FROM queue_entries
        WHERE assigned_barber_id = ? AND status IN ('Called', 'In Chair') AND id != ?
      `).get(entry.assigned_barber_id, id) as { count: number }).count;

      if (activeCount === 0) {
        db.prepare(`UPDATE barbers SET status = 'Available' WHERE id = ?`).run(entry.assigned_barber_id);
      }
    }

    try {
      getIO().emit('queue:updated');
    } catch (e) {}

    res.json({ success: true, message: `Token ${entry.token_number} cancelled.` });
  } catch (error: any) {
    console.error('Error cancelling queue entry:', error);
    res.status(500).json({ error: 'FAILED_CANCEL' });
  }
});

/**
 * POST /api/reception/walk-in
 * Adds a walk-in customer from reception
 */
router.post('/reception/walk-in', (req, res) => {
  try {
    const { customerName, serviceIds, preferredBarberId } = req.body;
    const customerPhone = req.body.customerPhone || req.body.phone || '';

    const nameCheck = validateCustomerName(customerName);
    if (!nameCheck.valid) {
      return res.status(400).json({ error: nameCheck.error || 'INVALID_NAME' });
    }

    // Phone validation (required or valid 10-digit)
    const phoneCheck = validatePhoneNumber(customerPhone || '');
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.error || 'INVALID_PHONE' });
    }

    // Prevent duplicate active entry
    const activeEntry = db.prepare(`
      SELECT token_number as tokenNumber FROM queue_entries
      WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')
      LIMIT 1
    `).get(phoneCheck.normalized) as any;

    if (activeEntry) {
      return res.status(409).json({
        error: 'DUPLICATE_ACTIVE_ENTRY',
        message: `This phone number is already active with token ${activeEntry.tokenNumber}.`,
      });
    }

    // Validate services
    const availableServices = (db.prepare(`SELECT id, name_en as nameEn, duration_minutes as durationMinutes, price, active FROM services`).all() as any[]).map(s => ({ ...s, active: Boolean(s.active) }));
    const servicesCheck = validateServicesSelection(serviceIds, availableServices);
    if (!servicesCheck.valid || !servicesCheck.selectedServices) {
      return res.status(400).json({ error: servicesCheck.error || 'INVALID_SERVICES' });
    }

    // Validate preferred barber if chosen
    let barberId: string | null = null;
    if (preferredBarberId) {
      const barber = db.prepare(`SELECT id FROM barbers WHERE id = ? AND active = 1 AND working_today = 1`).get(preferredBarberId);
      if (!barber) return res.status(400).json({ error: 'BARBER_UNAVAILABLE' });
      barberId = preferredBarberId;
    }

    const { totalPrice, totalDurationMinutes } = calculateServicesTotals(servicesCheck.selectedServices);

    const entryId = crypto.randomUUID();
    const joinedAt = new Date().toISOString();
    let tokenNumber = '';

    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      // Re-check duplicate phone within write lock
      const duplicateWithinLock = db.prepare(`
        SELECT token_number as tokenNumber FROM queue_entries
        WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')
        LIMIT 1
      `).get(phoneCheck.normalized) as any;

      if (duplicateWithinLock) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          error: 'DUPLICATE_ACTIVE_ENTRY',
          message: `This phone number is already active with token ${duplicateWithinLock.tokenNumber}.`,
        });
      }

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
        ) VALUES (?, ?, ?, ?, ?, NULL, 'Waiting', 'walk-in', ?, ?, ?)
      `).run(entryId, tokenNumber, customerName.trim(), phoneCheck.normalized, barberId, totalDurationMinutes, totalPrice, joinedAt);

      const insertService = db.prepare(`
        INSERT INTO queue_entry_services (entry_id, service_id, name_en, duration_minutes, price)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const srv of servicesCheck.selectedServices) {
        insertService.run(entryId, srv.id, srv.nameEn, srv.durationMinutes, srv.price);
      }
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    try {
      getIO().emit('queue:updated');
    } catch (e) {}

    res.status(201).json({
      success: true,
      entry: {
        id: entryId,
        tokenNumber,
        customerName: customerName.trim(),
        totalPrice,
        totalDurationMinutes,
      },
    });
  } catch (error: any) {
    console.error('Error adding walk-in:', error);
    res.status(500).json({ error: 'FAILED_ADD_WALK_IN' });
  }
});

/**
 * POST /api/reception/seed-dummy-data
 * Seeds 8 realistic dummy customers for comprehensive testing
 */
router.post('/reception/seed-dummy-data', (_req, res) => {
  try {
    // Check if queue has entries today
    const todayDate = new Date().toISOString().split('T')[0];
    const countRow = db.prepare(`
      SELECT COUNT(*) as count, MAX(CAST(SUBSTR(token_number, 3) AS INTEGER)) as maxSeq
      FROM queue_entries
      WHERE date(joined_at) = date(?)
    `).get(todayDate) as { count: number; maxSeq: number | null };
    
    // We seed 8 dummy customers with varied join times, services, and preferences
    const now = new Date();
    
    const dummyCustomers = [
      {
        name: 'Rohan Sharma',
        phone: '9811122233',
        services: ['srv-1'], // Haircut (30m, ₹150)
        barberSlug: 'ravi', // Ravi
        minutesAgo: 75, // > 60 min! Will test > 60 min highlight!
      },
      {
        name: 'Manish Verma',
        phone: '9822233344',
        services: ['srv-1', 'srv-2'], // Haircut + Beard Trim (45m, ₹230)
        barberSlug: null, // Any Barber
        minutesAgo: 65, // > 60 min! Will test > 60 min highlight!
      },
      {
        name: 'Suresh Patel',
        phone: '9833344455',
        services: ['srv-2'], // Beard Trim (15m, ₹80)
        barberSlug: 'amit', // Amit
        minutesAgo: 45,
      },
      {
        name: 'Vikram Joshi',
        phone: '9844455566',
        services: ['srv-3'], // Hair Spa (45m, ₹400)
        barberSlug: 'ravi', // Ravi
        minutesAgo: 35,
      },
      {
        name: 'Deepak Rao',
        phone: '9855566677',
        services: ['srv-5'], // Facial (30m, ₹300)
        barberSlug: 'imran', // Imran
        minutesAgo: 25,
      },
      {
        name: 'Pooja Bhatt',
        phone: '9866677788',
        services: ['srv-4'], // Hair Colour (60m, ₹600)
        barberSlug: null, // Any Barber
        minutesAgo: 20,
      },
      {
        name: 'Kunal Shah',
        phone: '9877788899',
        services: ['srv-1', 'srv-5'], // Haircut + Facial (60m, ₹450)
        barberSlug: 'amit', // Amit
        minutesAgo: 12,
      },
      {
        name: 'Anand Nair',
        phone: '9888899900',
        services: ['srv-2', 'srv-3'], // Beard Trim + Hair Spa (60m, ₹480)
        barberSlug: null, // Any Barber
        minutesAgo: 5,
      },
    ];

    const raviId = (db.prepare(`SELECT id FROM barbers WHERE slug = 'ravi'`).get() as any)?.id;
    const amitId = (db.prepare(`SELECT id FROM barbers WHERE slug = 'amit'`).get() as any)?.id;
    const imranId = (db.prepare(`SELECT id FROM barbers WHERE slug = 'imran'`).get() as any)?.id;

    const barberMap: Record<string, string> = {
      ravi: raviId,
      amit: amitId,
      imran: imranId,
    };

    let inserted = 0;
    let seq = Math.max(countRow.count, countRow.maxSeq || 0);

    // If active queue entries already exist today, ensure re-seeded or added entries get timestamps after the latest entry
    const latestExisting = db.prepare(`
      SELECT joined_at FROM queue_entries
      WHERE date(joined_at) = date(?)
      ORDER BY joined_at DESC
      LIMIT 1
    `).get(todayDate) as { joined_at: string } | undefined;
    const hasPriorEntries = Boolean(latestExisting);

    db.exec('BEGIN TRANSACTION;');
    try {
      // Reset barbers to Available
      db.prepare("UPDATE barbers SET status = 'Available' WHERE active = 1").run();

      // Clear any previous active entries for dummy customer phones so exactly 8 fresh dummy entries are seeded
      const dummyPhones = dummyCustomers.map(c => c.phone);
      db.prepare(`
        UPDATE queue_entries 
        SET status = 'Cancelled' 
        WHERE customer_phone IN (${dummyPhones.map(() => '?').join(',')}) AND status IN ('Waiting', 'Called', 'In Chair')
      `).run(...dummyPhones);

      for (const cust of dummyCustomers) {
        // Skip if phone already active
        const existing = db.prepare(`SELECT id FROM queue_entries WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')`).get(cust.phone);
        if (existing) continue;

        seq += 1;
        const tokenNumber = generateTokenNumber(seq);
        const entryId = crypto.randomUUID();
        // If prior entries exist, timestamp after latest existing so they join at the end; otherwise use minutesAgo
        const joinedAt = hasPriorEntries
          ? new Date(Date.now() + (inserted + 1) * 1000).toISOString()
          : new Date(now.getTime() - cust.minutesAgo * 60 * 1000).toISOString();
        inserted += 1;
        const barberId = cust.barberSlug ? barberMap[cust.barberSlug] : null;

        // Calculate totals
        const services = db.prepare(`SELECT id, name_en, duration_minutes, price FROM services WHERE id IN (${cust.services.map(() => '?').join(',')})`).all(...cust.services) as any[];
        const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
        const totalDurationMinutes = services.reduce((sum, s) => sum + s.duration_minutes, 0);

        db.prepare(`
          INSERT INTO queue_entries (
            id, token_number, customer_name, customer_phone,
            preferred_barber_id, assigned_barber_id, status, source,
            total_duration_minutes, total_price, joined_at
          ) VALUES (?, ?, ?, ?, ?, NULL, 'Waiting', 'online', ?, ?, ?)
        `).run(entryId, tokenNumber, cust.name, cust.phone, barberId, totalDurationMinutes, totalPrice, joinedAt);

        const insertSrv = db.prepare(`INSERT INTO queue_entry_services (entry_id, service_id, name_en, duration_minutes, price) VALUES (?, ?, ?, ?, ?)`);
        for (const s of services) {
          insertSrv.run(entryId, s.id, s.name_en, s.duration_minutes, s.price);
        }

        inserted += 1;
      }
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    try {
      getIO().emit('queue:updated');
    } catch (e) {}

    res.json({ success: true, count: inserted, message: `Seeded ${inserted} realistic dummy customers.` });
  } catch (error: any) {
    console.error('Error seeding dummy queue data:', error);
    res.status(500).json({ error: 'FAILED_SEED_DUMMY_DATA' });
  }
});

export default router;
