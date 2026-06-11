import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAppUi } from '../context/AppUiContext';
import { cn } from '../utils/cn';
import '../styles/fonts.css';

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
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>
      {/* Left side - Marketing Content */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 py-12 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-green-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-emerald-300/20 rounded-full blur-3xl"></div>

        <div className="relative z-10 max-w-lg mx-auto px-8">
          <h1 className="text-5xl font-bold text-green-600 leading-tight mb-6 whitespace-nowrap">
            Smart Audit Management
          </h1>
          <p className="text-lg text-green-600/80 leading-relaxed">
            Simplify complex enterprise compliance with AI-driven validation and real-time risk assessment tools.
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div
          className={cn(
            'w-full max-w-md backdrop-blur-md rounded-[2.5rem] shadow-xl p-10 border',
            isDark
              ? 'bg-slate-900/75 border-slate-700/80 shadow-black/30'
              : 'bg-white/30 border-white/40 shadow-gray-900/5'
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
