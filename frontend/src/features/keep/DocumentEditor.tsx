import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Code, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon,
  Table as TableIcon, History, Share2, ArrowLeft, Check, AlertCircle, RefreshCw, Save,
  Palette, Type
} from 'lucide-react';
import type { KeepItem } from '../../types';
import { api } from '../../services/api';
import { ShareModal } from './ShareModal';
import { VersionHistoryModal } from './VersionHistoryModal';

interface DocumentEditorProps {
  item: KeepItem;
  onBack: () => void;
  onShare?: (item: KeepItem) => void;
  onOpenVersionHistory?: (item: KeepItem) => void;
  onItemUpdated: (updatedItem: KeepItem) => void;
}

const PRESET_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#6366f1', '#a855f7', '#ec4899', '#fef08a', 'transparent'
];

// Floating Portal Color Picker Component anchored to parent button
const FloatingColorPicker: React.FC<{
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}> = ({ buttonRef, onSelectColor, onClose }) => {
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(12, rect.left + window.scrollX)
      });
    }
  }, [buttonRef]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [buttonRef, onClose]);

  return ReactDOM.createPortal(
    <div
      style={{ top: coords.top, left: coords.left }}
      className="fixed z-[9999] p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="grid grid-cols-5 gap-1.5 w-44">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onSelectColor(c); onClose(); }}
            title={c === 'transparent' ? 'Clear Color' : c}
            className="w-6 h-6 rounded-md border border-zinc-300 dark:border-zinc-700 hover:scale-110 transition-transform flex items-center justify-center text-[10px]"
            style={{ backgroundColor: c === 'transparent' ? '#ffffff' : c }}
          >
            {c === 'transparent' && '❌'}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  item,
  onBack,
  onItemUpdated
}) => {
  const [title, setTitle] = useState(item.name);
  const [content, setContent] = useState(item.document_content || '');
  const [version, setVersion] = useState(item.version);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state directly owned by active Document Editor workspace
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Color Pickers Anchored Refs
  const textColorBtnRef = useRef<HTMLButtonElement | null>(null);
  const highlightBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // Table Contextual Toolbar State
  const [activeTable, setActiveTable] = useState<HTMLTableElement | null>(null);
  const [activeCell, setActiveCell] = useState<HTMLTableCellElement | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(item.version);

  // Sync ref with state
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  // Sync when prop item updates (e.g. from version restore)
  useEffect(() => {
    if (item.version > versionRef.current) {
      setVersion(item.version);
      versionRef.current = item.version;
      setTitle(item.name);
      setContent(item.document_content || '');
      if (editorRef.current) {
        editorRef.current.innerHTML = item.document_content || '';
      }
    }
  }, [item]);

  // Initialize editor content once on initial mount
  useEffect(() => {
    if (editorRef.current && isInitialMount.current) {
      editorRef.current.innerHTML = item.document_content || '';
      isInitialMount.current = false;
    }
  }, [item.document_content]);

  // Execute formatting commands while preserving editor focus & selection
  const execCmd = (cmd: string, val: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      handleContentChange();
    }
  };

  // Perform save to API via PATCH with version concurrency check
  const performSave = useCallback(async (newTitle: string, newContent: string, isMilestone = false) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const response = await api.patch<KeepItem>(`/keep/items/${item.id}/`, {
        name: newTitle,
        document_content: newContent,
        version: versionRef.current,
        create_snapshot: isMilestone
      });

      versionRef.current = response.data.version;
      setVersion(response.data.version);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      onItemUpdated(response.data);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setSaveStatus('conflict');
        setErrorMessage('This document was updated by someone else. Refresh to get the latest version before continuing.');
      } else {
        setSaveStatus('error');
        setErrorMessage('Unable to save. Please try again.');
      }
    }
  }, [item.id, onItemUpdated]);

  // Debounced auto-save handler (1.2 seconds) with race protection
  const scheduleSave = (newTitle: string, newContent: string) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      performSave(newTitle, newContent, false);
    }, 1200);
  };

  const handleContentChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      scheduleSave(title, html);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    scheduleSave(newTitle, content);
  };

  // Link Insertion Workflow
  const insertLink = () => {
    const rawUrl = prompt('Enter website URL:');
    if (!rawUrl) return;

    const trimmed = rawUrl.trim();
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
      alert('Unsafe URL protocol rejected.');
      return;
    }

    const formattedUrl = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    execCmd('createLink', formattedUrl);
  };

  // Semantic Table Insertion
  const insertTable = () => {
    const tableHtml = `
      <table border="1" style="width:100%; border-collapse:collapse; margin:16px 0; border:1px solid #d4d4d8;" class="keep-doc-table">
        <thead>
          <tr>
            <th style="border:1px solid #d4d4d8; padding:8px 12px; background:#f4f4f5; font-weight:bold; text-align:left;">Header 1</th>
            <th style="border:1px solid #d4d4d8; padding:8px 12px; background:#f4f4f5; font-weight:bold; text-align:left;">Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #d4d4d8; padding:8px 12px;">Cell 1</td>
            <td style="border:1px solid #d4d4d8; padding:8px 12px;">Cell 2</td>
          </tr>
        </tbody>
      </table>
    `;
    execCmd('insertHTML', tableHtml);
  };

  // Detect focus inside table for Contextual Table Controls
  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) {
      setActiveTable(null);
      setActiveCell(null);
      return;
    }

    let node: Node | null = sel.anchorNode;
    let cellNode: HTMLTableCellElement | null = null;
    let tableNode: HTMLTableElement | null = null;

    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        cellNode = node as HTMLTableCellElement;
      }
      if (node.nodeName === 'TABLE') {
        tableNode = node as HTMLTableElement;
        break;
      }
      node = node.parentNode;
    }

    setActiveTable(tableNode);
    setActiveCell(cellNode);
  };

  // Table Control Actions
  const handleAddRow = (above = false) => {
    if (!activeTable || !activeCell) return;
    const row = activeCell.parentElement as HTMLTableRowElement;
    if (!row) return;

    const newRow = row.cloneNode(true) as HTMLTableRowElement;
    Array.from(newRow.cells).forEach(cell => cell.textContent = 'Cell');

    if (above) {
      row.parentNode?.insertBefore(newRow, row);
    } else {
      row.parentNode?.insertBefore(newRow, row.nextSibling);
    }
    handleContentChange();
  };

  const handleDeleteRow = () => {
    if (!activeTable || !activeCell) return;
    const row = activeCell.parentElement as HTMLTableRowElement;
    if (row) {
      row.remove();
      handleContentChange();
      setActiveTable(null);
      setActiveCell(null);
    }
  };

  const handleAddColumn = (left = false) => {
    if (!activeTable || !activeCell) return;
    const cellIdx = activeCell.cellIndex;

    Array.from(activeTable.rows).forEach(row => {
      const isHeader = row.parentElement?.tagName === 'THEAD';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.textContent = isHeader ? 'Header' : 'Cell';
      newCell.setAttribute('style', 'border:1px solid #d4d4d8; padding:8px 12px;');

      if (left) {
        row.insertBefore(newCell, row.cells[cellIdx]);
      } else {
        row.insertBefore(newCell, row.cells[cellIdx + 1] || null);
      }
    });
    handleContentChange();
  };

  const handleDeleteColumn = () => {
    if (!activeTable || !activeCell) return;
    const cellIdx = activeCell.cellIndex;

    Array.from(activeTable.rows).forEach(row => {
      if (row.cells[cellIdx]) {
        row.cells[cellIdx].remove();
      }
    });
    handleContentChange();
    setActiveTable(null);
    setActiveCell(null);
  };

  const handleDeleteTable = () => {
    if (activeTable) {
      activeTable.remove();
      handleContentChange();
      setActiveTable(null);
      setActiveCell(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative pb-20 md:pb-0">
      {/* Document Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Document"
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
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-3.5 w-3.5" /> Unable to save
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => performSave(title, content, true)}
            title="Save Snapshot Version"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Snapshot</span>
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

      {/* Error & Concurrency Banner */}
      {errorMessage && (
        <div className="flex items-center justify-between px-6 py-2.5 bg-red-500 text-white text-xs font-medium animate-in slide-in-from-top duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
          {saveStatus === 'conflict' && (
            <button
              onClick={() => window.location.reload()}
              className="px-2.5 py-1 bg-white text-red-600 rounded font-bold hover:bg-zinc-100 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      )}

      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 px-6 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto text-xs">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('bold')}
          title="Bold (Ctrl+B)"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('italic')}
          title="Italic (Ctrl+I)"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('underline')}
          title="Underline (Ctrl+U)"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('strikeThrough')}
          title="Strikethrough"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        {/* Text Color Picker Button */}
        <button
          ref={textColorBtnRef}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowHighlightPicker(false); }}
          title="Text Color"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Type className="h-4 w-4 text-blue-500" />
        </button>

        {/* Highlight Color Picker Button */}
        <button
          ref={highlightBtnRef}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowTextColorPicker(false); }}
          title="Highlight Text"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Palette className="h-4 w-4 text-amber-500" />
        </button>

        {/* Floating Portal Color Pickers */}
        {showTextColorPicker && (
          <FloatingColorPicker
            buttonRef={textColorBtnRef}
            onSelectColor={(c) => execCmd('foreColor', c)}
            onClose={() => setShowTextColorPicker(false)}
          />
        )}

        {showHighlightPicker && (
          <FloatingColorPicker
            buttonRef={highlightBtnRef}
            onSelectColor={(c) => execCmd('hiliteColor', c)}
            onClose={() => setShowHighlightPicker(false)}
          />
        )}

        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<h1>')}
          title="Heading 1"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<h2>')}
          title="Heading 2"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<h3>')}
          title="Heading 3"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<p>')}
          title="Paragraph"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-2"
        >
          P
        </button>

        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('insertUnorderedList')}
          title="Bullet List"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('insertOrderedList')}
          title="Numbered List"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<blockquote>')}
          title="Quote"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Quote className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<pre>')}
          title="Code Block"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <Code className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('justifyLeft')}
          title="Align Left"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('justifyCenter')}
          title="Align Center"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('justifyRight')}
          title="Align Right"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          title="Insert Link"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertTable}
          title="Insert Cell Table"
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        >
          <TableIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Contextual Table Control Bar (Visible when cursor is in Table) */}
      {activeTable && (
        <div className="flex items-center gap-2 px-6 py-1.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 animate-in fade-in duration-100 overflow-x-auto">
          <span className="flex items-center gap-1 mr-2 text-zinc-500">
            <TableIcon className="h-3.5 w-3.5" /> Table Controls:
          </span>
          <button onClick={() => handleAddRow(true)} className="px-2 py-1 bg-white dark:bg-zinc-900 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors">
            + Row Above
          </button>
          <button onClick={() => handleAddRow(false)} className="px-2 py-1 bg-white dark:bg-zinc-900 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors">
            + Row Below
          </button>
          <button onClick={handleDeleteRow} className="px-2 py-1 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors">
            - Delete Row
          </button>

          <div className="h-3 w-px bg-blue-300 dark:bg-blue-700 mx-1" />

          <button onClick={() => handleAddColumn(true)} className="px-2 py-1 bg-white dark:bg-zinc-900 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors">
            + Col Left
          </button>
          <button onClick={() => handleAddColumn(false)} className="px-2 py-1 bg-white dark:bg-zinc-900 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors">
            + Col Right
          </button>
          <button onClick={handleDeleteColumn} className="px-2 py-1 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors">
            - Delete Col
          </button>

          <div className="h-3 w-px bg-blue-300 dark:bg-blue-700 mx-1" />

          <button onClick={handleDeleteTable} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
            Delete Table
          </button>
        </div>
      )}

      {/* Editor Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-12 flex justify-center bg-zinc-100/50 dark:bg-zinc-950">
        <div className="w-full max-w-4xl min-h-[600px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl p-8 md:p-12 focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white transition-shadow">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleContentChange}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            className="prose dark:prose-invert max-w-none focus:outline-none min-h-[500px]"
            style={{ minHeight: '500px' }}
          />
        </div>
      </div>

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
          versionRef.current = updated.version;
          setTitle(updated.name);
          setContent(updated.document_content || '');
          if (editorRef.current) {
            editorRef.current.innerHTML = updated.document_content || '';
          }
          onItemUpdated(updated);
        }}
      />
    </div>
  );
};
