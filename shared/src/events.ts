/**
 * Socket.IO shared event names
 */

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  QUEUE_UPDATED: 'queue:updated',
  BARBER_STATUS_CHANGED: 'barber:status_changed',
  CUSTOMER_CALLED: 'customer:called',
  SERVICE_STARTED: 'service:started',
  SERVICE_COMPLETED: 'service:completed',
  SETTINGS_UPDATED: 'settings:updated',
  HEALTH_CHECK: 'health:check',
} as const;

export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
