import React, { useState } from 'react';
import { Check, Copy, Smartphone, X } from 'lucide-react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  createTxId,
  formatCurrency,
  formatDisplayDate,
  formatHourRange,
  GCASH_ACCOUNT,
  generateReceiptNumber,
  getCourtById,
  QueueAnalysis
} from '../data/courts';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { supabaseConfirmQRPayment } from '../lib/supabaseClub';
import { CourtBooking, CourtSchedule, PaymentTransaction } from '../types';
import { GCashQRCode } from './GCashQRCode';

interface GCashPaymentModalProps {
  booking: CourtBooking | null;
  queueInfo: QueueAnalysis;
  playerName: string;
  onClose: () => void;
  onPaymentSuccess: (updatedBooking: CourtBooking, tx: PaymentTransaction) => void;
}

export const GCashPaymentModal: React.FC<GCashPaymentModalProps> = ({
  booking,
  queueInfo,
  playerName,
  onClose,
  onPaymentSuccess
}) => {
  const [senderNumber, setSenderNumber] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!booking) return null;

  const isFirstInLine = queueInfo.aheadCount === 0;
  const targetStatus: 'current' | 'pending' = isFirstInLine ? 'current' : 'pending';

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(GCASH_ACCOUNT.accountNumber.replace(/-/g, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanSender = senderNumber.trim().slice(0, 20);
    const cleanRef = referenceNo.trim().toUpperCase().replace(/\s+/g, '').slice(0, 32);

    if (cleanSender.length < 7) {
      setErrorMsg('Enter a valid GCash mobile number (at least 7 digits).');
      return;
    }
    if (cleanRef.length < 6) {
      setErrorMsg('Enter your GCash reference number (at least 6 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const receiptNumber = generateReceiptNumber();
      const txId = createTxId();
      const paidAtIso = new Date().toISOString();

      const txPayload: Omit<PaymentTransaction, 'createdAt'> & { createdAt: unknown } = {
        txId,
        ownerId: booking.ownerId,
        bookingId: booking.bookingId,
        receiptNumber,
        courtId: booking.courtId,
        courtName: booking.courtName,
        date: booking.date,
        startHour: booking.startHour,
        durationHours: booking.durationHours,
        matchFormat: booking.matchFormat,
        amount: booking.totalAmount,
        paymentMethod: 'GCash',
        gcashAccountName: GCASH_ACCOUNT.accountName,
        gcashAccountNumber: GCASH_ACCOUNT.accountNumber,
        gcashReferenceNo: cleanRef,
        gcashSenderNumber: cleanSender,
        paymentStatus: 'paid',
        scheduleStatusAtPay: targetStatus,
        checkInCode: booking.checkInCode,
        createdAt: auth.currentUser ? serverTimestamp() : new Date().toISOString()
      };

      const schedulePayload: Omit<CourtSchedule, 'createdAt' | 'updatedAt'> & {
        createdAt: unknown;
        updatedAt: unknown;
      } = {
        scheduleId: booking.bookingId,
        bookingId: booking.bookingId,
        ownerId: booking.ownerId,
        playerDisplayName: (playerName.trim() || 'Openline Player').slice(0, 80),
        courtId: booking.courtId,
        courtName: booking.courtName.slice(0, 80),
        date: booking.date,
        startHour: booking.startHour,
        durationHours: booking.durationHours,
        matchFormat: booking.matchFormat,
        status: targetStatus,
        isActive: true,
        checkedIn: false,
        scoreSummary: '',
        createdAt: auth.currentUser ? serverTimestamp() : new Date().toISOString(),
        updatedAt: auth.currentUser ? serverTimestamp() : new Date().toISOString()
      };

      if (!auth.currentUser) {
        await supabaseConfirmQRPayment(
          booking.bookingId,
          {
            status: targetStatus,
            paymentMethod: 'GCash',
            gcashReferenceNo: cleanRef,
            gcashSenderNumber: cleanSender,
            receiptNumber,
            paidAtIso
          },
          txPayload as PaymentTransaction,
          schedulePayload as CourtSchedule
        );
      } else {
        const batch = writeBatch(db);
        const bookingRef = doc(db, 'bookings', booking.bookingId);
        const txRef = doc(db, 'transactions', txId);
        const scheduleRef = doc(db, 'courtSchedules', booking.bookingId);

        batch.update(bookingRef, {
          status: targetStatus,
          paymentStatus: 'paid',
          paymentMethod: 'GCash',
          gcashReferenceNo: cleanRef,
          gcashSenderNumber: cleanSender,
          receiptNumber,
          paidAtIso,
          updatedAt: serverTimestamp()
        });

        batch.set(txRef, txPayload);
        batch.set(scheduleRef, schedulePayload);
        await batch.commit();
      }

      const updatedBooking: CourtBooking = {
        ...booking,
        status: targetStatus,
        paymentStatus: 'paid',
        paymentMethod: 'GCash',
        gcashReferenceNo: cleanRef,
        gcashSenderNumber: cleanSender,
        receiptNumber,
        paidAtIso
      };

      onPaymentSuccess(updatedBooking, txPayload as PaymentTransaction);
    } catch (error) {
      if (!auth.currentUser) {
        setErrorMsg(
          error instanceof Error ? error.message : 'Unable to confirm payment in Supabase.'
        );
      } else {
        handleFirestoreError(error, OperationType.WRITE, `bookings/${booking.bookingId}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#500724]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gcash-modal-title"
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-pink-200 max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-pink-200/80 flex items-center justify-between gap-4 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#BE185D] text-white font-display font-bold text-sm flex items-center justify-center">
              G
            </div>
            <h2 id="gcash-modal-title" className="font-display text-base font-semibold text-[#831843]">
              Scan GCash QR Code to Pay
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-pink-700 hover:text-[#831843] hover:bg-pink-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-pink-50/70 border border-pink-200/80 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-[#831843] truncate">
                {getCourtById(booking.courtId).name}
              </p>
              <p className="mt-0.5 text-xs text-pink-900/75 font-mono tabular-nums">
                {formatDisplayDate(booking.date)} ·{' '}
                {formatHourRange(booking.startHour, booking.durationHours)}
              </p>
            </div>
            <p className="font-mono text-xl font-bold text-[#831843] tabular-nums shrink-0">
              {formatCurrency(booking.totalAmount)}
            </p>
          </div>

          <GCashQRCode
            amount={booking.totalAmount}
            bookingId={booking.bookingId}
            courtName={getCourtById(booking.courtId).name}
            date={booking.date}
          />

          <div className="flex items-center justify-between gap-3 bg-pink-50/60 p-3.5 rounded-xl border border-pink-200/80">
            <div>
              <p className="text-xs text-pink-900/70">{GCASH_ACCOUNT.accountName}</p>
              <p className="font-mono text-base font-bold text-[#831843] tabular-nums">
                {GCASH_ACCOUNT.accountNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyNumber}
              className="min-h-[40px] px-3 py-2 rounded-lg bg-pink-100 hover:bg-pink-200 text-[#831843] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy No.</span>
                </>
              )}
            </button>
          </div>

          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              isFirstInLine
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            {isFirstInLine ? (
              <p>
                <strong>First in Line (Current Schedule):</strong> Once paid, your booking starts
                immediately in <strong>Current Schedule</strong> with a live countdown timer.
              </p>
            ) : (
              <p>
                <strong>Next in Line (#{queueInfo.queueNumber} · Next Schedule):</strong> There{' '}
                {queueInfo.aheadCount === 1
                  ? 'is 1 active schedule'
                  : `are ${queueInfo.aheadCount} active schedules`}{' '}
                ahead of you. Once paid, your booking enters <strong>Next Schedule</strong>.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#831843] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
              <span>Enter Your GCash Transfer Details After Scanning QR</span>
            </p>

            <div>
              <label htmlFor="gcash-sender" className="block text-xs font-medium text-[#831843]">
                Your GCash Mobile Number
              </label>
              <input
                id="gcash-sender"
                type="tel"
                required
                maxLength={20}
                placeholder="0917 123 4567"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono text-slate-900 bg-white border border-pink-200 rounded-xl focus:outline-none focus:border-[#BE185D]"
              />
            </div>

            <div>
              <label htmlFor="gcash-ref" className="block text-xs font-medium text-[#831843]">
                GCash Reference Number
              </label>
              <input
                id="gcash-ref"
                type="text"
                required
                maxLength={32}
                placeholder="e.g. 9012847561234"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono text-slate-900 bg-white border border-pink-200 rounded-xl focus:outline-none focus:border-[#BE185D]"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-pink-50 border border-pink-200 text-xs text-[#831843]">
            <strong>Policy:</strong> Once paid via GCash, your court schedule is final — no
            cancellations or refunds.
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="sm:w-1/3 min-h-[48px] px-4 py-2.5 border border-pink-200 text-[#831843] text-sm font-medium rounded-xl hover:bg-pink-50 cursor-pointer"
            >
              Pay Later
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="sm:w-2/3 min-h-[48px] px-5 py-2.5 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Verifying & Finishing...' : 'Confirm Payment & Finish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
