import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export const SignUpForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    window.location.href = '/';
  };

  return (
    <div>
      <form onSubmit={handleSignUp} className="space-y-3.5">
        <div>
          <label htmlFor="signup-email" className="block text-xs font-medium text-slate-700">
            Email Address
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-pink-200 rounded-xl focus:outline-none focus:border-[#BE185D]"
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-xs font-medium text-slate-700">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password (min 6 characters)"
            className="mt-1 w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-pink-200 rounded-xl focus:outline-none focus:border-[#BE185D]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#BE185D] text-white font-medium text-sm flex items-center justify-center hover:bg-[#9D174D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BE185D] disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};
