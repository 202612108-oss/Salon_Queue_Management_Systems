import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCustomerName,
  normalizePhoneNumber,
  validatePhoneNumber,
  validateServicesSelection,
  calculateServicesTotals,
  calculateEstimatedWaitTime,
  isOnlineJoiningAllowed,
  generateTokenNumber,
  selectNextCustomerToCall,
  isWaitOver60Minutes,
  isNoShowEligible,
  isValidStatusTransition,
} from '../dist/rules/index.js';

test('T2: Service selection validation limits (1 to 3 services)', () => {
  const mockServices = [
    { id: 's1', nameEn: 'Haircut', durationMinutes: 30, price: 150, active: true },
    { id: 's2', nameEn: 'Beard Trim', durationMinutes: 15, price: 80, active: true },
    { id: 's3', nameEn: 'Hair Spa', durationMinutes: 45, price: 400, active: true },
    { id: 's4', nameEn: 'Facial', durationMinutes: 30, price: 300, active: true },
    { id: 's5', nameEn: 'Old Service', durationMinutes: 30, price: 200, active: false },
  ];

  // Zero services
  const zeroCheck = validateServicesSelection([], mockServices);
  assert.equal(zeroCheck.valid, false);
  assert.equal(zeroCheck.error, 'SERVICES_MIN_ONE');

  // Exactly 3 services
  const threeCheck = validateServicesSelection(['s1', 's2', 's3'], mockServices);
  assert.equal(threeCheck.valid, true);
  assert.equal(threeCheck.selectedServices?.length, 3);

  // Four services (max exceeded)
  const fourCheck = validateServicesSelection(['s1', 's2', 's3', 's4'], mockServices);
  assert.equal(fourCheck.valid, false);
  assert.equal(fourCheck.error, 'SERVICES_MAX_THREE');

  // Inactive service
  const inactiveCheck = validateServicesSelection(['s5'], mockServices);
  assert.equal(inactiveCheck.valid, false);
  assert.equal(inactiveCheck.error, 'SERVICE_NOT_FOUND_OR_INACTIVE');
});

test('T3: Phone number validation and normalization', () => {
  // Reject 9 digits
  assert.equal(validatePhoneNumber('987654321').valid, false);
  // Reject 11 digits
  assert.equal(validatePhoneNumber('98765432100').valid, false);
  // Reject letters
  assert.equal(validatePhoneNumber('9876abc321').valid, false);
  // Reject starting with 5
  assert.equal(validatePhoneNumber('5876543210').valid, false);

  // Accept valid starting with 9, 8, 7, 6
  assert.equal(validatePhoneNumber('9876543210').valid, true);
  assert.equal(validatePhoneNumber('8123456789').valid, true);
  assert.equal(validatePhoneNumber('7012345678').valid, true);
  assert.equal(validatePhoneNumber('6987654321').valid, true);

  // Normalize spaces and dashes
  const spaced = validatePhoneNumber('98765 43210');
  assert.equal(spaced.valid, true);
  assert.equal(spaced.normalized, '9876543210');

  // Normalize +91 prefix
  const prefixed = validatePhoneNumber('+91 98765 43210');
  assert.equal(prefixed.valid, true);
  assert.equal(prefixed.normalized, '9876543210');

  // Normalize leading 0
  const zeroLead = validatePhoneNumber('09876543210');
  assert.equal(zeroLead.valid, true);
  assert.equal(zeroLead.normalized, '9876543210');
});

test('Customer name validation', () => {
  assert.equal(validateCustomerName('A').valid, false);
  assert.equal(validateCustomerName('A'.repeat(51)).valid, false);
  assert.equal(validateCustomerName('Rahul Sharma').valid, true);
  assert.equal(validateCustomerName('રોહન પટેલ').valid, true);
  assert.equal(validateCustomerName('अमित वर्मा').valid, true);
});

test('T8 & T10: Call Next in order and Preferred Barber goes first when free', () => {
  const barbers = [
    { id: 'b1', name: 'Ravi', workingToday: true, status: 'Available', isOccupied: false },
    { id: 'b2', name: 'Amit', workingToday: true, status: 'Available', isOccupied: false },
  ];

  const waiting = [
    { id: 'w1', tokenNumber: 'T-001', customerName: 'Customer A', preferredBarberId: 'b1', joinedAt: '2026-11-24T10:00:00Z' },
    { id: 'w2', tokenNumber: 'T-002', customerName: 'Customer B', preferredBarberId: null, joinedAt: '2026-11-24T10:05:00Z' },
  ];

  const result = selectNextCustomerToCall(waiting, barbers);
  assert.equal(result.entry?.tokenNumber, 'T-001');
  assert.equal(result.assignedBarber?.id, 'b1');
  assert.equal(result.skippedEntries.length, 0);
});

test('T9: Barber preference is strictly respected; busy preferred barber is skipped without misassignment', () => {
  const barbers = [
    { id: 'b1', name: 'Ravi', workingToday: true, status: 'Busy', isOccupied: true },
    { id: 'b2', name: 'Amit', workingToday: true, status: 'Available', isOccupied: false },
  ];

  const waiting = [
    // w1 prefers Ravi (who is busy)
    { id: 'w1', tokenNumber: 'T-001', customerName: 'Customer A', preferredBarberId: 'b1', joinedAt: '2026-11-24T10:00:00Z' },
    // w2 chose Any Barber
    { id: 'w2', tokenNumber: 'T-002', customerName: 'Customer B', preferredBarberId: null, joinedAt: '2026-11-24T10:05:00Z' },
  ];

  const result = selectNextCustomerToCall(waiting, barbers);
  // w2 is called for Amit! w1 is NOT assigned to Amit!
  assert.equal(result.entry?.tokenNumber, 'T-002');
  assert.equal(result.assignedBarber?.id, 'b2');
  assert.equal(result.skippedEntries.length, 1);
  assert.equal(result.skippedEntries[0].tokenNumber, 'T-001');
});

test('T11: One customer per barber & Barber on break is never assigned', () => {
  const barbers = [
    { id: 'b1', name: 'Ravi', workingToday: true, status: 'On Break', isOccupied: false },
  ];

  const waiting = [
    { id: 'w1', tokenNumber: 'T-001', customerName: 'Customer A', preferredBarberId: null, joinedAt: '2026-11-24T10:00:00Z' },
  ];

  const result = selectNextCustomerToCall(waiting, barbers);
  assert.equal(result.entry, null);
  assert.equal(result.failureReason, 'NO_AVAILABLE_BARBERS');
});

test('T12: Any Barber tie-break by fewest customers served, then alphabetical', () => {
  const barbers = [
    { id: 'b1', name: 'Ravi', workingToday: true, status: 'Available', isOccupied: false, customersServedToday: 5 },
    { id: 'b2', name: 'Amit', workingToday: true, status: 'Available', isOccupied: false, customersServedToday: 2 },
  ];

  const waiting = [
    { id: 'w1', tokenNumber: 'T-001', customerName: 'Customer A', preferredBarberId: null, joinedAt: '2026-11-24T10:00:00Z' },
  ];

  const result = selectNextCustomerToCall(waiting, barbers);
  assert.equal(result.entry?.tokenNumber, 'T-001');
  assert.equal(result.assignedBarber?.name, 'Amit'); // Amit served 2 vs Ravi's 5
});

test('T14-T18: Status transitions state machine & 10-minute No-show rule', () => {
  // Waiting -> Cancelled allowed
  assert.equal(isValidStatusTransition('Waiting', 'Cancelled', 'customer').allowed, true);
  assert.equal(isValidStatusTransition('Waiting', 'Cancelled', 'receptionist').allowed, true);

  // Waiting -> In Chair disallowed (must be Called first)
  assert.equal(isValidStatusTransition('Waiting', 'In Chair', 'barber').allowed, false);

  // Called -> In Chair allowed for barber
  assert.equal(isValidStatusTransition('Called', 'In Chair', 'barber').allowed, true);

  // Called -> No-show before 10 minutes rejected
  const now = new Date('2026-11-24T12:08:00Z');
  const calledAt = '2026-11-24T12:00:00Z'; // only 8 mins passed
  const tooEarlyCheck = isValidStatusTransition('Called', 'No-show', 'receptionist', { calledAt, now });
  assert.equal(tooEarlyCheck.allowed, false);
  assert.equal(tooEarlyCheck.errorCode, 'NO_SHOW_TOO_EARLY');

  // Called -> No-show after 10 minutes allowed
  const now11Min = new Date('2026-11-24T12:11:00Z'); // 11 mins passed
  const eligibleCheck = isValidStatusTransition('Called', 'No-show', 'receptionist', { calledAt, now: now11Min });
  assert.equal(eligibleCheck.allowed, true);

  // In Chair -> Cancelled / No-show strictly forbidden
  assert.equal(isValidStatusTransition('In Chair', 'Cancelled', 'receptionist').allowed, false);
  assert.equal(isValidStatusTransition('In Chair', 'No-show', 'receptionist').allowed, false);
  assert.equal(isValidStatusTransition('In Chair', 'Done', 'barber').allowed, true);

  // Closed states (Done, Cancelled, No-show) cannot transition to anything
  assert.equal(isValidStatusTransition('Done', 'Waiting', 'receptionist').allowed, false);
  assert.equal(isValidStatusTransition('Cancelled', 'Waiting', 'customer').allowed, false);
  assert.equal(isValidStatusTransition('No-show', 'Called', 'receptionist').allowed, false);
});

test('T19-T22: Online joining cutoff 30 minutes before closing', () => {
  const settings = {
    isOpen: true,
    isPaused: false,
    closingTime: '20:00',
  };

  // 19:29:59 -> Allowed
  const beforeCutoff = new Date('2026-11-24T19:29:00');
  assert.equal(isOnlineJoiningAllowed(settings, beforeCutoff).allowed, true);

  // 19:30:00 -> Cutoff reached, blocked
  const atCutoff = new Date('2026-11-24T19:30:00');
  const cutoffResult = isOnlineJoiningAllowed(settings, atCutoff);
  assert.equal(cutoffResult.allowed, false);
  assert.equal(cutoffResult.reason, 'cutoff');

  // Closed queue
  assert.equal(isOnlineJoiningAllowed({ isOpen: false, isPaused: false, closingTime: '20:00' }, beforeCutoff).allowed, false);
});

test('T26-T30: Waiting time estimation formula', () => {
  // T26: 4 customers ahead (20, 30, 25, 45 = 120 min) with 3 barbers -> 40 min
  const entriesAhead1 = [
    { id: '1', status: 'Waiting', totalDurationMinutes: 20 },
    { id: '2', status: 'Waiting', totalDurationMinutes: 30 },
    { id: '3', status: 'Waiting', totalDurationMinutes: 25 },
    { id: '4', status: 'Waiting', totalDurationMinutes: 45 },
  ];
  assert.equal(calculateEstimatedWaitTime(entriesAhead1, 3), 40);

  // T27: 35 minutes ahead with 2 working barbers -> 35 / 2 = 17.5 -> rounded up to 20
  const entriesAhead2 = [
    { id: '1', status: 'Waiting', totalDurationMinutes: 35 },
  ];
  assert.equal(calculateEstimatedWaitTime(entriesAhead2, 2), 20);

  // T30: In Chair remaining time (30 min expected, 10 min elapsed = 20 remaining) + 25 min Waiting / 2 barbers = (20+25)/2 = 22.5 -> 25 min
  const now = new Date('2026-11-24T12:10:00Z');
  const entriesAhead3 = [
    { id: '1', status: 'In Chair', totalDurationMinutes: 30, serviceStartedAt: '2026-11-24T12:00:00Z' },
    { id: '2', status: 'Waiting', totalDurationMinutes: 25 },
  ];
  assert.equal(calculateEstimatedWaitTime(entriesAhead3, 2, now), 25);

  // T29: Nobody ahead -> 0 min ("Right away")
  assert.equal(calculateEstimatedWaitTime([], 2), 0);
});
