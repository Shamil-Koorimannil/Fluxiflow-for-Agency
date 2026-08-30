import React, { useEffect, useRef } from 'react';
import {
  ExternalLink, Pin, PinOff, Share2, FolderInput, Copy, Download, Trash2, RotateCcw, XCircle
} from 'lucide-react';
import type { KeepItem } from '../../types';

interface KeepContextMenuProps {
  item: KeepItem;
  x: number;
  y: number;
  onClose: () => void;
  onOpen: (item: KeepItem) => void;
  onTogglePin: (item: KeepItem) => void;
  onShare: (item: KeepItem) => void;
  onMove: (item: KeepItem) => void;
  onDuplicate: (item: KeepItem) => void;
  onExport: (item: KeepItem, format: 'xlsx' | 'csv') => void;
  onSoftDelete: (item: KeepItem) => void;
  onRestore?: (item: KeepItem) => void;
  onPermanentDelete?: (item: KeepItem) => void;
  isTrashSection?: boolean;
}

export const KeepContextMenu: React.FC<KeepContextMenuProps> = ({
  item,
  x,
  y,
  onClose,
  onOpen,
  onTogglePin,
  onShare,
  onMove,
  onDuplicate,
  onExport,
  onSoftDelete,
  onRestore,
  onPermanentDelete,
  isTrashSection = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust coordinates if menu would overflow screen
  const menuWidth = 200;
  const menuHeight = 260;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-52 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl py-1 text-sm text-zinc-700 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100"
    >
      {!isTrashSection ? (
        <>
          <button
            onClick={() => { onOpen(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <ExternalLink className="h-4 w-4 text-zinc-400" />
            <span>Open</span>
          </button>

          <button
            onClick={() => { onTogglePin(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            {item.is_pinned ? (
              <>
                <PinOff className="h-4 w-4 text-amber-500" />
                <span>Unpin</span>
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 text-zinc-400" />
                <span>Pin</span>
              </>
            )}
          </button>

          <button
            onClick={() => { onShare(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <Share2 className="h-4 w-4 text-zinc-400" />
            <span>Share & Permissions</span>
          </button>

          <button
            onClick={() => { onMove(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <FolderInput className="h-4 w-4 text-zinc-400" />
            <span>Move to...</span>
          </button>

          <button
            onClick={() => { onDuplicate(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <Copy className="h-4 w-4 text-zinc-400" />
            <span>Duplicate</span>
          </button>

          {item.item_type === 'SPREADSHEET' && (
            <>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <button
                onClick={() => { onExport(item, 'xlsx'); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left text-xs"
              >
                <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export as XLSX</span>
              </button>
              <button
                onClick={() => { onExport(item, 'csv'); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left text-xs"
              >
                <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export as CSV</span>
              </button>
            </>
          )}

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

          <button
            onClick={() => { onSoftDelete(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors text-left font-medium"
          >
            <Trash2 className="h-4 w-4" />
            <span>Move to Trash</span>
          </button>
        </>
      ) : (
        <>
          {onRestore && (
            <button
              onClick={() => { onRestore(item); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
            >
              <RotateCcw className="h-4 w-4 text-emerald-500" />
              <span>Restore</span>
            </button>
          )}

          {onPermanentDelete && (
            <button
              onClick={() => { onPermanentDelete(item); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors text-left font-medium"
            >
              <XCircle className="h-4 w-4" />
              <span>Delete Permanently</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
