import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { cn } from '../utils/cn';
import { forgotPasswordRequest } from '../services/authService';
import '../styles/fonts.css';

const authInputClass =
  'block w-full rounded-full border border-neutral-200 bg-white px-5 py-3.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white dark:focus:ring-white';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    setDevResetUrl('');

    try {
      const data = await forgotPasswordRequest(email.trim());
      setSuccess(
        data.message ||
          'If an account exists for that email, password reset instructions have been sent.'
      );
      if (data.devResetUrl) {
        setDevResetUrl(data.devResetUrl);
      }
    } catch (err) {
      setError(err.message || 'Unable to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#F8FAFC] font-manrope text-[#0F172A] dark:bg-neutral-950 dark:text-neutral-100">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>

      <div className="flex h-full items-center justify-center px-6 py-12">
        <div className="w-full max-w-[320px] sm:max-w-[340px]">
          <div className="mb-8 text-center">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Forgot Password?</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {error ? (
            <p className="mb-4 text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {success ? (
            <div className="mb-4 space-y-2 text-center text-sm text-emerald-700 dark:text-emerald-400">
              <p>{success}</p>
              {devResetUrl ? (
                <p className="break-all text-xs text-slate-600 dark:text-slate-400">
                  Dev reset link:{' '}
                  <a href={devResetUrl} className="underline">
                    {devResetUrl}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className={authInputClass}
              placeholder="Email Address"
              required
            />

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full rounded-full px-4 py-3.5 text-sm font-semibold transition-colors',
                'bg-neutral-900 text-white hover:bg-black',
                'dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            <Link to="/login" className="font-medium text-neutral-900 hover:underline dark:text-white">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
