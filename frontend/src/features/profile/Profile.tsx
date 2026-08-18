import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import { useAppTheme } from '../../context/ThemeContext';
import { Eye, EyeOff } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { themeMode, setThemeMode } = useAppTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email change state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailStep, setEmailStep] = useState<1 | 2>(1);
  const [emailResendCountdown, setEmailResendCountdown] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  // Password change state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordOtp, setPasswordOtp] = useState('');
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [passwordResendCountdown, setPasswordResendCountdown] = useState(0);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  useEffect(() => {
    let timer: any;
    if (emailResendCountdown > 0) {
      timer = setTimeout(() => {
        setEmailResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [emailResendCountdown]);

  useEffect(() => {
    let timer: any;
    if (passwordResendCountdown > 0) {
      timer = setTimeout(() => {
        setPasswordResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [passwordResendCountdown]);

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setEmailError('New email address is required.');
      return;
    }
    setEmailError(null);
    setEmailSuccess(null);
    setIsEmailSubmitting(true);
    try {
      await api.post('/auth/request-email-change-otp/', {
        user_id: user?.id,
        new_email: newEmail.trim().toLowerCase()
      });
      setEmailStep(2);
      setEmailResendCountdown(60);
      setEmailSuccess('Verification code has been sent to the new email address.');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setEmailError(err.response.data.detail);
      } else {
        setEmailError('Failed to request verification code. Please check your inputs.');
      }
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtp.trim()) {
      setEmailError('Verification code is required.');
      return;
    }
    setEmailError(null);
    setEmailSuccess(null);
    setIsEmailSubmitting(true);
    try {
      const response = await api.post('/auth/verify-email-change/', {
        user_id: user?.id,
        new_email: newEmail.trim().toLowerCase(),
        otp: emailOtp.trim()
      });
      updateUser(response.data);
      setSuccessMessage('Email address updated successfully.');
      setIsEmailModalOpen(false);
      setNewEmail('');
      setEmailOtp('');
      setEmailStep(1);
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setEmailError(err.response.data.detail);
      } else {
        setEmailError('Invalid verification code. Please try again.');
      }
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsPasswordSubmitting(true);
    try {
      await api.post('/auth/request-password-change-otp/');
      setPasswordStep(2);
      setPasswordResendCountdown(60);
      setPasswordSuccess('Verification code has been sent to your email address.');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setPasswordError(err.response.data.detail);
      } else {
        setPasswordError('Failed to send verification code. Please try again.');
      }
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword || !passwordOtp) {
      setPasswordError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsPasswordSubmitting(true);
    try {
      await api.post('/auth/set-password-with-otp/', {
        otp: passwordOtp.trim(),
        new_password: newPassword
      });
      
      const meResponse = await api.get('/auth/me/');
      updateUser(meResponse.data);

      setSuccessMessage('Password updated successfully.');
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOtp('');
      setPasswordStep(1);
    } catch (err: any) {
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          setPasswordError(detail.join(' '));
        } else {
          setPasswordError(String(detail));
        }
      } else {
        setPasswordError('Failed to update password. Make sure it meets account security requirements.');
      }
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((item) => item[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('name', name);
    
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    try {
      const response = await api.patch('/profile/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      updateUser(response.data);
      setSuccessMessage('Profile updated successfully.');
      setAvatarFile(null);
    } catch (err: any) {
      if (err.response?.data) {
        const errorData = err.response.data;
        if (typeof errorData === 'object') {
          const firstError = Object.values(errorData)[0];
          setErrorMessage(Array.isArray(firstError) ? firstError[0] : String(firstError));
        } else {
          setErrorMessage('Failed to update profile. Please check your inputs.');
        }
      } else {
        setErrorMessage('Failed to update profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Profile Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your personal details, profile image, and credentials.
        </p>
      </div>

      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {successMessage && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-4 text-sm font-medium text-green-700 dark:text-green-400">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 text-sm font-medium text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Avatar upload container */}
          <div className="flex items-center gap-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={user.name}
                className="h-20 w-20 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xl font-semibold tracking-wider text-zinc-600 dark:text-zinc-300">
                {getInitials(user.name)}
              </div>
            )}
            
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-black dark:text-white">Profile Picture</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={triggerFileSelect}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
                >
                  Upload Photo
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <p className="text-[11px] text-zinc-400">JPG, GIF or PNG. Max size 2MB.</p>
            </div>
          </div>

          {/* User Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Role
              </label>
              <input
                type="text"
                disabled
                value={user.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
              />
            </div>


          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-medium rounded-lg text-sm tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white dark:border-black border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-black dark:text-white">Account Security</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Configure your email and password login credentials.
          </p>
        </div>

        <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email Address</p>
              <p className="text-sm font-medium text-black dark:text-white mt-1">{user.email}</p>
            </div>
            <button
              onClick={() => {
                setIsEmailModalOpen(true);
                setEmailStep(1);
                setNewEmail('');
                setEmailOtp('');
                setEmailError(null);
                setEmailSuccess(null);
              }}
              type="button"
              className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white self-start sm:self-center"
            >
              Change Email
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Password</p>
              <p className="text-sm font-medium text-black dark:text-white mt-1">
                {user.has_password ? 'Password login configured' : 'Password login not configured'}
              </p>
            </div>
            <button
              onClick={() => {
                setIsPasswordModalOpen(true);
                setPasswordStep(1);
                setNewPassword('');
                setConfirmPassword('');
                setShowNewPassword(false);
                setShowConfirmPassword(false);
                setPasswordOtp('');
                setPasswordError(null);
                setPasswordSuccess(null);
              }}
              type="button"
              className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white self-start sm:self-center"
            >
              {user.has_password ? 'Change Password' : 'Set Password'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-black dark:text-white">Theme Preferences</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Customize how Fluxiflow for Agency looks on your device.
          </p>
        </div>
        
        <div className="flex gap-3">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setThemeMode(mode)}
              className={`flex-1 py-3 px-4 border text-sm font-semibold rounded-lg transition-colors capitalize ${
                themeMode === mode
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                  : 'bg-white dark:bg-black hover:bg-zinc-50 dark:hover:bg-white/10 text-zinc-755 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Email Change Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">
                  {emailStep === 1 ? 'Change Email' : 'Verify New Email'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {emailStep === 1 
                    ? 'Enter your new email address. We will send a verification code to this address.' 
                    : `A verification code was sent to: ${newEmail}`}
                </p>
              </div>
            </div>

            {emailError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 text-xs font-semibold text-red-600 dark:text-red-400">
                {emailError}
              </div>
            )}

            {emailSuccess && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-3 text-xs font-semibold text-green-700 dark:text-green-400">
                {emailSuccess}
              </div>
            )}

            {emailStep === 1 ? (
              <form onSubmit={handleRequestEmailChange} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">New Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="newemail@example.com"
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-lg text-black dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEmailSubmitting}
                    className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isEmailSubmitting ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailChange} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    placeholder="123456"
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white text-center font-mono tracking-widest placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    disabled={emailResendCountdown > 0 || isEmailSubmitting}
                    onClick={handleRequestEmailChange}
                    className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white disabled:opacity-50"
                  >
                    {emailResendCountdown > 0 ? `Resend in ${emailResendCountdown}s` : 'Resend Code'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEmailStep(1)}
                      className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-lg text-black dark:text-white"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isEmailSubmitting || emailOtp.length !== 6}
                      className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isEmailSubmitting ? 'Verifying...' : 'Verify & Change Email'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">
                  {passwordStep === 1 ? 'Verify Your Identity' : (user.has_password ? 'Change Password' : 'Set Password')}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {passwordStep === 1 
                    ? 'A verification code will be sent to your registered email to verify your identity.' 
                    : 'Enter your new password and the verification code sent to your email.'}
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 text-xs font-semibold text-red-600 dark:text-red-400">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-3 text-xs font-semibold text-green-700 dark:text-green-400">
                {passwordSuccess}
              </div>
            )}

            {passwordStep === 1 ? (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-lg text-black dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestPasswordOtp}
                  disabled={isPasswordSubmitting}
                  className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isPasswordSubmitting ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-10 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-10 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={passwordOtp}
                    onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    placeholder="123456"
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white text-center font-mono tracking-widest placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    disabled={passwordResendCountdown > 0 || isPasswordSubmitting}
                    onClick={handleRequestPasswordOtp}
                    className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white disabled:opacity-50"
                  >
                    {passwordResendCountdown > 0 ? `Resend in ${passwordResendCountdown}s` : 'Resend Code'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPasswordModalOpen(false)}
                      className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-lg text-black dark:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPasswordSubmitting || passwordOtp.length !== 6}
                      className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isPasswordSubmitting ? 'Saving...' : 'Save Password'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
