/**
 * Queue and Barber status definitions according to docs/03-flows-rules.md
 */

export type QueueStatus = 
  | 'Waiting'
  | 'Called'
  | 'In Chair'
  | 'Done'
  | 'Cancelled'
  | 'No-show';

export type BarberStatus = 
  | 'Available'
  | 'Busy'
  | 'On Break'
  | 'Off';

export const ACTIVE_QUEUE_STATUSES: readonly QueueStatus[] = [
  'Waiting',
  'Called',
  'In Chair'
] as const;

export const CLOSED_QUEUE_STATUSES: readonly QueueStatus[] = [
  'Done',
  'Cancelled',
  'No-show'
] as const;
