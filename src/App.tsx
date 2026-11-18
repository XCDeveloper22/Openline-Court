import { useCallback, useEffect, useRef, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { signOut } from 'firebase/auth';
import { Bell, Sparkles, X } from 'lucide-react';
import { BookCourtView } from './components/BookCourtView';
import { CurrentScheduleView } from './components/CurrentScheduleView';
import { FacilityMapView } from './components/FacilityMapView';
import { GCashPaymentModal } from './components/GCashPaymentModal';
import { HelpFaqView } from './components/HelpFaqView';
import { LoginScreen } from './components/LoginScreen';
import { PendingScheduleView } from './components/PendingScheduleView';
import { ProfileView } from './components/ProfileView';
import { ReceiptModal } from './components/ReceiptModal';
import { SplashScreen } from './components/SplashScreen';
import { TopNav } from './components/TopNav';
import { TransactLogView } from './components/TransactLogView';
import {
  computeCourtQueueInfo,
  formatHourRange,
  getCourtById,
  getPhilippineSlotTimestampMs,
  makeSlotKey,
  partitionActiveSchedules,
  QueueAnalysis
} from './data/courts';
import { auth } from './lib/firebase';
import {
  loadSupabaseClubData,
  supabaseBackfillSchedule,
  supabaseCompleteBooking,
  supabasePromoteBooking,
  subscribeSupabaseClubUpdates
} from './lib/supabaseClub';
import { supabase } from './supabaseClient.js';
import {
  BrowserNotificationPermission,
  getNotificationPermission,
  readNotifiedKeys,
  requestNotificationPermission,
  saveNotifiedKey,
  sendBrowserNotification
} from './lib/notifications';
import {
  BookingStatus,
  CourtBooking,
  CourtSchedule,
  CourtSlot,
  PaymentTransaction,
  TabId,
  UserPrivateInfo,
  UserProfile
} from './types';

interface InAppAlert {
  id: string;
  title: string;
  body: string;
  booking?: CourtBooking | null;
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('book');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [bookings, setBookings] = useState<CourtBooking[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [reservedSlots, setReservedSlots] = useState<CourtSlot[]>([]);
  const [sharedSchedules, setSharedSchedules] = useState<CourtSchedule[]>([]);
  const [sharedSchedulesReady, setSharedSchedulesReady] = useState(false);
  const [slotsReady, setSlotsReady] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const [paymentModalData, setPaymentModalData] = useState<{
    booking: CourtBooking;
    queueInfo: QueueAnalysis;
  } | null>(null);

  const [receiptModalData, setReceiptModalData] = useState<{
    booking?: CourtBooking | null;
    transaction?: PaymentTransaction | null;
  } | null>(null);

  const [promotedNoticeBooking, setPromotedNoticeBooking] = useState<CourtBooking | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getNotificationPermission());
  const [inAppAlerts, setInAppAlerts] = useState<InAppAlert[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const promotedIdsRef = useRef<Set<string>>(new Set());
  const autoFinishedIdsRef = useRef<Set<string>>(new Set());
  const backfilledIdsRef = useRef<Set<string>>(new Set());
  const prevBookingStatusRef = useRef<Map<string, BookingStatus>>(new Map());
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  const pushCourtAlert = useCallback(
    (
      dedupeKey: string,
      title: string,
      body: string,
      booking?: CourtBooking | null,
      persistDedupe = true
    ) => {
      if (persistDedupe) {
        if (notifiedKeysRef.current.has(dedupeKey)) return;
        notifiedKeysRef.current.add(dedupeKey);
        if (supabaseUser?.id) {
          saveNotifiedKey(supabaseUser.id, dedupeKey);
        }
      }

      sendBrowserNotification({
        title,
        body,
        tag: dedupeKey,
        onClick: () => {
          setActiveTab('current');
          if (booking) {
            setReceiptModalData({ booking });
          }
        }
      });

      setInAppAlerts((prev) => {
        if (prev.some((a) => a.id === dedupeKey)) return prev;
        return [{ id: dedupeKey, title, body, booking }, ...prev].slice(0, 3);
      });
    },
    [supabaseUser]
  );

  const handleEnableNotifications = useCallback(async () => {
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      sendBrowserNotification({
        title: 'Openline Court Alerts Enabled',
        body: 'You will be notified 5 minutes before court time and when your turn moves from Next to Current.',
        tag: 'openline-alerts-enabled'
      });
    }
  }, []);

  // Clear any legacy cached Firebase Auth session so PC and mobile always stay synced on Supabase Auth
  useEffect(() => {
    void signOut(auth).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const readySafetyTimer = window.setTimeout(() => {
      if (mounted) setSupabaseReady(true);
    }, 4000);

    const clearUserData = () => {
      setProfile(null);
      setPrivateInfo(null);
      setBookings([]);
      setTransactions([]);
      setReservedSlots([]);
      setSharedSchedules([]);
      setSharedSchedulesReady(false);
      setSlotsReady(false);
      setBookingsLoading(false);
      setInAppAlerts([]);
      promotedIdsRef.current.clear();
      autoFinishedIdsRef.current.clear();
      backfilledIdsRef.current.clear();
      prevBookingStatusRef.current.clear();
      notifiedKeysRef.current.clear();
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const sessionUser = data.session?.user ?? null;
        setSupabaseUser(sessionUser);
        setSupabaseReady(true);
        if (!sessionUser) {
          clearUserData();
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSupabaseReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const sessionUser = session?.user ?? null;
      setSupabaseUser(sessionUser);
      setSupabaseReady(true);
      if (!sessionUser) {
        clearUserData();
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(readySafetyTimer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const supabaseUserId = supabaseUser?.id ?? null;
  const supabaseUserEmail = supabaseUser?.email ?? '';
  const supabaseUserMeta = supabaseUser?.user_metadata as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!supabaseUserId) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [supabaseUserId]);

  useEffect(() => {
    if (!supabaseUserId) return;

    let cancelled = false;
    const fallbackName =
      typeof supabaseUserMeta?.full_name === 'string'
        ? supabaseUserMeta.full_name
        : typeof supabaseUserMeta?.name === 'string'
          ? supabaseUserMeta.name
          : supabaseUserEmail.split('@')[0] || 'Openline Player';
    const fallbackAvatar =
      typeof supabaseUserMeta?.avatar_url === 'string' ? supabaseUserMeta.avatar_url : '';

    const refreshFromSupabase = async () => {
      try {
        const snap = await loadSupabaseClubData(
          supabaseUserId,
          supabaseUserEmail,
          fallbackName,
          fallbackAvatar
        );
        if (cancelled) return;
        setProfile(snap.profile);
        setPrivateInfo(snap.privateInfo);
        setBookings(snap.bookings);
        setTransactions(snap.transactions);
        setReservedSlots(snap.reservedSlots);
        setSharedSchedules(snap.sharedSchedules);
        setBookingsLoading(false);
        setSlotsReady(true);
        setSharedSchedulesReady(true);

        if (snap.syncErrors.length > 0) {
          setInAppAlerts((prev) => {
            const id = 'supabase-load-error';
            const body = `Supabase sync issue (${snap.syncErrors.join(' | ')}). Run the updated supabase_schema.sql in Supabase SQL Editor if any table or policy is missing.`;
            const filtered = prev.filter((a) => a.id !== id);
            return [{ id, title: 'Supabase Database Sync Notice', body }, ...filtered].slice(0, 3);
          });
        } else {
          setInAppAlerts((prev) => prev.filter((a) => a.id !== 'supabase-load-error'));
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to load Supabase data.';
        setProfile((prev) =>
          prev ?? {
            uid: supabaseUserId,
            displayName: fallbackName.slice(0, 80),
            photoUrl: fallbackAvatar.slice(0, 500),
            skillLevel: '3.5',
            dominantHand: 'Right',
            preferredCourtId: 'court-1',
            bio: '',
            createdAt: null,
            updatedAt: null
          }
        );
        setPrivateInfo((prev) =>
          prev ?? {
            uid: supabaseUserId,
            email: supabaseUserEmail,
            phone: '',
            updatedAt: null
          }
        );
        setBookingsLoading(false);
        setSlotsReady(true);
        setSharedSchedulesReady(true);
        setInAppAlerts((prev) => {
          const id = 'supabase-load-error';
          if (prev.some((a) => a.id === id)) return prev;
          return [
            {
              id,
              title: 'Supabase Database Sync Notice',
              body: message
            },
            ...prev
          ].slice(0, 3);
        });
      }
    };

    notifiedKeysRef.current = readNotifiedKeys(supabaseUserId);
    setNotificationPermission(getNotificationPermission());
    setBookingsLoading(true);
    void refreshFromSupabase();

    const unsub = subscribeSupabaseClubUpdates(supabaseUserId, () => {
      void refreshFromSupabase();
    });

    const pollId = window.setInterval(() => {
      void refreshFromSupabase();
    }, 10000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshFromSupabase();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(pollId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [supabaseUserId, supabaseUserEmail, supabaseUserMeta]);

  // Backfill any paid active bookings into shared court_schedules so all users & devices see Current and Next Schedules
  useEffect(() => {
    if (!supabaseUserId || !sharedSchedulesReady || bookings.length === 0) return;

    const displayName = (
      profile?.displayName ||
      supabaseUserEmail.split('@')[0] ||
      'Openline Player'
    ).slice(0, 80);

    bookings.forEach((booking) => {
      if (booking.status !== 'current' && booking.status !== 'pending') return;
      if (booking.courtId !== 'court-1' && booking.courtId !== 'court-2') return;
      if (booking.paymentStatus && booking.paymentStatus !== 'paid') return;

      const existingSchedule = sharedSchedules.find((s) => s.scheduleId === booking.bookingId);
      if (existingSchedule && existingSchedule.status === booking.status && existingSchedule.isActive) {
        return;
      }
      if (backfilledIdsRef.current.has(booking.bookingId)) return;

      backfilledIdsRef.current.add(booking.bookingId);
      void supabaseBackfillSchedule(booking, displayName).catch(() => {
        backfilledIdsRef.current.delete(booking.bookingId);
      });
    });
  }, [supabaseUserId, supabaseUserEmail, profile, sharedSchedulesReady, bookings, sharedSchedules]);

  // Global auto-promotion: when a paid 'pending' booking has 0 schedules ahead of it, promote to 'current'
  useEffect(() => {
    if (!supabaseUserId || !slotsReady || !sharedSchedulesReady || bookings.length === 0) return;

    bookings.forEach((booking) => {
      if (booking.status !== 'pending' || (booking.paymentStatus && booking.paymentStatus !== 'paid')) {
        return;
      }
      if (promotedIdsRef.current.has(booking.bookingId)) return;

      const queue = computeCourtQueueInfo(
        reservedSlots,
        booking.courtId,
        booking.date,
        booking.startHour,
        booking.bookingId,
        nowMs,
        sharedSchedules
      );

      if (queue.aheadCount === 0) {
        promotedIdsRef.current.add(booking.bookingId);
        const promotedBooking: CourtBooking = { ...booking, status: 'current' };
        const courtLabel = getCourtById(booking.courtId).name;

        void supabasePromoteBooking(booking.bookingId, supabaseUserId)
          .then(() => {
            setPromotedNoticeBooking(promotedBooking);
            pushCourtAlert(
              `promoted_${booking.bookingId}`,
              `It's Your Turn Now · ${courtLabel}`,
              `Your schedule moved from Next to Current on ${courtLabel} (${formatHourRange(
                booking.startHour,
                booking.durationHours
              )}). Show code ${booking.checkInCode} to the watcher.`,
              promotedBooking
            );
          })
          .catch(() => {
            promotedIdsRef.current.delete(booking.bookingId);
          });
      }
    });
  }, [
    supabaseUserId,
    slotsReady,
    sharedSchedulesReady,
    bookings,
    reservedSlots,
    sharedSchedules,
    nowMs,
    pushCourtAlert
  ]);

  // Auto-finish: once a current schedule reaches its scheduled PHT end time, automatically complete it
  useEffect(() => {
    if (!supabaseUser || !slotsReady || !sharedSchedulesReady || bookings.length === 0) {
      return;
    }

    bookings.forEach((booking) => {
      if (booking.courtId !== 'court-1' && booking.courtId !== 'court-2') return;
      if (booking.status !== 'current') return;
      if (booking.paymentStatus && booking.paymentStatus !== 'paid') return;
      if (autoFinishedIdsRef.current.has(booking.bookingId)) return;

      const endMs = getPhilippineSlotTimestampMs(
        booking.date,
        booking.startHour + booking.durationHours
      );
      if (nowMs < endMs) return;

      autoFinishedIdsRef.current.add(booking.bookingId);
      const cleanScore = (booking.scoreSummary ?? '').slice(0, 64);
      const slotKeys = [makeSlotKey(booking.courtId, booking.date, booking.startHour)];
      if (booking.durationHours === 2) {
        slotKeys.push(makeSlotKey(booking.courtId, booking.date, booking.startHour + 1));
      }

      void supabaseCompleteBooking(booking.bookingId, cleanScore, slotKeys, supabaseUser.id)
        .then(() => {
          setPromotedNoticeBooking((prev) =>
            prev?.bookingId === booking.bookingId ? null : prev
          );
          const courtLabel = getCourtById(booking.courtId).name;
          const completedBooking: CourtBooking = {
            ...booking,
            status: 'completed',
            checkedIn: true
          };
          pushCourtAlert(
            `finished_${booking.bookingId}`,
            `Schedule Finished · ${courtLabel}`,
            `Your ${formatHourRange(
              booking.startHour,
              booking.durationHours
            )} session on ${courtLabel} is complete and logged in Completed Matches.`,
            completedBooking
          );
        })
        .catch(() => {
          autoFinishedIdsRef.current.delete(booking.bookingId);
        });
    });
  }, [supabaseUser, slotsReady, sharedSchedulesReady, bookings, nowMs, pushCourtAlert]);

  // Detect any status change from 'pending' -> 'current'
  useEffect(() => {
    if (!supabaseUser || bookings.length === 0) return;

    const prevMap = prevBookingStatusRef.current;
    bookings.forEach((booking) => {
      if (booking.courtId !== 'court-1' && booking.courtId !== 'court-2') return;
      const prevStatus = prevMap.get(booking.bookingId);
      if (prevStatus === 'pending' && booking.status === 'current') {
        setPromotedNoticeBooking(booking);
        const courtLabel = getCourtById(booking.courtId).name;
        pushCourtAlert(
          `promoted_${booking.bookingId}`,
          `It's Your Turn Now · ${courtLabel}`,
          `Status changed from Pending to Current on ${courtLabel} (${formatHourRange(
            booking.startHour,
            booking.durationHours
          )}). Show receipt ${booking.receiptNumber || booking.checkInCode} to the watcher.`,
          booking
        );
      }
      prevMap.set(booking.bookingId, booking.status);
    });
  }, [supabaseUser, bookings, pushCourtAlert]);

  // Alert user 5 minutes before their scheduled court start time
  useEffect(() => {
    if (!supabaseUser || bookings.length === 0) return;

    const checkUpcomingReminders = () => {
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;

      bookings.forEach((booking) => {
        if (booking.courtId !== 'court-1' && booking.courtId !== 'court-2') return;
        if (booking.status !== 'current' && booking.status !== 'pending') return;

        const startMs = getPhilippineSlotTimestampMs(booking.date, booking.startHour);
        const msUntilStart = startMs - now;

        if (msUntilStart > 0 && msUntilStart <= fiveMinutesMs) {
          const minsLeft = Math.max(1, Math.ceil(msUntilStart / 60000));
          const courtLabel = getCourtById(booking.courtId).name;
          const key = `5min_${booking.bookingId}_${booking.date}_${booking.startHour}`;
          pushCourtAlert(
            key,
            `5-Minute Court Alert · ${courtLabel}`,
            `Your ${formatHourRange(booking.startHour, booking.durationHours)} session starts in ${minsLeft} min. Entry Code: ${booking.checkInCode}.`,
            booking
          );
        }
      });
    };

    checkUpcomingReminders();
    const timerId = window.setInterval(checkUpcomingReminders, 5000);
    return () => window.clearInterval(timerId);
  }, [supabaseUser, bookings, pushCourtAlert]);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (!splashDone || !supabaseReady) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!supabaseUser) {
    return <LoginScreen />;
  }

  const activeUid = supabaseUser.id;

  const { currentSchedules, pendingSchedules } = partitionActiveSchedules(
    sharedSchedules,
    bookings,
    reservedSlots,
    activeUid,
    nowMs
  );
  const currentCount = currentSchedules.length;
  const pendingCount = pendingSchedules.length;

  const unpaidBookings = bookings.filter(
    (b) =>
      b.status === 'awaiting_payment' && (b.courtId === 'court-1' || b.courtId === 'court-2')
  );

  const handleSignOut = async () => {
    await Promise.allSettled([signOut(auth), supabase.auth.signOut()]);
    setActiveTab('book');
  };

  const playerName =
    profile?.displayName ||
    supabaseUser.email?.split('@')[0] ||
    'Openline Player';

  return (
    <div className="min-h-dvh bg-[#FFF9FB] bg-[radial-gradient(ellipse_at_top_right,_rgba(244,114,182,0.10),_transparent_55%)] flex flex-col lg:flex-row">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSignOut={handleSignOut}
        currentCount={currentCount}
        pendingCount={pendingCount}
        unpaidCount={unpaidBookings.length}
        notificationPermission={notificationPermission}
        onEnableNotifications={handleEnableNotifications}
        playerName={playerName}
        playerPhotoUrl={profile?.photoUrl || undefined}
      />

      <div className="flex-1 min-w-0 flex flex-col lg:order-1">
        <main className="flex-1 container-4k px-4 sm:px-6 lg:px-10 2xl:px-14 pt-5 sm:pt-7 pb-[calc(2.5rem+env(safe-area-inset-bottom))] lg:py-8 2xl:py-10 space-y-6">
          {/* In-App Court Push Alerts Stack (5-min warnings & Pending -> Current alerts) */}
          {inAppAlerts.length > 0 && (
            <div className="space-y-2.5" aria-live="polite" aria-label="Court Alerts">
              {inAppAlerts.map((alert) => (
                <div
                  key={alert.id}
                  role="alert"
                  className="bg-pink-50 border border-[#BE185D] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Bell className="w-5 h-5 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-[#831843]">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-pink-950 leading-relaxed">{alert.body}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {alert.booking && (
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptModalData({ booking: alert.booking });
                          setActiveTab('current');
                          setInAppAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                        }}
                        className="min-h-[40px] px-3.5 py-2 bg-[#BE185D] text-white text-xs font-semibold rounded-xl hover:bg-[#9D174D] whitespace-nowrap cursor-pointer"
                      >
                        View Schedule
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Dismiss alert"
                      onClick={() =>
                        setInAppAlerts((prev) => prev.filter((a) => a.id !== alert.id))
                      }
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-[#831843] hover:bg-pink-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Global Turn Notification when Next in Line advances to Current */}
          {promotedNoticeBooking && (
            <div
              role="status"
              className="bg-pink-50 border border-pink-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-display text-sm font-bold text-[#831843]">
                    It is Your Schedule Now on {getCourtById(promotedNoticeBooking.courtId).name}!
                  </p>
                  <p className="mt-0.5 text-xs text-pink-900">
                    The court turn ahead of you finished. Present your active receipt to the court
                    watcher or manager.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setReceiptModalData({ booking: promotedNoticeBooking });
                    setPromotedNoticeBooking(null);
                    setActiveTab('current');
                  }}
                  className="min-h-[44px] px-4 py-2 bg-[#BE185D] text-white text-xs font-semibold rounded-xl hover:bg-[#9D174D] cursor-pointer"
                >
                  Show Turn Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setPromotedNoticeBooking(null)}
                  className="min-h-[44px] px-3 py-2 text-xs font-medium text-[#831843] hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <ProfileView
              profile={profile}
              privateInfo={privateInfo}
              bookings={bookings}
              transactions={transactions}
              clubCurrentCount={currentCount}
              clubPendingCount={pendingCount}
              notificationPermission={notificationPermission}
              onEnableNotifications={handleEnableNotifications}
            />
          )}

          {activeTab === 'book' && (
            <BookCourtView
              uid={activeUid}
              playerName={playerName}
              defaultCourtId={profile?.preferredCourtId === 'court-2' ? 'court-2' : 'court-1'}
              unpaidBookings={unpaidBookings}
              reservedSlots={reservedSlots}
              sharedSchedules={sharedSchedules}
              loadingSlots={!slotsReady}
              onShowReceipt={(booking, tx) =>
                setReceiptModalData({ booking, transaction: tx ?? null })
              }
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'current' && (
            <CurrentScheduleView
              uid={activeUid}
              bookings={bookings}
              sharedSchedules={sharedSchedules}
              reservedSlots={reservedSlots}
              loading={bookingsLoading && !sharedSchedulesReady}
              onShowReceipt={(booking) => setReceiptModalData({ booking })}
              onBookCourt={() => setActiveTab('book')}
            />
          )}

          {activeTab === 'pending' && (
            <PendingScheduleView
              uid={activeUid}
              bookings={bookings}
              sharedSchedules={sharedSchedules}
              reservedSlots={reservedSlots}
              loading={bookingsLoading && !sharedSchedulesReady}
              onShowReceipt={(booking) => setReceiptModalData({ booking })}
              onBookCourt={() => setActiveTab('book')}
            />
          )}

          {activeTab === 'transact' && (
            <TransactLogView
              bookings={bookings}
              transactions={transactions}
              reservedSlots={reservedSlots}
              sharedSchedules={sharedSchedules}
              loading={bookingsLoading}
              onStartPayment={(booking, queueInfo) =>
                setPaymentModalData({ booking, queueInfo })
              }
              onShowTransactionReceipt={(tx, matchingBooking) =>
                setReceiptModalData({ transaction: tx, booking: matchingBooking })
              }
              onBookCourt={() => setActiveTab('book')}
            />
          )}

          {activeTab === 'map' && (
            <FacilityMapView
              uid={activeUid}
              bookings={bookings}
              sharedSchedules={sharedSchedules}
              reservedSlots={reservedSlots}
            />
          )}

          {activeTab === 'faq' && <HelpFaqView />}
        </main>
      </div>

      {/* GCash QR Checkout Modal (used when paying pending items from Transact Log) */}
      <GCashPaymentModal
        booking={paymentModalData?.booking ?? null}
        queueInfo={
          paymentModalData?.queueInfo ?? {
            aheadCount: 0,
            queueNumber: 1,
            aheadStartHour: null,
            aheadDurationHours: null
          }
        }
        playerName={playerName}
        onClose={() => setPaymentModalData(null)}
        onPaymentSuccess={(updatedBooking, tx) => {
          setPaymentModalData(null);
          setReceiptModalData({ booking: updatedBooking, transaction: tx });
          setActiveTab(updatedBooking.status === 'current' ? 'current' : 'pending');
        }}
      />

      {/* Official Purchase & Watcher Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(receiptModalData)}
        onClose={() => setReceiptModalData(null)}
        playerName={playerName}
        booking={receiptModalData?.booking}
        transaction={receiptModalData?.transaction}
      />
    </div>
  );
}
