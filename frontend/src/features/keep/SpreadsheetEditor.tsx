import React, { useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Download, History, Share2, Check, RefreshCw, AlertCircle, Table
} from 'lucide-react';
import type { KeepItem, KeepSpreadsheetData, KeepSheet } from '../../types';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { SpreadsheetTabs } from './SpreadsheetTabs';
import { ShareModal } from './ShareModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { api } from '../../services/api';

interface SpreadsheetEditorProps {
  item: KeepItem;
  onBack: () => void;
  onShare: (item: KeepItem) => void;
  onOpenVersionHistory: (item: KeepItem) => void;
  onItemUpdated: (updatedItem: KeepItem) => void;
}

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  item,
  onBack,
  onItemUpdated
}) => {
  const [title, setTitle] = useState(item.name);
  const [version, setVersion] = useState(item.version);

  // Modals state directly owned by active Spreadsheet Editor workspace
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Initialize spreadsheet data with fallback default sheet
  const initialData: KeepSpreadsheetData = item.spreadsheet_data && item.spreadsheet_data.sheets?.length > 0
    ? item.spreadsheet_data
    : {
        sheets: [
          { id: 'sheet_1', name: 'Sheet1', cells: {} }
        ]
      };

  const [spreadsheetData, setSpreadsheetData] = useState<KeepSpreadsheetData>(initialData);
  const [activeSheetId, setActiveSheetId] = useState<string>(initialData.sheets[0]?.id || 'sheet_1');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSheet = spreadsheetData.sheets.find(s => s.id === activeSheetId) || spreadsheetData.sheets[0];

  const performSave = useCallback(async (newTitle: string, newData: KeepSpreadsheetData, isMilestone = false) => {
    setSaveStatus('saving');
    try {
      const response = await api.put<KeepItem>(`/keep/items/${item.id}/`, {
        name: newTitle,
        spreadsheet_data: newData,
        version: version,
        create_snapshot: isMilestone
      });

      setVersion(response.data.version);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
      setConflictMessage(null);
      onItemUpdated(response.data);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setSaveStatus('conflict');
        setConflictMessage(err?.response?.data?.detail || 'This spreadsheet was updated by someone else. Refresh before continuing.');
      } else {
        setSaveStatus('error');
      }
    }
  }, [item.id, version, onItemUpdated]);

  const scheduleSave = (newTitle: string, newData: KeepSpreadsheetData) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      performSave(newTitle, newData, false);
    }, 1200);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    scheduleSave(newTitle, spreadsheetData);
  };

  const handleSheetDataChange = (updatedSheet: KeepSheet) => {
    const newSheets = spreadsheetData.sheets.map(s => s.id === updatedSheet.id ? updatedSheet : s);
    const newData = { sheets: newSheets };
    setSpreadsheetData(newData);
    scheduleSave(title, newData);
  };

  const handleAddSheet = () => {
    const newSheetId = `sheet_${Date.now()}`;
    const newSheetName = `Sheet${spreadsheetData.sheets.length + 1}`;
    const newSheet: KeepSheet = { id: newSheetId, name: newSheetName, cells: {} };
    const newData = { sheets: [...spreadsheetData.sheets, newSheet] };
    setSpreadsheetData(newData);
    setActiveSheetId(newSheetId);
    scheduleSave(title, newData);
  };

  const handleRenameSheet = (sheetId: string, newName: string) => {
    const newSheets = spreadsheetData.sheets.map(s => s.id === sheetId ? { ...s, name: newName } : s);
    const newData = { sheets: newSheets };
    setSpreadsheetData(newData);
    scheduleSave(title, newData);
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (spreadsheetData.sheets.length <= 1) return;
    const newSheets = spreadsheetData.sheets.filter(s => s.id !== sheetId);
    const newData = { sheets: newSheets };
    setSpreadsheetData(newData);
    if (activeSheetId === sheetId) {
      setActiveSheetId(newSheets[0].id);
    }
    scheduleSave(title, newData);
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      const query = format === 'csv' ? `export_format=csv&sheet_id=${activeSheetId}` : `export_format=xlsx`;
      const response = await api.get(`/keep/items/${item.id}/export/?${query}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'Spreadsheet'}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export spreadsheet:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative pb-20 md:pb-0">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <Table className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />

          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Spreadsheet"
            className="text-lg font-bold bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-black dark:focus:border-white outline-none px-1 py-0.5 transition-colors max-w-md truncate"
          />

          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium ml-2">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-blue-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Saved {lastSavedTime ? `at ${lastSavedTime}` : ''}
              </span>
            )}
            {saveStatus === 'conflict' && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <AlertCircle className="h-3.5 w-3.5" /> Conflict
              </span>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            title="Download XLSX Workbook"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export XLSX</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            title="Download Active Sheet CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors shadow-sm"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Stale Version Conflict Banner */}
      {saveStatus === 'conflict' && conflictMessage && (
        <div className="flex items-center justify-between px-6 py-2.5 bg-red-500 text-white text-xs font-medium animate-in slide-in-from-top duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{conflictMessage}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 bg-white text-red-600 rounded font-bold hover:bg-zinc-100 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Main Grid View */}
      <div className="flex-1 overflow-hidden">
        {activeSheet && (
          <SpreadsheetGrid
            activeSheet={activeSheet}
            onChangeSheetData={handleSheetDataChange}
          />
        )}
      </div>

      {/* Sheet Tabs Bar */}
      <SpreadsheetTabs
        sheets={spreadsheetData.sheets}
        activeSheetId={activeSheetId}
        onSelectSheet={setActiveSheetId}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onDeleteSheet={handleDeleteSheet}
      />

      {/* Workspace-Level Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        item={item}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Workspace-Level Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        item={item}
        onClose={() => setIsHistoryOpen(false)}
        onVersionRestored={(updated) => {
          setVersion(updated.version);
          if (updated.spreadsheet_data) {
            setSpreadsheetData(updated.spreadsheet_data);
          }
          onItemUpdated(updated);
        }}
      />
    </div>
  );
};
