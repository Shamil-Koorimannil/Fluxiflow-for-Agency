import React, { useState, useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import type { ClientBrandAsset, ClientBrandAssetFolder } from '../../types';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: { type: 'folder'; item: ClientBrandAssetFolder } | { type: 'asset'; item: ClientBrandAsset } | null;
  onSaved: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  target,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [fileExt, setFileExt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setErrorMessage(null);
      if (target.type === 'folder') {
        setName(target.item.name);
        setFileExt('');
      } else {
        const fullName = target.item.name || '';
        const lastDot = fullName.lastIndexOf('.');
        if (lastDot > 0) {
          setName(fullName.slice(0, lastDot));
          setFileExt(fullName.slice(lastDot));
        } else {
          setName(fullName);
          setFileExt('');
        }
      }
    }
  }, [target]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Name cannot be empty or whitespace only.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (target.type === 'folder') {
        await api.patch(`/client-brand-asset-folders/${target.item.id}/`, {
          name: trimmed,
        });
      } else {
        // Asset rename: ensure original extension is attached
        let finalName = trimmed;
        if (fileExt && !finalName.toLowerCase().endsWith(fileExt.toLowerCase())) {
          finalName = `${finalName}${fileExt}`;
        }
        await api.post(`/client-brand-assets/${target.item.id}/rename/`, {
          name: finalName,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.name?.[0] || err?.response?.data?.detail || 'Failed to rename.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-none z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Rename {target.type === 'folder' ? 'Folder' : 'Brand Asset'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              New Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
              {fileExt && (
                <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
                  {fileExt}
                </span>
              )}
            </div>
            {fileExt && (
              <p className="text-[11px] text-zinc-400 mt-1">
                File extension <code className="font-mono text-purple-500">{fileExt}</code> is automatically preserved.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
