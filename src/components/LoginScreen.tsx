import React, { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { CLUB_INFO } from '../data/courts';
import { supabase } from '../supabaseClient.js';
import { FacebookLogo } from './FacebookLogo';

export const LoginScreen: React.FC = () => {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      setErrorMsg(error.message);
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-white grid lg:grid-cols-12 items-stretch">
      {/* Left Hero Court Visual */}
      <div className="relative lg:col-span-7 min-h-[240px] sm:min-h-[300px] lg:min-h-dvh bg-[#500724] overflow-hidden">
        <img
          src="/src/assets/images/login_hero_court_1794934163933.jpg"
          alt="Openline Court pickleball complex in Soriano, Cabadbaran City, Agusan del Norte"
          referrerPolicy="no-referrer"
          className="w-full h-full lg:h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#500724]/90 via-[#500724]/35 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12 2xl:p-16 text-white">
          <p className="font-display text-2xl lg:text-3xl 2xl:text-4xl font-semibold tracking-tight">
            {CLUB_INFO.name}
          </p>
          <p className="mt-2 text-xs sm:text-sm text-pink-100 flex flex-wrap items-center gap-2">
            <span>2 Pickleball Courts</span>
            <span aria-hidden="true">·</span>
            <span>₱250/hr Flat Rate</span>
            <span aria-hidden="true">·</span>
            <span>{CLUB_INFO.location}</span>
          </p>
        </div>
      </div>

      {/* Right Gmail Auth Panel */}
      <div className="lg:col-span-5 flex flex-col justify-center px-5 py-10 sm:px-12 lg:px-14 2xl:px-20 bg-[#FFF9FB]">
        <div className="max-w-md 2xl:max-w-lg w-full mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#BE185D] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" shapeRendering="geometricPrecision" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
                <line x1="12" y1="5" x2="12" y2="19" stroke="#FBCFE8" strokeWidth="1.75" />
                <line x1="8" y1="5" x2="8" y2="19" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
                <line x1="16" y1="5" x2="16" y2="19" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
              </svg>
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              {CLUB_INFO.name}
            </span>
          </div>

          <h1
            className="mt-7 font-display text-[clamp(1.65rem,3vw,2.35rem)] leading-[1.15] font-semibold tracking-tight text-slate-900"
            style={{ textWrap: 'balance' }}
          >
            Book a pickleball court in seconds.
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Sign in to reserve Court 1 or Court 2, pay via GCash QR, and follow live schedules.
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
              className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-pink-200 bg-white text-[#831843] font-medium text-sm flex items-center justify-center gap-3 hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BE185D] disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {signingIn ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin text-[#BE185D]"
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
                  <span>Connecting Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#BE185D"
                      d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-8 pt-5 border-t border-pink-200/70 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
            <span>7 AM – 10 PM PHT</span>
            <span aria-hidden="true">·</span>
            <span>₱250/hr</span>
            <span aria-hidden="true">·</span>
            <span>2 Courts</span>
          </div>

          <div className="mt-5 pt-5 border-t border-pink-200/60 flex flex-col gap-2 text-xs text-slate-600">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#BE185D] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{CLUB_INFO.location}</span>
            </p>
            <a
              href={CLUB_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Openline Court Facebook Page"
              className="inline-flex items-center gap-2 font-semibold text-[#831843] hover:text-[#BE185D] hover:underline w-fit"
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
