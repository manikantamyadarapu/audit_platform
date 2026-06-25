import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { AuditSearchIllustration } from '../components/auth/AuditSearchIllustration';
import { cn } from '../utils/cn';
import { getRememberedEmail, getRememberMePreference, persistAuthSession } from '../utils/authUser';
import '../styles/fonts.css';

const loginInputClass =
  'block w-full rounded-full border border-neutral-200 bg-white px-5 py-3.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white dark:focus:ring-white';

const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const LOGIN_MAX_ATTEMPTS = 3;
const LOGIN_RETRY_DELAY_MS = 700;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientFetchError(error) {
  return (
    error?.name === 'TypeError' ||
    error?.message === 'Failed to fetch' ||
    /network/i.test(error?.message ?? '')
  );
}

async function postLoginWithRetry(credentials) {
  let lastResponse = null;

  for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      lastResponse = response;

      if (TRANSIENT_HTTP_STATUSES.has(response.status) && attempt < LOGIN_MAX_ATTEMPTS) {
        await sleep(LOGIN_RETRY_DELAY_MS * attempt);
        continue;
      }

      return response;
    } catch (error) {
      if (isTransientFetchError(error) && attempt < LOGIN_MAX_ATTEMPTS) {
        await sleep(LOGIN_RETRY_DELAY_MS * attempt);
        continue;
      }
      throw error;
    }
  }

  return lastResponse;
}

function getLoginErrorMessage(error, response) {
  if (isTransientFetchError(error)) {
    return 'Could not reach the server. Check that the backend is running, then try again.';
  }

  if (response && TRANSIENT_HTTP_STATUSES.has(response.status)) {
    return 'Server is starting up or temporarily unavailable. Please try again in a moment.';
  }

  return error?.message || 'Login failed';
}

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(getRememberMePreference());
  const [formData, setFormData] = useState({
    email: getRememberedEmail(),
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getRememberMePreference()) {
      setRememberMe(true);
      setFormData((prev) => ({ ...prev, email: getRememberedEmail() }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    let response = null;

    try {
      response = await postLoginWithRetry({
        email: formData.email,
        password: formData.password,
      });

      if (!response.ok) {
        let errorMessage = 'Invalid email or password';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || `Server error: ${response.status}`;
        } catch {
          if (TRANSIENT_HTTP_STATUSES.has(response.status)) {
            errorMessage = getLoginErrorMessage(null, response);
          } else {
            errorMessage = response.statusText || `Server error: ${response.status}`;
          }
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        const text = await response.text();
        if (!text || text.trim() === '') {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server. Please try again.');
      }

      if (data.success) {
        persistAuthSession({
          accessToken: data.accessToken || data.token,
          user: data.user,
          rememberMe,
          email: formData.email,
        });
        navigate('/dashboard');
      } else {
        throw new Error(data.message || data.detail || 'Login failed');
      }
    } catch (err) {
      setError(getLoginErrorMessage(err, response));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#F8FAFC] font-manrope text-[#0F172A] dark:bg-neutral-950 dark:text-neutral-100">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>

      <div className="relative z-10 grid h-full grid-cols-1 lg:grid-cols-2 lg:items-center">
        {/* Left — branding (centered in column, same gap feel as login card) */}
        <div className="relative hidden lg:flex lg:items-center lg:justify-center lg:overflow-visible lg:px-6 xl:px-10">
          <AuditSearchIllustration />

          <div className="relative z-10 w-full max-w-md">
            <div className="py-8">
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-neutral-600 dark:text-neutral-300 sm:text-base">
                HAA AUDIT
              </p>
              <h1 className="mt-4 whitespace-nowrap text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white xl:text-4xl 2xl:text-5xl">
                Audit Intelligence{' '}
                <span className="text-[#10B981]">Platform</span>
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base">
                Automate compliance verification, rate auditing, gross weight validation, and audit
                reporting from a single enterprise-grade platform.
              </p>
            </div>
          </div>
        </div>

        {/* Right — login form */}
        <div className="flex items-center justify-center px-6 py-12 xl:px-10">
          <div className="w-full max-w-[340px] sm:max-w-[380px]">
            <div className="mb-8 lg:hidden">
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-neutral-600 dark:text-neutral-300 sm:text-base">
                HAA AUDIT
              </p>
              <h1 className="mt-2 whitespace-nowrap text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">
                Audit Intelligence{' '}
                <span className="text-emerald-600 dark:text-emerald-400">Platform</span>
              </h1>
            </div>

            <div className="mb-8 text-center">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Welcome Back!</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Sign in to access your audit dashboard
              </p>
            </div>

              {error ? (
                <div className="mb-6 text-center">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="sr-only">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={loginInputClass}
                    placeholder="Email Address"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      className={cn(loginInputClass, 'pr-12')}
                      placeholder="Password"
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
                </div>

                <div className="flex items-center justify-between px-1 text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-950"
                    />
                    Remember me
                  </label>
                  <Link
                    to="/forgot-password"
                    className="font-medium text-slate-700 transition-colors hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'mt-2 w-full rounded-full px-4 py-3.5 text-sm font-semibold transition-colors',
                    'bg-neutral-900 text-white hover:bg-black',
                    'dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-700 dark:text-slate-300 sm:text-base">
                Secure audit platform for compliance and validation
              </p>
          </div>
        </div>
      </div>
    </div>
  );
}
