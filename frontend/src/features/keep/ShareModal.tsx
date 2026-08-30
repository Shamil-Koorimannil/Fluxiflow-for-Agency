import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Share2, X, Link as LinkIcon, Copy, Check, Trash2, Lock, Users, Shield
} from 'lucide-react';
import type { KeepItem, KeepPermission, KeepShareLink, KeepAccessLevel, KeepRole } from '../../types';
import { api } from '../../services/api';

interface ShareModalProps {
  isOpen: boolean;
  item: KeepItem | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  item,
  onClose
}) => {
  const [email, setEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState<KeepAccessLevel>('ONLY_ME');
  const [role, setRole] = useState<KeepRole>('VIEW');
  const [permissionsList, setPermissionsList] = useState<KeepPermission[]>([]);
  const [shareLinks, setShareLinks] = useState<KeepShareLink[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      loadPermissionsAndLinks();
    }
  }, [isOpen, item]);

  const loadPermissionsAndLinks = async () => {
    if (!item) return;
    setError(null);
    try {
      const [permRes, linkRes] = await Promise.all([
        api.get<KeepPermission[]>(`/keep/items/${item.id}/permissions/`),
        api.get<KeepShareLink[]>(`/keep/items/${item.id}/share_link/`)
      ]);
      setPermissionsList(permRes.data);
      setShareLinks(linkRes.data);
    } catch (err: any) {
      setError('Failed to load sharing settings.');
    }
  };

  if (!isOpen || !item) return null;

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/keep/items/${item.id}/permissions/`, {
        email: email || undefined,
        access_level: accessLevel,
        role: role
      });
      setEmail('');
      loadPermissionsAndLinks();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update sharing settings.');
    }
  };

  const handleRevokePermission = async (permId: string) => {
    try {
      await api.delete(`/keep/items/${item.id}/revoke_permission/?permission_id=${permId}`);
      loadPermissionsAndLinks();
    } catch (err) {
      setError('Failed to revoke permission.');
    }
  };

  const handleGenerateShareLink = async (linkRole: KeepRole) => {
    setError(null);
    try {
      await api.post(`/keep/items/${item.id}/share_link/`, { permission: linkRole });
      loadPermissionsAndLinks();
    } catch (err) {
      setError('Failed to generate share link.');
    }
  };

  const handleRevokeShareLinks = async () => {
    try {
      await api.delete(`/keep/items/${item.id}/share_link/`);
      loadPermissionsAndLinks();
    } catch (err) {
      setError('Failed to revoke share links.');
    }
  };

  const activeLink = shareLinks.find(l => l.is_active);
  const shareUrl = activeLink ? `${window.location.origin}/keep/share/${activeLink.token}` : '';

  const copyToClipboard = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Share2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-base leading-tight">Share '{item.name}'</h3>
              <p className="text-xs text-zinc-400">Manage permissions & secure link access</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-800 font-medium">
              {error}
            </div>
          )}

          {/* Direct Sharing Form */}
          <form onSubmit={handleAddPermission} className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Share with Specific Teammate
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter member's email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as KeepRole)}
                className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none"
              >
                <option value="VIEW">Can view</option>
                <option value="EDIT">Can edit</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-semibold text-xs rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Share
              </button>
            </div>
          </form>

          {/* Access Policy Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Organization Access Policy
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAccessLevel('ONLY_ME')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  accessLevel === 'ONLY_ME'
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Lock className="h-4 w-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Only Me</div>
                  <div className="text-[10px] text-zinc-400">Private to owner</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccessLevel('YOU_AND_ADMINS')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  accessLevel === 'YOU_AND_ADMINS'
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Shield className="h-4 w-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">You + Admins</div>
                  <div className="text-[10px] text-zinc-400">Admins can view/edit</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccessLevel('EVERYONE')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  accessLevel === 'EVERYONE'
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Everyone</div>
                  <div className="text-[10px] text-zinc-400">Entire organization</div>
                </div>
              </button>
            </div>
          </div>

          {/* Existing Explicit Permissions List */}
          {permissionsList.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                People with Access
              </label>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {permissionsList.map(perm => (
                  <div key={perm.id} className="flex items-center justify-between px-3.5 py-2.5 text-xs bg-white dark:bg-zinc-900">
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{perm.user_email || 'Organization Access'}</div>
                      <div className="text-[10px] text-zinc-400">{perm.access_level} • {perm.role}</div>
                    </div>
                    <button
                      onClick={() => handleRevokePermission(perm.id)}
                      className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secure Share Link Section */}
          <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Shareable Link
            </label>
            {activeLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                  <LinkIcon className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent text-xs outline-none truncate"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 px-3 py-1 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex-shrink-0"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>Link grants: <strong>{activeLink.permission}</strong> access</span>
                  <button
                    onClick={handleRevokeShareLinks}
                    className="text-red-500 hover:underline font-medium"
                  >
                    Revoke Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateShareLink('VIEW')}
                  className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Create View Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateShareLink('EDIT')}
                  className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Create Edit Link</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
