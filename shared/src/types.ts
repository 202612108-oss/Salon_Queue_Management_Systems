import { QueueStatus, BarberStatus } from './statuses.js';

export interface Service {
  id: string;
  nameEn: string;
  nameGu?: string;
  nameHi?: string;
  durationMinutes: number;
  price: number;
  active: boolean;
  orderIndex: number;
}

export interface Barber {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  active: boolean;
  workingToday: boolean;
  status: BarberStatus;
  currentEntryId?: string | null;
  breakStartedAt?: string | null;
}

export interface QueueEntryService {
  serviceId: string;
  nameEn: string;
  durationMinutes: number;
  price: number;
}

export interface QueueEntry {
  id: string;
  tokenNumber: string; // e.g. "T-001"
  customerName: string;
  customerPhone: string;
  services: QueueEntryService[];
  preferredBarberId: string | null; // null represents "Any Barber"
  assignedBarberId: string | null;
  status: QueueStatus;
  totalDurationMinutes: number;
  totalPrice: number;
  source: 'online' | 'walk-in';
  position?: number;
  estimatedWaitMinutes?: number;
  joinedAt: string;
  calledAt?: string | null;
  serviceStartedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  noShowAt?: string | null;
}

export interface SalonSettings {
  isOpen: boolean;
  isPaused: boolean;
  pauseExpiresAt?: string | null;
  openingTime: string; // "09:00"
  closingTime: string; // "20:00"
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  tagline: string;
}

export interface QueueSummary {
  waitingCount: number;
  inChairCount: number;
  completedTodayCount: number;
  estimatedWaitMinutes: number;
  isOpen: boolean;
  isPaused: boolean;
}
