import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { KeepSheet } from '../../types';

interface SpreadsheetTabsProps {
  sheets: KeepSheet[];
  activeSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (sheetId: string, newName: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  readOnly?: boolean;
}

export const SpreadsheetTabs: React.FC<SpreadsheetTabsProps> = ({
  sheets,
  activeSheetId,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
  readOnly = false
}) => {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');

  const handleStartRename = (sheet: KeepSheet) => {
    if (readOnly) return;
    setEditingSheetId(sheet.id);
    setTempName(sheet.name);
  };

  const handleFinishRename = (sheetId: string) => {
    if (tempName.trim()) {
      onRenameSheet(sheetId, tempName.trim());
    }
    setEditingSheetId(null);
  };

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs overflow-x-auto">
      {!readOnly && (
        <button
          onClick={onAddSheet}
          title="Add Sheet"
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1 flex-shrink-0" />

      {sheets.map(sheet => {
        const isActive = sheet.id === activeSheetId;
        const isEditing = sheet.id === editingSheetId;

        return (
          <div
            key={sheet.id}
            onClick={() => onSelectSheet(sheet.id)}
            onDoubleClick={() => handleStartRename(sheet)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-t-lg border-t border-x cursor-pointer transition-colors font-medium select-none flex-shrink-0 ${
              isActive
                ? 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-black dark:text-white shadow-sm font-semibold'
                : 'bg-zinc-50/60 dark:bg-zinc-900/60 border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {isEditing ? (
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => handleFinishRename(sheet.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename(sheet.id);
                  if (e.key === 'Escape') setEditingSheetId(null);
                }}
                autoFocus
                className="bg-transparent outline-none border-b border-black dark:border-white px-0.5 text-xs w-20"
              />
            ) : (
              <span>{sheet.name}</span>
            )}

            {!readOnly && sheets.length > 1 && isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSheet(sheet.id);
                }}
                title="Delete Sheet"
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
