import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import type { DialogVariant } from '../../context/ConfirmDialogContext';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  showCancel?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  showCancel = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || isLoading) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  const renderIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 mb-4 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
        );
      case 'warning':
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 mb-4 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 mb-4 shrink-0">
            <Info className="h-6 w-6" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-xl text-xs transition-colors py-2.5 px-4 shadow-sm flex-1 whitespace-nowrap flex items-center justify-center gap-1.5';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold rounded-xl text-xs transition-colors py-2.5 px-4 shadow-sm flex-1 whitespace-nowrap flex items-center justify-center gap-1.5';
      case 'info':
      default:
        return 'bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 text-white dark:text-black font-semibold rounded-xl text-xs transition-colors py-2.5 px-4 shadow-sm flex-1 whitespace-nowrap flex items-center justify-center gap-1.5';
    }
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-[11000] flex items-center justify-center p-4"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-sm sm:max-w-md w-full p-6 shadow-2xl text-center relative animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {renderIcon()}

        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 mb-2">
          {title}
        </h3>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        <div className="flex items-center justify-center gap-3">
          {showCancel && (
            <button
              type="button"
              disabled={isLoading}
              onClick={onCancel}
              className="py-2.5 px-4 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 text-xs font-semibold rounded-xl transition-colors flex-1 text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
            >
              {cancelText}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={getConfirmButtonClasses()}
          >
            {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
