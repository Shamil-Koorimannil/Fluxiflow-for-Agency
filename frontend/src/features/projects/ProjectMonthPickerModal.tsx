import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ProjectMonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number | null; // 0-based: 0 = Jan, 11 = Dec, null = All Months in Year
  onSelect: (year: number, month: number | null) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ProjectMonthPickerModal: React.FC<ProjectMonthPickerModalProps> = ({
  isOpen,
  onClose,
  selectedYear: initialYear,
  selectedMonth: initialMonth,
  onSelect,
}) => {
  const [viewYear, setViewYear] = useState<number>(initialYear || new Date().getFullYear());

  if (!isOpen) return null;

  const handleSelectMonth = (monthIdx: number) => {
    onSelect(viewYear, monthIdx);
    onClose();
  };

  const handleSelectAllMonthsInYear = () => {
    onSelect(viewYear, null);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-none z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-xs w-full p-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <h3 className="font-bold text-sm text-black dark:text-white">Filter by Date</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Year Navigation */}
        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60 rounded-lg p-1.5 mb-4 border border-zinc-100 dark:border-zinc-850">
          <button
            type="button"
            onClick={() => setViewYear(viewYear - 1)}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            title="Previous Year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-bold text-sm text-black dark:text-white tracking-wide">
            {viewYear}
          </span>
          <button
            type="button"
            onClick={() => setViewYear(viewYear + 1)}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            title="Next Year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* All Months in Year Option */}
        <button
          type="button"
          onClick={handleSelectAllMonthsInYear}
          className={`w-full py-1.5 px-3 mb-3 text-xs font-semibold rounded-lg transition-colors border text-center ${
            initialMonth === null && initialYear === viewYear
              ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
              : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          Entire Year {viewYear}
        </button>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((monthName, idx) => {
            const isSelected = initialYear === viewYear && initialMonth === idx;
            return (
              <button
                key={monthName}
                type="button"
                onClick={() => handleSelectMonth(idx)}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all border text-center ${
                  isSelected
                    ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                    : 'bg-white dark:bg-black text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white'
                }`}
              >
                {monthName.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
