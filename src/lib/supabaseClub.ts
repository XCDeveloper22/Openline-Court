import { getPhilippineSlotTimestampMs } from '../data/courts';
import { supabase } from '../supabaseClient.js';
import {
  BookingStatus,
  CourtBooking,
  CourtId,
  CourtSchedule,
  CourtSlot,
  DominantHand,
  MatchFormat,
  PaymentStatus,
  PaymentTransaction,
  SkillLevel,
  UserPrivateInfo,
  UserProfile
} from '../types';

const refreshListeners = new Set<() => void>();

export function notifySupabaseClubListeners(): void {
  refreshListeners.forEach((cb) => cb());
}

export function subscribeSupabaseClubUpdates(userId: string, onRefresh: () => void): () => void {
  refreshListeners.add(onRefresh);

  const channel = supabase
    .channel(`openline-club-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => onRefresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () =>
      onRefresh()
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_slots' }, () =>
      onRefresh()
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_schedules' }, () =>
      onRefresh()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'player_profiles',
        filter: `user_id=eq.${userId}`
      },
      () => onRefresh()
    )
    .subscribe();

  return () => {
    refreshListeners.delete(onRefresh);
    void supabase.removeChannel(channel);
  };
}

interface ProfileRow {
  user_id: string;
  display_name: string;
  email: string;
  phone: string;
  photo_url: string;
  skill_level: string;
  dominant_hand: string;
  preferred_court_id: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

interface BookingRow {
  booking_id: string;
  user_id: string;
  court_id: string;
  court_name: string;
  date: string;
  start_hour: number;
  duration_hours: number;
  match_format: string;
  partner_names: string;
  paddle_rental: boolean;
  hourly_rate: number;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  gcash_reference_no: string;
  gcash_sender_number: string;
  receipt_number: string;
  paid_at_iso: string;
  check_in_code: string;
  checked_in: boolean;
  score_summary: string;
  created_at: string;
  updated_at: string;
}

interface TransactionRow {
  tx_id: string;
  user_id: string;
  booking_id: string;
  receipt_number: string;
  court_id: string;
  court_name: string;
  date: string;
  start_hour: number;
  duration_hours: number;
  match_format: string;
  amount: number;
  payment_method: string;
  gcash_account_name: string;
  gcash_account_number: string;
  gcash_reference_no: string;
  gcash_sender_number: string;
  payment_status: string;
  schedule_status_at_pay: string;
  check_in_code: string;
  created_at: string;
}

interface SlotRow {
  slot_key: string;
  user_id: string;
  booking_id: string;
  court_id: string;
  date: string;
  hour: number;
  start_hour: number;
  duration_hours: number;
  status: string;
  created_at: string;
}

interface ScheduleRow {
  schedule_id: string;
  user_id: string;
  booking_id: string;
  player_display_name: string;
  court_id: string;
  court_name: string;
  date: string;
  start_hour: number;
  duration_hours: number;
  match_format: string;
  status: string;
  is_active: boolean;
  checked_in: boolean;
  score_summary: string;
  created_at: string;
  updated_at: string;
}

function mapProfile(row: ProfileRow): { profile: UserProfile; privateInfo: UserPrivateInfo } {
  return {
    profile: {
      uid: row.user_id,
      displayName: row.display_name,
      photoUrl: row.photo_url,
      skillLevel: row.skill_level as SkillLevel,
      dominantHand: (row.dominant_hand === 'Left' ? 'Left' : 'Right') as DominantHand,
      preferredCourtId: (row.preferred_court_id === 'court-2' ? 'court-2' : 'court-1') as CourtId,
      bio: row.bio,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    },
    privateInfo: {
      uid: row.user_id,
      email: row.email,
      phone: row.phone,
      updatedAt: row.updated_at
    }
  };
}

function mapBooking(row: BookingRow): CourtBooking {
  return {
    bookingId: row.booking_id,
    ownerId: row.user_id,
    courtId: row.court_id as CourtId,
    courtName: row.court_name,
    date: row.date,
    startHour: row.start_hour,
    durationHours: (row.duration_hours === 2 ? 2 : 1) as 1 | 2,
    matchFormat: row.match_format as MatchFormat,
    partnerNames: row.partner_names,
    paddleRental: row.paddle_rental,
    hourlyRate: row.hourly_rate,
    totalAmount: row.total_amount,
    status: row.status as BookingStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method,
    gcashReferenceNo: row.gcash_reference_no,
    gcashSenderNumber: row.gcash_sender_number,
    receiptNumber: row.receipt_number,
    paidAtIso: row.paid_at_iso,
    checkInCode: row.check_in_code,
    checkedIn: row.checked_in,
    scoreSummary: row.score_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTransaction(row: TransactionRow): PaymentTransaction {
  return {
    txId: row.tx_id,
    ownerId: row.user_id,
    bookingId: row.booking_id,
    receiptNumber: row.receipt_number,
    courtId: row.court_id as CourtId,
    courtName: row.court_name,
    date: row.date,
    startHour: row.start_hour,
    durationHours: (row.duration_hours === 2 ? 2 : 1) as 1 | 2,
    matchFormat: row.match_format as MatchFormat,
    amount: row.amount,
    paymentMethod: 'GCash',
    gcashAccountName: row.gcash_account_name,
    gcashAccountNumber: row.gcash_account_number,
    gcashReferenceNo: row.gcash_reference_no,
    gcashSenderNumber: row.gcash_sender_number,
    paymentStatus: 'paid',
    scheduleStatusAtPay: row.schedule_status_at_pay as 'current' | 'pending',
    checkInCode: row.check_in_code,
    createdAt: row.created_at
  };
}

function mapSlot(row: SlotRow): CourtSlot {
  return {
    slotKey: row.slot_key,
    courtId: row.court_id as CourtId,
    date: row.date,
    hour: row.hour,
    startHour: row.start_hour,
    durationHours: (row.duration_hours === 2 ? 2 : 1) as 1 | 2,
    bookingId: row.booking_id,
    ownerId: row.user_id,
    status: 'reserved',
    createdAt: row.created_at
  };
}

function mapSchedule(row: ScheduleRow): CourtSchedule {
  return {
    scheduleId: row.schedule_id,
    bookingId: row.booking_id,
    ownerId: row.user_id,
    playerDisplayName: row.player_display_name,
    courtId: row.court_id as CourtId,
    courtName: row.court_name,
    date: row.date,
    startHour: row.start_hour,
    durationHours: (row.duration_hours === 2 ? 2 : 1) as 1 | 2,
    matchFormat: row.match_format as MatchFormat,
    status: row.status as 'current' | 'pending' | 'completed',
    isActive: row.is_active,
    checkedIn: row.checked_in,
    scoreSummary: row.score_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export interface SupabaseClubSnapshot {
  profile: UserProfile;
  privateInfo: UserPrivateInfo;
  bookings: CourtBooking[];
  transactions: PaymentTransaction[];
  reservedSlots: CourtSlot[];
  sharedSchedules: CourtSchedule[];
}

export async function loadSupabaseClubData(
  userId: string,
  email: string,
  fallbackDisplayName?: string,
  fallbackPhotoUrl?: string
): Promise<SupabaseClubSnapshot> {
  const defaultName = (fallbackDisplayName?.trim() || email.split('@')[0] || 'Openline Player').slice(
    0,
    80
  );

  // 1. Load or create user's profile
  const { data: existingProfile, error: profileErr } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  let profileRow = existingProfile as ProfileRow | null;
  if (!profileRow) {
    const { data: insertedProfile, error: insertErr } = await supabase
      .from('player_profiles')
      .upsert(
        {
          user_id: userId,
          display_name: defaultName,
          email: email.slice(0, 160),
          phone: '',
          photo_url: (fallbackPhotoUrl ?? '').slice(0, 500),
          skill_level: '3.5',
          dominant_hand: 'Right',
          preferred_court_id: 'court-1',
          bio: ''
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (insertErr) {
      throw new Error(insertErr.message);
    }
    profileRow = insertedProfile as ProfileRow;
  }

  // 2. Load user's bookings, transactions, and club slots/schedules
  const [bookingsRes, txRes, slotsRes, schedulesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase.from('court_slots').select('*').eq('status', 'reserved'),
    supabase.from('court_schedules').select('*').eq('is_active', true)
  ]);

  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);
  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (schedulesRes.error) throw new Error(schedulesRes.error.message);

  const now = Date.now();
  const allSlots = ((slotsRes.data ?? []) as SlotRow[]).map(mapSlot);
  const activeSlots: CourtSlot[] = [];
  const expiredOwnedKeys: string[] = [];

  allSlots.forEach((slot) => {
    const endMs = getPhilippineSlotTimestampMs(
      slot.date,
      (slot.startHour ?? slot.hour) + (slot.durationHours ?? 1)
    );
    if (endMs > now) {
      activeSlots.push(slot);
    } else if (slot.ownerId === userId) {
      expiredOwnedKeys.push(slot.slotKey);
    }
  });

  if (expiredOwnedKeys.length > 0) {
    void supabase
      .from('court_slots')
      .delete()
      .in('slot_key', expiredOwnedKeys)
      .eq('user_id', userId);
  }

  const { profile, privateInfo } = mapProfile(profileRow);

  return {
    profile,
    privateInfo,
    bookings: ((bookingsRes.data ?? []) as BookingRow[]).map(mapBooking),
    transactions: ((txRes.data ?? []) as TransactionRow[]).map(mapTransaction),
    reservedSlots: activeSlots,
    sharedSchedules: ((schedulesRes.data ?? []) as ScheduleRow[]).map(mapSchedule)
  };
}

export async function supabaseReserveBookingAndSlots(
  booking: CourtBooking,
  newSlots: CourtSlot[]
): Promise<{ ok: true } | { ok: false; reason: 'conflict' }> {
  const { error: bookingErr } = await supabase.from('bookings').insert({
    booking_id: booking.bookingId,
    user_id: booking.ownerId,
    court_id: booking.courtId,
    court_name: booking.courtName,
    date: booking.date,
    start_hour: booking.startHour,
    duration_hours: booking.durationHours,
    match_format: booking.matchFormat,
    partner_names: booking.partnerNames,
    paddle_rental: booking.paddleRental,
    hourly_rate: booking.hourlyRate,
    total_amount: booking.totalAmount,
    status: booking.status,
    payment_status: booking.paymentStatus,
    payment_method: booking.paymentMethod,
    gcash_reference_no: booking.gcashReferenceNo,
    gcash_sender_number: booking.gcashSenderNumber,
    receipt_number: booking.receiptNumber,
    paid_at_iso: booking.paidAtIso,
    check_in_code: booking.checkInCode,
    checked_in: booking.checkedIn,
    score_summary: booking.scoreSummary
  });

  if (bookingErr) {
    throw new Error(bookingErr.message);
  }

  const { error: slotsErr } = await supabase.from('court_slots').insert(
    newSlots.map((slot) => ({
      slot_key: slot.slotKey,
      user_id: slot.ownerId,
      booking_id: slot.bookingId,
      court_id: slot.courtId,
      date: slot.date,
      hour: slot.hour,
      start_hour: slot.startHour,
      duration_hours: slot.durationHours,
      status: slot.status
    }))
  );

  if (slotsErr) {
    // Clean up awaiting_payment booking if slot was taken concurrently
    await supabase
      .from('bookings')
      .delete()
      .eq('booking_id', booking.bookingId)
      .eq('user_id', booking.ownerId);

    if (slotsErr.code === '23505' || slotsErr.message.toLowerCase().includes('duplicate')) {
      return { ok: false, reason: 'conflict' };
    }
    throw new Error(slotsErr.message);
  }

  notifySupabaseClubListeners();
  return { ok: true };
}

export async function supabaseConfirmQRPayment(
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
): Promise<void> {
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({
      status: updates.status,
      payment_status: 'paid',
      payment_method: updates.paymentMethod,
      gcash_reference_no: updates.gcashReferenceNo,
      gcash_sender_number: updates.gcashSenderNumber,
      receipt_number: updates.receiptNumber,
      paid_at_iso: updates.paidAtIso
    })
    .eq('booking_id', bookingId)
    .eq('user_id', tx.ownerId);

  if (updateErr) throw new Error(updateErr.message);

  const { error: txErr } = await supabase.from('transactions').insert({
    tx_id: tx.txId,
    user_id: tx.ownerId,
    booking_id: tx.bookingId,
    receipt_number: tx.receiptNumber,
    court_id: tx.courtId,
    court_name: tx.courtName,
    date: tx.date,
    start_hour: tx.startHour,
    duration_hours: tx.durationHours,
    match_format: tx.matchFormat,
    amount: tx.amount,
    payment_method: tx.paymentMethod,
    gcash_account_name: tx.gcashAccountName,
    gcash_account_number: tx.gcashAccountNumber,
    gcash_reference_no: tx.gcashReferenceNo,
    gcash_sender_number: tx.gcashSenderNumber,
    payment_status: tx.paymentStatus,
    schedule_status_at_pay: tx.scheduleStatusAtPay,
    check_in_code: tx.checkInCode
  });

  if (txErr) throw new Error(txErr.message);

  const { error: scheduleErr } = await supabase.from('court_schedules').upsert(
    {
      schedule_id: schedule.scheduleId,
      user_id: schedule.ownerId,
      booking_id: schedule.bookingId,
      player_display_name: schedule.playerDisplayName,
      court_id: schedule.courtId,
      court_name: schedule.courtName,
      date: schedule.date,
      start_hour: schedule.startHour,
      duration_hours: schedule.durationHours,
      match_format: schedule.matchFormat,
      status: schedule.status,
      is_active: schedule.isActive,
      checked_in: schedule.checkedIn,
      score_summary: schedule.scoreSummary
    },
    { onConflict: 'schedule_id' }
  );

  if (scheduleErr) throw new Error(scheduleErr.message);

  notifySupabaseClubListeners();
}

export async function supabaseCancelUnpaidBooking(
  bookingId: string,
  slotKeys: string[],
  userId: string
): Promise<void> {
  if (slotKeys.length > 0) {
    const { error: slotErr } = await supabase
      .from('court_slots')
      .delete()
      .in('slot_key', slotKeys)
      .eq('user_id', userId);
    if (slotErr) throw new Error(slotErr.message);
  }

  const { error: bookingErr } = await supabase
    .from('bookings')
    .delete()
    .eq('booking_id', bookingId)
    .eq('user_id', userId);

  if (bookingErr) throw new Error(bookingErr.message);

  notifySupabaseClubListeners();
}

export async function supabasePromoteBooking(bookingId: string, userId: string): Promise<void> {
  const [bookingRes, scheduleRes] = await Promise.all([
    supabase
      .from('bookings')
      .update({ status: 'current' })
      .eq('booking_id', bookingId)
      .eq('user_id', userId),
    supabase
      .from('court_schedules')
      .update({ status: 'current' })
      .eq('schedule_id', bookingId)
      .eq('user_id', userId)
  ]);

  if (bookingRes.error) throw new Error(bookingRes.error.message);
  if (scheduleRes.error) throw new Error(scheduleRes.error.message);

  notifySupabaseClubListeners();
}

export async function supabaseCheckInBooking(bookingId: string, userId: string): Promise<void> {
  const [bookingRes, scheduleRes] = await Promise.all([
    supabase
      .from('bookings')
      .update({ checked_in: true })
      .eq('booking_id', bookingId)
      .eq('user_id', userId),
    supabase
      .from('court_schedules')
      .update({ checked_in: true })
      .eq('schedule_id', bookingId)
      .eq('user_id', userId)
  ]);

  if (bookingRes.error) throw new Error(bookingRes.error.message);
  if (scheduleRes.error) throw new Error(scheduleRes.error.message);

  notifySupabaseClubListeners();
}

export async function supabaseCompleteBooking(
  bookingId: string,
  scoreSummary: string,
  slotKeys: string[],
  userId: string
): Promise<void> {
  const [bookingRes, scheduleRes] = await Promise.all([
    supabase
      .from('bookings')
      .update({
        status: 'completed',
        checked_in: true,
        score_summary: scoreSummary
      })
      .eq('booking_id', bookingId)
      .eq('user_id', userId),
    supabase
      .from('court_schedules')
      .update({
        status: 'completed',
        is_active: false,
        checked_in: true,
        score_summary: scoreSummary
      })
      .eq('schedule_id', bookingId)
      .eq('user_id', userId)
  ]);

  if (bookingRes.error) throw new Error(bookingRes.error.message);
  if (scheduleRes.error) throw new Error(scheduleRes.error.message);

  if (slotKeys.length > 0) {
    const { error: slotErr } = await supabase
      .from('court_slots')
      .delete()
      .in('slot_key', slotKeys)
      .eq('user_id', userId);
    if (slotErr) throw new Error(slotErr.message);
  }

  notifySupabaseClubListeners();
}

export async function supabaseUpdateBookingPartners(
  bookingId: string,
  partnerNames: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ partner_names: partnerNames })
    .eq('booking_id', bookingId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  notifySupabaseClubListeners();
}

export async function supabaseRescheduleBooking(
  bookingId: string,
  newDate: string,
  newStartHour: number,
  oldKeys: string[],
  newSlots: CourtSlot[],
  userId: string
): Promise<{ ok: true } | { ok: false; reason: 'conflict' }> {
  const keysToInsert = newSlots.filter((s) => !oldKeys.includes(s.slotKey));
  const keysToDelete = oldKeys.filter((k) => !newSlots.some((s) => s.slotKey === k));

  if (keysToInsert.length > 0) {
    const { error: insertErr } = await supabase.from('court_slots').insert(
      keysToInsert.map((slot) => ({
        slot_key: slot.slotKey,
        user_id: slot.ownerId,
        booking_id: slot.bookingId,
        court_id: slot.courtId,
        date: slot.date,
        hour: slot.hour,
        start_hour: slot.startHour,
        duration_hours: slot.durationHours,
        status: slot.status
      }))
    );

    if (insertErr) {
      if (insertErr.code === '23505' || insertErr.message.toLowerCase().includes('duplicate')) {
        return { ok: false, reason: 'conflict' };
      }
      throw new Error(insertErr.message);
    }
  }

  if (keysToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('court_slots')
      .delete()
      .in('slot_key', keysToDelete)
      .eq('user_id', userId);
    if (delErr) throw new Error(delErr.message);
  }

  const [bookingRes, scheduleRes] = await Promise.all([
    supabase
      .from('bookings')
      .update({ date: newDate, start_hour: newStartHour })
      .eq('booking_id', bookingId)
      .eq('user_id', userId),
    supabase
      .from('court_schedules')
      .update({ date: newDate, start_hour: newStartHour })
      .eq('schedule_id', bookingId)
      .eq('user_id', userId)
  ]);

  if (bookingRes.error) throw new Error(bookingRes.error.message);
  if (scheduleRes.error) throw new Error(scheduleRes.error.message);

  notifySupabaseClubListeners();
  return { ok: true };
}

export async function supabaseSaveUserProfile(
  userId: string,
  profilePatch: {
    displayName: string;
    skillLevel: SkillLevel;
    dominantHand: DominantHand;
    preferredCourtId: CourtId;
    bio: string;
  },
  phone: string
): Promise<void> {
  const { error } = await supabase
    .from('player_profiles')
    .update({
      display_name: profilePatch.displayName,
      skill_level: profilePatch.skillLevel,
      dominant_hand: profilePatch.dominantHand,
      preferred_court_id: profilePatch.preferredCourtId,
      bio: profilePatch.bio,
      phone
    })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  notifySupabaseClubListeners();
}
