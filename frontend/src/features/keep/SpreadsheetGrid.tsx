import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  Plus, Palette, Type
} from 'lucide-react';
import type { KeepSheet } from '../../types';

interface SpreadsheetGridProps {
  activeSheet: KeepSheet;
  onChangeSheetData: (updatedSheet: KeepSheet) => void;
  readOnly?: boolean;
}

const PRESET_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#6366f1', '#a855f7', '#ec4899', '#ffffff', 'transparent'
];

// Helper to parse cell key 'B2' into column string, row number, and 0-based column index
const parseCellKey = (cellKey: string) => {
  const match = cellKey.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { col: 'A', row: 1, colIdx: 0 };
  const col = match[1];
  const row = parseInt(match[2], 10);
  let colIdx = 0;
  for (let i = 0; i < col.length; i++) {
    colIdx = colIdx * 26 + (col.charCodeAt(i) - 65 + 1);
  }
  return { col, row, colIdx: colIdx - 1 };
};

// Helper to get all cell keys in rectangular range between cellA and cellB
const getCellsInRange = (cellA: string, cellB: string, columns: string[]): string[] => {
  const pA = parseCellKey(cellA);
  const pB = parseCellKey(cellB);

  const minRow = Math.min(pA.row, pB.row);
  const maxRow = Math.max(pA.row, pB.row);
  const minCol = Math.min(pA.colIdx, pB.colIdx);
  const maxCol = Math.max(pA.colIdx, pB.colIdx);

  const keys: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (c < columns.length) {
        keys.push(`${columns[c]}${r}`);
      }
    }
  }
  return keys;
};

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

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  activeSheet,
  onChangeSheetData,
  readOnly = false
}) => {
  // Selection Architecture State
  const [anchorCell, setAnchorCell] = useState<string>('A1');
  const [activeCell, setActiveCell] = useState<string>('A1');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [formulaValue, setFormulaValue] = useState<string>('');
  const [numRows, setNumRows] = useState<number>(50);
  const [numCols, setNumCols] = useState<number>(20);

  // Color Pickers Anchored Refs
  const textColorBtnRef = useRef<HTMLButtonElement | null>(null);
  const bgColorBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  const cellInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Convert 0-indexed column index to name (0 -> A, 25 -> Z, 26 -> AA)
  const colIndexToName = (index: number): string => {
    let name = '';
    let i = index;
    while (i >= 0) {
      name = String.fromCharCode((i % 26) + 65) + name;
      i = Math.floor(i / 26) - 1;
    }
    return name;
  };

  const columns = Array.from({ length: numCols }, (_, i) => colIndexToName(i));
  const rows = Array.from({ length: numRows }, (_, i) => i + 1);

  // Range calculation
  const selectedCellKeys = getCellsInRange(anchorCell, activeCell, columns);
  const selectedCellSet = new Set(selectedCellKeys);

  // Sync formula bar when active cell changes
  useEffect(() => {
    const cellData = activeSheet.cells[activeCell];
    if (cellData) {
      setFormulaValue(cellData.formula || cellData.value || '');
    } else {
      setFormulaValue('');
    }
  }, [activeCell, activeSheet]);

  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [editingCell]);

  // Global mouseup event to terminate dragging
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const updateCell = useCallback((cellId: string, value: string, formula?: string) => {
    if (readOnly) return;
    const newCells = { ...activeSheet.cells };
    const currentFormat = newCells[cellId]?.format || {};

    if (!value && !formula) {
      delete newCells[cellId];
    } else {
      newCells[cellId] = {
        value: value,
        formula: formula || (value.startsWith('=') ? value : ''),
        format: currentFormat
      };
    }

    onChangeSheetData({
      ...activeSheet,
      cells: newCells
    });
  }, [activeSheet, onChangeSheetData, readOnly]);

  // Apply format to selected range, row, or column
  const applyFormatToSelection = (field: string, val: any) => {
    if (readOnly) return;
    const newCells = { ...activeSheet.cells };

    let targetCellKeys: string[] = selectedCellKeys;

    if (selectedRow !== null) {
      targetCellKeys = columns.map(c => `${c}${selectedRow}`);
    } else if (selectedCol !== null) {
      targetCellKeys = rows.map(r => `${selectedCol}${r}`);
    }

    targetCellKeys.forEach(cellKey => {
      const cellData = newCells[cellKey] || { value: '' };
      const currentFormat = cellData.format || {};
      const newFormat = {
        ...currentFormat,
        [field]: val === 'transparent' ? undefined : (currentFormat[field as keyof typeof currentFormat] === val ? undefined : val)
      };
      newCells[cellKey] = {
        ...cellData,
        format: newFormat
      };
    });

    onChangeSheetData({
      ...activeSheet,
      cells: newCells
    });
  };

  // Keyboard navigation & Copy/Paste handling
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (editingCell) return; // Allow normal input when typing inside cell

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Copy (Ctrl+C)
      if (modifier && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const pAnchor = parseCellKey(anchorCell);
        const pActive = parseCellKey(activeCell);
        const minR = Math.min(pAnchor.row, pActive.row);
        const maxR = Math.max(pAnchor.row, pActive.row);
        const minC = Math.min(pAnchor.colIdx, pActive.colIdx);
        const maxC = Math.max(pAnchor.colIdx, pActive.colIdx);

        const rowStrings: string[] = [];
        for (let r = minR; r <= maxR; r++) {
          const rowVals: string[] = [];
          for (let c = minC; c <= maxC; c++) {
            const k = `${columns[c]}${r}`;
            const cd = activeSheet.cells[k];
            rowVals.push(cd?.formula || cd?.value || '');
          }
          rowStrings.push(rowVals.join('\t'));
        }
        const tsvText = rowStrings.join('\n');
        await navigator.clipboard.writeText(tsvText);
        return;
      }

      // Paste (Ctrl+V)
      if (modifier && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        try {
          const text = await navigator.clipboard.readText();
          if (!text) return;

          const lines = text.split(/\r?\n/).filter(line => line.length > 0);
          const pActive = parseCellKey(activeCell);
          const newCells = { ...activeSheet.cells };

          lines.forEach((line, rOffset) => {
            const colsData = line.split('\t');
            colsData.forEach((val, cOffset) => {
              const targetColIdx = pActive.colIdx + cOffset;
              const targetRow = pActive.row + rOffset;
              if (targetColIdx < columns.length && targetRow <= numRows) {
                const targetKey = `${columns[targetColIdx]}${targetRow}`;
                const currFmt = newCells[targetKey]?.format || {};
                newCells[targetKey] = {
                  value: val.startsWith('=') ? '' : val,
                  formula: val.startsWith('=') ? val : '',
                  format: currFmt
                };
              }
            });
          });

          onChangeSheetData({ ...activeSheet, cells: newCells });
        } catch (err) {
          console.error('Clipboard paste failed:', err);
        }
        return;
      }

      // Delete / Backspace -> Clear Range Content
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const newCells = { ...activeSheet.cells };
        selectedCellKeys.forEach(k => {
          delete newCells[k];
        });
        onChangeSheetData({ ...activeSheet, cells: newCells });
        return;
      }

      // Arrow Key Navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const pActive = parseCellKey(activeCell);
        let newR = pActive.row;
        let newC = pActive.colIdx;

        if (e.key === 'ArrowUp') newR = Math.max(1, pActive.row - 1);
        if (e.key === 'ArrowDown') newR = Math.min(numRows, pActive.row + 1);
        if (e.key === 'ArrowLeft') newC = Math.max(0, pActive.colIdx - 1);
        if (e.key === 'ArrowRight') newC = Math.min(columns.length - 1, pActive.colIdx + 1);

        const newTargetKey = `${columns[newC]}${newR}`;
        setActiveCell(newTargetKey);
        if (!e.shiftKey) {
          setAnchorCell(newTargetKey);
        }
        setSelectedRow(null);
        setSelectedCol(null);
        return;
      }

      // Enter or F2 -> Start editing active cell with existing value
      if (!readOnly && (e.key === 'Enter' || e.key === 'F2')) {
        e.preventDefault();
        const curCell = activeSheet.cells[activeCell];
        setEditingValue(curCell?.formula || curCell?.value || '');
        setEditingCell(activeCell);
        return;
      }

      // Typing printable character -> Start editing active cell directly with typed char
      if (!readOnly && !modifier && e.key.length === 1 && !['Tab', 'Escape'].includes(e.key)) {
        setEditingValue(e.key);
        setEditingCell(activeCell);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, anchorCell, activeSheet, columns, numRows, selectedCellKeys, editingCell, readOnly, onChangeSheetData]);

  // Cell Interaction Handlers
  const handleCellMouseDown = (cellId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only

    if (e.shiftKey) {
      setActiveCell(cellId);
    } else {
      setAnchorCell(cellId);
      setActiveCell(cellId);
      setIsDragging(true);
    }

    setSelectedRow(null);
    setSelectedCol(null);
  };

  const handleCellDoubleClick = (cellId: string) => {
    if (readOnly) return;
    const curCell = activeSheet.cells[cellId];
    setEditingValue(curCell?.formula || curCell?.value || '');
    setEditingCell(cellId);
  };

  const handleCellMouseEnter = (cellId: string) => {
    if (isDragging) {
      setActiveCell(cellId);
    }
  };

  // Row / Col Header Selection
  const handleRowHeaderClick = (rowNum: number) => {
    setSelectedRow(rowNum);
    setSelectedCol(null);
    const startKey = `A${rowNum}`;
    const endKey = `${columns[columns.length - 1]}${rowNum}`;
    setAnchorCell(startKey);
    setActiveCell(endKey);
    setEditingCell(null);
  };

  const handleColHeaderClick = (colName: string) => {
    setSelectedCol(colName);
    setSelectedRow(null);
    const startKey = `${colName}1`;
    const endKey = `${colName}${numRows}`;
    setAnchorCell(startKey);
    setActiveCell(endKey);
    setEditingCell(null);
  };

  const handleFormulaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCell(activeCell, formulaValue);
    setEditingCell(null);
  };

  const addRow = () => setNumRows(prev => prev + 10);
  const addCol = () => setNumCols(prev => prev + 5);

  const activeCellData = activeSheet.cells[activeCell];
  const activeFormat = activeCellData?.format || {};

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-xs select-none">
      {/* Formatting & Controls Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {/* Selected Cell/Range Identifier */}
          <div className="font-bold text-zinc-800 dark:text-zinc-200 px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded min-w-[60px] text-center font-mono">
            {selectedRow !== null
              ? `Row ${selectedRow}`
              : selectedCol !== null
              ? `Col ${selectedCol}`
              : anchorCell === activeCell
              ? activeCell
              : `${anchorCell}:${activeCell}`}
          </div>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Formula Bar Input */}
          <form onSubmit={handleFormulaSubmit} className="flex-1 flex items-center gap-1 min-w-[200px]">
            <span className="font-serif italic font-bold text-zinc-400">fx</span>
            <input
              type="text"
              value={formulaValue}
              onChange={(e) => setFormulaValue(e.target.value)}
              onBlur={() => updateCell(activeCell, formulaValue)}
              placeholder="Enter value or formula (e.g. =A1+B1)"
              className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded text-xs outline-none focus:border-black dark:focus:border-white font-mono"
            />
          </form>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Text Formatting Toolbar Buttons */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatToSelection('bold', true)}
            className={`p-1.5 rounded transition-colors ${activeFormat.bold ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatToSelection('italic', true)}
            className={`p-1.5 rounded transition-colors ${activeFormat.italic ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatToSelection('underline', true)}
            className={`p-1.5 rounded transition-colors ${activeFormat.underline ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
            title="Underline"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatToSelection('strikethrough', true)}
            className={`p-1.5 rounded transition-colors ${activeFormat.strikethrough ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Text Color Picker Button */}
          <button
            ref={textColorBtnRef}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowBgColorPicker(false); }}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center gap-1"
            title="Text Color"
          >
            <Type className="h-3.5 w-3.5" style={{ color: activeFormat.color || 'currentColor' }} />
          </button>

          {/* Background Fill Color Picker Button */}
          <button
            ref={bgColorBtnRef}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setShowBgColorPicker(!showBgColorPicker); setShowTextColorPicker(false); }}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center gap-1"
            title="Fill Color"
          >
            <Palette className="h-3.5 w-3.5" style={{ color: activeFormat.bgColor || 'currentColor' }} />
          </button>

          {/* Floating Color Pickers */}
          {showTextColorPicker && (
            <FloatingColorPicker
              buttonRef={textColorBtnRef}
              onSelectColor={(c) => applyFormatToSelection('color', c)}
              onClose={() => setShowTextColorPicker(false)}
            />
          )}

          {showBgColorPicker && (
            <FloatingColorPicker
              buttonRef={bgColorBtnRef}
              onSelectColor={(c) => applyFormatToSelection('bgColor', c)}
              onClose={() => setShowBgColorPicker(false)}
            />
          )}

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Alignment Controls */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatToSelection('align', 'left')}
            className={`p-1.5 rounded transition-colors ${activeFormat.align === 'left' ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
            title="Align Left"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatToSelection('align', 'center')}
            className={`p-1.5 rounded transition-colors ${activeFormat.align === 'center' ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
            title="Align Center"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatToSelection('align', 'right')}
            className={`p-1.5 rounded transition-colors ${activeFormat.align === 'right' ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
            title="Align Right"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Row/Col Add Buttons */}
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            <Plus className="h-3 w-3" /> +10 Rows
          </button>
          <button
            onClick={addCol}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            <Plus className="h-3 w-3" /> +5 Cols
          </button>
        </div>
      )}

      {/* Grid Table Container */}
      <div ref={gridContainerRef} className="flex-1 overflow-auto relative">
        <table className="border-collapse table-fixed w-full text-zinc-900 dark:text-zinc-100 select-none">
          <thead>
            <tr>
              <th className="w-12 h-7 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 sticky top-0 left-0 z-30 text-center font-medium text-zinc-400" />
              {columns.map(col => {
                const isColSelected = selectedCol === col;
                return (
                  <th
                    key={col}
                    onClick={() => handleColHeaderClick(col)}
                    className={`w-28 h-7 border border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 font-semibold text-center cursor-pointer transition-colors ${
                      isColSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isRowSelected = selectedRow === row;
              return (
                <tr key={row}>
                  {/* Row Header Number */}
                  <td
                    onClick={() => handleRowHeaderClick(row)}
                    className={`w-12 h-7 border border-zinc-200 dark:border-zinc-800 sticky left-0 z-10 font-semibold text-center cursor-pointer transition-colors ${
                      isRowSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {row}
                  </td>

                  {/* Columns */}
                  {columns.map(col => {
                    const cellId = `${col}${row}`;
                    const cell = activeSheet.cells[cellId];
                    const isAnchor = anchorCell === cellId;
                    const isActive = activeCell === cellId;
                    const isInRange = selectedCellSet.has(cellId);
                    const isColHighlighted = selectedCol === col;
                    const isRowHighlighted = selectedRow === row;
                    const isEditing = editingCell === cellId;
                    const fmt = cell?.format || {};

                    return (
                      <td
                        key={cellId}
                        onMouseDown={(e) => handleCellMouseDown(cellId, e)}
                        onDoubleClick={() => handleCellDoubleClick(cellId)}
                        onMouseEnter={() => handleCellMouseEnter(cellId)}
                        style={{
                          fontWeight: fmt.bold ? 'bold' : 'normal',
                          fontStyle: fmt.italic ? 'italic' : 'normal',
                          textDecoration: fmt.underline ? 'underline' : fmt.strikethrough ? 'line-through' : 'none',
                          textAlign: fmt.align || 'left',
                          color: fmt.color,
                          backgroundColor: (isInRange || isColHighlighted || isRowHighlighted)
                            ? (isAnchor ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)')
                            : fmt.bgColor
                        }}
                        className={`w-28 h-7 border border-zinc-200 dark:border-zinc-800 px-1.5 truncate relative ${
                          isActive ? 'outline outline-2 outline-blue-600 z-10' : ''
                        }`}
                      >
                        {isEditing ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => {
                              updateCell(cellId, editingValue);
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                updateCell(cellId, editingValue);
                                setEditingCell(null);
                                const p = parseCellKey(cellId);
                                const nextRow = Math.min(numRows, p.row + 1);
                                const nextKey = `${columns[p.colIdx]}${nextRow}`;
                                setActiveCell(nextKey);
                                setAnchorCell(nextKey);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingCell(null);
                              }
                            }}
                            className="w-full h-full bg-white dark:bg-zinc-900 outline-none text-xs px-1 font-mono"
                          />
                        ) : (
                          <span>{cell?.value || ''}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
