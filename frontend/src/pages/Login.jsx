import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

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
        // Store JWT token and user info
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
    <div className="min-h-screen w-full flex bg-white">
      {/* Left side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome back!</h1>
            <p className="text-sm text-gray-500">Enter your Credentials to access your account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2d5016] focus:border-[#2d5016] transition-colors text-sm outline-none"
                placeholder="Enter your email"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2d5016] focus:border-[#2d5016] transition-colors text-sm outline-none pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-[#2d5016] border-gray-300 rounded focus:ring-[#2d5016]"
                />
                <span className="ml-2 text-sm text-gray-600">Remember me for 30 days</span>
              </label>
              <button type="button" className="text-xs text-[#2d5016] hover:text-[#1a3009] font-medium">
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-[#3d6b1f] hover:bg-[#2d5016] text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#3d6b1f] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>

      {/* Right side - Plant Image */}
      <div className="hidden lg:flex lg:w-[40%] xl:w-[35%] relative overflow-hidden rounded-3xl my-8 mr-8 border-2 border-white shadow-2xl">
        <img
          src="/src/assets/login-image.jpg"
          alt="Tropical plant leaves"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/10"></div>
      </div>
    </div>
  );
}
