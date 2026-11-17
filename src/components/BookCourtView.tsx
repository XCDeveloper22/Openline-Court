import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  Receipt,
  Smartphone
} from 'lucide-react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  CLUB_INFO,
  computeCourtQueueInfo,
  COURT_HOURS,
  COURTS,
  createBookingId,
  createTxId,
  formatCurrency,
  formatDisplayDate,
  formatHour,
  formatHourRange,
  GCASH_ACCOUNT,
  generateCheckInCode,
  generateReceiptNumber,
  getCourtById,
  getPhilippineNowParts,
  getUpcomingDates,
  makeSlotKey,
  MATCH_FORMAT_LABELS,
  PADDLE_RENTAL_FEE,
  QueueAnalysis
} from '../data/courts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CourtBooking,
  CourtId,
  CourtSchedule,
  CourtSlot,
  MatchFormat,
  PaymentTransaction
} from '../types';
import { GCashQRCode } from './GCashQRCode';

type BookingFlowStep = 'court' | 'schedule' | 'qr' | 'done';

interface BookCourtViewProps {
  uid: string;
  playerName: string;
  defaultCourtId: CourtId;
  unpaidBookings: CourtBooking[];
  reservedSlots: CourtSlot[];
  sharedSchedules: CourtSchedule[];
  loadingSlots: boolean;
  onShowReceipt: (booking: CourtBooking, tx?: PaymentTransaction | null) => void;
}

const STEP_LABELS: {
  id: BookingFlowStep;
  num: number;
  shortLabel: string;
  fullLabel: string;
}[] = [
  { id: 'court', num: 1, shortLabel: 'Court', fullLabel: 'Court' },
  { id: 'schedule', num: 2, shortLabel: 'Date', fullLabel: 'Date & Time' },
  { id: 'qr', num: 3, shortLabel: 'QR', fullLabel: 'QR Pay' },
  { id: 'done', num: 4, shortLabel: 'Done', fullLabel: 'Done' }
];

export const BookCourtView: React.FC<BookCourtViewProps> = ({
  uid,
  playerName,
  defaultCourtId,
  unpaidBookings,
  reservedSlots,
  sharedSchedules,
  loadingSlots,
  onShowReceipt
}) => {
  const upcomingDates = useMemo(() => getUpcomingDates(14), []);
  const topRef = useRef<HTMLDivElement | null>(null);

  const [flowStep, setFlowStep] = useState<BookingFlowStep>('court');
  const [selectedCourtId, setSelectedCourtId] = useState<CourtId>(defaultCourtId);
  const [selectedDate, setSelectedDate] = useState<string>(upcomingDates[0].iso);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [durationHours, setDurationHours] = useState<1 | 2>(1);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('doubles');
  const [partnerNames, setPartnerNames] = useState('');
  const [paddleRental, setPaddleRental] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Step 3 (QR Payment) & Step 4 (Done) state
  const [activePaymentBooking, setActivePaymentBooking] = useState<CourtBooking | null>(null);
  const [activeQueueInfo, setActiveQueueInfo] = useState<QueueAnalysis | null>(null);
  const [senderNumber, setSenderNumber] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [completedBooking, setCompletedBooking] = useState<CourtBooking | null>(null);
  const [completedTx, setCompletedTx] = useState<PaymentTransaction | null>(null);

  useEffect(() => {
    if (flowStep === 'court') {
      setSelectedCourtId(defaultCourtId);
    }
  }, [defaultCourtId, flowStep]);

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const dateSlots = useMemo(
    () => reservedSlots.filter((s) => s.date === selectedDate),
    [reservedSlots, selectedDate]
  );

  const slotMap = useMemo(() => {
    const map: Record<string, CourtSlot> = {};
    dateSlots.forEach((slot) => {
      map[slot.slotKey] = slot;
    });
    return map;
  }, [dateSlots]);

  const scheduleByBookingId = useMemo(() => {
    const map: Record<string, CourtSchedule> = {};
    sharedSchedules.forEach((sch) => {
      map[sch.bookingId] = sch;
    });
    return map;
  }, [sharedSchedules]);

  const selectedCourt = getCourtById(selectedCourtId);
  const isToday = selectedDate === upcomingDates[0].iso;
  const currentHourNow = getPhilippineNowParts().hour;

  const isHourAvailable = (hour: number): boolean => {
    if (isToday && hour < currentHourNow) return false;
    const firstKey = makeSlotKey(selectedCourtId, selectedDate, hour);
    if (slotMap[firstKey]) return false;
    if (durationHours === 2) {
      if (hour >= 21) return false;
      const secondKey = makeSlotKey(selectedCourtId, selectedDate, hour + 1);
      if (slotMap[secondKey]) return false;
    }
    return true;
  };

  useEffect(() => {
    if (selectedHour !== null && !isHourAvailable(selectedHour)) {
      setSelectedHour(null);
    }
  }, [selectedCourtId, selectedDate, durationHours, slotMap]);

  const selectedQueueInfo = useMemo(() => {
    if (selectedHour === null) {
      return computeCourtQueueInfo(reservedSlots, selectedCourtId, selectedDate, 23);
    }
    return computeCourtQueueInfo(reservedSlots, selectedCourtId, selectedDate, selectedHour);
  }, [reservedSlots, selectedCourtId, selectedDate, selectedHour]);

  const courtFee = selectedCourt.hourlyRate * durationHours;
  const equipmentFee = paddleRental ? PADDLE_RENTAL_FEE : 0;
  const totalAmount = courtFee + equipmentFee;

  const handleSelectCourtAndContinue = (courtId: CourtId) => {
    setSelectedCourtId(courtId);
    setSelectedHour(null);
    setSubmitError(null);
    setFlowStep('schedule');
    scrollToTop();
  };

  const handleReserveAndGoToQR = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (selectedHour === null) {
      setSubmitError('Please tap an open court start time first.');
      return;
    }
    if (!isHourAvailable(selectedHour)) {
      setSubmitError('That slot was just taken. Please pick another open time.');
      return;
    }

    setSubmitting(true);
    try {
      const bookingId = createBookingId();
      const checkInCode = generateCheckInCode();
      const sanitizedPartners = partnerNames.trim().slice(0, 120);
      const queueAtBook = computeCourtQueueInfo(
        reservedSlots,
        selectedCourt.id,
        selectedDate,
        selectedHour
      );

      const batch = writeBatch(db);
      const bookingRef = doc(db, 'bookings', bookingId);

      const newBookingPayload: Omit<CourtBooking, 'createdAt' | 'updatedAt'> & {
        createdAt: unknown;
        updatedAt: unknown;
      } = {
        bookingId,
        ownerId: uid,
        courtId: selectedCourt.id,
        courtName: selectedCourt.name.slice(0, 80),
        date: selectedDate,
        startHour: selectedHour,
        durationHours,
        matchFormat,
        partnerNames: sanitizedPartners,
        paddleRental,
        hourlyRate: selectedCourt.hourlyRate,
        totalAmount,
        status: 'awaiting_payment',
        paymentStatus: 'unpaid',
        paymentMethod: '',
        gcashReferenceNo: '',
        gcashSenderNumber: '',
        receiptNumber: '',
        paidAtIso: '',
        checkInCode,
        checkedIn: false,
        scoreSummary: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(bookingRef, newBookingPayload);

      const firstSlotKey = makeSlotKey(selectedCourt.id, selectedDate, selectedHour);
      batch.set(doc(db, 'courtSlots', firstSlotKey), {
        slotKey: firstSlotKey,
        courtId: selectedCourt.id,
        date: selectedDate,
        hour: selectedHour,
        startHour: selectedHour,
        durationHours,
        bookingId,
        ownerId: uid,
        status: 'reserved',
        createdAt: serverTimestamp()
      });

      if (durationHours === 2) {
        const secondSlotKey = makeSlotKey(selectedCourt.id, selectedDate, selectedHour + 1);
        batch.set(doc(db, 'courtSlots', secondSlotKey), {
          slotKey: secondSlotKey,
          courtId: selectedCourt.id,
          date: selectedDate,
          hour: selectedHour + 1,
          startHour: selectedHour,
          durationHours,
          bookingId,
          ownerId: uid,
          status: 'reserved',
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();

      setSelectedHour(null);
      setPartnerNames('');
      setPaddleRental(false);
      setActivePaymentBooking(newBookingPayload as CourtBooking);
      setActiveQueueInfo(queueAtBook);
      setSenderNumber('');
      setReferenceNo('');
      setPayError(null);
      setFlowStep('qr');
      scrollToTop();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        setSubmitError(
          'That slot was just reserved by another player. Please choose another available time.'
        );
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'bookings');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(GCASH_ACCOUNT.accountNumber.replace(/-/g, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleConfirmQRPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentBooking) return;
    setPayError(null);

    const cleanSender = senderNumber.trim().slice(0, 20);
    const cleanRef = referenceNo.trim().toUpperCase().replace(/\s+/g, '').slice(0, 32);

    if (cleanSender.length < 7) {
      setPayError('Enter a valid GCash mobile number (at least 7 digits).');
      return;
    }
    if (cleanRef.length < 6) {
      setPayError('Enter your GCash reference number (at least 6 characters).');
      return;
    }

    const queue =
      activeQueueInfo ??
      computeCourtQueueInfo(
        reservedSlots,
        activePaymentBooking.courtId,
        activePaymentBooking.date,
        activePaymentBooking.startHour,
        activePaymentBooking.bookingId
      );
    const targetStatus: 'current' | 'pending' = queue.aheadCount === 0 ? 'current' : 'pending';

    setPaying(true);
    try {
      const receiptNumber = generateReceiptNumber();
      const txId = createTxId();
      const paidAtIso = new Date().toISOString();

      const batch = writeBatch(db);
      const bookingRef = doc(db, 'bookings', activePaymentBooking.bookingId);
      const txRef = doc(db, 'transactions', txId);
      const scheduleRef = doc(db, 'courtSchedules', activePaymentBooking.bookingId);

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

      const txPayload: Omit<PaymentTransaction, 'createdAt'> & { createdAt: unknown } = {
        txId,
        ownerId: activePaymentBooking.ownerId,
        bookingId: activePaymentBooking.bookingId,
        receiptNumber,
        courtId: activePaymentBooking.courtId,
        courtName: activePaymentBooking.courtName,
        date: activePaymentBooking.date,
        startHour: activePaymentBooking.startHour,
        durationHours: activePaymentBooking.durationHours,
        matchFormat: activePaymentBooking.matchFormat,
        amount: activePaymentBooking.totalAmount,
        paymentMethod: 'GCash',
        gcashAccountName: GCASH_ACCOUNT.accountName,
        gcashAccountNumber: GCASH_ACCOUNT.accountNumber,
        gcashReferenceNo: cleanRef,
        gcashSenderNumber: cleanSender,
        paymentStatus: 'paid',
        scheduleStatusAtPay: targetStatus,
        checkInCode: activePaymentBooking.checkInCode,
        createdAt: serverTimestamp()
      };

      batch.set(txRef, txPayload);

      const schedulePayload: Omit<CourtSchedule, 'createdAt' | 'updatedAt'> & {
        createdAt: unknown;
        updatedAt: unknown;
      } = {
        scheduleId: activePaymentBooking.bookingId,
        bookingId: activePaymentBooking.bookingId,
        ownerId: activePaymentBooking.ownerId,
        playerDisplayName: (playerName.trim() || 'Openline Player').slice(0, 80),
        courtId: activePaymentBooking.courtId,
        courtName: activePaymentBooking.courtName.slice(0, 80),
        date: activePaymentBooking.date,
        startHour: activePaymentBooking.startHour,
        durationHours: activePaymentBooking.durationHours,
        matchFormat: activePaymentBooking.matchFormat,
        status: targetStatus,
        isActive: true,
        checkedIn: false,
        scoreSummary: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(scheduleRef, schedulePayload);
      await batch.commit();

      const updatedBooking: CourtBooking = {
        ...activePaymentBooking,
        status: targetStatus,
        paymentStatus: 'paid',
        paymentMethod: 'GCash',
        gcashReferenceNo: cleanRef,
        gcashSenderNumber: cleanSender,
        receiptNumber,
        paidAtIso
      };

      setCompletedBooking(updatedBooking);
      setCompletedTx(txPayload as PaymentTransaction);
      setActivePaymentBooking(null);
      setFlowStep('done');
      scrollToTop();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${activePaymentBooking.bookingId}`);
    } finally {
      setPaying(false);
    }
  };

  const currentStepIdx = STEP_LABELS.findIndex((s) => s.id === flowStep);

  return (
    <div ref={topRef} className="space-y-6 sm:space-y-8 2xl:space-y-10">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.45rem,2.5vw,2.15rem)] font-semibold tracking-tight text-slate-900">
            Booked Here · Quick Court Reservation
          </h1>
          <p className="mt-1.5 text-sm 2xl:text-base text-slate-600 max-w-2xl">
            Click a court, pick your date &amp; duration, scan the GCash QR code to pay, and
            you&apos;re done. Confirmed schedules are final (no cancellations or refunds).
          </p>
        </div>

        {/* Continuous 4-Step Flow Indicator */}
        <ol
          aria-label="Booking Progress"
          className="surface-2026 grid grid-cols-4 gap-1 sm:gap-1.5 rounded-2xl p-1.5 xl:min-w-[460px] shrink-0"
        >
          {STEP_LABELS.map((step, idx) => {
            const isCurrent = step.id === flowStep;
            const isPast = idx < currentStepIdx;
            return (
              <li
                key={step.id}
                className={`min-w-0 px-1.5 sm:px-2.5 py-2 rounded-xl text-center text-[11px] sm:text-xs font-medium truncate transition-colors ${
                  isCurrent
                    ? 'bg-[#BE185D] text-white font-semibold'
                    : isPast
                      ? 'bg-pink-50 text-[#831843]'
                      : 'text-slate-500'
                }`}
              >
                <span className="font-mono tabular-nums mr-0.5 sm:mr-1">{step.num}.</span>
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.fullLabel}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Unpaid Reservation Reminder Banner */}
      {unpaidBookings.length > 0 && flowStep !== 'qr' && (
        <div
          role="region"
          aria-label="Pending GCash Payments"
          className="bg-pink-50 border border-pink-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-[#831843]">
                You have {unpaidBookings.length} reservation waiting for QR payment
              </p>
              <p className="mt-0.5 text-xs text-pink-900">
                {getCourtById(unpaidBookings[0].courtId).name} · {unpaidBookings[0].date} ·{' '}
                {formatHourRange(unpaidBookings[0].startHour, unpaidBookings[0].durationHours)} (
                {formatCurrency(unpaidBookings[0].totalAmount)})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const b = unpaidBookings[0];
              const qInfo = computeCourtQueueInfo(
                reservedSlots,
                b.courtId,
                b.date,
                b.startHour,
                b.bookingId
              );
              setActivePaymentBooking(b);
              setActiveQueueInfo(qInfo);
              setSenderNumber('');
              setReferenceNo('');
              setPayError(null);
              setFlowStep('qr');
              scrollToTop();
            }}
            className="min-h-[44px] px-4 py-2 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open QR to Pay
          </button>
        </div>
      )}

      {/* STEP 1: CLICK A COURT */}
      {flowStep === 'court' && (
        <section aria-label="Step 1: Choose Pickleball Court" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-semibold text-slate-900">
              Step 1 · Click a Court to Begin
            </h2>
            <span className="text-xs text-pink-900/75">Tap any court to pick date &amp; duration</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 2xl:gap-8">
            {COURTS.map((court) => {
              const activeToday = sharedSchedules.filter(
                (s) => s.courtId === court.id && s.date === upcomingDates[0].iso && s.isActive
              );

              return (
                <button
                  key={court.id}
                  type="button"
                  onClick={() => handleSelectCourtAndContinue(court.id)}
                  className="surface-2026 group text-left hover:border-[#BE185D] hover:-translate-y-0.5 rounded-3xl overflow-hidden transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BE185D]"
                >
                  <div className="aspect-[16/10] w-full bg-pink-50 relative overflow-hidden">
                    {!failedImages[court.id] ? (
                      <img
                        src={court.image}
                        alt={court.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [court.id]: true }))
                        }
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#831843] flex flex-col items-center justify-center p-4 text-white">
                        <MapPin className="w-6 h-6 text-pink-300" aria-hidden="true" />
                        <span className="mt-2 text-xs font-medium text-center">{court.name}</span>
                      </div>
                    )}
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-[#500724]/85 via-[#500724]/20 to-transparent"
                      aria-hidden="true"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 flex items-end justify-between gap-3 text-white">
                      <div className="min-w-0">
                        <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
                          {court.name}
                        </h3>
                        <p className="text-xs text-pink-100 truncate">
                          {court.environment} · {court.surface}
                        </p>
                      </div>
                      <span className="font-mono text-base sm:text-lg font-bold text-white tabular-nums shrink-0">
                        ₱{court.hourlyRate}/hr
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 space-y-4">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                      {court.description}
                    </p>
                    <div className="pt-3 border-t border-pink-100 flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          activeToday.length === 0 ? 'text-emerald-700' : 'text-[#BE185D]'
                        }`}
                      >
                        {activeToday.length === 0
                          ? 'Open today · First in line'
                          : `${activeToday.length} scheduled today`}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#BE185D] group-hover:translate-x-0.5 transition-transform">
                        <span>Pick Date &amp; Time</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 2: PICK DATE, DURATION & START TIME */}
      {flowStep === 'schedule' && (
        <form
          onSubmit={handleReserveAndGoToQR}
          className="surface-2026 rounded-3xl p-5 sm:p-8 2xl:p-10 space-y-6"
        >
          {/* Selected Court Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-pink-100">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-12 rounded-xl overflow-hidden bg-pink-50 shrink-0 border border-pink-200/60">
                {!failedImages[selectedCourt.id] ? (
                  <img
                    src={selectedCourt.image}
                    alt={selectedCourt.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#831843] flex items-center justify-center text-white">
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#BE185D]">Selected Court</p>
                <h2 className="font-display text-lg font-semibold text-slate-900 truncate">
                  {selectedCourt.name}
                </h2>
                <p className="text-xs text-slate-600 truncate">
                  {selectedCourt.environment} ·{' '}
                  <span className="font-mono font-semibold text-[#831843]">
                    ₱{selectedCourt.hourlyRate}/hr
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFlowStep('court')}
              className="min-h-[44px] px-4 py-2 border border-pink-200 text-[#831843] bg-pink-50/70 hover:bg-pink-100 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Change Court</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
                    <span>Pick Date &amp; Duration</span>
                  </h3>
                  <div className="flex items-center gap-1 p-1 bg-pink-50 border border-pink-200/60 rounded-xl">
                    {([1, 2] as const).map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setDurationHours(hrs)}
                        className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          durationHours === hrs
                            ? 'bg-white text-[#831843] shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {hrs} {hrs === 1 ? 'Hour' : 'Hours'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {upcomingDates.map((d) => {
                    const active = d.iso === selectedDate;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => setSelectedDate(d.iso)}
                        className={`min-h-[56px] min-w-[76px] px-3.5 py-2.5 rounded-2xl border text-left shrink-0 transition-all cursor-pointer ${
                          active
                            ? 'bg-[#BE185D] border-[#BE185D] text-white shadow-xs'
                            : 'bg-white border-pink-200/80 text-slate-700 hover:border-[#BE185D]'
                        }`}
                      >
                        <p className={`text-[11px] font-medium ${active ? 'text-pink-100' : 'text-slate-500'}`}>
                          {d.dayShort}
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-bold tabular-nums whitespace-nowrap">
                          {d.dateLabel}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-pink-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
                    <span>Tap Start Time</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    {loadingSlots
                      ? 'Refreshing slots...'
                      : `${formatDisplayDate(selectedDate)} · ${CLUB_INFO.operatingHours} PHT`}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {COURT_HOURS.map((hour) => {
                    const available = isHourAvailable(hour);
                    const isChosen = selectedHour === hour;
                    const isSecondCovered =
                      selectedHour !== null && durationHours === 2 && hour === selectedHour + 1;
                    const existingSlot = slotMap[makeSlotKey(selectedCourtId, selectedDate, hour)];
                    const slotTaken = Boolean(existingSlot);
                    const bookedBy = existingSlot
                      ? scheduleByBookingId[existingSlot.bookingId]?.playerDisplayName
                      : undefined;
                    const pastHour = isToday && hour < currentHourNow;

                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={!available}
                        onClick={() => setSelectedHour(hour)}
                        className={`min-h-[62px] p-3 rounded-2xl border text-left flex flex-col justify-between gap-1 transition-all min-w-0 ${
                          isChosen || isSecondCovered
                            ? 'bg-[#BE185D] border-[#BE185D] text-white shadow-xs cursor-pointer'
                            : available
                              ? 'bg-white border-pink-200/80 text-slate-900 hover:border-[#BE185D] hover:bg-pink-50/40 cursor-pointer'
                              : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span className="font-mono text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap">
                          {formatHour(hour)}
                        </span>
                        <span
                          className={`text-[11px] font-medium truncate ${
                            isChosen || isSecondCovered
                              ? 'text-pink-100'
                              : slotTaken
                                ? 'text-amber-700'
                                : pastHour
                                  ? 'text-slate-400'
                                  : 'text-emerald-700'
                          }`}
                        >
                          {isChosen
                            ? 'Selected'
                            : isSecondCovered
                              ? '2nd Hour'
                              : slotTaken
                                ? bookedBy
                                  ? `Booked · ${bookedBy.split(' ')[0]}`
                                  : 'Booked'
                                : pastHour
                                  ? 'Past'
                                  : durationHours === 2 && hour >= 21
                                    ? '1h max'
                                    : 'Open'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Summary & Continue to QR */}
            <div className="lg:col-span-4 lg:border-l lg:border-pink-100 lg:pl-8 lg:sticky lg:top-8 space-y-5">
              <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900">
                Match Details &amp; Summary
              </h3>

              <div>
                <span className="block text-sm font-medium text-slate-700">Match Format</span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 p-1 bg-pink-50 border border-pink-200/60 rounded-xl">
                  {(['singles', 'doubles', 'drills'] as MatchFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setMatchFormat(fmt)}
                      className={`min-h-[40px] py-2 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        matchFormat === fmt
                          ? 'bg-white text-[#831843] shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {fmt === 'singles' ? 'Singles' : fmt === 'doubles' ? 'Doubles' : 'Drills'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="partner-names" className="block text-sm font-medium text-slate-700">
                  Players / Partners (Optional)
                </label>
                <input
                  id="partner-names"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Marco R., Bea T."
                  value={partnerNames}
                  onChange={(e) => setPartnerNames(e.target.value)}
                  className="mt-1.5 w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-pink-200 rounded-xl focus:outline-none focus:border-[#BE185D]"
                />
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-pink-200/80 hover:bg-pink-50/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paddleRental}
                  onChange={(e) => setPaddleRental(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-[#BE185D]"
                />
                <span className="text-sm text-slate-700">
                  Add Carbon Paddle &amp; Pro Balls{' '}
                  <span className="font-mono text-xs text-[#831843] tabular-nums">
                    (+₱{PADDLE_RENTAL_FEE})
                  </span>
                </span>
              </label>

              {selectedHour !== null && (
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    selectedQueueInfo.aheadCount === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-pink-50 border-pink-200 text-[#831843]'
                  }`}
                >
                  {selectedQueueInfo.aheadCount === 0 ? (
                    <p>
                      <strong>First on this court:</strong> After QR payment, your session starts in{' '}
                      <strong>Current Schedule</strong> with a live countdown timer.
                    </p>
                  ) : (
                    <p>
                      <strong>Next in Line (Queue #{selectedQueueInfo.queueNumber}):</strong>{' '}
                      {selectedQueueInfo.aheadCount} booking ahead on {selectedCourt.name}. After QR
                      payment, your turn waits in <strong>Next Schedule</strong>.
                    </p>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-pink-100 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Date &amp; Time</span>
                  <span className="font-mono text-xs text-slate-900 tabular-nums">
                    {selectedHour !== null
                      ? `${selectedDate} · ${formatHourRange(selectedHour, durationHours)}`
                      : 'Tap an open time'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Duration</span>
                  <span className="text-slate-900">
                    {durationHours} {durationHours === 1 ? 'Hour' : 'Hours'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-pink-100 text-base font-semibold text-slate-900">
                  <span>Total to Pay</span>
                  <span className="font-mono text-[#831843] tabular-nums">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || selectedHour === null}
                className="w-full min-h-[48px] px-5 py-3 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{submitting ? 'Preparing QR Code...' : 'Continue to QR Payment'}</span>
                {!submitting && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* STEP 3: SCAN QR CODE TO PAY */}
      {flowStep === 'qr' && activePaymentBooking && (
        <section
          aria-label="Step 3: Scan GCash QR Code to Pay"
          className="surface-2026 rounded-3xl p-5 sm:p-8 2xl:p-10"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Scannable QR Code & Summary */}
            <div className="lg:col-span-5 space-y-4">
              <GCashQRCode
                amount={activePaymentBooking.totalAmount}
                bookingId={activePaymentBooking.bookingId}
                courtName={activePaymentBooking.courtName}
                date={activePaymentBooking.date}
              />

              <div className="flex items-center justify-between gap-3 bg-pink-50/70 p-3.5 rounded-xl border border-pink-200/80">
                <div>
                  <p className="text-xs text-pink-900/70">GCash Account</p>
                  <p className="font-mono text-sm font-bold text-[#831843] tabular-nums">
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
            </div>

            {/* Right Column: Confirmation Inputs */}
            <form onSubmit={handleConfirmQRPayment} className="lg:col-span-7 space-y-5">
              <div>
                <p className="text-xs font-semibold text-[#BE185D]">Step 3 · QR Code Payment</p>
                <h2 className="mt-1 font-display text-xl sm:text-2xl font-semibold text-slate-900">
                  {getCourtById(activePaymentBooking.courtId).name}
                </h2>
                <p className="mt-1 text-sm text-slate-600 font-mono tabular-nums">
                  {formatDisplayDate(activePaymentBooking.date)} ·{' '}
                  {formatHourRange(
                    activePaymentBooking.startHour,
                    activePaymentBooking.durationHours
                  )}{' '}
                  · {formatCurrency(activePaymentBooking.totalAmount)}
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  (activeQueueInfo?.aheadCount ?? 0) === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                {(activeQueueInfo?.aheadCount ?? 0) === 0 ? (
                  <p>
                    <strong>First in Line (Current Schedule):</strong> Once you confirm payment, your
                    court schedule becomes live immediately in <strong>Current Schedule</strong>.
                  </p>
                ) : (
                  <p>
                    <strong>Next in Line (Queue #{activeQueueInfo?.queueNumber}):</strong>{' '}
                    {activeQueueInfo?.aheadCount} schedule ahead. Once paid, your booking enters{' '}
                    <strong>Next Schedule</strong> until the current match finishes.
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-[#831843] flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
                  <span>After scanning the QR code, enter your GCash receipt details</span>
                </p>

                <div>
                  <label htmlFor="qr-gcash-sender" className="block text-xs font-medium text-[#831843]">
                    Your GCash Mobile Number
                  </label>
                  <input
                    id="qr-gcash-sender"
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
                  <label htmlFor="qr-gcash-ref" className="block text-xs font-medium text-[#831843]">
                    GCash Reference Number
                  </label>
                  <input
                    id="qr-gcash-ref"
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
                <strong>Policy:</strong> Once paid via GCash QR, your court schedule is final — no
                cancellations or refunds.
              </div>

              {payError && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">
                  {payError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActivePaymentBooking(null);
                    setFlowStep('court');
                  }}
                  className="sm:w-1/3 min-h-[48px] px-4 py-2.5 border border-pink-200 text-[#831843] text-sm font-medium rounded-xl hover:bg-pink-50 cursor-pointer"
                >
                  Pay Later
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="sm:w-2/3 min-h-[48px] px-5 py-2.5 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] disabled:opacity-60 cursor-pointer"
                >
                  {paying ? 'Confirming Payment...' : 'Confirm Payment & Finish'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* STEP 4: BOOKING & PAYMENT DONE */}
      {flowStep === 'done' && completedBooking && (
        <section
          aria-label="Step 4: Booking Confirmed"
          className="surface-2026 rounded-3xl p-6 sm:p-10 2xl:p-12 max-w-2xl mx-auto text-center space-y-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-pink-50 border border-pink-200 text-[#BE185D] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#BE185D]">Step 4 · Done</p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">
              Payment Complete · Schedule Confirmed!
            </h2>
            <p className="text-sm text-slate-600">
              {completedBooking.status === 'current'
                ? 'You are first on this court! Your session is now live in Current Schedule with a countdown timer.'
                : 'Your court reservation is queued in Next Schedule. Wait for the turn ahead to finish.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-pink-50/70 border border-pink-200/80 rounded-xl text-left">
            <div>
              <p className="text-xs text-pink-900/70">Court Entry Code</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#831843] tabular-nums">
                {completedBooking.checkInCode}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-pink-900/70">Receipt Number</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[#831843] tabular-nums">
                {completedBooking.receiptNumber}
              </p>
            </div>
          </div>

          <div className="text-sm text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">
              {getCourtById(completedBooking.courtId).name}
            </p>
            <p className="font-mono text-xs text-slate-600 tabular-nums">
              {formatDisplayDate(completedBooking.date)} ·{' '}
              {formatHourRange(completedBooking.startHour, completedBooking.durationHours)} ·{' '}
              {formatCurrency(completedBooking.totalAmount)}
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Use the navigation bar to view your turn in{' '}
            <strong className="text-[#831843]">
              {completedBooking.status === 'current' ? 'Current Schedule' : 'Next Schedule'}
            </strong>{' '}
            or check <strong className="text-[#831843]">Transact Log</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => onShowReceipt(completedBooking, completedTx)}
              className="flex-1 min-h-[48px] px-4 py-2.5 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Receipt className="w-4 h-4" aria-hidden="true" />
              <span>View Official Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCompletedBooking(null);
                setCompletedTx(null);
                setFlowStep('court');
              }}
              className="flex-1 min-h-[48px] px-4 py-2.5 border border-pink-200 text-[#831843] bg-pink-50/60 text-sm font-semibold rounded-xl hover:bg-pink-100 cursor-pointer"
            >
              Book Another Court
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
