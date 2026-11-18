import React, { useMemo, useState } from 'react';
import { Check, Copy, ReceiptText, Search, Smartphone, Trash2 } from 'lucide-react';
import {
  computeCourtQueueInfo,
  formatCurrency,
  formatDisplayDate,
  formatHourRange,
  GCASH_ACCOUNT,
  getCourtById,
  makeSlotKey,
  QueueAnalysis
} from '../data/courts';
import { supabaseCancelUnpaidBooking } from '../lib/supabaseClub';
import { CourtBooking, CourtSchedule, CourtSlot, PaymentTransaction } from '../types';

interface TransactLogViewProps {
  bookings: CourtBooking[];
  transactions: PaymentTransaction[];
  reservedSlots: CourtSlot[];
  sharedSchedules: CourtSchedule[];
  loading: boolean;
  onStartPayment: (booking: CourtBooking, queueInfo: QueueAnalysis) => void;
  onShowTransactionReceipt: (tx: PaymentTransaction, matchingBooking?: CourtBooking | null) => void;
  onBookCourt?: () => void;
}

export const TransactLogView: React.FC<TransactLogViewProps> = ({
  bookings,
  transactions,
  reservedSlots,
  sharedSchedules,
  loading,
  onStartPayment,
  onShowTransactionReceipt,
  onBookCourt
}) => {
  const [copied, setCopied] = useState(false);
  const [busyCancelId, setBusyCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const unpaidBookings = bookings
    .filter(
      (b) =>
        b.status === 'awaiting_payment' && (b.courtId === 'court-1' || b.courtId === 'court-2')
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.receiptNumber.localeCompare(a.receiptNumber)),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedTransactions;
    return sortedTransactions.filter((tx) => {
      const courtLabel = getCourtById(tx.courtId).name.toLowerCase();
      return (
        tx.receiptNumber.toLowerCase().includes(q) ||
        tx.gcashReferenceNo.toLowerCase().includes(q) ||
        tx.checkInCode.toLowerCase().includes(q) ||
        tx.date.toLowerCase().includes(q) ||
        courtLabel.includes(q)
      );
    });
  }, [sortedTransactions, searchQuery]);

  const totalPaidAmount = sortedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  const handleCopyGCash = async () => {
    try {
      await navigator.clipboard.writeText(GCASH_ACCOUNT.accountNumber.replace(/-/g, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCancelUnpaid = async (booking: CourtBooking) => {
    setCancelError(null);
    setBusyCancelId(booking.bookingId);
    try {
      const keys = [makeSlotKey(booking.courtId, booking.date, booking.startHour)];
      if (booking.durationHours === 2) {
        keys.push(makeSlotKey(booking.courtId, booking.date, booking.startHour + 1));
      }
      await supabaseCancelUnpaidBooking(booking.bookingId, keys, booking.ownerId);
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : 'Unable to delete reservation in Supabase.'
      );
    } finally {
      setBusyCancelId(null);
    }
  };

  const getMatchingBooking = (bookingId: string): CourtBooking | null => {
    return bookings.find((b) => b.bookingId === bookingId) ?? null;
  };

  const getTurnLabel = (tx: PaymentTransaction): string => {
    const match = getMatchingBooking(tx.bookingId);
    if (!match) return tx.scheduleStatusAtPay === 'current' ? 'Current Turn' : 'Queued';
    if (match.status === 'current') return 'Your Turn Now (Current)';
    if (match.status === 'pending') return 'Waiting in Line (Next)';
    if (match.status === 'completed') return 'Completed';
    return 'Paid';
  };

  if (loading) {
    return (
      <div className="surface-2026 rounded-3xl p-6 sm:p-8 2xl:p-10 space-y-4">
        <div className="h-6 w-56 bg-pink-50 rounded" />
        <div className="h-28 w-full bg-pink-50 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 2xl:space-y-10">
      <div>
        <h1 className="font-display text-[clamp(1.45rem,2.5vw,2.1rem)] font-semibold tracking-tight text-slate-900">
          Receipts
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pay waiting bookings or show your receipt at check-in.
        </p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 2xl:gap-6">
        <div className="surface-2026 lg:col-span-6 rounded-3xl p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#BE185D] text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
              G
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Official Club GCash Account</p>
              <p className="font-mono text-lg 2xl:text-xl font-bold text-slate-900 tabular-nums truncate">
                {GCASH_ACCOUNT.accountNumber}
              </p>
              <p className="text-xs text-slate-600 truncate">{GCASH_ACCOUNT.accountName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyGCash}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-[#831843] text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="surface-2026 lg:col-span-3 rounded-3xl p-5 sm:p-6">
          <p className="text-xs font-medium text-slate-500">Total Paid via GCash</p>
          <p className="mt-1.5 font-mono text-2xl 2xl:text-3xl font-bold text-[#831843] tabular-nums">
            {formatCurrency(totalPaidAmount)}
          </p>
        </div>

        <div className="surface-2026 lg:col-span-3 rounded-3xl p-5 sm:p-6">
          <p className="text-xs font-medium text-slate-500">Purchased Receipts</p>
          <p className="mt-1.5 font-mono text-2xl 2xl:text-3xl font-bold text-slate-900 tabular-nums">
            {sortedTransactions.length}
          </p>
        </div>
      </section>

      {unpaidBookings.length > 0 && (
        <section className="surface-2026 rounded-3xl overflow-hidden">
          <div className="px-5 py-4 bg-pink-50 border-b border-pink-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#831843] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
              <span>Awaiting GCash Payment ({unpaidBookings.length})</span>
            </h2>
          </div>

          {cancelError && (
            <div role="alert" className="m-4 p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">
              {cancelError}
            </div>
          )}

          <div className="divide-y divide-pink-100">
            {unpaidBookings.map((booking) => {
              const queueInfo = computeCourtQueueInfo(
                reservedSlots,
                booking.courtId,
                booking.date,
                booking.startHour,
                booking.bookingId,
                Date.now(),
                sharedSchedules
              );
              const isCancelling = busyCancelId === booking.bookingId;

              return (
                <div
                  key={booking.bookingId}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-display text-base font-semibold text-slate-900">
                      {getCourtById(booking.courtId).name}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 font-mono tabular-nums">
                      {formatDisplayDate(booking.date)} ·{' '}
                      {formatHourRange(booking.startHour, booking.durationHours)} ·{' '}
                      <strong className="text-slate-900">{formatCurrency(booking.totalAmount)}</strong>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {queueInfo.aheadCount === 0
                        ? 'Enters Current Schedule immediately after payment'
                        : `Enters Next Schedule (#${queueInfo.queueNumber} in line) after payment`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => onStartPayment(booking, queueInfo)}
                      className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] cursor-pointer whitespace-nowrap"
                    >
                      Pay {formatCurrency(booking.totalAmount)} via GCash
                    </button>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => handleCancelUnpaid(booking)}
                      aria-label="Discard unpaid reservation"
                      className="min-h-[44px] min-w-[44px] px-3 py-2 border border-slate-300 text-slate-600 hover:text-red-700 hover:bg-slate-50 rounded-xl inline-flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="surface-2026 rounded-3xl overflow-hidden">
        <div className="px-5 sm:px-6 2xl:px-8 py-4 sm:py-5 border-b border-pink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
              <span>Official GCash Receipts</span>
            </h2>
            <span className="font-mono text-xs text-slate-500 tabular-nums sm:hidden">
              {filteredTransactions.length} records
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {sortedTransactions.length > 0 && (
              <div className="relative flex-1 sm:w-64">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search receipt, ref, court..."
                  aria-label="Search receipts"
                  className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-[#FFF9FB] border border-pink-200/80 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#BE185D]"
                />
              </div>
            )}
            <span className="hidden sm:inline font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
              {filteredTransactions.length} records
            </span>
          </div>
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              No paid receipts yet. Book a court and pay via GCash QR to save your receipt here.
            </p>
            {onBookCourt && (
              <button
                type="button"
                onClick={onBookCourt}
                className="min-h-[44px] px-5 py-2.5 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] transition-colors cursor-pointer"
              >
                Book a Court
              </button>
            )}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800">
              No receipts match &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-[#BE185D] hover:underline cursor-pointer"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-pink-100">
              {filteredTransactions.map((tx) => {
                const match = getMatchingBooking(tx.bookingId);
                return (
                  <div key={tx.txId} className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#831843] tabular-nums">
                          {tx.receiptNumber}
                        </p>
                        <h3 className="mt-0.5 font-display text-base font-semibold text-slate-900">
                          {getCourtById(tx.courtId).name}
                        </h3>
                      </div>
                      <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatCurrency(tx.amount)}
                      </p>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="font-mono tabular-nums">
                        {tx.date} · {formatHourRange(tx.startHour, tx.durationHours)}
                      </p>
                      <p>
                        GCash Ref: <strong className="font-mono text-slate-900">{tx.gcashReferenceNo}</strong>{' '}
                        · Code <strong className="font-mono text-slate-900">{tx.checkInCode}</strong>
                      </p>
                      <p className="font-medium text-[#BE185D]">{getTurnLabel(tx)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onShowTransactionReceipt(tx, match)}
                      className="w-full min-h-[44px] px-4 py-2 bg-[#BE185D] text-white text-sm font-medium rounded-xl hover:bg-[#9D174D] cursor-pointer"
                    >
                      Show Receipt to Watcher / Manager
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-pink-100 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Receipt No.</th>
                    <th className="py-3 px-4">Court</th>
                    <th className="py-3 px-4">Schedule</th>
                    <th className="py-3 px-4">GCash Ref</th>
                    <th className="py-3 px-4">Turn Status</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-6 text-right">Watcher Pass</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-100 text-sm">
                  {filteredTransactions.map((tx) => {
                    const match = getMatchingBooking(tx.bookingId);
                    return (
                      <tr key={tx.txId} className="hover:bg-pink-50/40">
                        <td className="py-3.5 px-6 font-mono text-xs font-semibold text-[#831843] tabular-nums whitespace-nowrap">
                          {tx.receiptNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {getCourtById(tx.courtId).name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {tx.date} · {formatHourRange(tx.startHour, tx.durationHours)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {tx.gcashReferenceNo}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-[#BE185D] whitespace-nowrap">
                          {getTurnLabel(tx)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onShowTransactionReceipt(tx, match)}
                            className="px-3.5 py-2 bg-[#BE185D] text-white text-xs font-medium rounded-lg hover:bg-[#9D174D] cursor-pointer"
                          >
                            Show Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
