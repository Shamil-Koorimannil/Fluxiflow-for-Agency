import React, { useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
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
    
    if (password) {
      formData.append('password', password);
    }
    
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
      setPassword('');
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
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-sm text-zinc-500">
          Manage your personal details, profile image, and credentials.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {successMessage && (
            <div className="rounded-lg bg-green-50 border border-green-100 p-4 text-sm font-medium text-green-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm font-medium text-red-600">
              {errorMessage}
            </div>
          )}

          {/* Avatar upload container */}
          <div className="flex items-center gap-6 pb-4 border-b border-zinc-100">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={user.name}
                className="h-20 w-20 rounded-full object-cover border border-zinc-200"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xl font-semibold tracking-wider text-zinc-600">
                {getInitials(user.name)}
              </div>
            )}
            
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Profile Picture</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={triggerFileSelect}
                  className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors"
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
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Role
              </label>
              <input
                type="text"
                disabled
                value={user.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Change Password (optional)
              </label>
              <input
                type="password"
                placeholder="Leave blank to keep current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-black hover:bg-zinc-800 text-white font-medium rounded-lg text-sm tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
