import { Router } from 'express';
import { db } from '../db/index.js';
import { getIO } from '../sockets/index.js';
import { SOCKET_EVENTS } from '@salon/shared';

const router = Router();

/**
 * GET /api/admin/dashboard
 * Aggregates all data needed for Screen 7 Owner Settings:
 * - Services list
 * - Barbers list
 * - Queue settings & hours
 * - Daily statistics
 */
router.get('/admin/dashboard', (_req, res) => {
  try {
    const todayDate = new Date().toISOString().split('T')[0];

    // 1. Services Management List
    const services = db.prepare(`
      SELECT 
        id, 
        name_en as nameEn, 
        name_gu as nameGu, 
        name_hi as nameHi, 
        duration_minutes as durationMinutes, 
        price, 
        active, 
        order_index as orderIndex,
        (
          SELECT COUNT(*) 
          FROM queue_entry_services qes 
          WHERE qes.service_id = services.id
        ) as timesUsed
      FROM services
      ORDER BY order_index ASC, name_en ASC
    `).all() as any[];

    // 2. Barbers Management List
    const barbers = db.prepare(`
      SELECT 
        b.id, 
        b.name, 
        b.slug, 
        b.avatar_url as avatarUrl, 
        b.active, 
        b.working_today as workingToday, 
        b.status,
        (
          SELECT COUNT(*) 
          FROM queue_entries q 
          WHERE q.assigned_barber_id = b.id AND q.status IN ('Called', 'In Chair')
        ) as occupiedCount,
        (
          SELECT COUNT(*)
          FROM queue_entries q
          WHERE q.assigned_barber_id = b.id AND q.status = 'Done' AND date(q.completed_at) = date('now')
        ) as customersServedToday
      FROM barbers b
      ORDER BY b.name ASC
    `).all() as any[];

    // 3. Queue Settings & Hours
    const settingsRows = db.prepare('SELECT key, value FROM salon_settings').all() as { key: string; value: string }[];
    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows) {
      settingsMap[row.key] = row.value;
    }

    const isOpen = settingsMap['is_open'] === '1';
    const isPaused = settingsMap['is_paused'] === '1';
    const openingTime = settingsMap['opening_time'] || '09:00';
    const closingTime = settingsMap['closing_time'] || '23:00';
    const salonName = settingsMap['salon_name'] || 'Royal Cuts Lounge';

    const waitingCountStmt = db.prepare(`SELECT COUNT(*) as count FROM queue_entries WHERE status = 'Waiting'`);
    const totalWaiting = (waitingCountStmt.get() as { count: number }).count;

    // 4. Daily Statistics
    const servedStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_entries 
      WHERE status = 'Done' AND date(completed_at) = date(?)
    `);
    const customersServedToday = (servedStmt.get(todayDate) as { count: number }).count;

    const noShowStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_entries 
      WHERE status = 'No-show' AND (date(no_show_at) = date(?) OR date(joined_at) = date(?))
    `);
    const totalNoShows = (noShowStmt.get(todayDate, todayDate) as { count: number }).count;

    const cancelledStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_entries 
      WHERE status = 'Cancelled' AND (date(cancelled_at) = date(?) OR date(joined_at) = date(?))
    `);
    const totalCancelled = (cancelledStmt.get(todayDate, todayDate) as { count: number }).count;

    const joinedTodayStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_entries 
      WHERE date(joined_at) = date(?)
    `);
    const totalJoinedToday = (joinedTodayStmt.get(todayDate) as { count: number }).count;

    // Average wait time (minutes)
    const waitTimesRows = db.prepare(`
      SELECT (strftime('%s', called_at) - strftime('%s', joined_at)) as waitSeconds
      FROM queue_entries
      WHERE called_at IS NOT NULL AND date(joined_at) = date(?)
    `).all(todayDate) as { waitSeconds: number }[];

    let averageWaitMinutes = 15;
    if (waitTimesRows.length > 0) {
      const totalSec = waitTimesRows.reduce((sum, r) => sum + Math.max(0, r.waitSeconds), 0);
      averageWaitMinutes = Math.round(totalSec / waitTimesRows.length / 60);
    }

    // Revenue value from completed services today
    const revenueRow = db.prepare(`
      SELECT SUM(total_price) as totalRev 
      FROM queue_entries 
      WHERE status = 'Done' AND date(completed_at) = date(?)
    `).get(todayDate) as { totalRev: number | null };
    const totalRevenue = revenueRow?.totalRev || 0;

    res.json({
      services: services.map(s => ({
        ...s,
        active: Boolean(s.active),
        timesUsed: s.timesUsed || 0,
      })),
      barbers: barbers.map(b => ({
        ...b,
        active: Boolean(b.active),
        workingToday: Boolean(b.workingToday),
        isOccupied: b.occupiedCount > 0,
      })),
      queueSettings: {
        isOpen,
        isPaused,
        openingTime,
        closingTime,
        salonName,
        totalWaiting,
      },
      dailyStats: {
        customersServedToday,
        averageWaitMinutes,
        totalNoShows,
        totalCancelled,
        totalJoinedToday,
        totalRevenue,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'FAILED_ADMIN_DASHBOARD' });
  }
});

// =========================================================================
// SECTION 1: Service Management Endpoints
// =========================================================================

/**
 * POST /api/admin/services
 * Adds a new service with English, Gujarati, Hindi names, duration, and price.
 */
router.post('/admin/services', (req, res) => {
  try {
    const { nameEn, nameGu, nameHi, durationMinutes, price, active } = req.body;

    const trimmedEn = nameEn?.trim() || '';
    if (trimmedEn.length < 2 || trimmedEn.length > 40) {
      return res.status(400).json({
        error: 'INVALID_SERVICE_NAME',
        message: 'Service name in English must be between 2 and 40 characters.',
      });
    }

    // Check unique name among active services
    const existing = db.prepare('SELECT id FROM services WHERE LOWER(name_en) = LOWER(?) AND active = 1').get(trimmedEn);
    if (existing) {
      return res.status(400).json({
        error: 'DUPLICATE_SERVICE_NAME',
        message: 'An active service with this name already exists.',
      });
    }

    const duration = Number(durationMinutes);
    if (isNaN(duration) || duration < 5 || duration > 300) {
      return res.status(400).json({
        error: 'INVALID_DURATION',
        message: 'Duration must be between 5 and 300 minutes.',
      });
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0 || priceNum > 99999) {
      return res.status(400).json({
        error: 'INVALID_PRICE',
        message: 'Price must be between ₹0 and ₹99,999.',
      });
    }

    // Determine max order index
    const maxOrderRow = db.prepare('SELECT MAX(order_index) as maxOrder FROM services').get() as { maxOrder: number | null };
    const orderIndex = (maxOrderRow?.maxOrder || 0) + 1;

    const id = `srv-${Date.now()}`;
    const isActive = active !== undefined ? (active ? 1 : 0) : 1;

    db.prepare(`
      INSERT INTO services (id, name_en, name_gu, name_hi, duration_minutes, price, active, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      trimmedEn,
      nameGu?.trim() || null,
      nameHi?.trim() || null,
      duration,
      priceNum,
      isActive,
      orderIndex
    );

    // Broadcast updates
    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
      getIO().emit(SOCKET_EVENTS.SETTINGS_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.status(201).json({
      success: true,
      service: {
        id,
        nameEn: trimmedEn,
        nameGu: nameGu?.trim() || null,
        nameHi: nameHi?.trim() || null,
        durationMinutes: duration,
        price: priceNum,
        active: Boolean(isActive),
        orderIndex,
      },
    });
  } catch (error: any) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'FAILED_CREATE_SERVICE' });
  }
});

/**
 * PUT /api/admin/services/:id
 * Edits an existing service.
 */
router.put('/admin/services/:id', (req, res) => {
  try {
    const serviceId = req.params.id;
    const { nameEn, nameGu, nameHi, durationMinutes, price, active } = req.body;

    const service = db.prepare('SELECT id FROM services WHERE id = ?').get(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'SERVICE_NOT_FOUND' });
    }

    const trimmedEn = nameEn?.trim() || '';
    if (trimmedEn.length < 2 || trimmedEn.length > 40) {
      return res.status(400).json({
        error: 'INVALID_SERVICE_NAME',
        message: 'Service name in English must be between 2 and 40 characters.',
      });
    }

    // Check duplicate name on other services
    const duplicate = db.prepare('SELECT id FROM services WHERE LOWER(name_en) = LOWER(?) AND id != ? AND active = 1').get(trimmedEn, serviceId);
    if (duplicate) {
      return res.status(400).json({
        error: 'DUPLICATE_SERVICE_NAME',
        message: 'An active service with this name already exists.',
      });
    }

    const duration = Number(durationMinutes);
    if (isNaN(duration) || duration < 5 || duration > 300) {
      return res.status(400).json({
        error: 'INVALID_DURATION',
        message: 'Duration must be between 5 and 300 minutes.',
      });
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0 || priceNum > 99999) {
      return res.status(400).json({
        error: 'INVALID_PRICE',
        message: 'Price must be between ₹0 and ₹99,999.',
      });
    }

    const isActive = active !== undefined ? (active ? 1 : 0) : 1;

    db.prepare(`
      UPDATE services
      SET name_en = ?, name_gu = ?, name_hi = ?, duration_minutes = ?, price = ?, active = ?
      WHERE id = ?
    `).run(
      trimmedEn,
      nameGu?.trim() || null,
      nameHi?.trim() || null,
      duration,
      priceNum,
      isActive,
      serviceId
    );

    // Broadcast updates
    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
      getIO().emit(SOCKET_EVENTS.SETTINGS_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      service: {
        id: serviceId,
        nameEn: trimmedEn,
        nameGu: nameGu?.trim() || null,
        nameHi: nameHi?.trim() || null,
        durationMinutes: duration,
        price: priceNum,
        active: Boolean(isActive),
      },
    });
  } catch (error: any) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'FAILED_UPDATE_SERVICE' });
  }
});

/**
 * DELETE /api/admin/services/:id
 * Deletes an unused service, or blocks delete if used in appointments.
 */
router.delete('/admin/services/:id', (req, res) => {
  try {
    const serviceId = req.params.id;

    // Check if service exists
    const service = db.prepare('SELECT id, name_en as nameEn FROM services WHERE id = ?').get(serviceId) as any;
    if (!service) {
      return res.status(404).json({ error: 'SERVICE_NOT_FOUND' });
    }

    // Check if service has been used in queue_entry_services
    const usageRow = db.prepare('SELECT COUNT(*) as count FROM queue_entry_services WHERE service_id = ?').get(serviceId) as { count: number };
    if (usageRow.count > 0) {
      return res.status(400).json({
        error: 'SERVICE_IN_USE',
        message: 'This service has been used in previous customer visits. Please disable it instead of deleting.',
      });
    }

    db.prepare('DELETE FROM services WHERE id = ?').run(serviceId);

    // Broadcast
    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
      getIO().emit(SOCKET_EVENTS.SETTINGS_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      message: `Service '${service.nameEn}' deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'FAILED_DELETE_SERVICE' });
  }
});

/**
 * PATCH /api/admin/services/:id/toggle
 * Enables or disables a service (active = 1 or 0).
 */
router.patch('/admin/services/:id/toggle', (req, res) => {
  try {
    const serviceId = req.params.id;

    const service = db.prepare('SELECT id, active, name_en as nameEn FROM services WHERE id = ?').get(serviceId) as any;
    if (!service) {
      return res.status(404).json({ error: 'SERVICE_NOT_FOUND' });
    }

    const nextActive = service.active === 1 ? 0 : 1;
    db.prepare('UPDATE services SET active = ? WHERE id = ?').run(nextActive, serviceId);

    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
      getIO().emit(SOCKET_EVENTS.SETTINGS_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      serviceId,
      active: Boolean(nextActive),
      message: `Service '${service.nameEn}' is now ${nextActive === 1 ? 'active' : 'disabled'}.`,
    });
  } catch (error: any) {
    console.error('Error toggling service status:', error);
    res.status(500).json({ error: 'FAILED_TOGGLE_SERVICE' });
  }
});

// =========================================================================
// SECTION 2: Barber Management Endpoints
// =========================================================================

/**
 * POST /api/admin/barbers
 * Adds a new barber to the salon.
 */
router.post('/admin/barbers', (req, res) => {
  try {
    const { name, workingToday, active } = req.body;

    const trimmedName = name?.trim() || '';
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      return res.status(400).json({
        error: 'INVALID_BARBER_NAME',
        message: "Barber's name must be between 2 and 30 characters.",
      });
    }

    // Check duplicate name
    const existing = db.prepare('SELECT id FROM barbers WHERE LOWER(name) = LOWER(?)').get(trimmedName);
    if (existing) {
      return res.status(400).json({
        error: 'DUPLICATE_BARBER_NAME',
        message: 'A barber with this name already exists.',
      });
    }

    // Generate unique slug
    let baseSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = `barber-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (db.prepare('SELECT id FROM barbers WHERE slug = ?').get(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const id = `barb-${Date.now()}`;
    const isWorking = workingToday !== undefined ? (workingToday ? 1 : 0) : 1;
    const isActive = active !== undefined ? (active ? 1 : 0) : 1;

    db.prepare(`
      INSERT INTO barbers (id, name, slug, active, working_today, status)
      VALUES (?, ?, ?, ?, ?, 'Available')
    `).run(id, trimmedName, slug, isActive, isWorking);

    try {
      getIO().emit(SOCKET_EVENTS.BARBER_STATUS_CHANGED, { barberId: id, status: 'Available' });
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.status(201).json({
      success: true,
      barber: {
        id,
        name: trimmedName,
        slug,
        active: Boolean(isActive),
        workingToday: Boolean(isWorking),
        status: 'Available',
      },
    });
  } catch (error: any) {
    console.error('Error adding barber:', error);
    res.status(500).json({ error: 'FAILED_ADD_BARBER' });
  }
});

/**
 * PUT /api/admin/barbers/:id
 * Edits barber details (e.g. name, active).
 */
router.put('/admin/barbers/:id', (req, res) => {
  try {
    const barberId = req.params.id;
    const { name, active } = req.body;

    const barber = db.prepare('SELECT id, name FROM barbers WHERE id = ?').get(barberId) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND' });
    }

    const trimmedName = name?.trim() || '';
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      return res.status(400).json({
        error: 'INVALID_BARBER_NAME',
        message: "Barber's name must be between 2 and 30 characters.",
      });
    }

    // Check duplicate on other barbers
    const duplicate = db.prepare('SELECT id FROM barbers WHERE LOWER(name) = LOWER(?) AND id != ?').get(trimmedName, barberId);
    if (duplicate) {
      return res.status(400).json({
        error: 'DUPLICATE_BARBER_NAME',
        message: 'Another barber with this name already exists.',
      });
    }

    const isActive = active !== undefined ? (active ? 1 : 0) : 1;

    db.prepare(`
      UPDATE barbers
      SET name = ?, active = ?
      WHERE id = ?
    `).run(trimmedName, isActive, barberId);

    try {
      getIO().emit(SOCKET_EVENTS.BARBER_STATUS_CHANGED, { barberId });
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      barber: {
        id: barberId,
        name: trimmedName,
        active: Boolean(isActive),
      },
    });
  } catch (error: any) {
    console.error('Error updating barber:', error);
    res.status(500).json({ error: 'FAILED_UPDATE_BARBER' });
  }
});

/**
 * DELETE /api/admin/barbers/:id
 * Removes a barber. If they have historical customer records, deactivates them safely.
 */
router.delete('/admin/barbers/:id', (req, res) => {
  try {
    const barberId = req.params.id;

    const barber = db.prepare('SELECT id, name FROM barbers WHERE id = ?').get(barberId) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND' });
    }

    // Check if currently occupied
    const occupied = db.prepare(`
      SELECT id FROM queue_entries 
      WHERE assigned_barber_id = ? AND status IN ('Called', 'In Chair')
      LIMIT 1
    `).get(barberId);

    if (occupied) {
      return res.status(400).json({
        error: 'BARBER_CURRENTLY_OCCUPIED',
        message: 'Cannot remove barber while they have an active customer. Complete or reassign service first.',
      });
    }

    // Check if referenced in historical queue entries
    const history = db.prepare(`
      SELECT id FROM queue_entries 
      WHERE assigned_barber_id = ? OR preferred_barber_id = ?
      LIMIT 1
    `).get(barberId, barberId);

    if (history) {
      // Soft-delete to preserve queue history integrity
      db.prepare(`
        UPDATE barbers
        SET active = 0, working_today = 0, status = 'Off'
        WHERE id = ?
      `).run(barberId);
    } else {
      // Hard delete if never had any entries
      db.prepare('DELETE FROM barbers WHERE id = ?').run(barberId);
    }

    try {
      getIO().emit(SOCKET_EVENTS.BARBER_STATUS_CHANGED, { barberId, status: 'Off' });
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      message: `Barber '${barber.name}' removed successfully.`,
    });
  } catch (error: any) {
    console.error('Error removing barber:', error);
    res.status(500).json({ error: 'FAILED_REMOVE_BARBER' });
  }
});

/**
 * PATCH /api/admin/barbers/:id/duty
 * Sets barber on duty or off duty for today (working_today = 1 or 0).
 */
router.patch('/admin/barbers/:id/duty', (req, res) => {
  try {
    const barberId = req.params.id;
    const { workingToday } = req.body;

    const barber = db.prepare('SELECT id, name, status, working_today as workingToday FROM barbers WHERE id = ?').get(barberId) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND' });
    }

    const nextDuty = workingToday ? 1 : 0;
    const nextStatus = nextDuty === 1 ? 'Available' : 'Off';

    db.prepare(`
      UPDATE barbers
      SET working_today = ?, status = ?
      WHERE id = ?
    `).run(nextDuty, nextStatus, barberId);

    try {
      getIO().emit(SOCKET_EVENTS.BARBER_STATUS_CHANGED, { barberId, status: nextStatus });
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      barberId,
      workingToday: Boolean(nextDuty),
      status: nextStatus,
      message: `${barber.name} is now ${nextDuty === 1 ? 'on duty (Available)' : 'off duty (Off)'}.`,
    });
  } catch (error: any) {
    console.error('Error updating duty status:', error);
    res.status(500).json({ error: 'FAILED_UPDATE_DUTY' });
  }
});

// =========================================================================
// SECTION 3: Queue Settings Endpoints (Open/Close & Hours)
// =========================================================================

/**
 * POST /api/admin/queue/status
 * Opens or closes the live queue.
 */
router.post('/admin/queue/status', (req, res) => {
  try {
    const { isOpen, isPaused } = req.body;

    const updateSetting = db.prepare('INSERT OR REPLACE INTO salon_settings (key, value) VALUES (?, ?)');

    if (isOpen !== undefined) {
      updateSetting.run('is_open', isOpen ? '1' : '0');
    }
    if (isPaused !== undefined) {
      updateSetting.run('is_paused', isPaused ? '1' : '0');
    }

    try {
      getIO().emit(SOCKET_EVENTS.SETTINGS_UPDATED);
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      isOpen: Boolean(isOpen),
      isPaused: Boolean(isPaused),
      message: isOpen ? 'Live queue is now OPEN.' : 'Live queue is now CLOSED to online joiners.',
    });
  } catch (error: any) {
    console.error('Error toggling queue open status:', error);
    res.status(500).json({ error: 'FAILED_QUEUE_STATUS' });
  }
});

/**
 * POST /api/admin/queue/hours
 * Updates salon opening and closing hours.
 */
router.post('/admin/queue/hours', (req, res) => {
  try {
    const { openingTime, closingTime } = req.body;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(openingTime) || !timeRegex.test(closingTime)) {
      return res.status(400).json({
        error: 'INVALID_TIME_FORMAT',
        message: 'Times must be in 24-hour HH:MM format (e.g. 09:00, 21:00).',
      });
    }

    const updateSetting = db.prepare('INSERT OR REPLACE INTO salon_settings (key, value) VALUES (?, ?)');
    updateSetting.run('opening_time', openingTime);
    updateSetting.run('closing_time', closingTime);

    try {
      getIO().emit(SOCKET_EVENTS.SETTINGS_UPDATED);
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
    } catch (e) {
      console.warn('Socket emit error:', e);
    }

    res.json({
      success: true,
      openingTime,
      closingTime,
      message: `Operating hours saved: ${openingTime} to ${closingTime}.`,
    });
  } catch (error: any) {
    console.error('Error updating salon hours:', error);
    res.status(500).json({ error: 'FAILED_UPDATE_HOURS' });
  }
});

/**
 * POST /api/admin/queue/reset
 * Implements Rule R14 (End-of-day reset):
 * Completes entries In Chair, marks Waiting/Called as Cancelled, resets barbers to Available
 */
router.post('/admin/queue/reset', (_req, res) => {
  try {
    const now = new Date().toISOString();
    db.prepare(`UPDATE queue_entries SET status = 'Done', completed_at = ? WHERE status = 'In Chair'`).run(now);
    db.prepare(`UPDATE queue_entries SET status = 'Cancelled', cancelled_at = ? WHERE status IN ('Waiting', 'Called')`).run(now);
    db.prepare(`UPDATE barbers SET status = 'Available' WHERE active = 1 AND working_today = 1`).run();

    try {
      getIO().emit(SOCKET_EVENTS.QUEUE_UPDATED);
    } catch (e) {}

    res.json({ success: true, message: 'Queue reset successfully according to Rule R14.' });
  } catch (error: any) {
    console.error('Error resetting queue:', error);
    res.status(500).json({ error: 'FAILED_RESET_QUEUE' });
  }
});

export default router;
