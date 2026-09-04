import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2 } from 'lucide-react';
import type { KeepItem } from '../../types';

interface RenameKeepItemModalProps {
  isOpen: boolean;
  item: KeepItem | null;
  onClose: () => void;
  onSave: (itemId: string, newName: string) => Promise<void>;
}

export const RenameKeepItemModal: React.FC<RenameKeepItemModalProps> = ({
  isOpen,
  item,
  onClose,
  onSave
}) => {
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      // If it's a file with extension, strip extension for editing, store it separately
      setNameInput(item.name);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return '.' + parts.pop()!.toLowerCase();
    }
    return '';
  };

  const fileExt = item.item_type === 'FILE' ? getFileExtension(item.original_filename || item.name) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = nameInput.trim();
    if (!trimmed) {
      setError('Item name is required.');
      return;
    }

    // Preserve original file extension for FILE items strictly
    if (fileExt) {
      const lower = trimmed.toLowerCase();
      if (!lower.endsWith(fileExt)) {
        if (trimmed.includes('.')) {
          const base = trimmed.substring(0, trimmed.lastIndexOf('.'));
          trimmed = (base.trim() || trimmed) + fileExt;
        } else {
          trimmed += fileExt;
        }
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(item.id, trimmed);
      onClose();
    } catch (err: any) {
      console.error('Failed to rename item:', err);
      setError('Failed to rename item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative animate-in zoom-in-95 duration-150 text-black dark:text-white">
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Edit2 className="h-4 w-4 text-blue-500" />
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
            Rename
          </h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Enter a new name for this item.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-2.5 text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <input
              type="text"
              required
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={isSubmitting}
              placeholder="Item name"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-black dark:focus:border-white disabled:opacity-50 transition-colors"
            />
            {fileExt && (
              <p className="text-[10px] text-zinc-400 mt-1">
                File extension <code className="font-mono">{fileExt}</code> will be preserved automatically.
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !nameInput.trim()}
              className="px-3.5 py-1.5 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
