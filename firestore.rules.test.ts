/**
 * Security test specification for Openline Court Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads must receive PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Profile',
    collectionPath: '/users/userB',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { uid: 'userB', displayName: 'Spoofer', skillLevel: '4.0' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'PII Leak Attempt',
    collectionPath: '/users/userB/private/info',
    operation: 'get',
    authUid: 'userA',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Profile',
    collectionPath: '/users/userA',
    operation: 'update',
    authUid: 'userA',
    emailVerified: true,
    payload: { isAdmin: true, skillLevel: '5.0+' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Email Write',
    collectionPath: '/bookings/bk_unverified',
    operation: 'create',
    authUid: 'userA',
    emailVerified: false,
    payload: { bookingId: 'bk_unverified', ownerId: 'userA', status: 'pending' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Booking Owner Spoofing',
    collectionPath: '/bookings/bk_spoof',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { bookingId: 'bk_spoof', ownerId: 'userB', status: 'pending' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned Booking without Atomic CourtSlot',
    collectionPath: '/bookings/bk_orphan',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { bookingId: 'bk_orphan', ownerId: 'userA', courtId: 'court-1', date: '2026-11-18', startHour: 10 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Resource Poisoning via Oversized Invalid ID',
    collectionPath: `/bookings/${'x'.repeat(300)}`,
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { bookingId: 'invalid$id' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Value Poisoning on Court Hour and Amount',
    collectionPath: '/bookings/bk_badvals',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { bookingId: 'bk_badvals', ownerId: 'userA', startHour: 99, totalAmount: -10 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    collectionPath: '/bookings/bk_timeforge',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { bookingId: 'bk_timeforge', ownerId: 'userA', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Bypass from Completed to Pending',
    collectionPath: '/bookings/bk_completed',
    operation: 'update',
    authUid: 'userA',
    emailVerified: true,
    payload: { status: 'pending' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Immutable OwnerId Mutation',
    collectionPath: '/bookings/bk_active',
    operation: 'update',
    authUid: 'userA',
    emailVerified: true,
    payload: { ownerId: 'userB' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Slot Deletion by Non-Owner',
    collectionPath: '/courtSlots/court-1_2026-11-18_10',
    operation: 'delete',
    authUid: 'userA',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Unpaid Shared CourtSchedule Spoof',
    collectionPath: '/courtSchedules/bk_unpaid',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { scheduleId: 'bk_unpaid', bookingId: 'bk_unpaid', ownerId: 'userA', status: 'current', isActive: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
