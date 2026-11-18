import React, { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { CLUB_INFO } from '../data/courts';
import { supabase } from '../supabaseClient.js';
import { FacebookLogo } from './FacebookLogo';
import { CourtLinesBackdrop, PickleballBallIcon, PickleballLogoMark } from './PickleballIcons';

const CANONICAL_DOMAIN_ORIGIN = 'https://www.openlinecourt.online';

function resolveOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return `${CANONICAL_DOMAIN_ORIGIN}/`;
  const host = window.location.hostname.toLowerCase();
  if (
    host === 'www.openlinecourt.online' ||
    host === 'openlinecourt.online' ||
    host === 'openlinecourt.wasmer.app'
  ) {
    return `${CANONICAL_DOMAIN_ORIGIN}/`;
  }
  return `${window.location.origin}/`;
}

export const LoginScreen: React.FC = () => {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: resolveOAuthRedirectUrl()
      }
    });
    if (error) {
      setErrorMsg(error.message);
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-[#FAFBFD] grid lg:grid-cols-12 items-stretch">
      {/* Left Pickleball Court Showcase */}
      <div className="relative lg:col-span-7 min-h-[260px] sm:min-h-[320px] lg:min-h-dvh bg-[#831843] overflow-hidden">
        <img
          src="/og-thumbnail.jpg"
          alt="Openline Court pickleball courts in Soriano, Cabadbaran City"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (!img.dataset.fallback) {
              img.dataset.fallback = '1';
              img.src = '/src/assets/images/login_hero_court_1794934163933.jpg';
            } else {
              img.style.display = 'none';
            }
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#500724]/85 via-[#500724]/25 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12">
          <div className="max-w-lg rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-5 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-lime-300">
              <PickleballBallIcon className="w-4 h-4 shrink-0" />
              <span>Open Daily · 7:00 AM – 10:00 PM PHT</span>
            </div>
            <p className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              {CLUB_INFO.name}
            </p>
            <p className="mt-1.5 text-xs sm:text-sm text-pink-100">
              Court 1 Indoor &amp; Court 2 Outdoor · ₱250/hr · {CLUB_INFO.location}
            </p>
          </div>
        </div>
      </div>

      {/* Right Fresh Sign-In Panel */}
      <div className="relative lg:col-span-5 flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-14 bg-white overflow-hidden">
        <CourtLinesBackdrop className="pointer-events-none absolute -right-14 -top-10 w-80 h-44 text-[#BE185D] opacity-[0.045]" />

        <div className="relative max-w-md w-full mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#BE185D] text-white flex items-center justify-center shadow-xs shrink-0">
              <PickleballLogoMark className="w-6 h-6" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-slate-900 block leading-tight">
                {CLUB_INFO.name}
              </span>
              <span className="text-xs font-medium text-[#BE185D]">Pickleball Club</span>
            </div>
          </div>

          <h1
            className="mt-8 font-display text-[clamp(1.75rem,3vw,2.4rem)] leading-[1.15] font-semibold tracking-tight text-slate-900"
            style={{ textWrap: 'balance' }}
          >
            Your pickleball court, one tap away.
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Sign in with Google to reserve Court 1 or Court 2, pay with GCash, and check live court turns.
          </p>

          {errorMsg && (
            <div
              role="alert"
              className="mt-5 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <div className="mt-7">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#BE185D] hover:bg-[#9D174D] text-white font-semibold text-sm flex items-center justify-center gap-3 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BE185D] disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {signingIn ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeOpacity="0.25"
                      strokeWidth="3"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.14H1.01v3.14C3.02 21.17 7.18 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.02 14.03a7.17 7.17 0 0 1 0-4.06V6.83H1.01a11.99 11.99 0 0 0 0 10.34l4.01-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.83c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.19 15.3 0 12 0 7.18 0 3.02 2.83 1.01 6.83l4.01 3.14c.98-2.95 3.73-5.14 6.98-5.14Z"
                      />
                    </svg>
                  </span>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-600">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{CLUB_INFO.location}</span>
            </p>
            <a
              href={CLUB_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Openline Court Facebook Page"
              className="inline-flex items-center gap-2 font-semibold text-slate-800 hover:text-[#BE185D] w-fit transition-colors"
            >
              <FacebookLogo className="w-4 h-4 shrink-0" />
              <span>@openlinecourt</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#BE185D]" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
