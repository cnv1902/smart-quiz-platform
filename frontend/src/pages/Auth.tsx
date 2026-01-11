import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Quiz Platform';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login(formData);
      const { access_token, user } = response.data;
      
      setAuth(user, access_token);
      toast.success('Đăng nhập thành công!');
      
      // Redirect to returnUrl if exists, otherwise dashboard
      if (returnUrl) {
        // Decode the returnUrl in case it was encoded
        const decodedUrl = decodeURIComponent(returnUrl);
        navigate(decodedUrl, { replace: true });
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-500">CATOM</h1>
          <p className="text-slate-500 mt-2">Nền tảng thi trắc nghiệm thông minh</p>
        </div>

        {/* Login Form */}
        <div className="card animate-slideUp">
          <h2 className="text-xl font-semibold text-slate-700 mb-6">Đăng nhập</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field pl-10"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link 
                to="/forgot-password" 
                className="text-sm text-primary-500 hover:text-primary-600"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
  });

  // Cooldown timer for resend OTP
  useState(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.register(formData);
      toast.success(response.data.message || 'Mã OTP đã được gửi!');
      setStep('otp');
      setResendCooldown(60);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.verifyRegister(formData.email, otp);
      const { access_token, user } = response.data;
      
      setAuth(user, access_token);
      toast.success('Đăng ký thành công!');
      
      if (returnUrl) {
        const decodedUrl = decodeURIComponent(returnUrl);
        navigate(decodedUrl, { replace: true });
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Mã OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      await authAPI.resendOtp(formData.email);
      toast.success('Đã gửi lại mã OTP!');
      setResendCooldown(60);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Không thể gửi lại OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-500">{APP_NAME}</h1>
          <p className="text-slate-500 mt-2">Nền tảng thi trắc nghiệm thông minh</p>
        </div>

        {/* Register Form */}
        <div className="card animate-slideUp">
          {step === 'register' ? (
            <>
              <h2 className="text-xl font-semibold text-slate-700 mb-6">Đăng ký tài khoản</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Họ và tên
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="input-field pl-10"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-field pl-10"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-field pl-10 pr-10"
                      placeholder="Tối thiểu 6 ký tự"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Đang xử lý...' : 'Đăng ký'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-slate-700 mb-2">Xác thực email</h2>
              <p className="text-slate-500 text-sm mb-6">
                Nhập mã OTP đã được gửi đến {formData.email}
              </p>
              
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Mã OTP
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="input-field text-center text-2xl tracking-widest"
                    placeholder="000000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Đang xác thực...' : 'Xác nhận'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading || resendCooldown > 0}
                    className="text-sm text-primary-500 hover:text-primary-600 disabled:text-slate-400"
                  >
                    {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setStep('register'); setOtp(''); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Quay lại
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ForgotPasswordPage = () => {
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      toast.success('Mã OTP đã được gửi đến email của bạn');
      setStep('otp');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.verifyOTP(email, otp);
      toast.success('Xác thực thành công');
      setStep('reset');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Mã OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.resetPassword(email, otp, newPassword);
      toast.success('Đặt lại mật khẩu thành công!');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-500">{APP_NAME}</h1>
          <p className="text-slate-500 mt-2">Khôi phục mật khẩu</p>
        </div>

        <div className="card animate-slideUp">
          {step === 'email' && (
            <>
              <h2 className="text-xl font-semibold text-slate-700 mb-2">Quên mật khẩu?</h2>
              <p className="text-slate-500 text-sm mb-6">
                Nhập email của bạn để nhận mã OTP
              </p>
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="email@example.com"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                  {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
                </button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <h2 className="text-xl font-semibold text-slate-700 mb-2">Nhập mã OTP</h2>
              <p className="text-slate-500 text-sm mb-6">
                Nhập mã OTP đã được gửi đến {email}
              </p>
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Mã OTP
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="input-field text-center text-2xl tracking-widest"
                    placeholder="000000"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                  {loading ? 'Đang xác thực...' : 'Xác nhận'}
                </button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <h2 className="text-xl font-semibold text-slate-700 mb-2">Đặt mật khẩu mới</h2>
              <p className="text-slate-500 text-sm mb-6">
                Nhập mật khẩu mới cho tài khoản của bạn
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field"
                    placeholder="Tối thiểu 6 ký tự"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                  {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary-500 hover:text-primary-600">
              ← Quay lại đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
