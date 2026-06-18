import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { cn } from '../utils/cn';
import { resetPasswordRequest, validateResetTokenRequest } from '../services/authService';
import '../styles/fonts.css';

const authInputClass =
  'block w-full rounded-full border border-neutral-200 bg-white px-5 py-3.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white dark:focus:ring-white';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token) {
        setTokenValid(false);
        setError('Invalid or missing reset link.');
        setIsValidating(false);
        return;
      }

      try {
        const data = await validateResetTokenRequest(token);
        if (!cancelled) {
          setTokenValid(Boolean(data.valid));
          if (!data.valid) {
            setError('This reset link is invalid or has expired.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setTokenValid(false);
          setError(err.message || 'This reset link is invalid or has expired.');
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    }

    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await resetPasswordRequest({ token, newPassword: password });
      setSuccess(data.message || 'Password reset successfully.');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message || 'Unable to reset password. Please try again.');
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
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Reset Password</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Choose a new password for your account.
            </p>
          </div>

          {isValidating ? (
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">Checking reset link...</p>
          ) : null}

          {!isValidating && !tokenValid ? (
            <div className="space-y-4 text-center">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
              <Link
                to="/forgot-password"
                className="inline-block text-sm font-medium text-neutral-900 hover:underline dark:text-white"
              >
                Request a new reset link
              </Link>
            </div>
          ) : null}

          {!isValidating && tokenValid ? (
            <>
              {error ? (
                <p className="mb-4 text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
              ) : null}
              {success ? (
                <p className="mb-4 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {success}
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(authInputClass, 'pr-12')}
                    placeholder="New Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={authInputClass}
                  placeholder="Confirm Password"
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
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          ) : null}

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
