import { Router } from 'express';
import { db } from '../db/index.js';
import { calculateEstimatedWaitTime, CustomerAheadEntry } from '../rules/queueRules.js';

const router = Router();

/**
 * GET /api/display
 * Fetches dedicated state for the Waiting Area TV screen:
 * - Salon settings (name, open/closed/paused)
 * - Now Serving stations for working barbers (Ravi, Amit, Imran) with large tokens,
 *   distinguishing Serving ('In Chair') vs Please Come ('Called')
 * - Next Five waiting entries with calculated estimated waiting time
 */
router.get('/display', (_req, res) => {
  try {
    const now = new Date();

    // 1. Salon Info & Queue Status
    const salonRow = db.prepare(`SELECT value FROM salon_settings WHERE key = 'salon_name'`).get() as { value: string } | undefined;
    const isOpenRow = db.prepare(`SELECT value FROM salon_settings WHERE key = 'is_open'`).get() as { value: string } | undefined;
    const isPausedRow = db.prepare(`SELECT value FROM salon_settings WHERE key = 'is_paused'`).get() as { value: string } | undefined;

    const salonName = salonRow?.value || 'Royal Cuts Lounge';
    const isOpen = isOpenRow ? isOpenRow.value === '1' : true;
    const isPaused = isPausedRow ? isPausedRow.value === '1' : false;

    let queueStatus: 'open' | 'closed' | 'paused' = 'open';
    if (!isOpen) queueStatus = 'closed';
    else if (isPaused) queueStatus = 'paused';

    // 2. Working Barbers & Now Serving
    const barbers = db.prepare(`
      SELECT id, name, slug, avatar_url as avatarUrl, status, break_started_at as breakStartedAt
      FROM barbers
      WHERE active = 1 AND working_today = 1
      ORDER BY name ASC
    `).all() as any[];

    const nowServing = barbers.map((b) => {
      const activeEntry = db.prepare(`
        SELECT 
          q.id, q.token_number as tokenNumber, q.customer_name as customerName,
          q.status, q.called_at as calledAt, q.service_started_at as serviceStartedAt,
          q.total_duration_minutes as totalDurationMinutes,
          (
            SELECT GROUP_CONCAT(name_en, ', ')
            FROM queue_entry_services s
            WHERE s.entry_id = q.id
          ) as servicesSummary
        FROM queue_entries q
        WHERE q.assigned_barber_id = ? AND q.status IN ('Called', 'In Chair')
        LIMIT 1
      `).get(b.id) as any;

      let currentCustomer = null;
      if (activeEntry) {
        let elapsedSeconds = 0;
        if (activeEntry.status === 'In Chair' && activeEntry.serviceStartedAt) {
          elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(activeEntry.serviceStartedAt).getTime()) / 1000));
        } else if (activeEntry.status === 'Called' && activeEntry.calledAt) {
          elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(activeEntry.calledAt).getTime()) / 1000));
        }

        currentCustomer = {
          id: activeEntry.id,
          tokenNumber: activeEntry.tokenNumber,
          customerName: activeEntry.customerName,
          status: activeEntry.status as 'Called' | 'In Chair',
          calledAt: activeEntry.calledAt,
          serviceStartedAt: activeEntry.serviceStartedAt,
          totalDurationMinutes: activeEntry.totalDurationMinutes,
          servicesSummary: activeEntry.servicesSummary || 'Standard Service',
          elapsedSeconds,
        };
      }

      return {
        barberId: b.id,
        barberName: b.name,
        barberSlug: b.slug,
        barberAvatar: b.avatarUrl,
        barberStatus: b.status,
        currentCustomer,
      };
    });

    // 3. Waiting Queue & Next Five calculation
    const waitingRows = db.prepare(`
      SELECT 
        q.id, q.token_number as tokenNumber, q.customer_name as customerName,
        q.preferred_barber_id as preferredBarberId, q.joined_at as joinedAt,
        q.total_duration_minutes as totalDurationMinutes,
        b.name as preferredBarberName,
        (
          SELECT GROUP_CONCAT(name_en, ', ')
          FROM queue_entry_services s
          WHERE s.entry_id = q.id
        ) as servicesSummary
      FROM queue_entries q
      LEFT JOIN barbers b ON q.preferred_barber_id = b.id
      WHERE q.status = 'Waiting'
      ORDER BY q.joined_at ASC
    `).all() as any[];

    // In-service and called customers (ahead of all waiting customers)
    const inServiceOrCalledRows = db.prepare(`
      SELECT id, status, total_duration_minutes as totalDurationMinutes, service_started_at as serviceStartedAt
      FROM queue_entries
      WHERE status IN ('In Chair', 'Called')
      ORDER BY joined_at ASC
    `).all() as any[];

    const workingBarbersCount = Math.max(1, barbers.length);

    // Prepare Next Five entries with estimated wait time
    const nextFive = waitingRows.slice(0, 5).map((row, index) => {
      // Customers ahead for this waiting entry:
      // All currently In Chair & Called, plus all Waiting entries that came before this one
      const customersAhead: CustomerAheadEntry[] = [
        ...inServiceOrCalledRows.map((r) => ({
          id: r.id,
          status: r.status,
          totalDurationMinutes: r.totalDurationMinutes,
          serviceStartedAt: r.serviceStartedAt,
        })),
        ...waitingRows.slice(0, index).map((r) => ({
          id: r.id,
          status: 'Waiting' as const,
          totalDurationMinutes: r.totalDurationMinutes,
        })),
      ];

      const estimatedWaitMinutes = calculateEstimatedWaitTime(
        customersAhead,
        workingBarbersCount,
        now
      );

      return {
        position: index + 1,
        id: row.id,
        tokenNumber: row.tokenNumber,
        customerName: row.customerName,
        preferredBarberName: row.preferredBarberName || 'Any Barber',
        servicesSummary: row.servicesSummary || 'Standard Service',
        totalDurationMinutes: row.totalDurationMinutes,
        estimatedWaitMinutes,
      };
    });

    res.json({
      salonName,
      queueStatus,
      currentTime: now.toISOString(),
      totalWaiting: waitingRows.length,
      nowServing,
      nextFive,
    });
  } catch (error: any) {
    console.error('Error fetching display data:', error);
    res.status(500).json({ error: 'FAILED_FETCH_DISPLAY_DATA' });
  }
});

export default router;
