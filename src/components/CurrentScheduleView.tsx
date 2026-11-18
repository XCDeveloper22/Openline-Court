import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Receipt, Trophy, Users } from 'lucide-react';
import { CourtLinesBackdrop, PickleballBallIcon } from './PickleballIcons';
import {
  COURTS,
  formatCurrency,
  formatDisplayDate,
  formatHour,
  formatHourRange,
  formatPhilippineClock,
  getCourtById,
  getScheduleTimerState,
  getUpcomingDates,
  makeSlotKey,
  MATCH_FORMAT_LABELS,
  partitionActiveSchedules
} from '../data/courts';
import { supabaseCheckInBooking, supabaseCompleteBooking } from '../lib/supabaseClub';
import { CourtBooking, CourtId, CourtSchedule, CourtSlot } from '../types';

interface CurrentScheduleViewProps {
  uid: string;
  bookings: CourtBooking[];
  sharedSchedules: CourtSchedule[];
  reservedSlots: CourtSlot[];
  loading: boolean;
  onShowReceipt: (booking: CourtBooking) => void;
  onBookCourt?: () => void;
}

export const CurrentScheduleView: React.FC<CurrentScheduleViewProps> = ({
  uid,
  bookings,
  sharedSchedules,
  reservedSlots,
  loading,
  onShowReceipt,
  onBookCourt
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [courtFilter, setCourtFilter] = useState<'all' | CourtId>('all');

  const todayIso = useMemo(() => getUpcomingDates(1)[0].iso, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  const liveClockLabel = useMemo(() => formatPhilippineClock(nowMs), [nowMs]);

  const ownBookingsMap = useMemo(() => {
    const map: Record<string, CourtBooking> = {};
    bookings.forEach((b) => {
      map[b.bookingId] = b;
    });
    return map;
  }, [bookings]);

  const { currentSchedules: allCurrentSchedules } = useMemo(
    () => partitionActiveSchedules(sharedSchedules, bookings, reservedSlots, uid, nowMs),
    [sharedSchedules, bookings, reservedSlots, uid, nowMs]
  );

  const visibleCurrentSchedules = useMemo(() => {
    if (courtFilter === 'all') return allCurrentSchedules;
    return allCurrentSchedules.filter((s) => s.courtId === courtFilter);
  }, [allCurrentSchedules, courtFilter]);

  const completedBookings = useMemo(
    () =>
      bookings
        .filter(
          (b) => b.status === 'completed' && (b.courtId === 'court-1' || b.courtId === 'court-2')
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.startHour - a.startHour),
    [bookings]
  );

  const handleCheckIn = async (booking: CourtBooking) => {
    setActionError(null);
    setBusyId(booking.bookingId);
    try {
      await supabaseCheckInBooking(booking.bookingId, uid);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to check in.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCompleteMatch = async (booking: CourtBooking) => {
    setActionError(null);
    setBusyId(booking.bookingId);
    try {
      const cleanScore = scoreInput.trim().slice(0, 64);
      const keys = [makeSlotKey(booking.courtId, booking.date, booking.startHour)];
      if (booking.durationHours === 2) {
        keys.push(makeSlotKey(booking.courtId, booking.date, booking.startHour + 1));
      }
      await supabaseCompleteBooking(booking.bookingId, cleanScore, keys, uid);
      setCompletingId(null);
      setScoreInput('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to complete schedule.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-pink-200/80 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="h-6 w-56 bg-pink-50 rounded" />
        <div className="h-32 w-full bg-pink-50 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.45rem,2.5vw,2.1rem)] font-semibold tracking-tight text-slate-900">
            Playing Now
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            See who is on Court 1 and Court 2 right now.
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl surface-2026 flex items-center justify-between sm:justify-start gap-2.5 shrink-0">
          <span className="text-xs font-medium text-slate-500">PHT</span>
          <span className="font-mono text-xs sm:text-sm font-semibold text-[#831843] tabular-nums">
            {liveClockLabel}
          </span>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">
          {actionError}
        </div>
      )}

      {/* Live 2-Court Status Strip (Visible on Mobile & Desktop) */}
      <section aria-label="Live 2-Court Status" className="grid grid-cols-1 md:grid-cols-2 gap-4 2xl:gap-5">
        {COURTS.map((court) => {
          const courtSchedules = allCurrentSchedules
            .filter((s) => s.courtId === court.id)
            .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);

          const liveNowMatch = courtSchedules.find(
            (s) => getScheduleTimerState(s.date, s.startHour, s.durationHours, nowMs).phase === 'live'
          );
          const activeNow =
            liveNowMatch ??
            courtSchedules.find((s) => s.date === todayIso) ??
            courtSchedules[0] ??
            null;

          const timer = activeNow
            ? getScheduleTimerState(activeNow.date, activeNow.startHour, activeNow.durationHours, nowMs)
            : null;
          const isMine = activeNow?.ownerId === uid;

          return (
            <div
              key={court.id}
              className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3 min-w-0 transition-colors ${
                activeNow && isMine
                  ? 'bg-pink-50/90 border-2 border-[#BE185D]'
                  : 'surface-2026'
              }`}
            >
              <CourtLinesBackdrop className="pointer-events-none absolute -right-8 -bottom-6 w-48 h-24 text-[#BE185D] opacity-[0.04]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 truncate flex items-center gap-2">
                    <PickleballBallIcon
                      className={`w-4 h-4 shrink-0 ${
                        activeNow ? 'text-[#BE185D]' : 'text-emerald-600'
                      }`}
                    />
                    <span className="truncate">{court.name}</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    {court.environment} · ₱{court.hourlyRate}/hr
                  </p>
                </div>

                {activeNow && timer ? (
                  <div className="text-right shrink-0">
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        timer.phase === 'live'
                          ? 'text-emerald-700'
                          : timer.phase === 'upcoming'
                            ? 'text-[#BE185D]'
                            : 'text-slate-500'
                      }`}
                    >
                      {timer.phase === 'live'
                        ? 'Live · Remaining'
                        : timer.phase === 'upcoming'
                          ? 'Starts in'
                          : 'Time Up'}
                    </p>
                    <p className="font-mono text-sm sm:text-base font-bold text-[#831843] tabular-nums">
                      {timer.phase === 'upcoming'
                        ? timer.formattedUntilStart
                        : timer.formattedRemaining}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700 shrink-0">Open</span>
                )}
              </div>

              {activeNow && timer ? (
                <div className="pt-2.5 border-t border-pink-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <span className="font-medium text-[#831843] truncate">
                    {isMine ? 'You (Current Turn)' : activeNow.playerDisplayName}
                  </span>
                  <span className="font-mono tabular-nums text-slate-600 shrink-0">
                    {activeNow.date === todayIso ? 'Today' : formatDisplayDate(activeNow.date)} ·{' '}
                    {formatHourRange(activeNow.startHour, activeNow.durationHours)}
                  </span>
                </div>
              ) : (
                <div className="pt-2.5 border-t border-pink-100">
                  <p className="text-xs text-slate-500">Available to book now</p>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Court Filter Tabs */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Filter active schedules by court"
      >
        <button
          type="button"
          role="tab"
          aria-selected={courtFilter === 'all'}
          onClick={() => setCourtFilter('all')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors tabular-nums ${
            courtFilter === 'all'
              ? 'bg-[#BE185D] text-white'
              : 'bg-white border border-pink-200/80 text-[#831843] hover:bg-pink-50'
          }`}
        >
          All Courts ({allCurrentSchedules.length})
        </button>
        {COURTS.map((c) => {
          const count = allCurrentSchedules.filter((s) => s.courtId === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={courtFilter === c.id}
              onClick={() => setCourtFilter(c.id)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-colors tabular-nums ${
                courtFilter === c.id
                  ? 'bg-[#BE185D] text-white font-semibold'
                  : 'bg-white border border-pink-200/80 text-slate-700 hover:bg-pink-50'
              }`}
            >
              {c.name.split('·')[0].trim()} ({count})
            </button>
          );
        })}
      </div>

      {visibleCurrentSchedules.length === 0 ? (
        <div className="surface-2026 rounded-3xl p-8 sm:p-10 text-center space-y-3">
          <PickleballBallIcon className="w-8 h-8 text-[#BE185D] mx-auto" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No one is on {courtFilter === 'all' ? 'the courts' : 'this court'} right now
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Grab an open slot and start playing today.
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
          {visibleCurrentSchedules.map((schedule) => {
            const ownBooking = ownBookingsMap[schedule.bookingId] ?? null;
            const isMine = schedule.ownerId === uid && Boolean(ownBooking);
            const isBusy = busyId === schedule.bookingId;
            const isCompleting = completingId === schedule.bookingId;
            const timer = getScheduleTimerState(
              schedule.date,
              schedule.startHour,
              schedule.durationHours,
              nowMs
            );

            return (
              <section
                key={schedule.scheduleId}
                className={`rounded-3xl overflow-hidden ${
                  isMine ? 'bg-white border-2 border-[#BE185D]' : 'surface-2026'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  {/* Live Timer Panel */}
                  <div
                    className={`lg:col-span-4 p-5 sm:p-6 2xl:p-7 flex flex-col justify-between gap-5 text-white ${
                      isMine
                        ? 'bg-[#831843] bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.22),_transparent_60%)]'
                        : 'bg-[#9D174D] bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.18),_transparent_60%)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-pink-200">
                        {timer.phase === 'live'
                          ? 'LIVE NOW · Time Remaining'
                          : timer.phase === 'upcoming'
                            ? `Starts in · Opens at ${formatHour(schedule.startHour)}`
                            : 'Schedule Window Complete'}
                      </p>
                      <p className="mt-2 font-mono text-[clamp(2rem,3.5vw,2.75rem)] leading-none font-bold tracking-tight tabular-nums">
                        {timer.phase === 'upcoming'
                          ? timer.formattedUntilStart
                          : timer.formattedRemaining}
                      </p>
                      <p className="mt-1.5 text-xs text-pink-100 leading-relaxed">
                        {timer.phase === 'upcoming'
                          ? `Session timer (${timer.formattedTotalDuration}) starts counting at ${formatHour(
                              schedule.startHour
                            )}`
                          : timer.phase === 'live'
                            ? `Active (${formatHourRange(schedule.startHour, schedule.durationHours)}) · ${timer.progressPercent}% elapsed`
                            : isMine
                              ? 'Session done — automatically finishing schedule...'
                              : 'Session done — releasing court automatically'}
                      </p>
                    </div>

                    <div>
                      <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full bg-[#F472B6] transition-all duration-500"
                          style={{ width: `${timer.progressPercent}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-pink-100">
                        <span className="shrink-0">{isMine ? 'Entry Code' : 'Player'}</span>
                        <span className="font-mono font-bold text-white text-sm truncate">
                          {isMine && ownBooking
                            ? ownBooking.checkInCode
                            : schedule.playerDisplayName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details & Controls */}
                  <div className="lg:col-span-8 p-5 sm:p-6 flex flex-col justify-between gap-5 min-w-0">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-semibold text-[#BE185D]">
                          {isMine
                            ? 'Your Active Schedule'
                            : `Playing: ${schedule.playerDisplayName}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {schedule.checkedIn ? 'Checked In on Court' : 'Paid · Active Turn'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {schedule.date === todayIso ? 'Today' : formatDisplayDate(schedule.date)}
                        </span>
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
                              Receipt{' '}
                              <strong className="font-mono text-slate-900">
                                {ownBooking.receiptNumber || ownBooking.checkInCode}
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
                          ? 'Final schedule · No cancellations or refunds once booked and paid.'
                          : 'Live club board · Visible across all players and devices.'}
                      </p>
                    </div>

                    {isMine && ownBooking ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => onShowReceipt(ownBooking)}
                            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#BE185D] text-white text-sm font-medium rounded-xl hover:bg-[#9D174D] transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Receipt className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>Show Receipt to Watcher</span>
                          </button>

                          {!ownBooking.checkedIn && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleCheckIn(ownBooking)}
                              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-pink-200 text-[#831843] bg-pink-50/70 text-sm font-medium rounded-xl hover:bg-pink-100 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>Check In</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setCompletingId(isCompleting ? null : ownBooking.bookingId);
                              setScoreInput('');
                            }}
                            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>Finish Schedule</span>
                          </button>
                        </div>

                        {isCompleting && (
                          <div className="pt-4 border-t border-pink-100 flex flex-col sm:flex-row sm:items-end gap-3">
                            <div className="flex-1 min-w-0">
                              <label
                                htmlFor={`score-${ownBooking.bookingId}`}
                                className="block text-xs font-medium text-slate-700"
                              >
                                Final Match Score (Optional, e.g. 11-7, 11-9)
                              </label>
                              <input
                                id={`score-${ownBooking.bookingId}`}
                                type="text"
                                maxLength={64}
                                placeholder="11-8, 9-11, 11-6"
                                value={scoreInput}
                                onChange={(e) => setScoreInput(e.target.value)}
                                className="mt-1 w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#BE185D]"
                              />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleCompleteMatch(ownBooking)}
                                className="min-h-[44px] px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                              >
                                Done &amp; Release Court
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompletingId(null)}
                                className="min-h-[44px] px-3.5 py-2 border border-pink-200 text-[#831843] text-sm font-medium rounded-xl hover:bg-pink-50 cursor-pointer"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-pink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <Users className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            Court currently reserved by {schedule.playerDisplayName}
                          </span>
                        </span>
                        {onBookCourt ? (
                          <button
                            type="button"
                            onClick={onBookCourt}
                            className="text-[11px] font-semibold text-[#BE185D] hover:underline shrink-0 cursor-pointer text-left"
                          >
                            Book next slot in Book Court
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 shrink-0">
                            Queue next time slot via Book Court
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {completedBookings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
              <span>Your Completed Match Log ({completedBookings.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              className="min-h-[40px] px-2 text-sm font-medium text-[#BE185D] hover:text-[#9D174D] cursor-pointer"
            >
              {showCompleted ? 'Hide' : 'Show'}
            </button>
          </div>

          {showCompleted && (
            <div className="surface-2026 rounded-3xl overflow-hidden">
              <div className="md:hidden divide-y divide-pink-100">
                {completedBookings.map((item) => (
                  <div key={item.bookingId} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-slate-900 truncate">
                        {getCourtById(item.courtId).name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                        {item.date} · {formatHourRange(item.startHour, item.durationHours)}
                      </p>
                      {item.scoreSummary && (
                        <p className="mt-0.5 font-mono text-xs text-[#831843]">
                          Score: {item.scoreSummary}
                        </p>
                      )}
                    </div>
                    <p className="font-mono text-sm font-bold text-slate-900 tabular-nums shrink-0">
                      {formatCurrency(item.totalAmount)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-pink-100 text-xs font-medium text-slate-500">
                      <th className="py-3.5 px-6">Court</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Time</th>
                      <th className="py-3.5 px-4">Score</th>
                      <th className="py-3.5 px-6 text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-100 text-sm">
                    {completedBookings.map((item) => (
                      <tr key={item.bookingId} className="hover:bg-pink-50/40 transition-colors">
                        <td className="py-3.5 px-6 font-medium text-slate-900 whitespace-nowrap">
                          {getCourtById(item.courtId).name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs tabular-nums whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs tabular-nums whitespace-nowrap">
                          {formatHourRange(item.startHour, item.durationHours)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                          {item.scoreSummary || 'Completed'}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
