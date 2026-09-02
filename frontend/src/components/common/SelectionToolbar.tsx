import React, { useState } from 'react';
import { Trash2, X, CheckSquare, AlertTriangle } from 'lucide-react';

export interface SelectionToolbarProps {
  selectedCount: number;
  totalVisibleCount?: number;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  onConfirmDelete: () => Promise<void> | void;
  isDeleting?: boolean;
  areAllSelected?: boolean;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedCount,
  totalVisibleCount,
  onClearSelection,
  onSelectAll,
  onConfirmDelete,
  isDeleting = false,
  areAllSelected = false,
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (selectedCount === 0) return null;

  const handleDeleteClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    try {
      await onConfirmDelete();
    } finally {
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
      {/* Floating Selection Toolbar Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-2xl shadow-2xl border border-zinc-800 dark:border-zinc-200 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-6 duration-200 max-w-[95vw] md:max-w-md">
        <div className="flex items-center gap-2 pr-2 border-r border-zinc-700 dark:border-zinc-300">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold shrink-0">
            {selectedCount}
          </span>
          <span className="text-xs font-bold tracking-wide whitespace-nowrap">
            {totalVisibleCount ? `${selectedCount} / ${totalVisibleCount}` : selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end">
          {onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{areAllSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-zinc-400 dark:text-zinc-500 hover:text-white dark:hover:text-black transition-colors"
            title="Cancel selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-100 dark:bg-red-950/40 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Delete {selectedCount} task{selectedCount > 1 ? 's' : ''}?
              </h3>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              Are you sure you want to permanently delete {selectedCount > 1 ? `these ${selectedCount} selected tasks` : 'this selected task'}? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirm}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete {selectedCount} Task{selectedCount > 1 ? 's' : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
