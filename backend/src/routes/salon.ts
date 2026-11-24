import { Router } from 'express';
import { db } from '../db/index.js';
import { calculateEstimatedWaitTime, isOnlineJoiningAllowed } from '../rules/index.js';

const router = Router();

router.get(['/salon', '/salon/status'], (_req, res) => {
  try {
    // 1. Fetch settings
    const settingsRows = db.prepare('SELECT key, value FROM salon_settings').all() as { key: string; value: string }[];
    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows) {
      settingsMap[row.key] = row.value;
    }

    const isOpen = settingsMap['is_open'] === '1';
    const isPaused = settingsMap['is_paused'] === '1';
    const closingTime = settingsMap['closing_time'] || '23:00';
    const openingTime = settingsMap['opening_time'] || '09:00';

    const onlineStatus = isOnlineJoiningAllowed({ isOpen, isPaused, closingTime });

    // 2. Fetch active barbers
    const barbers = db.prepare(`
      SELECT 
        b.id, b.name, b.slug, b.avatar_url as avatarUrl, b.active, b.working_today as workingToday, b.status,
        (SELECT COUNT(*) FROM queue_entries q WHERE q.preferred_barber_id = b.id AND q.status = 'Waiting') as customersWaitingCount
      FROM barbers b
      WHERE b.active = 1
      ORDER BY b.name ASC
    `).all() as any[];

    // 3. Count waiting & in chair entries
    const waitingEntries = db.prepare(`
      SELECT id, status, total_duration_minutes as totalDurationMinutes, service_started_at as serviceStartedAt
      FROM queue_entries
      WHERE status IN ('Waiting', 'Called', 'In Chair')
      ORDER BY joined_at ASC
    `).all() as any[];

    const waitingCount = waitingEntries.filter(e => e.status === 'Waiting').length;
    const inChairCount = waitingEntries.filter(e => e.status === 'In Chair' || e.status === 'Called').length;

    const workingBarbers = barbers.filter(b => b.workingToday && b.status !== 'Off');
    const estimatedWaitMinutes = calculateEstimatedWaitTime(waitingEntries, workingBarbers.length);

    res.json({
      settings: {
        salonName: settingsMap['salon_name'] || 'Royal Cuts Lounge',
        tagline: settingsMap['tagline'] || 'Luxury Grooming for Gentlemen',
        address: settingsMap['address'] || '4th Floor, Silver Plaza, Ring Road, Surat',
        phone: settingsMap['phone'] || '9876543210',
        openingTime,
        closingTime,
        isOpen,
        isPaused,
        onlineJoiningAllowed: onlineStatus.allowed,
        onlineJoiningReason: onlineStatus.reason,
      },
      queueSummary: {
        waitingCount,
        inChairCount,
        completedTodayCount: 0,
        estimatedWaitMinutes,
        isOpen,
        isPaused,
      },
      barbers,
    });
  } catch (error: any) {
    console.error('Error fetching salon status:', error);
    res.status(500).json({ error: 'FAILED_FETCH_SALON_STATUS' });
  }
});

export default router;
