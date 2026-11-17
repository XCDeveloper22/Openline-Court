import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';
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
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
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
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('profile');

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
  const [alertPromptDismissed, setAlertPromptDismissed] = useState(false);
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
        if (user) {
          saveNotifiedKey(user.uid, dedupeKey);
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
    [user]
  );

  const handleEnableNotifications = useCallback(async () => {
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      setAlertPromptDismissed(true);
      sendBrowserNotification({
        title: 'Openline Court Alerts Enabled',
        body: 'You will be notified 5 minutes before court time and when your turn moves from Next to Current.',
        tag: 'openline-alerts-enabled'
      });
    }
  }, []);

  const handleTestNotification = useCallback(() => {
    const testId = `test_${Date.now()}`;
    const body =
      notificationPermission === 'granted'
        ? 'Sample alert: Court 1 starts in 5 minutes. Your browser push notifications are working.'
        : 'Sample in-app alert: Court 1 starts in 5 minutes. Enable browser permission for OS push alerts too.';
    pushCourtAlert(testId, 'Openline Court · Test Reminder', body, null, false);
  }, [notificationPermission, pushCourtAlert]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
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
      } else {
        notifiedKeysRef.current = readNotifiedKeys(firebaseUser.uid);
        setNotificationPermission(getNotificationPermission());
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;

    const ensureProfileProvisioned = async () => {
      const userRef = doc(db, 'users', user.uid);
      const privateRef = doc(db, 'users', user.uid, 'private', 'info');

      try {
        const existingSnap = await getDoc(userRef);
        if (!existingSnap.exists() && !cancelled) {
          const fallbackName =
            user.displayName?.trim() || user.email?.split('@')[0] || 'Openline Player';

          const batch = writeBatch(db);
          batch.set(userRef, {
            uid: user.uid,
            displayName: fallbackName.slice(0, 80),
            photoUrl: (user.photoURL ?? '').slice(0, 500),
            skillLevel: '3.5',
            dominantHand: 'Right',
            preferredCourtId: 'court-1',
            bio: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          batch.set(privateRef, {
            uid: user.uid,
            email: (user.email ?? '').slice(0, 160),
            phone: '',
            updatedAt: serverTimestamp()
          });
          await batch.commit();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    };

    void ensureProfileProvisioned();

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`)
    );

    const unsubPrivate = onSnapshot(
      doc(db, 'users', user.uid, 'private', 'info'),
      (snap) => {
        if (snap.exists()) {
          setPrivateInfo(snap.data() as UserPrivateInfo);
        }
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/private/info`)
    );

    setBookingsLoading(true);
    const bookingsQuery = query(collection(db, 'bookings'), where('ownerId', '==', user.uid));
    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const items: CourtBooking[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as CourtBooking);
        });
        setBookings(items);
        setBookingsLoading(false);
      },
      (error) => {
        setBookingsLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      }
    );

    const txQuery = query(collection(db, 'transactions'), where('ownerId', '==', user.uid));
    const unsubTransactions = onSnapshot(
      txQuery,
      (snapshot) => {
        const items: PaymentTransaction[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as PaymentTransaction);
        });
        setTransactions(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    const slotsQuery = query(collection(db, 'courtSlots'), where('status', '==', 'reserved'));
    const unsubSlots = onSnapshot(
      slotsQuery,
      (snapshot) => {
        const list: CourtSlot[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CourtSlot);
        });
        setReservedSlots(list);
        setSlotsReady(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'courtSlots')
    );

    const schedulesQuery = query(collection(db, 'courtSchedules'), where('isActive', '==', true));
    const unsubSchedules = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const list: CourtSchedule[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CourtSchedule);
        });
        setSharedSchedules(list);
        setSharedSchedulesReady(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'courtSchedules')
    );

    return () => {
      cancelled = true;
      unsubProfile();
      unsubPrivate();
      unsubBookings();
      unsubTransactions();
      unsubSlots();
      unsubSchedules();
    };
  }, [authReady, user]);

  // Backfill any existing paid/legacy active bookings into shared courtSchedules so all devices see them
  useEffect(() => {
    if (!user || !sharedSchedulesReady || bookings.length === 0) return;

    const displayName = (
      profile?.displayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'Openline Player'
    ).slice(0, 80);

    bookings.forEach((booking) => {
      if (booking.status !== 'current' && booking.status !== 'pending') return;
      if (booking.courtId !== 'court-1' && booking.courtId !== 'court-2') return;
      if (booking.paymentStatus && booking.paymentStatus !== 'paid') return;
      if (sharedSchedules.some((s) => s.scheduleId === booking.bookingId)) return;
      if (backfilledIdsRef.current.has(booking.bookingId)) return;

      backfilledIdsRef.current.add(booking.bookingId);
      void setDoc(doc(db, 'courtSchedules', booking.bookingId), {
        scheduleId: booking.bookingId,
        bookingId: booking.bookingId,
        ownerId: booking.ownerId,
        playerDisplayName: displayName,
        courtId: booking.courtId,
        courtName: booking.courtName.slice(0, 80),
        date: booking.date,
        startHour: booking.startHour,
        durationHours: booking.durationHours,
        matchFormat: booking.matchFormat,
        status: booking.status,
        isActive: true,
        checkedIn: booking.checkedIn,
        scoreSummary: (booking.scoreSummary ?? '').slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch((error) => {
        backfilledIdsRef.current.delete(booking.bookingId);
        handleFirestoreError(error, OperationType.CREATE, `courtSchedules/${booking.bookingId}`);
      });
    });
  }, [user, profile, sharedSchedulesReady, bookings, sharedSchedules]);

  // Global auto-promotion: when a paid 'pending' booking has 0 schedules ahead of it, promote to 'current'
  useEffect(() => {
    if (!slotsReady || bookings.length === 0) return;

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
        nowMs
      );

      if (queue.aheadCount === 0) {
        promotedIdsRef.current.add(booking.bookingId);
        const batch = writeBatch(db);
        batch.update(doc(db, 'bookings', booking.bookingId), {
          status: 'current',
          updatedAt: serverTimestamp()
        });
        if (sharedSchedules.some((s) => s.scheduleId === booking.bookingId)) {
          batch.update(doc(db, 'courtSchedules', booking.bookingId), {
            status: 'current',
            updatedAt: serverTimestamp()
          });
        }
        void batch
          .commit()
          .then(() => {
            const promotedBooking: CourtBooking = { ...booking, status: 'current' };
            setPromotedNoticeBooking(promotedBooking);
            const courtLabel = getCourtById(booking.courtId).name;
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
          .catch((error) => {
            promotedIdsRef.current.delete(booking.bookingId);
            handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.bookingId}`);
          });
      }
    });
  }, [slotsReady, bookings, reservedSlots, sharedSchedules, nowMs, pushCourtAlert]);

  // Auto-finish: once a current schedule reaches its scheduled PHT end time, automatically complete it
  useEffect(() => {
    if (!user || !slotsReady || !sharedSchedulesReady || bookings.length === 0) return;

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
      const batch = writeBatch(db);

      batch.update(doc(db, 'bookings', booking.bookingId), {
        status: 'completed',
        checkedIn: true,
        scoreSummary: cleanScore,
        updatedAt: serverTimestamp()
      });

      if (sharedSchedules.some((s) => s.scheduleId === booking.bookingId)) {
        batch.update(doc(db, 'courtSchedules', booking.bookingId), {
          status: 'completed',
          isActive: false,
          checkedIn: true,
          scoreSummary: cleanScore,
          updatedAt: serverTimestamp()
        });
      }

      const slotKeys = [makeSlotKey(booking.courtId, booking.date, booking.startHour)];
      if (booking.durationHours === 2) {
        slotKeys.push(makeSlotKey(booking.courtId, booking.date, booking.startHour + 1));
      }
      slotKeys.forEach((key) => {
        if (reservedSlots.some((s) => s.slotKey === key && s.ownerId === booking.ownerId)) {
          batch.delete(doc(db, 'courtSlots', key));
        }
      });

      void batch
        .commit()
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
        .catch((error) => {
          autoFinishedIdsRef.current.delete(booking.bookingId);
          handleFirestoreError(error, OperationType.WRITE, `bookings/${booking.bookingId}`);
        });
    });
  }, [
    user,
    slotsReady,
    sharedSchedulesReady,
    bookings,
    sharedSchedules,
    reservedSlots,
    nowMs,
    pushCourtAlert
  ]);

  // Detect any status change from 'pending' -> 'current' (e.g. from another device or tab)
  useEffect(() => {
    if (!user || bookings.length === 0) return;

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
  }, [user, bookings, pushCourtAlert]);

  // Alert user 5 minutes before their scheduled court start time
  useEffect(() => {
    if (!user || bookings.length === 0) return;

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
  }, [user, bookings, pushCourtAlert]);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (!splashDone || !authReady) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  const { currentSchedules, pendingSchedules } = partitionActiveSchedules(
    sharedSchedules,
    bookings,
    reservedSlots,
    user.uid,
    nowMs
  );
  const currentCount = currentSchedules.length;
  const pendingCount = pendingSchedules.length;

  const unpaidBookings = bookings.filter(
    (b) =>
      b.status === 'awaiting_payment' && (b.courtId === 'court-1' || b.courtId === 'court-2')
  );

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveTab('profile');
  };

  const playerName = profile?.displayName || user.displayName || 'Openline Player';

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
        playerPhotoUrl={profile?.photoUrl || user.photoURL || undefined}
      />

      <div className="flex-1 min-w-0 flex flex-col lg:order-1">
        <main className="flex-1 container-4k px-4 sm:px-6 lg:px-10 2xl:px-14 pt-5 sm:pt-7 pb-[calc(2.5rem+env(safe-area-inset-bottom))] lg:py-10 2xl:py-12 space-y-6 sm:space-y-8">
          {/* Browser Push Alert Opt-In Banner (when permission is default and not dismissed) */}
          {notificationPermission === 'default' && !alertPromptDismissed && (
            <div
              role="region"
              aria-label="Enable Browser Alerts"
              className="surface-2026 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Bell className="w-5 h-5 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-[#831843]">
                    Turn on Browser Court Push Alerts
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Receive a push notification 5 minutes before your court time and immediately when
                    your Next Schedule moves to Current Schedule.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="min-h-[40px] px-4 py-2 bg-[#BE185D] text-white text-xs font-semibold rounded-xl hover:bg-[#9D174D] whitespace-nowrap cursor-pointer"
                >
                  Enable Alerts
                </button>
                <button
                  type="button"
                  onClick={() => setAlertPromptDismissed(true)}
                  className="min-h-[40px] px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#831843] cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          )}

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
              onTestNotification={handleTestNotification}
            />
          )}

          {activeTab === 'book' && (
            <BookCourtView
              uid={user.uid}
              playerName={playerName}
              defaultCourtId={profile?.preferredCourtId === 'court-2' ? 'court-2' : 'court-1'}
              unpaidBookings={unpaidBookings}
              reservedSlots={reservedSlots}
              sharedSchedules={sharedSchedules}
              loadingSlots={!slotsReady}
              onShowReceipt={(booking, tx) =>
                setReceiptModalData({ booking, transaction: tx ?? null })
              }
            />
          )}

          {activeTab === 'current' && (
            <CurrentScheduleView
              uid={user.uid}
              bookings={bookings}
              sharedSchedules={sharedSchedules}
              reservedSlots={reservedSlots}
              loading={bookingsLoading && !sharedSchedulesReady}
              onShowReceipt={(booking) => setReceiptModalData({ booking })}
            />
          )}

          {activeTab === 'pending' && (
            <PendingScheduleView
              uid={user.uid}
              bookings={bookings}
              sharedSchedules={sharedSchedules}
              reservedSlots={reservedSlots}
              loading={bookingsLoading && !sharedSchedulesReady}
              onShowReceipt={(booking) => setReceiptModalData({ booking })}
            />
          )}

          {activeTab === 'transact' && (
            <TransactLogView
              bookings={bookings}
              transactions={transactions}
              reservedSlots={reservedSlots}
              loading={bookingsLoading}
              onStartPayment={(booking, queueInfo) =>
                setPaymentModalData({ booking, queueInfo })
              }
              onShowTransactionReceipt={(tx, matchingBooking) =>
                setReceiptModalData({ transaction: tx, booking: matchingBooking })
              }
            />
          )}

          {activeTab === 'map' && (
            <FacilityMapView
              uid={user.uid}
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
