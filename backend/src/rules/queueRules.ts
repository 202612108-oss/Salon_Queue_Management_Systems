import { QueueStatus } from '@salon/shared';

export interface ServiceItem {
  id: string;
  nameEn: string;
  nameGu?: string;
  nameHi?: string;
  durationMinutes: number;
  price: number;
  active: boolean;
}

export interface CustomerAheadEntry {
  id: string;
  status: QueueStatus;
  totalDurationMinutes: number;
  serviceStartedAt?: string | null;
}

/**
 * Validates customer name
 * Rules: 2 to 50 characters. Unicode letters, spaces, dots, hyphens.
 */
export function validateCustomerName(name: string): { valid: boolean; error?: string } {
  const trimmed = name?.trim() || '';
  if (trimmed.length < 2) {
    return { valid: false, error: 'NAME_TOO_SHORT' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'NAME_TOO_LONG' };
  }
  // Allow Unicode letters & marks (English, Gujarati, Hindi matras, etc.), spaces, dots, hyphens
  const regex = /^[\p{L}\p{M}\s\.\-]+$/u;
  if (!regex.test(trimmed)) {
    return { valid: false, error: 'NAME_INVALID_CHARACTERS' };
  }
  return { valid: true };
}

/**
 * Normalizes phone number: strips non-digits and optional +91 or 91 country prefix
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Validates Indian 10-digit mobile number starting with 6, 7, 8, 9
 */
export function validatePhoneNumber(rawPhone: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizePhoneNumber(rawPhone);
  if (!normalized || normalized.length !== 10) {
    return { valid: false, normalized, error: 'PHONE_INVALID_LENGTH' };
  }
  if (!/^[6-9]/.test(normalized)) {
    return { valid: false, normalized, error: 'PHONE_INVALID_PREFIX' };
  }
  return { valid: true, normalized };
}

/**
 * Validates services selection (1 to 3 active services)
 */
export function validateServicesSelection(
  selectedIds: string[],
  availableServices: ServiceItem[]
): { valid: boolean; error?: string; selectedServices?: ServiceItem[] } {
  if (!selectedIds || selectedIds.length === 0) {
    return { valid: false, error: 'SERVICES_MIN_ONE' };
  }
  if (selectedIds.length > 3) {
    return { valid: false, error: 'SERVICES_MAX_THREE' };
  }

  const selectedServices: ServiceItem[] = [];
  for (const id of selectedIds) {
    const srv = availableServices.find(s => s.id === id && s.active);
    if (!srv) {
      return { valid: false, error: 'SERVICE_NOT_FOUND_OR_INACTIVE' };
    }
    selectedServices.push(srv);
  }

  return { valid: true, selectedServices };
}

/**
 * Calculates total price and duration from selected services
 */
export function calculateServicesTotals(services: { price: number; durationMinutes: number }[]): {
  totalPrice: number;
  totalDurationMinutes: number;
} {
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const totalDurationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  return { totalPrice, totalDurationMinutes };
}

/**
 * Calculates estimated waiting time (Section 6 of docs/03-flows-rules.md)
 * 
 * Formula:
 * Estimated waiting time = Total service minutes of customers ahead / Number of working barbers
 * Rounded up to nearest 5 minutes.
 */
export function calculateEstimatedWaitTime(
  customersAhead: CustomerAheadEntry[],
  workingBarbersCount: number,
  now: Date = new Date()
): number {
  if (workingBarbersCount <= 0) {
    return 0;
  }

  let totalMinutesAhead = 0;
  for (const entry of customersAhead) {
    if (entry.status === 'In Chair' && entry.serviceStartedAt) {
      // Remaining minutes for In Chair
      const started = new Date(entry.serviceStartedAt).getTime();
      const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - started) / (1000 * 60)));
      const remaining = Math.max(0, entry.totalDurationMinutes - elapsedMinutes);
      totalMinutesAhead += remaining;
    } else if (entry.status === 'Waiting' || entry.status === 'Called') {
      totalMinutesAhead += entry.totalDurationMinutes;
    }
  }

  if (totalMinutesAhead === 0) {
    return 0;
  }

  const exactMinutes = totalMinutesAhead / workingBarbersCount;
  // Round up to nearest 5 minutes
  const rounded = Math.ceil(exactMinutes / 5) * 5;
  return rounded;
}

/**
 * Checks whether online joining is allowed (Rule R9)
 * Closes automatically 30 minutes before closing time.
 */
export function isOnlineJoiningAllowed(
  settings: {
    isOpen: boolean;
    isPaused: boolean;
    closingTime: string; // e.g. "20:00"
  },
  now: Date = new Date()
): { allowed: boolean; reason?: 'closed' | 'paused' | 'cutoff' } {
  if (!settings.isOpen) {
    return { allowed: false, reason: 'closed' };
  }
  if (settings.isPaused) {
    return { allowed: false, reason: 'paused' };
  }

  // Check 30-minute cut-off before closing time (Rule R9)
  if (settings.closingTime && settings.closingTime.trim() !== '') {
    const [closeHour, closeMinute] = settings.closingTime.split(':').map(Number);
    const closingDate = new Date(now);
    closingDate.setHours(closeHour, closeMinute, 0, 0);

    // Handle midnight crossover (e.g. closes at 01:00 or 02:00 late night)
    if (closingDate.getTime() < now.getTime() - 6 * 60 * 60 * 1000) {
      closingDate.setDate(closingDate.getDate() + 1);
    }

    const cutoffDate = new Date(closingDate.getTime() - 30 * 60 * 1000);
    if (now >= cutoffDate) {
      return { allowed: false, reason: 'cutoff' };
    }
  }

  return { allowed: true };
}

/**
 * Formats daily token numbers: S-1, S-2, S-3, etc.
 */
export function generateTokenNumber(dailySequenceNumber: number): string {
  return `S-${dailySequenceNumber}`;
}

export interface BarberState {
  id: string;
  name: string;
  workingToday: boolean;
  status: 'Available' | 'Busy' | 'On Break' | 'Off';
  isOccupied: boolean; // Has customer in 'Called' or 'In Chair'
  customersServedToday?: number;
}

export interface WaitingQueueEntry {
  id: string;
  tokenNumber: string;
  customerName: string;
  preferredBarberId: string | null;
  joinedAt: string;
}

export interface CallNextSelectionResult {
  entry: WaitingQueueEntry | null;
  assignedBarber: BarberState | null;
  skippedEntries: { tokenNumber: string; customerName: string; reason: string }[];
  failureReason?: 'NO_AVAILABLE_BARBERS' | 'NO_WAITING_CUSTOMERS' | 'TARGET_BARBER_NOT_AVAILABLE' | 'NO_ELIGIBLE_CUSTOMERS';
}

/**
 * Selects the next customer to call according to Rule R3 from docs/03-flows-rules.md:
 * - First come, first served ordering.
 * - Preferred barber is strictly respected (never assign Ravi-preference customer to Amit).
 * - If preferred barber is unavailable, customer is skipped without losing queue order.
 * - Any Barber entries are assigned to an available barber (tie-broken by fewest served, then alphabetical).
 */
export function selectNextCustomerToCall(
  waitingEntries: WaitingQueueEntry[],
  barbers: BarberState[],
  targetBarberId?: string | null
): CallNextSelectionResult {
  if (waitingEntries.length === 0) {
    return {
      entry: null,
      assignedBarber: null,
      skippedEntries: [],
      failureReason: 'NO_WAITING_CUSTOMERS',
    };
  }

  // Available barbers: working today, 'Available' status, and not currently occupied
  const availableBarbers = barbers.filter(
    b => b.workingToday && b.status === 'Available' && !b.isOccupied
  );

  if (availableBarbers.length === 0) {
    return {
      entry: null,
      assignedBarber: null,
      skippedEntries: [],
      failureReason: 'NO_AVAILABLE_BARBERS',
    };
  }

  const skippedEntries: { tokenNumber: string; customerName: string; reason: string }[] = [];

  // Case A: Specific barber called next (e.g. clicked on Ravi's card)
  if (targetBarberId) {
    const targetBarber = availableBarbers.find(b => b.id === targetBarberId);
    if (!targetBarber) {
      return {
        entry: null,
        assignedBarber: null,
        skippedEntries: [],
        failureReason: 'TARGET_BARBER_NOT_AVAILABLE',
      };
    }

    for (const entry of waitingEntries) {
      if (entry.preferredBarberId === targetBarberId) {
        return {
          entry,
          assignedBarber: targetBarber,
          skippedEntries,
        };
      }
      if (entry.preferredBarberId === null) {
        // Any Barber customer can be served by target barber
        return {
          entry,
          assignedBarber: targetBarber,
          skippedEntries,
        };
      }
      // Specific to another barber -> must skip, never misassign
      skippedEntries.push({
        tokenNumber: entry.tokenNumber,
        customerName: entry.customerName,
        reason: `Prefers another barber`,
      });
    }

    return {
      entry: null,
      assignedBarber: null,
      skippedEntries,
      failureReason: 'NO_ELIGIBLE_CUSTOMERS',
    };
  }

  // Case B: General Call Next (calls earliest eligible waiting customer)
  for (const entry of waitingEntries) {
    if (entry.preferredBarberId) {
      const preferredAvail = availableBarbers.find(b => b.id === entry.preferredBarberId);
      if (preferredAvail) {
        return {
          entry,
          assignedBarber: preferredAvail,
          skippedEntries,
        };
      } else {
        // Preferred barber is busy or unavailable
        const barberInfo = barbers.find(b => b.id === entry.preferredBarberId);
        skippedEntries.push({
          tokenNumber: entry.tokenNumber,
          customerName: entry.customerName,
          reason: `Waiting for ${barberInfo?.name || 'preferred barber'} (currently busy/unavailable)`,
        });
        continue; // skip to next waiting entry
      }
    } else {
      // Any Barber: choose available barber with fewest customers served, then alphabetical
      const chosenBarber = [...availableBarbers].sort((a, b) => {
        const servedA = a.customersServedToday ?? 0;
        const servedB = b.customersServedToday ?? 0;
        if (servedA !== servedB) return servedA - servedB;
        return a.name.localeCompare(b.name);
      })[0];

      return {
        entry,
        assignedBarber: chosenBarber,
        skippedEntries,
      };
    }
  }

  return {
    entry: null,
    assignedBarber: null,
    skippedEntries,
    failureReason: 'NO_ELIGIBLE_CUSTOMERS',
  };
}

/**
 * Checks if a customer has been waiting more than 60 minutes
 */
export function isWaitOver60Minutes(joinedAt: string, now: Date = new Date()): boolean {
  if (!joinedAt) return false;
  const joinedTime = new Date(joinedAt).getTime();
  const elapsedMinutes = (now.getTime() - joinedTime) / (1000 * 60);
  return elapsedMinutes > 60;
}

export type ValidRole = 'customer' | 'receptionist' | 'barber' | 'admin';

export interface TransitionCheck {
  allowed: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Checks eligibility for marking No-show (Rule R6: 10 minutes from Call)
 */
export function isNoShowEligible(
  calledAt: string | null | undefined,
  now: Date = new Date()
): { eligible: boolean; elapsedMinutes: number; remainingMinutes: number } {
  if (!calledAt) {
    return { eligible: false, elapsedMinutes: 0, remainingMinutes: 10 };
  }
  const calledTime = new Date(calledAt).getTime();
  const elapsedMinutes = Math.max(0, (now.getTime() - calledTime) / (1000 * 60));
  const remainingMinutes = Math.max(0, Math.ceil(10 - elapsedMinutes));
  return {
    eligible: elapsedMinutes >= 10,
    elapsedMinutes,
    remainingMinutes,
  };
}

/**
 * Validates queue status transitions according to Section 2.2 of docs/03-flows-rules.md:
 * - Allowed transitions:
 *   - Waiting -> Called (Receptionist/Admin)
 *   - Waiting -> Cancelled (Customer/Receptionist/Admin)
 *   - Called -> In Chair (Barber/Admin)
 *   - Called -> Cancelled (Customer/Receptionist/Admin)
 *   - Called -> No-show (Receptionist/Admin, only after 10 min)
 *   - Called -> Waiting (Undo call)
 *   - In Chair -> Done (Barber/Admin)
 * - Final states: Done, Cancelled, No-show can NEVER transition to any state.
 * - In Chair cannot be cancelled or marked No-show.
 */
export function isValidStatusTransition(
  fromStatus: QueueStatus,
  toStatus: QueueStatus,
  role: ValidRole,
  extraContext?: {
    calledAt?: string | null;
    serviceStartedAt?: string | null;
    now?: Date;
  }
): TransitionCheck {
  // 1. Final closed states can never transition
  if (['Done', 'Cancelled', 'No-show'].includes(fromStatus)) {
    return {
      allowed: false,
      errorCode: 'STATUS_IS_FINAL',
      errorMessage: `Status '${fromStatus}' is a final closed state. Rejoining requires a new token.`,
    };
  }

  // 2. Waiting Transitions
  if (fromStatus === 'Waiting') {
    if (toStatus === 'Called') {
      if (['receptionist', 'admin'].includes(role)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        errorCode: 'UNAUTHORIZED_ROLE',
        errorMessage: 'Only the receptionist or admin can call the next customer.',
      };
    }
    if (toStatus === 'Cancelled') {
      // Allowed for customer, receptionist, admin
      return { allowed: true };
    }
    return {
      allowed: false,
      errorCode: 'INVALID_TRANSITION',
      errorMessage: `Cannot transition directly from 'Waiting' to '${toStatus}'. Must be Called first.`,
    };
  }

  // 3. Called Transitions
  if (fromStatus === 'Called') {
    if (toStatus === 'In Chair') {
      if (['barber', 'admin'].includes(role)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        errorCode: 'UNAUTHORIZED_ROLE',
        errorMessage: 'Only the barber can start the service (move to In Chair).',
      };
    }
    if (toStatus === 'Cancelled') {
      // Allowed for customer or receptionist before chair starts
      return { allowed: true };
    }
    if (toStatus === 'No-show') {
      if (!['receptionist', 'admin'].includes(role)) {
        return {
          allowed: false,
          errorCode: 'UNAUTHORIZED_ROLE',
          errorMessage: 'Only the receptionist or admin can mark a customer as No-show.',
        };
      }
      const check = isNoShowEligible(extraContext?.calledAt, extraContext?.now);
      if (!check.eligible) {
        return {
          allowed: false,
          errorCode: 'NO_SHOW_TOO_EARLY',
          errorMessage: `No-show can only be marked after 10 minutes from calling. Remaining: ${check.remainingMinutes} min.`,
        };
      }
      return { allowed: true };
    }
    if (toStatus === 'Waiting') {
      // Undo call
      if (['receptionist', 'admin'].includes(role)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        errorCode: 'UNAUTHORIZED_ROLE',
        errorMessage: 'Only receptionist can undo a call.',
      };
    }
    return {
      allowed: false,
      errorCode: 'INVALID_TRANSITION',
      errorMessage: `Cannot transition directly from 'Called' to '${toStatus}'.`,
    };
  }

  // 4. In Chair Transitions
  if (fromStatus === 'In Chair') {
    if (toStatus === 'Done') {
      if (['barber', 'admin'].includes(role)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        errorCode: 'UNAUTHORIZED_ROLE',
        errorMessage: 'Only the barber can mark service as Done.',
      };
    }
    // "In Chair to Cancelled or No-show is NOT allowed" (Rule 2.2)
    return {
      allowed: false,
      errorCode: 'CANNOT_CANCEL_IN_CHAIR',
      errorMessage: 'A customer in chair cannot be cancelled or marked No-show. Service must be finished with Done.',
    };
  }

  return {
    allowed: false,
    errorCode: 'INVALID_TRANSITION',
    errorMessage: `Invalid transition from '${fromStatus}' to '${toStatus}'.`,
  };
}

