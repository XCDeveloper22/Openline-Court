import { CourtBooking, CourtId, CourtInfo, CourtSchedule, CourtSlot, MatchFormat } from '../types';

export const CLUB_INFO = {
  name: 'Openline Court',
  location: 'Soriano, Cabadbaran City, Agusan del Norte',
  operatingHours: '7:00 AM – 10:00 PM',
  timezone: 'Asia/Manila',
  timezoneLabel: 'Philippine Time (PHT)',
  facebookUrl: 'https://www.facebook.com/openlinecourt',
  facebookLabel: 'facebook.com/openlinecourt'
} as const;

export const GCASH_ACCOUNT = {
  accountName: 'OPENLINE COURT CLUB',
  accountNumber: '0917-842-6190'
};

export const COURTS: CourtInfo[] = [
  {
    id: 'court-1',
    name: 'Court 1',
    surface: 'Cushioned Pro Acrylic',
    environment: 'Indoor Climate-Controlled',
    lighting: '5000K Linear Arena LED',
    hourlyRate: 250,
    image: '/src/assets/images/court_championship_indoor_1794934163360.jpg',
    description:
      'Tournament-grade indoor pickleball court with acoustic baffling, competition net tension, and viewing gallery.'
  },
  {
    id: 'court-2',
    name: 'Court 2',
    surface: 'High-Contrast Acrylic',
    environment: 'Outdoor Perimeter Windscreen',
    lighting: 'Glare-Free Court Floods',
    hourlyRate: 250,
    image: '/src/assets/images/court_tournament_acrylic_1794934164080.jpg',
    description:
      'Fast-playing outdoor pickleball court bordered by tall conifers and dark mesh windscreens.'
  }
];

// Open 7:00 AM to 10:00 PM PHT (last 1-hour slot starts at 9:00 PM and ends at 10:00 PM)
export const COURT_HOURS = Array.from({ length: 15 }, (_, idx) => idx + 7);

export const PADDLE_RENTAL_FEE = 100;

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  singles: 'Singles (1v1)',
  doubles: 'Doubles (2v2)',
  drills: 'Open Drills'
};

export function getCourtById(courtId: CourtId | string): CourtInfo {
  return COURTS.find((court) => court.id === courtId) ?? COURTS[0];
}

export function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${period}`;
}

export function formatHourRange(startHour: number, durationHours: number): string {
  return `${formatHour(startHour)} – ${formatHour(startHour + durationHours)}`;
}

export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`;
}

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getPhilippineNowParts(nowMs: number = Date.now()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoDate: string;
} {
  const pht = new Date(nowMs + PHT_OFFSET_MS);
  const year = pht.getUTCFullYear();
  const month = pht.getUTCMonth() + 1;
  const day = pht.getUTCDate();
  const hour = pht.getUTCHours();
  const minute = pht.getUTCMinutes();
  const second = pht.getUTCSeconds();
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, minute, second, isoDate };
}

export function getPhilippineSlotTimestampMs(isoDate: string, hour: number): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1, hour - 8, 0, 0, 0);
}

export function formatPhilippineClock(nowMs: number = Date.now()): string {
  return new Date(nowMs).toLocaleTimeString('en-US', {
    timeZone: CLUB_INFO.timezone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

export interface DateOption {
  iso: string;
  dayShort: string;
  dateLabel: string;
  isToday: boolean;
}

export function getUpcomingDates(days = 14): DateOption[] {
  const result: DateOption[] = [];
  const today = getPhilippineNowParts();
  for (let i = 0; i < days; i += 1) {
    const noonUtc = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12, 0, 0));
    const yyyy = noonUtc.getUTCFullYear();
    const mm = String(noonUtc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(noonUtc.getUTCDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const dayShort =
      i === 0
        ? 'Today'
        : noonUtc.toLocaleDateString('en-US', { weekday: 'short', timeZone: CLUB_INFO.timezone });
    const dateLabel = noonUtc.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: CLUB_INFO.timezone
    });
    result.push({ iso, dayShort, dateLabel, isToday: i === 0 });
  }
  return result;
}

export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return noonUtc.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: CLUB_INFO.timezone
  });
}

export function generateCheckInCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'OL';
  for (let i = 0; i < 4; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateReceiptNumber(): string {
  const pht = getPhilippineNowParts();
  const stamp = `${pht.year}${String(pht.month).padStart(2, '0')}${String(pht.day).padStart(
    2,
    '0'
  )}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `OLR-${stamp}-${suffix}`;
}

export function createBookingId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `bk_${Date.now()}_${rand}`;
}

export function createTxId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `tx_${Date.now()}_${rand}`;
}

export function makeSlotKey(courtId: CourtId, date: string, hour: number): string {
  return `${courtId}_${date}_${hour}`;
}

export interface QueueAnalysis {
  aheadCount: number;
  queueNumber: number;
  aheadStartHour: number | null;
  aheadDurationHours: number | null;
}

export function computeCourtQueueInfo(
  slots: CourtSlot[],
  courtId: CourtId,
  date: string,
  targetStartHour: number,
  excludeBookingId?: string,
  nowMs: number = Date.now()
): QueueAnalysis {
  const seenBookings = new Map<string, { startHour: number; durationHours: number }>();

  slots.forEach((slot) => {
    if (
      slot.courtId === courtId &&
      slot.date === date &&
      slot.status === 'reserved' &&
      slot.bookingId !== excludeBookingId
    ) {
      const sStart = slot.startHour ?? slot.hour;
      const sDur = slot.durationHours ?? 1;
      if (getPhilippineSlotTimestampMs(slot.date, sStart + sDur) <= nowMs) {
        return;
      }
      if (!seenBookings.has(slot.bookingId)) {
        seenBookings.set(slot.bookingId, {
          startHour: sStart,
          durationHours: sDur
        });
      }
    }
  });

  const earlierBookings = Array.from(seenBookings.values())
    .filter((item) => item.startHour < targetStartHour)
    .sort((a, b) => a.startHour - b.startHour);

  const aheadCount = earlierBookings.length;
  const immediateAhead = earlierBookings[earlierBookings.length - 1] ?? null;

  return {
    aheadCount,
    queueNumber: aheadCount + 1,
    aheadStartHour: immediateAhead ? immediateAhead.startHour : null,
    aheadDurationHours: immediateAhead ? immediateAhead.durationHours : null
  };
}

export function partitionActiveSchedules(
  sharedSchedules: CourtSchedule[],
  ownBookings: CourtBooking[],
  reservedSlots: CourtSlot[],
  uid: string,
  nowMs: number = Date.now()
): { currentSchedules: CourtSchedule[]; pendingSchedules: CourtSchedule[] } {
  const activeCourtIds = new Set<string>(COURTS.map((c) => c.id));
  const combined = new Map<string, CourtSchedule>();

  sharedSchedules.forEach((sch) => {
    if (!sch.isActive || !activeCourtIds.has(sch.courtId)) return;
    combined.set(sch.bookingId, sch);
  });

  ownBookings.forEach((b) => {
    if ((b.status !== 'current' && b.status !== 'pending') || !activeCourtIds.has(b.courtId)) {
      return;
    }
    if (!combined.has(b.bookingId)) {
      combined.set(b.bookingId, {
        scheduleId: b.bookingId,
        bookingId: b.bookingId,
        ownerId: b.ownerId,
        playerDisplayName: 'Your Schedule',
        courtId: b.courtId,
        courtName: b.courtName,
        date: b.date,
        startHour: b.startHour,
        durationHours: b.durationHours,
        matchFormat: b.matchFormat,
        status: b.status,
        isActive: true,
        checkedIn: b.checkedIn,
        scoreSummary: b.scoreSummary,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      });
    }
  });

  const currentSchedules: CourtSchedule[] = [];
  const pendingSchedules: CourtSchedule[] = [];

  combined.forEach((sch) => {
    const endMs = getPhilippineSlotTimestampMs(sch.date, sch.startHour + sch.durationHours);
    if (endMs <= nowMs) {
      return;
    }
    const queue = computeCourtQueueInfo(
      reservedSlots,
      sch.courtId,
      sch.date,
      sch.startHour,
      sch.bookingId,
      nowMs
    );
    if (sch.status === 'current' || (sch.status === 'pending' && queue.aheadCount === 0)) {
      currentSchedules.push({ ...sch, status: 'current' });
    } else if (sch.status === 'pending') {
      pendingSchedules.push(sch);
    }
  });

  const sortFn = (a: CourtSchedule, b: CourtSchedule) => {
    const aOwn = a.ownerId === uid ? 0 : 1;
    const bOwn = b.ownerId === uid ? 0 : 1;
    if (aOwn !== bOwn) return aOwn - bOwn;
    return a.date.localeCompare(b.date) || a.startHour - b.startHour;
  };

  currentSchedules.sort(sortFn);
  pendingSchedules.sort(sortFn);

  return { currentSchedules, pendingSchedules };
}

export interface ScheduleTimerState {
  phase: 'upcoming' | 'live' | 'ended';
  formattedRemaining: string;
  formattedUntilStart: string;
  formattedTotalDuration: string;
  progressPercent: number;
}

export function getScheduleTimerState(
  date: string,
  startHour: number,
  durationHours: number,
  nowMs: number
): ScheduleTimerState {
  const startMs = getPhilippineSlotTimestampMs(date, startHour);
  const endMs = getPhilippineSlotTimestampMs(date, startHour + durationHours);
  const totalMs = Math.max(1, endMs - startMs);

  const formatFromSeconds = (totalSec: number): string => {
    const clamped = Math.max(0, totalSec);
    const hrs = Math.floor(clamped / 3600);
    const mins = Math.floor((clamped % 3600) / 60);
    const secs = clamped % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(
      2,
      '0'
    )}`;
  };

  const totalSec = Math.round(totalMs / 1000);
  const formattedTotalDuration = formatFromSeconds(totalSec);

  if (nowMs < startMs) {
    const untilStartSec = Math.ceil((startMs - nowMs) / 1000);
    return {
      phase: 'upcoming',
      formattedRemaining: formattedTotalDuration,
      formattedUntilStart: formatFromSeconds(untilStartSec),
      formattedTotalDuration,
      progressPercent: 0
    };
  }

  if (nowMs >= endMs) {
    return {
      phase: 'ended',
      formattedRemaining: '00:00:00',
      formattedUntilStart: '00:00:00',
      formattedTotalDuration,
      progressPercent: 100
    };
  }

  const elapsedMs = nowMs - startMs;
  const remainingSec = Math.ceil((endMs - nowMs) / 1000);
  const pct = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));

  return {
    phase: 'live',
    formattedRemaining: formatFromSeconds(remainingSec),
    formattedUntilStart: '00:00:00',
    formattedTotalDuration,
    progressPercent: pct
  };
}
