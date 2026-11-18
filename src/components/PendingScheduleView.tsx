import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Edit3, Hourglass, Receipt, Sparkles, Users } from 'lucide-react';
import { PickleballPaddleIcon } from './PickleballIcons';
import {
  computeCourtQueueInfo,
  COURT_HOURS,
  COURTS,
  formatCurrency,
  formatDisplayDate,
  formatHour,
  formatHourRange,
  getCourtById,
  getPhilippineNowParts,
  getUpcomingDates,
  makeSlotKey,
  MATCH_FORMAT_LABELS,
  partitionActiveSchedules
} from '../data/courts';
import { supabaseRescheduleBooking, supabaseUpdateBookingPartners } from '../lib/supabaseClub';
import { CourtBooking, CourtId, CourtSchedule, CourtSlot } from '../types';

interface PendingScheduleViewProps {
  uid: string;
  bookings: CourtBooking[];
  sharedSchedules: CourtSchedule[];
  reservedSlots: CourtSlot[];
  loading: boolean;
  onShowReceipt: (booking: CourtBooking) => void;
  onBookCourt?: () => void;
}

export const PendingScheduleView: React.FC<PendingScheduleViewProps> = ({
  uid,
  bookings,
  sharedSchedules,
  reservedSlots,
  loading,
  onShowReceipt,
  onBookCourt
}) => {
  const upcomingDates = useMemo(() => getUpcomingDates(14), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingPartnersId, setEditingPartnersId] = useState<string | null>(null);
  const [partnersDraft, setPartnersDraft] = useState('');
  const [reschedulingBooking, setReschedulingBooking] = useState<CourtBooking | null>(null);
  const [newDate, setNewDate] = useState(upcomingDates[0].iso);
  const [newHour, setNewHour] = useState<number | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [courtFilter, setCourtFilter] = useState<'all' | CourtId>('all');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ownBookingsMap = useMemo(() => {
    const map: Record<string, CourtBooking> = {};
    bookings.forEach((b) => {
      map[b.bookingId] = b;
    });
    return map;
  }, [bookings]);

  const { pendingSchedules: allPendingSchedules } = useMemo(
    () => partitionActiveSchedules(sharedSchedules, bookings, reservedSlots, uid, nowMs),
    [sharedSchedules, bookings, reservedSlots, uid, nowMs]
  );

  const visiblePendingSchedules = useMemo(() => {
    if (courtFilter === 'all') return allPendingSchedules;
    return allPendingSchedules.filter((s) => s.courtId === courtFilter);
  }, [allPendingSchedules, courtFilter]);

  const slotMap = useMemo(() => {
    const map: Record<string, CourtSlot> = {};
    reservedSlots.forEach((s) => {
      map[s.slotKey] = s;
    });
    return map;
  }, [reservedSlots]);

  const handleSavePartners = async (booking: CourtBooking) => {
    setBusyId(booking.bookingId);
    try {
      const cleanPartners = partnersDraft.trim().slice(0, 120);
      await supabaseUpdateBookingPartners(booking.bookingId, cleanPartners, uid);
      setEditingPartnersId(null);
    } catch (error) {
      setRescheduleError(error instanceof Error ? error.message : 'Unable to save partners.');
    } finally {
      setBusyId(null);
    }
  };

  const isSlotFreeForReschedule = (booking: CourtBooking, hour: number): boolean => {
    if (booking.durationHours === 2 && hour >= 21) return false;
    const isToday = newDate === upcomingDates[0].iso;
    if (isToday && hour < getPhilippineNowParts().hour) return false;

    const k1 = makeSlotKey(booking.courtId, newDate, hour);
    const s1 = slotMap[k1];
    if (s1 && s1.bookingId !== booking.bookingId) return false;

    if (booking.durationHours === 2) {
      const k2 = makeSlotKey(booking.courtId, newDate, hour + 1);
      const s2 = slotMap[k2];
      if (s2 && s2.bookingId !== booking.bookingId) return false;
    }
    return true;
  };

  const handleApplyReschedule = async (booking: CourtBooking) => {
    setRescheduleError(null);
    if (newHour === null) {
      setRescheduleError('Select a new start time.');
      return;
    }
    if (newDate === booking.date && newHour === booking.startHour) {
      setReschedulingBooking(null);
      return;
    }

    setBusyId(booking.bookingId);
    try {
      const oldKeys = [makeSlotKey(booking.courtId, booking.date, booking.startHour)];
      if (booking.durationHours === 2) {
        oldKeys.push(makeSlotKey(booking.courtId, booking.date, booking.startHour + 1));
      }
      const newKeys = [makeSlotKey(booking.courtId, newDate, newHour)];
      if (booking.durationHours === 2) {
        newKeys.push(makeSlotKey(booking.courtId, newDate, newHour + 1));
      }

      const newSlots: CourtSlot[] = newKeys.map((key, idx) => ({
        slotKey: key,
        courtId: booking.courtId,
        date: newDate,
        hour: newHour + idx,
        startHour: newHour,
        durationHours: booking.durationHours,
        bookingId: booking.bookingId,
        ownerId: uid,
        status: 'reserved',
        createdAt: new Date().toISOString()
      }));
      const res = await supabaseRescheduleBooking(
        booking.bookingId,
        newDate,
        newHour,
        oldKeys,
        newSlots,
        uid
      );
      if (!res.ok) {
        setRescheduleError('Selected slot was taken. Please pick another open hour.');
        return;
      }
      setReschedulingBooking(null);
      setNewHour(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setRescheduleError(msg || 'Unable to reschedule booking in Supabase.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-pink-200/80 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="h-6 w-56 bg-pink-50 rounded" />
        <div className="h-24 w-full bg-pink-50 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="font-display text-[clamp(1.45rem,2.5vw,2.1rem)] font-semibold tracking-tight text-slate-900">
          Up Next
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Paid turns waiting in line. Courts move up automatically when the match ahead finishes.
        </p>
      </div>

      {/* Court Filter Tabs */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Filter next schedules by court"
      >
        <button
          type="button"
          role="tab"
          aria-selected={courtFilter === 'all'}
          onClick={() => setCourtFilter('all')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors tabular-nums ${
            courtFilter === 'all'
              ? 'bg-[#BE185D] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Courts ({allPendingSchedules.length})
        </button>
        {COURTS.map((c) => {
          const count = allPendingSchedules.filter((s) => s.courtId === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={courtFilter === c.id}
              onClick={() => setCourtFilter(c.id)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-colors tabular-nums ${
                courtFilter === c.id
                  ? 'bg-[#BE185D] text-white font-semibold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {c.name.split('·')[0].trim()} ({count})
            </button>
          );
        })}
      </div>

      {visiblePendingSchedules.length === 0 ? (
        <div className="surface-2026 rounded-3xl p-8 sm:p-10 text-center space-y-3">
          <PickleballPaddleIcon className="w-8 h-8 text-[#BE185D] mx-auto" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No turns waiting in line
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Later bookings queued behind an active match appear here.
          </p>
          {onBookCourt && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onBookCourt}
                className="min-h-[44px] px-5 py-2.5 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] transition-colors cursor-pointer"
              >
                Book a Court
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {visiblePendingSchedules.map((schedule) => {
            const ownBooking = ownBookingsMap[schedule.bookingId] ?? null;
            const isMine = schedule.ownerId === uid && Boolean(ownBooking);
            const isBusy = busyId === schedule.bookingId;
            const isEditingPartners = editingPartnersId === schedule.bookingId;
            const isRescheduling = reschedulingBooking?.bookingId === schedule.bookingId;
            const queue = computeCourtQueueInfo(
              reservedSlots,
              schedule.courtId,
              schedule.date,
              schedule.startHour,
              schedule.bookingId,
              nowMs,
              sharedSchedules
            );

            return (
              <section
                key={schedule.scheduleId}
                className={`rounded-3xl p-5 sm:p-6 2xl:p-7 space-y-5 ${
                  isMine ? 'bg-white border-2 border-[#BE185D]' : 'surface-2026'
                }`}
              >
                {/* Queue Status Banner */}
                <div className="p-4 rounded-xl bg-pink-50 border border-pink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {queue.aheadCount === 0 ? (
                      <Sparkles className="w-5 h-5 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Hourglass className="w-5 h-5 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#831843]">
                        {queue.aheadCount === 0
                          ? isMine
                            ? 'Your Turn Now — Activating Current Schedule...'
                            : `${schedule.playerDisplayName}'s Turn Now`
                          : `Queue #${queue.queueNumber} · Waiting for ${queue.aheadCount} ahead`}
                      </p>
                      <p className="mt-0.5 text-xs text-pink-900 leading-relaxed">
                        {queue.aheadStartHour !== null && queue.aheadDurationHours !== null
                          ? `Current match ahead plays ${formatHourRange(
                              queue.aheadStartHour,
                              queue.aheadDurationHours
                            )}. Once that court turn finishes, the next turn activates automatically.`
                          : 'Paid via GCash QR and queued on the club schedule.'}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#831843] tabular-nums shrink-0 self-start sm:self-center">
                    {isMine && ownBooking
                      ? `Receipt ${ownBooking.receiptNumber || ownBooking.checkInCode}`
                      : schedule.playerDisplayName}
                  </span>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-[#BE185D]">
                        {isMine ? 'Your Next Schedule' : `Queued Player: ${schedule.playerDisplayName}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDisplayDate(schedule.date)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {formatHourRange(schedule.startHour, schedule.durationHours)}
                      </span>
                    </div>

                    <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900">
                      {getCourtById(schedule.courtId).name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                      <span>{MATCH_FORMAT_LABELS[schedule.matchFormat]}</span>
                      {isMine && ownBooking && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Code{' '}
                            <strong className="font-mono text-slate-900">
                              {ownBooking.checkInCode}
                            </strong>
                          </span>
                          {ownBooking.partnerNames && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Players: {ownBooking.partnerNames}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-900 tabular-nums">
                            {formatCurrency(ownBooking.totalAmount)}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      {isMine
                        ? 'Confirmed reservation · No cancellations or refunds.'
                        : 'Live club queue · Visible to all players on desktop and mobile.'}
                    </p>
                  </div>

                  {isMine && ownBooking ? (
                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onShowReceipt(ownBooking)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#BE185D] text-white text-sm font-medium rounded-xl hover:bg-[#9D174D] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Receipt className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>View Receipt</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingPartnersId(isEditingPartners ? null : ownBooking.bookingId);
                          setPartnersDraft(ownBooking.partnerNames);
                          setReschedulingBooking(null);
                        }}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-pink-200 text-[#831843] bg-pink-50/60 text-sm font-medium rounded-xl hover:bg-pink-100 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Partners</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          if (isRescheduling) {
                            setReschedulingBooking(null);
                          } else {
                            setReschedulingBooking(ownBooking);
                            setNewDate(ownBooking.date);
                            setNewHour(ownBooking.startHour);
                            setEditingPartnersId(null);
                            setRescheduleError(null);
                          }
                        }}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-pink-200 text-[#831843] bg-pink-50/60 text-sm font-medium rounded-xl hover:bg-pink-100 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Reschedule</span>
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                      <Users className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
                      <span>Reserved slot in queue</span>
                    </div>
                  )}
                </div>

                {isMine && ownBooking && isEditingPartners && (
                  <div className="pt-4 border-t border-pink-100 flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                      <label
                        htmlFor={`partners-${ownBooking.bookingId}`}
                        className="block text-xs font-medium text-slate-700"
                      >
                        Partner &amp; Opponent Names
                      </label>
                      <input
                        id={`partners-${ownBooking.bookingId}`}
                        type="text"
                        maxLength={120}
                        value={partnersDraft}
                        onChange={(e) => setPartnersDraft(e.target.value)}
                        placeholder="Add player names"
                        className="mt-1 w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#BE185D]"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSavePartners(ownBooking)}
                        className="min-h-[44px] px-4 py-2 bg-[#BE185D] text-white text-sm font-medium rounded-xl hover:bg-[#9D174D] cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPartnersId(null)}
                        className="min-h-[44px] px-3.5 py-2 border border-pink-200 text-[#831843] text-sm font-medium rounded-xl hover:bg-pink-50 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {isMine && ownBooking && isRescheduling && (
                  <div className="pt-4 border-t border-pink-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor={`resched-date-${ownBooking.bookingId}`}
                          className="block text-xs font-medium text-slate-700"
                        >
                          New Date
                        </label>
                        <select
                          id={`resched-date-${ownBooking.bookingId}`}
                          value={newDate}
                          onChange={(e) => {
                            setNewDate(e.target.value);
                            setNewHour(null);
                          }}
                          className="mt-1 w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                        >
                          {upcomingDates.map((d) => (
                            <option key={d.iso} value={d.iso}>
                              {d.dayShort} · {d.dateLabel} ({d.iso})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`resched-hour-${ownBooking.bookingId}`}
                          className="block text-xs font-medium text-slate-700"
                        >
                          New Start Time ({ownBooking.durationHours} hr)
                        </label>
                        <select
                          id={`resched-hour-${ownBooking.bookingId}`}
                          value={newHour ?? ''}
                          onChange={(e) => setNewHour(Number(e.target.value))}
                          className="mt-1 w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                        >
                          <option value="" disabled>
                            Choose an open slot
                          </option>
                          {COURT_HOURS.map((hr) => {
                            const free = isSlotFreeForReschedule(ownBooking, hr);
                            return (
                              <option key={hr} value={hr} disabled={!free}>
                                {formatHour(hr)} {free ? '— Available' : '— Unavailable'}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {rescheduleError && <p className="text-xs text-red-700">{rescheduleError}</p>}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy || newHour === null}
                        onClick={() => handleApplyReschedule(ownBooking)}
                        className="min-h-[44px] px-4 py-2 bg-[#BE185D] text-white text-sm font-medium rounded-xl hover:bg-[#9D174D] disabled:opacity-50 cursor-pointer"
                      >
                        Confirm New Time
                      </button>
                      <button
                        type="button"
                        onClick={() => setReschedulingBooking(null)}
                        className="min-h-[44px] px-3.5 py-2 border border-pink-200 text-[#831843] text-sm font-medium rounded-xl hover:bg-pink-50 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
