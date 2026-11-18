import React from 'react';
import { CheckCircle2, Printer, ShieldCheck, X } from 'lucide-react';
import {
  formatCurrency,
  formatDisplayDate,
  formatHourRange,
  GCASH_ACCOUNT,
  getCourtById,
  MATCH_FORMAT_LABELS
} from '../data/courts';
import { CourtBooking, PaymentTransaction } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  booking?: CourtBooking | null;
  transaction?: PaymentTransaction | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  playerName,
  booking,
  transaction
}) => {
  if (!isOpen || (!booking && !transaction)) return null;

  const receiptNo = booking?.receiptNumber || transaction?.receiptNumber || 'OLR-VERIFIED';
  const resolvedCourtId = booking?.courtId || transaction?.courtId;
  const courtName = resolvedCourtId
    ? getCourtById(resolvedCourtId).name
    : booking?.courtName || transaction?.courtName || 'Openline Court';
  const date = booking?.date || transaction?.date || '';
  const startHour = booking?.startHour ?? transaction?.startHour ?? 8;
  const durationHours = booking?.durationHours ?? transaction?.durationHours ?? 1;
  const matchFormat = booking?.matchFormat ?? transaction?.matchFormat ?? 'doubles';
  const amount = booking?.totalAmount ?? transaction?.amount ?? 0;
  const gcashRef = booking?.gcashReferenceNo || transaction?.gcashReferenceNo || '';
  const gcashSender = booking?.gcashSenderNumber || transaction?.gcashSenderNumber || '';
  const checkInCode = booking?.checkInCode || transaction?.checkInCode || '';

  const isYourTurnNow =
    booking?.status === 'current' ||
    (!booking && transaction?.scheduleStatusAtPay === 'current');

  const isCompleted = booking?.status === 'completed';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#500724]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-pink-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-pink-200/80 flex items-center justify-between gap-4 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#BE185D]" aria-hidden="true" />
            <h2 id="receipt-modal-title" className="font-display text-base font-semibold text-[#831843]">
              Official Court &amp; Payment Receipt
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-pink-700 hover:text-[#831843] hover:bg-pink-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Watcher / Manager Turn Banner */}
          <div
            className={`p-4 rounded-xl border ${
              isYourTurnNow
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : isCompleted
                  ? 'bg-pink-50/70 border-pink-200 text-[#831843]'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isYourTurnNow
                    ? 'text-emerald-700'
                    : isCompleted
                      ? 'text-[#BE185D]'
                      : 'text-amber-700'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="font-display text-sm font-bold tracking-tight">
                  {isYourTurnNow
                    ? 'YOUR SCHEDULE IS ACTIVE NOW — SHOW TO WATCHER'
                    : isCompleted
                      ? 'COMPLETED COURT RECEIPT'
                      : 'PAID & IN QUEUE — WAITING FOR CURRENT TURN'}
                </p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  {isYourTurnNow
                    ? 'Your GCash payment is verified. Show this pass to the court watcher on duty.'
                    : isCompleted
                      ? 'This session is completed and saved in Receipts & Pay.'
                      : 'Your GCash payment is verified. Your turn moves to Current Schedule as soon as the match ahead finishes.'}
                </p>
              </div>
            </div>
          </div>

          {/* Access Code & Receipt Number Highlight */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-pink-50/70 border border-pink-200/80 rounded-xl">
            <div>
              <p className="text-xs text-pink-900/70">Court Entry Code</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-[#831843] tabular-nums">
                {checkInCode}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-pink-900/70">Receipt Number</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[#831843] tabular-nums">
                {receiptNo}
              </p>
            </div>
          </div>

          {/* Details List */}
          <dl className="divide-y divide-pink-100 text-sm border border-pink-200/80 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Player</dt>
              <dd className="font-medium text-slate-900 text-right">{playerName}</dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Court</dt>
              <dd className="font-medium text-slate-900 text-right">{courtName}</dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Schedule Date</dt>
              <dd className="font-medium text-slate-900 text-right">{formatDisplayDate(date)}</dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Time Slot</dt>
              <dd className="font-mono font-medium text-slate-900 tabular-nums text-right">
                {formatHourRange(startHour, durationHours)}
              </dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Match Format</dt>
              <dd className="text-slate-900 text-right">{MATCH_FORMAT_LABELS[matchFormat]}</dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Payment Method</dt>
              <dd className="font-medium text-slate-900 text-right">
                GCash ({GCASH_ACCOUNT.accountNumber})
              </dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">GCash Reference No.</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums text-right">
                {gcashRef || 'Verified'}
              </dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Sender Mobile</dt>
              <dd className="font-mono text-slate-900 tabular-nums text-right">
                {gcashSender || '—'}
              </dd>
            </div>
            <div className="px-4 py-3 flex justify-between gap-4">
              <dt className="text-pink-900/70">Schedule Policy</dt>
              <dd className="text-xs font-semibold text-[#831843] text-right">
                Final Schedule · Non-cancellable &amp; Non-refundable
              </dd>
            </div>
            <div className="px-4 py-3.5 bg-pink-50/70 flex justify-between gap-4 items-baseline">
              <dt className="font-semibold text-[#831843]">Amount Paid</dt>
              <dd className="font-mono text-lg font-bold text-[#831843] tabular-nums">
                {formatCurrency(amount)}
              </dd>
            </div>
          </dl>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 min-h-[46px] px-4 py-2.5 border border-pink-200 text-[#831843] text-sm font-medium rounded-xl hover:bg-pink-50 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[46px] px-4 py-2.5 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
