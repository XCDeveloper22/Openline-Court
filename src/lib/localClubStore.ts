import { getPhilippineSlotTimestampMs } from '../data/courts';
import {
  CourtBooking,
  CourtSchedule,
  CourtSlot,
  PaymentTransaction,
  UserPrivateInfo,
  UserProfile
} from '../types';

const STORAGE_KEY = 'openline_club_store_v1';

interface LocalClubStoreData {
  profiles: Record<string, UserProfile>;
  privateInfos: Record<string, UserPrivateInfo>;
  bookings: CourtBooking[];
  transactions: PaymentTransaction[];
  reservedSlots: CourtSlot[];
  sharedSchedules: CourtSchedule[];
}

const listeners = new Set<() => void>();

function readStore(): LocalClubStoreData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalClubStoreData>;
      const now = Date.now();
      const rawSlots = Array.isArray(parsed.reservedSlots) ? parsed.reservedSlots : [];
      const activeSlots = rawSlots.filter((slot) => {
        const start = slot.startHour ?? slot.hour;
        const dur = slot.durationHours ?? 1;
        return getPhilippineSlotTimestampMs(slot.date, start + dur) > now;
      });
      return {
        profiles: parsed.profiles ?? {},
        privateInfos: parsed.privateInfos ?? {},
        bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        reservedSlots: activeSlots,
        sharedSchedules: Array.isArray(parsed.sharedSchedules) ? parsed.sharedSchedules : []
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    profiles: {},
    privateInfos: {},
    bookings: [],
    transactions: [],
    reservedSlots: [],
    sharedSchedules: []
  };
}

function writeStore(data: LocalClubStoreData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
  listeners.forEach((cb) => cb());
}

export function subscribeLocalClubStore(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function ensureLocalUserProfile(uid: string, email: string): {
  profile: UserProfile;
  privateInfo: UserPrivateInfo;
} {
  const store = readStore();
  let changed = false;

  if (!store.profiles[uid]) {
    const fallbackName = email?.split('@')[0]?.slice(0, 80) || 'Openline Player';
    store.profiles[uid] = {
      uid,
      displayName: fallbackName,
      photoUrl: '',
      skillLevel: '3.5',
      dominantHand: 'Right',
      preferredCourtId: 'court-1',
      bio: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    changed = true;
  }

  if (!store.privateInfos[uid]) {
    store.privateInfos[uid] = {
      uid,
      email: (email || '').slice(0, 160),
      phone: '',
      updatedAt: new Date().toISOString()
    };
    changed = true;
  }

  if (changed) {
    writeStore(store);
  }

  return {
    profile: store.profiles[uid],
    privateInfo: store.privateInfos[uid]
  };
}

export function getLocalClubSnapshot(uid: string, email: string): {
  profile: UserProfile;
  privateInfo: UserPrivateInfo;
  bookings: CourtBooking[];
  transactions: PaymentTransaction[];
  reservedSlots: CourtSlot[];
  sharedSchedules: CourtSchedule[];
} {
  const { profile, privateInfo } = ensureLocalUserProfile(uid, email);
  const store = readStore();
  return {
    profile,
    privateInfo,
    bookings: store.bookings.filter((b) => b.ownerId === uid),
    transactions: store.transactions.filter((t) => t.ownerId === uid),
    reservedSlots: store.reservedSlots,
    sharedSchedules: store.sharedSchedules.filter((s) => s.isActive)
  };
}

export function localReserveBookingAndSlots(
  booking: CourtBooking,
  newSlots: CourtSlot[]
): { ok: true } | { ok: false; reason: 'conflict' } {
  const store = readStore();
  const existingKeys = new Set(store.reservedSlots.map((s) => s.slotKey));
  if (newSlots.some((s) => existingKeys.has(s.slotKey))) {
    return { ok: false, reason: 'conflict' };
  }
  store.bookings.push(booking);
  store.reservedSlots.push(...newSlots);
  writeStore(store);
  return { ok: true };
}

export function localConfirmQRPayment(
  bookingId: string,
  updates: {
    status: 'current' | 'pending';
    paymentMethod: string;
    gcashReferenceNo: string;
    gcashSenderNumber: string;
    receiptNumber: string;
    paidAtIso: string;
  },
  tx: PaymentTransaction,
  schedule: CourtSchedule
): void {
  const store = readStore();
  store.bookings = store.bookings.map((b) =>
    b.bookingId === bookingId
      ? {
          ...b,
          ...updates,
          paymentStatus: 'paid',
          updatedAt: new Date().toISOString()
        }
      : b
  );
  store.transactions.push(tx);
  store.sharedSchedules = [
    ...store.sharedSchedules.filter((s) => s.scheduleId !== schedule.scheduleId),
    schedule
  ];
  writeStore(store);
}

export function localCancelUnpaidBooking(bookingId: string, slotKeys: string[]): void {
  const store = readStore();
  const keySet = new Set(slotKeys);
  store.bookings = store.bookings.map((b) =>
    b.bookingId === bookingId
      ? { ...b, status: 'cancelled', updatedAt: new Date().toISOString() }
      : b
  );
  store.reservedSlots = store.reservedSlots.filter((s) => !keySet.has(s.slotKey));
  writeStore(store);
}

export function localPromoteBooking(bookingId: string): void {
  const store = readStore();
  const nowIso = new Date().toISOString();
  store.bookings = store.bookings.map((b) =>
    b.bookingId === bookingId ? { ...b, status: 'current', updatedAt: nowIso } : b
  );
  store.sharedSchedules = store.sharedSchedules.map((s) =>
    s.scheduleId === bookingId ? { ...s, status: 'current', updatedAt: nowIso } : s
  );
  writeStore(store);
}

export function localCheckInBooking(bookingId: string): void {
  const store = readStore();
  const nowIso = new Date().toISOString();
  store.bookings = store.bookings.map((b) =>
    b.bookingId === bookingId ? { ...b, checkedIn: true, updatedAt: nowIso } : b
  );
  store.sharedSchedules = store.sharedSchedules.map((s) =>
    s.scheduleId === bookingId ? { ...s, checkedIn: true, updatedAt: nowIso } : s
  );
  writeStore(store);
}

export function localCompleteBooking(
  bookingId: string,
  scoreSummary: string,
  slotKeys: string[]
): void {
  const store = readStore();
  const nowIso = new Date().toISOString();
  const keySet = new Set(slotKeys);
  store.bookings = store.bookings.map((b) =>
    b.bookingId === bookingId
      ? {
          ...b,
          status: 'completed',
          checkedIn: true,
          scoreSummary,
          updatedAt: nowIso
        }
      : b
  );
  store.sharedSchedules = store.sharedSchedules.map((s) =>
    s.scheduleId === bookingId
      ? {
          ...s,
          status: 'completed',
          isActive: false,
          checkedIn: true,
          scoreSummary,
          updatedAt: nowIso
        }
      : s
  );
  store.reservedSlots = store.reservedSlots.filter((s) => !keySet.has(s.slotKey));
  writeStore(store);
}

export function localUpdateBookingPartners(bookingId: string, partnerNames: string): void {
  const store = readStore();
  store.bookings = store.bookings.map((b) =>
    b.bookingId === bookingId
      ? { ...b, partnerNames, updatedAt: new Date().toISOString() }
      : b
  );
  writeStore(store);
}

export function localRescheduleBooking(
  bookingId: string,
  newDate: string,
  newStartHour: number,
  oldKeys: string[],
  newSlots: CourtSlot[]
): { ok: true } | { ok: false; reason: 'conflict' } {
  const store = readStore();
  const oldSet = new Set(oldKeys);
  const remainingSlots = store.reservedSlots.filter((s) => !oldSet.has(s.slotKey));
  const remainingKeys = new Set(remainingSlots.map((s) => s.slotKey));
  if (newSlots.some((s) => remainingKeys.has(s.slotKey))) {
    return { ok: false, reason: 'conflict' };
  }
  const nowIso = new Date().toISOString();
  store.reservedSlots = [...remainingSlots, ...newSlots];
  store.bookings = store.bookings.map((b) =>
    b.bookingId === bookingId
      ? { ...b, date: newDate, startHour: newStartHour, updatedAt: nowIso }
      : b
  );
  store.sharedSchedules = store.sharedSchedules.map((s) =>
    s.scheduleId === bookingId
      ? { ...s, date: newDate, startHour: newStartHour, updatedAt: nowIso }
      : s
  );
  writeStore(store);
  return { ok: true };
}

export function localSaveUserProfile(
  uid: string,
  profilePatch: Partial<UserProfile>,
  phone: string
): void {
  const store = readStore();
  const nowIso = new Date().toISOString();
  if (store.profiles[uid]) {
    store.profiles[uid] = { ...store.profiles[uid], ...profilePatch, updatedAt: nowIso };
  }
  if (store.privateInfos[uid]) {
    store.privateInfos[uid] = { ...store.privateInfos[uid], phone, updatedAt: nowIso };
  }
  writeStore(store);
}
