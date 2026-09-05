import React, { useState, useRef, useEffect } from 'react';
import { Plus, FileText, StickyNote, Table, Folder, Upload, ChevronDown } from 'lucide-react';
import type { KeepItemType } from '../../types';

interface NewKeepItemMenuProps {
  onCreateItem: (type: KeepItemType) => void;
  onOpenUploadModal: () => void;
  disabled?: boolean;
}

export const NewKeepItemMenu: React.FC<NewKeepItemMenuProps> = ({
  onCreateItem,
  onOpenUploadModal,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4" />
        <span>New</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl py-1.5 z-[9999] text-sm animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => {
              onCreateItem('DOCUMENT');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium"
          >
            <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold">Document</div>
              <div className="text-xs text-zinc-400">Rich-text document</div>
            </div>
          </button>

          <button
            onClick={() => {
              onCreateItem('NOTE');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium"
          >
            <div className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white">
              <StickyNote className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold">Note</div>
              <div className="text-xs text-zinc-400">Quick formatted note</div>
            </div>
          </button>

          <button
            onClick={() => {
              onCreateItem('SPREADSHEET');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium"
          >
            <div className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Table className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold">Spreadsheet</div>
              <div className="text-xs text-zinc-400">Multi-sheet workbook</div>
            </div>
          </button>

          <button
            onClick={() => {
              onCreateItem('FOLDER');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium"
          >
            <div className="p-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-500">
              <Folder className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold">Folder</div>
              <div className="text-xs text-zinc-400">Organize workspace items</div>
            </div>
          </button>

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

          <button
            onClick={() => {
              onOpenUploadModal();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium"
          >
            <div className="p-1 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold">Upload File</div>
              <div className="text-xs text-zinc-400">PDF, PNG, Excel/CSV, DOCX, Zip, etc.</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
