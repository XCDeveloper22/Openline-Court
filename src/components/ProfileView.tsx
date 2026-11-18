import React, { useEffect, useState } from 'react';
import { Bell, Check, Clock, ExternalLink, MapPin, Save } from 'lucide-react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { CLUB_INFO, COURTS } from '../data/courts';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { localSaveUserProfile } from '../lib/localClubStore';
import { BrowserNotificationPermission } from '../lib/notifications';
import {
  CourtBooking,
  CourtId,
  DominantHand,
  PaymentTransaction,
  SkillLevel,
  UserPrivateInfo,
  UserProfile
} from '../types';
import { FacebookLogo } from './FacebookLogo';

interface ProfileViewProps {
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  bookings: CourtBooking[];
  transactions: PaymentTransaction[];
  clubCurrentCount: number;
  clubPendingCount: number;
  notificationPermission: BrowserNotificationPermission;
  onEnableNotifications: () => void;
}

const SKILL_LEVELS: SkillLevel[] = ['2.5', '3.0', '3.5', '4.0', '4.5', '5.0+'];

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  privateInfo,
  bookings,
  transactions,
  clubCurrentCount,
  clubPendingCount,
  notificationPermission,
  onEnableNotifications
}) => {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(profile?.skillLevel ?? '3.5');
  const [dominantHand, setDominantHand] = useState<DominantHand>(profile?.dominantHand ?? 'Right');
  const [preferredCourtId, setPreferredCourtId] = useState<CourtId>(
    profile?.preferredCourtId === 'court-2' ? 'court-2' : 'court-1'
  );
  const [phone, setPhone] = useState(privateInfo?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setSkillLevel(profile.skillLevel);
      setDominantHand(profile.dominantHand);
      setPreferredCourtId(profile.preferredCourtId === 'court-2' ? 'court-2' : 'court-1');
      setBio(profile.bio);
    }
  }, [profile]);

  useEffect(() => {
    if (privateInfo) {
      setPhone(privateInfo.phone);
    }
  }, [privateInfo]);

  if (!profile) {
    return (
      <div className="surface-2026 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="h-6 w-48 bg-pink-50 rounded" />
        <div className="h-24 w-full bg-pink-50 rounded" />
      </div>
    );
  }

  const validBookings = bookings.filter(
    (b) => b.courtId === 'court-1' || b.courtId === 'court-2'
  );
  const currentMatches = validBookings.filter((b) => b.status === 'current').length;
  const pendingMatches = validBookings.filter((b) => b.status === 'pending').length;
  const completedMatches = validBookings.filter((b) => b.status === 'completed').length;
  const unpaidCount = validBookings.filter((b) => b.status === 'awaiting_payment').length;

  const initials = (profile.displayName || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(false);

    const trimmedName = displayName.trim().slice(0, 80);
    const trimmedBio = bio.trim().slice(0, 240);
    const trimmedPhone = phone.trim().slice(0, 32);

    if (!trimmedName) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      if (!auth.currentUser) {
        localSaveUserProfile(
          profile.uid,
          {
            displayName: trimmedName,
            skillLevel,
            dominantHand,
            preferredCourtId,
            bio: trimmedBio
          },
          trimmedPhone
        );
        setSavedNotice(true);
        window.setTimeout(() => setSavedNotice(false), 3000);
        return;
      }

      const batch = writeBatch(db);
      const userRef = doc(db, 'users', profile.uid);
      const privateRef = doc(db, 'users', profile.uid, 'private', 'info');

      batch.update(userRef, {
        displayName: trimmedName,
        photoUrl: (profile.photoUrl ?? '').slice(0, 500),
        skillLevel,
        dominantHand,
        preferredCourtId,
        bio: trimmedBio,
        updatedAt: serverTimestamp()
      });

      batch.update(privateRef, {
        email: (privateInfo?.email ?? '').slice(0, 160),
        phone: trimmedPhone,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 2xl:space-y-10">
      {/* Player Identity & Activity Overview */}
      <section className="surface-2026 rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-8 2xl:p-10 bg-gradient-to-br from-[#FFF6F9] via-white to-white">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              {profile.photoUrl && !avatarFailed ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-pink-200 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#BE185D] text-white font-display text-2xl font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#BE185D]">Player Profile</p>
                <h1 className="mt-0.5 font-display text-[clamp(1.4rem,2.4vw,2.1rem)] font-semibold tracking-tight text-slate-900 truncate">
                  {profile.displayName}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-600">
                  <span className="truncate max-w-full">
                    {privateInfo?.email || 'Verified Gmail Account'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-[#831843] tabular-nums whitespace-nowrap">
                    DUPR {profile.skillLevel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">{profile.dominantHand}-Handed</span>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 xl:gap-8 pt-5 xl:pt-0 border-t xl:border-t-0 xl:border-l border-pink-100 xl:pl-8 shrink-0">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Current Turn</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {currentMatches}
                </dd>
                <dd className="text-[11px] text-slate-500 tabular-nums">
                  {clubCurrentCount} club-wide
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Next in Line</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {pendingMatches}
                </dd>
                <dd className="text-[11px] text-slate-500 tabular-nums">
                  {clubPendingCount} queued
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Receipts</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-[#831843] tabular-nums">
                  {transactions.length}
                </dd>
                <dd className="text-[11px] text-slate-500 tabular-nums">
                  {unpaidCount > 0 ? `${unpaidCount} due` : 'Verified'}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Completed</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {completedMatches}
                </dd>
                <dd className="text-[11px] text-slate-500">Matches</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* 12-Column Bento Split: Settings (Left) + Club Venue & Alerts (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start">
        <div className="xl:col-span-5 space-y-6 order-1 xl:order-2">
          <section className="surface-2026 rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Club Location &amp; Hours
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Open daily for Court 1 &amp; Court 2 reservations (₱250/hr)
              </p>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-700 pt-1">
              <p className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{CLUB_INFO.location}</span>
              </p>
              <p className="flex items-center gap-2.5 font-mono text-xs sm:text-sm text-slate-900 tabular-nums">
                <Clock className="w-4 h-4 text-[#BE185D] shrink-0" aria-hidden="true" />
                <span>
                  {CLUB_INFO.operatingHours} · {CLUB_INFO.timezoneLabel}
                </span>
              </p>
            </div>

            <div className="pt-2 border-t border-pink-100">
              <a
                href={CLUB_INFO.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Openline Court Facebook Page"
                className="w-full min-h-[44px] px-4 py-2.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#831843] text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
              >
                <FacebookLogo className="w-5 h-5 shrink-0" />
                <span>@openlinecourt</span>
                <ExternalLink className="w-4 h-4 text-[#BE185D]" aria-hidden="true" />
              </a>
            </div>
          </section>

          <section className="surface-2026 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 text-[#BE185D] flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Court Schedule Push Alerts
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Automatic alerts 5 minutes before your Philippine Time slot and when a{' '}
                  <strong>Next Schedule</strong> turn moves to <strong>Current Schedule</strong>.
                </p>
              </div>
            </div>

            <p className="text-xs font-medium text-[#831843] pt-1">
              Status:{' '}
              {notificationPermission === 'granted'
                ? 'Browser Push + In-App Alerts Active'
                : notificationPermission === 'denied'
                  ? 'Browser Push Blocked (In-App Alerts Active)'
                  : notificationPermission === 'unsupported'
                    ? 'In-App Alerts Active'
                    : 'Waiting for Browser Permission'}
            </p>

            {notificationPermission === 'default' && (
              <button
                type="button"
                onClick={onEnableNotifications}
                className="w-full min-h-[44px] px-4 py-2 bg-[#BE185D] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#9D174D] whitespace-nowrap cursor-pointer"
              >
                Enable Push Alerts
              </button>
            )}
          </section>
        </div>

        <section className="xl:col-span-7 surface-2026 rounded-3xl p-5 sm:p-8 order-2 xl:order-1">
        <div className="pb-5 border-b border-pink-100">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Player Settings &amp; Court Preferences
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Update your player name, DUPR skill level, and preferred home court.
          </p>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="player-name" className="block text-sm font-medium text-slate-700">
                Display Name
              </label>
              <input
                id="player-name"
                type="text"
                maxLength={80}
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#BE185D]"
              />
            </div>

            <div>
              <label htmlFor="player-email" className="block text-sm font-medium text-slate-700">
                Gmail Account
              </label>
              <input
                id="player-email"
                type="email"
                disabled
                value={privateInfo?.email ?? ''}
                className="mt-1.5 w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="skill-level" className="block text-sm font-medium text-slate-700">
                Skill Rating (DUPR)
              </label>
              <select
                id="skill-level"
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                className="mt-1.5 w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#BE185D]"
              >
                {SKILL_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}{' '}
                    {lvl === '2.5'
                      ? '— Beginner'
                      : lvl === '3.5'
                        ? '— Intermediate'
                        : lvl === '4.5'
                          ? '— Advanced'
                          : lvl === '5.0+'
                            ? '— Pro / Open'
                            : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700">Dominant Hand</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2 p-1 bg-pink-50 rounded-xl border border-pink-200/60">
                {(['Right', 'Left'] as DominantHand[]).map((hand) => (
                  <button
                    key={hand}
                    type="button"
                    onClick={() => setDominantHand(hand)}
                    className={`min-h-[40px] py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                      dominantHand === hand
                        ? 'bg-white text-[#831843] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {hand}-Handed
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="preferred-court" className="block text-sm font-medium text-slate-700">
                Home Court Preference
              </label>
              <select
                id="preferred-court"
                value={preferredCourtId}
                onChange={(e) => setPreferredCourtId(e.target.value as CourtId)}
                className="mt-1.5 w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#BE185D]"
              >
                {COURTS.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name} (₱{court.hourlyRate}/hr)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="player-phone" className="block text-sm font-medium text-slate-700">
                GCash / Contact Mobile
              </label>
              <input
                id="player-phone"
                type="tel"
                maxLength={32}
                placeholder="0917 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#BE185D]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="player-bio" className="block text-sm font-medium text-slate-700">
              Play Style &amp; Match Notes
            </label>
            <textarea
              id="player-bio"
              rows={3}
              maxLength={240}
              placeholder="Preferred doubles rotation, morning drills, or match notes..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1.5 w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#BE185D]"
            />
            <p className="mt-1 text-xs text-slate-500 text-right tabular-nums">{bio.length}/240</p>
          </div>

          <div className="flex items-center justify-end gap-4 pt-1">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#BE185D]">
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Saved</span>
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#BE185D] text-white text-sm font-medium rounded-xl hover:bg-[#9D174D] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </section>
      </div>
    </div>
  );
};
