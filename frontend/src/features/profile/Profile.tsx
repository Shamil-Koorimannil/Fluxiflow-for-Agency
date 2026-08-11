import React, { useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import { useAppTheme } from '../../context/ThemeContext';

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { themeMode, setThemeMode } = useAppTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    formData.append('email', email);
    

    
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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-colors"
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
    </div>
  );
};
