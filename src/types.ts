export type TabId = 'profile' | 'book' | 'current' | 'pending' | 'transact' | 'map' | 'faq';

export type CourtId = 'court-1' | 'court-2';

export type SkillLevel = '2.5' | '3.0' | '3.5' | '4.0' | '4.5' | '5.0+';

export type DominantHand = 'Right' | 'Left';

export type MatchFormat = 'singles' | 'doubles' | 'drills';

export type BookingStatus =
  | 'awaiting_payment'
  | 'pending'
  | 'current'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid';

export interface CourtInfo {
  id: CourtId;
  name: string;
  surface: string;
  environment: string;
  lighting: string;
  hourlyRate: number;
  image: string;
  description: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoUrl: string;
  skillLevel: SkillLevel;
  dominantHand: DominantHand;
  preferredCourtId: CourtId;
  bio: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone: string;
  updatedAt: unknown;
}

export interface CourtBooking {
  bookingId: string;
  ownerId: string;
  courtId: CourtId;
  courtName: string;
  date: string;
  startHour: number;
  durationHours: 1 | 2;
  matchFormat: MatchFormat;
  partnerNames: string;
  paddleRental: boolean;
  hourlyRate: number;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  gcashReferenceNo: string;
  gcashSenderNumber: string;
  receiptNumber: string;
  paidAtIso: string;
  checkInCode: string;
  checkedIn: boolean;
  scoreSummary: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CourtSlot {
  slotKey: string;
  courtId: CourtId;
  date: string;
  hour: number;
  startHour: number;
  durationHours: 1 | 2;
  bookingId: string;
  ownerId: string;
  status: 'reserved';
  createdAt: unknown;
}

export interface PaymentTransaction {
  txId: string;
  ownerId: string;
  bookingId: string;
  receiptNumber: string;
  courtId: CourtId;
  courtName: string;
  date: string;
  startHour: number;
  durationHours: 1 | 2;
  matchFormat: MatchFormat;
  amount: number;
  paymentMethod: 'GCash';
  gcashAccountName: string;
  gcashAccountNumber: string;
  gcashReferenceNo: string;
  gcashSenderNumber: string;
  paymentStatus: 'paid';
  scheduleStatusAtPay: 'current' | 'pending';
  checkInCode: string;
  createdAt: unknown;
}

export interface CourtSchedule {
  scheduleId: string;
  bookingId: string;
  ownerId: string;
  playerDisplayName: string;
  courtId: CourtId;
  courtName: string;
  date: string;
  startHour: number;
  durationHours: 1 | 2;
  matchFormat: MatchFormat;
  status: 'current' | 'pending' | 'completed';
  isActive: boolean;
  checkedIn: boolean;
  scoreSummary: string;
  createdAt: unknown;
  updatedAt: unknown;
}
