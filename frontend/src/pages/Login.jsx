import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAppUi } from '../context/AppUiContext';
import { cn } from '../utils/cn';
import { AuditIntelligenceBackground } from '../components/auth/AuditIntelligenceBackground';
import '../styles/fonts.css';
import '../styles/login-animations.css';

export default function Login() {
  const navigate = useNavigate();
  const { theme } = useAppUi();
  const isDark = theme === 'dark';
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      // Check if response is OK but empty
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');

      // Handle network errors or empty responses
      if (!response.ok) {
        let errorMessage = 'Invalid credentials';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || `Server error: ${response.status}`;
        } catch (jsonError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Try to parse JSON response
      let data;
      try {
        const text = await response.text();
        if (!text || text.trim() === '') {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error('Invalid response from server. Please try again.');
      }

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isAuthenticated', 'true');
        navigate('/dashboard');
      } else {
        throw new Error(data.message || data.detail || 'Login failed');
      }
    } catch (err) {
      // Simple error messages
      if (err.name === 'TypeError' || err.message === 'Failed to fetch' || err.message.includes('Network')) {
        setError('Network Error');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative min-h-screen w-full flex font-manrope',
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950'
          : 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50'
      )}
    >
      {/* Ambient page effects */}
      <div className="login-noise-overlay pointer-events-none absolute inset-0 z-[1]" aria-hidden="true" />
      <div
        className={cn(
          'login-ambient-glow pointer-events-none absolute -left-32 top-1/4 z-[1] h-[28rem] w-[28rem] rounded-full blur-[100px]',
          isDark ? 'bg-emerald-500/12' : 'bg-emerald-400/20'
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          'login-ambient-glow pointer-events-none absolute bottom-0 right-1/4 z-[1] h-80 w-80 rounded-full blur-[90px]',
          isDark ? 'bg-emerald-600/10' : 'bg-teal-400/15'
        )}
        style={{ animationDelay: '4s' }}
        aria-hidden="true"
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-1/2 z-[1] w-px',
          isDark
            ? 'bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent'
            : 'bg-gradient-to-b from-transparent via-emerald-400/15 to-transparent'
        )}
        aria-hidden="true"
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>

      {/* Left side — Audit Intelligence Engine */}
      <div className="relative hidden flex-col justify-center overflow-hidden lg:flex lg:w-1/2">
        <AuditIntelligenceBackground isDark={isDark} />

        {/* Radial glows behind hero */}
        <div
          className={cn(
            'pointer-events-none absolute left-1/4 top-1/4 z-[2] h-72 w-72 -translate-x-1/2 rounded-full blur-3xl',
            isDark ? 'bg-emerald-500/15' : 'bg-green-200/35'
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            'pointer-events-none absolute bottom-1/4 right-1/4 z-[2] h-80 w-80 rounded-full blur-3xl',
            isDark ? 'bg-emerald-600/10' : 'bg-emerald-300/25'
          )}
          aria-hidden="true"
        />

        {/* Glass reflection strip */}
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 z-[3] w-24',
            isDark
              ? 'bg-gradient-to-l from-white/[0.03] to-transparent'
              : 'bg-gradient-to-l from-white/25 to-transparent'
          )}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-lg px-16 py-12">
          <div className="login-hero-glass rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-10 dark:border-emerald-500/10 dark:bg-emerald-950/10">
            <p
              className={cn(
                'login-hero-fade login-hero-fade-delay-1 mb-3 font-mono text-xs font-semibold uppercase tracking-[0.35em]',
                isDark ? 'text-emerald-400/70' : 'text-emerald-700/80'
              )}
            >
              HAA AUDIT
            </p>
            <h1
              className={cn(
                'login-hero-fade login-hero-fade-delay-2 login-hero-title text-4xl font-bold leading-tight tracking-tight xl:text-5xl',
                isDark ? 'text-emerald-400' : 'text-green-600'
              )}
            >
              Audit Intelligence Platform
            </h1>
            <p
              className={cn(
                'login-hero-fade login-hero-fade-delay-3 mt-6 text-base leading-relaxed xl:text-lg',
                isDark ? 'text-emerald-100/55' : 'text-green-700/75'
              )}
            >
              Automated compliance verification, rate auditing, gross weight validation, and audit
              analytics.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="relative z-10 flex w-full items-center justify-center p-8 lg:w-1/2">
        <div
          className={cn(
            'login-card-float w-full max-w-md rounded-[2.5rem] border p-10 backdrop-blur-2xl',
            isDark
              ? 'border-emerald-500/20 bg-slate-900/65 shadow-[0_8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(16,185,129,0.08),0_0_60px_rgba(16,185,129,0.06)] ring-1 ring-emerald-500/10'
              : 'border-emerald-400/25 bg-white/25 shadow-[0_8px_40px_rgba(15,23,42,0.08),0_0_0_1px_rgba(16,185,129,0.1),0_0_48px_rgba(16,185,129,0.08)] ring-1 ring-emerald-500/15'
          )}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Welcome Back!</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Sign in to access your audit dashboard</p>
          </div>

          {error && ( 
            <div className="mb-6 text-center">
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-5 py-3.5 bg-[var(--color-surface-elevated)] backdrop-blur-sm border border-[var(--color-border-soft)] rounded-full focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)] outline-none shadow-[var(--shadow-glass)]"
                placeholder="Enter your email"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-5 py-3.5 bg-[var(--color-surface-elevated)] backdrop-blur-sm border border-[var(--color-border-soft)] rounded-full focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)] outline-none pr-12 shadow-[var(--shadow-glass)]"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--color-text-faint)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-8 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-semibold rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-lg shadow-gray-800/20 hover:shadow-xl hover:shadow-gray-800/30 backdrop-blur-sm border border-gray-700/30 mt-6"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
            Secure audit platform for compliance and validation
          </p>
        </div>
      </div>
    </div>
  );
}
