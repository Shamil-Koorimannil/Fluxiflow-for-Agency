import React, { useState, useEffect } from 'react';
import { X, Folder, MoveRight, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import type { ClientBrandAsset, ClientBrandAssetFolder } from '../../types';

interface MoveAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: ClientBrandAsset | null;
  folders: ClientBrandAssetFolder[];
  onMoved: () => void;
}

export const MoveAssetModal: React.FC<MoveAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  folders,
  onMoved,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setSelectedFolderId(asset.folder || null);
      setErrorMessage(null);
    }
  }, [asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedFolderId === (asset.folder || null)) {
      setErrorMessage('Asset is already in the selected destination.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/client-brand-assets/${asset.id}/move/`, {
        target_folder_id: selectedFolderId,
      });

      onMoved();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to move asset.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to build folder path display
  const getFolderPath = (folder: ClientBrandAssetFolder): string => {
    let path = folder.name;
    let currParentId = folder.parent;
    while (currParentId) {
      const parent = folders.find((f) => f.id === currParentId);
      if (parent) {
        path = `${parent.name} / ${path}`;
        currParentId = parent.parent;
      } else {
        break;
      }
    }
    return path;
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-none z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <MoveRight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Move Asset</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Select destination for <span className="font-bold text-zinc-900 dark:text-zinc-100">{asset.name}</span>:
        </p>

        {/* Error alert */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Folder Options List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/50 dark:bg-zinc-900/50">
            {/* Root folder option */}
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedFolderId === null
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-purple-500 shrink-0" />
                <span>Root (Brand Assets)</span>
              </div>
              {selectedFolderId === null && <Check className="h-4 w-4 text-purple-600" />}
            </button>

            {/* Folder list */}
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="h-4 w-4 text-purple-500 shrink-0" />
                    <span className="truncate">{getFolderPath(folder)}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-purple-600 shrink-0" />}
                </button>
              );
            })}
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
              {isSubmitting ? 'Moving...' : 'Move Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
