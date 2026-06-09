import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, FileCheck, BarChart3, TrendingUp } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials');
      }

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isAuthenticated', 'true');
        navigate('/dashboard');
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Left side - Marketing Content */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 py-12 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-green-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-emerald-300/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold text-green-900 leading-tight mb-6">
            Smart Audit
            <span className="block text-green-700">Management</span>
          </h1>
          <p className="text-lg text-green-800/80 mb-10 leading-relaxed">
            Streamline your audit processes with intelligent validation, real-time reporting, and comprehensive compliance tracking.
          </p>
          
          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-green-900/5 border border-green-100">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center mb-3">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-green-900">ID Proof Audit</p>
              <p className="text-xs text-green-700 mt-1">PAN & Address Validation</p>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-green-900/5 border border-green-100">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-green-900">Rate Audit</p>
              <p className="text-xs text-green-700 mt-1">Price Validation</p>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-green-900/5 border border-green-100">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-green-900">Gross Weight</p>
              <p className="text-xs text-green-700 mt-1">Weight Verification</p>
            </div>
            
            <div className="bg-green-600 rounded-2xl p-5 shadow-lg shadow-green-900/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-100" />
                <span className="text-2xl font-bold text-white">99.9%</span>
              </div>
              <p className="text-sm font-semibold text-green-50">Accuracy Rate</p>
              <p className="text-xs text-green-200 mt-1">In all audits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-green-900/10 border border-green-100 p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-green-900 mb-2">Welcome Back !</h2>
            <p className="text-sm text-green-700/70">Sign in to access your audit dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-green-800 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-4 py-3.5 bg-green-50/50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all text-sm text-green-900 placeholder-green-400 outline-none"
                placeholder="Enter your email"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-green-800 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-4 py-3.5 bg-green-50/50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all text-sm text-green-900 placeholder-green-400 outline-none pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-green-500 hover:text-green-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 bg-green-800 hover:bg-green-900 text-white font-semibold rounded-xl transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-lg shadow-green-800/30 hover:shadow-xl hover:shadow-green-800/40 mt-6"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-green-600">
            Secure audit platform for compliance and validation
          </p>
        </div>
      </div>
    </div>
  );
}
