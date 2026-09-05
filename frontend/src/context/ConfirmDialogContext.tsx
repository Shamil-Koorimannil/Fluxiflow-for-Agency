import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export type DialogVariant = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  showCancel?: boolean;
}

export interface PromptOptions {
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: string;
}

export interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showAlert: (options: Omit<ConfirmOptions, 'showCancel'>) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmDialogContext = createContext<DialogContextType | null>(null);

export const useConfirm = (): DialogContextType => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context;
};

interface DialogState {
  isOpen: boolean;
  type: 'confirm' | 'prompt';
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: DialogVariant;
  showCancel: boolean;
  promptValue: string;
  placeholder: string;
  inputType: string;
  resolve: (value: any) => void;
}

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'confirm',
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger',
        showCancel: options.showCancel !== false,
        promptValue: '',
        placeholder: '',
        inputType: 'text',
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback((options: Omit<ConfirmOptions, 'showCancel'>): Promise<void> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'confirm',
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'OK',
        cancelText: '',
        variant: options.variant || 'info',
        showCancel: false,
        promptValue: '',
        placeholder: '',
        inputType: 'text',
        resolve: () => resolve(),
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'prompt',
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'OK',
        cancelText: options.cancelText || 'Cancel',
        variant: 'info',
        showCancel: true,
        promptValue: options.defaultValue || '',
        placeholder: options.placeholder || '',
        inputType: options.inputType || 'text',
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((value: boolean | string | null) => {
    if (dialogState) {
      const resolve = dialogState.resolve;
      setDialogState(null);
      resolve(value);
    }
  }, [dialogState]);

  useEffect(() => {
    if (dialogState?.isOpen) {
      const timer = setTimeout(() => {
        if (dialogState.type === 'prompt' && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [dialogState?.isOpen, dialogState?.type]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialogState?.isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(dialogState.type === 'prompt' ? null : false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState, handleClose]);

  const renderIcon = (variant: DialogVariant) => {
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

  const getConfirmButtonClasses = (variant: DialogVariant) => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition-colors py-2.5 px-4 shadow-sm flex-1 whitespace-nowrap';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition-colors py-2.5 px-4 shadow-sm flex-1 whitespace-nowrap';
      case 'info':
      default:
        return 'bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-xl text-xs transition-colors py-2.5 px-4 shadow-sm flex-1 whitespace-nowrap';
    }
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm, showAlert, prompt }}>
      {children}
      {dialogState?.isOpen && (
        <div
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-[11000] flex items-center justify-center p-4"
          onClick={() => handleClose(dialogState.type === 'prompt' ? null : false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-sm sm:max-w-md w-full p-6 shadow-2xl text-center relative animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            {renderIcon(dialogState.variant)}

            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 mb-2">
              {dialogState.title}
            </h3>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed whitespace-pre-line">
              {dialogState.message}
            </p>

            {dialogState.type === 'prompt' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleClose(dialogState.promptValue);
                }}
                className="mb-6"
              >
                <input
                  ref={inputRef}
                  type={dialogState.inputType}
                  placeholder={dialogState.placeholder}
                  value={dialogState.promptValue}
                  onChange={(e) => setDialogState({ ...dialogState, promptValue: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 font-medium"
                />
              </form>
            )}

            <div className="flex items-center justify-center gap-3">
              {dialogState.showCancel && (
                <button
                  type="button"
                  onClick={() => handleClose(dialogState.type === 'prompt' ? null : false)}
                  className="py-2.5 px-4 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold rounded-xl transition-colors flex-1 text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
                >
                  {dialogState.cancelText}
                </button>
              )}

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => {
                  if (dialogState.type === 'prompt') {
                    handleClose(dialogState.promptValue);
                  } else {
                    handleClose(true);
                  }
                }}
                className={getConfirmButtonClasses(dialogState.variant)}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};
