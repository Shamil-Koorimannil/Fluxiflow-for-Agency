import React, { useState } from 'react';
import { Popover, IconButton, Typography } from '@mui/material';
import { Calendar, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { formatDateOnly } from '../../utils/time';

interface DatePickerProps {
  value?: string; // "YYYY-MM-DD" or "" for single mode
  onChange?: (val: string) => void; // for single mode
  values?: string[]; // array of "YYYY-MM-DD" for multi mode
  onMultiChange?: (vals: string[]) => void; // for multi mode
  multiSelect?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  variant?: 'standard' | 'inline';
  isOverdue?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value = '',
  onChange,
  values = [],
  onMultiChange,
  multiSelect = false,
  placeholder = 'Select date',
  disabled = false,
  required = false,
  variant = 'standard',
  isOverdue = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const activeValues = multiSelect
    ? values
    : (value ? [value] : []);

  // Keep track of the month/year currently shown in the calendar view
  const [viewDate, setViewDate] = useState(() => {
    const firstVal = activeValues[0];
    if (firstVal) {
      const [y, m] = firstVal.split('-').map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
    const firstVal = activeValues[0];
    if (firstVal) {
      const [y, m] = firstVal.split('-').map(Number);
      if (y && m) setViewDate(new Date(y, m - 1, 1));
    } else {
      setViewDate(new Date());
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClearSingle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) onChange('');
  };

  const handleRemoveDate = (dateToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiSelect && onMultiChange) {
      const updated = values.filter((d) => d !== dateToRemove);
      onMultiChange(updated);
    }
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth(); // 0-11

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const selectDay = (day: number) => {
    const yStr = String(currentYear);
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    if (multiSelect) {
      if (onMultiChange) {
        let updated: string[];
        if (values.includes(dateStr)) {
          updated = values.filter((d) => d !== dateStr);
        } else {
          updated = [...values, dateStr];
        }
        // Deduplicate and sort chronologically
        const uniqueSorted = Array.from(new Set(updated)).sort();
        onMultiChange(uniqueSorted);
      }
      // Stay open in multi-select mode
    } else {
      if (onChange) onChange(dateStr);
      handleClose();
    }
  };

  const getDisplayValue = () => {
    if (!value) return '';
    return formatDateOnly(value);
  };

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const isSelected = (day: number) => {
    const yStr = String(currentYear);
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    if (multiSelect) {
      return values.includes(dateStr);
    }
    return value === dateStr;
  };

  return (
    <div className={variant === 'inline' ? 'inline-block' : 'relative w-full'}>
      {multiSelect ? (
        <div className="space-y-2">
          {/* Selected Date Badges List */}
          {values.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50">
              {values.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                >
                  <Calendar size={12} className="text-zinc-500 shrink-0" />
                  <span>{formatDateOnly(d)}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveDate(d, e)}
                      className="text-zinc-400 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Remove date"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Add Date Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleOpen}
            className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-left text-zinc-700 dark:text-zinc-300 hover:border-black dark:hover:border-white focus:outline-none disabled:opacity-50 transition-colors shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-zinc-400 shrink-0" />
              <span className="font-semibold">
                {values.length > 0 ? '+ Add More Dates' : '+ Select Task Dates'}
              </span>
            </div>
            <Plus size={14} className="text-zinc-400" />
          </button>
        </div>
      ) : (
        /* Single Date Mode */
        <button
          type="button"
          disabled={disabled}
          onClick={handleOpen}
          className={
            variant === 'inline'
              ? 'inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer select-none font-medium border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 px-1.5 py-0.5 rounded-md'
              : 'w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-left text-black dark:text-white hover:border-black dark:hover:border-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors'
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar
              size={variant === 'inline' ? 13 : 16}
              className={isOverdue ? 'text-red-500 shrink-0' : 'text-zinc-400 shrink-0'}
            />
            <span
              className={
                isOverdue
                  ? 'text-red-600 dark:text-red-400 font-bold truncate'
                  : getDisplayValue()
                  ? 'truncate'
                  : 'text-zinc-400 truncate'
              }
            >
              {getDisplayValue() || placeholder}
            </span>
          </div>
          {variant !== 'inline' && !required && value && !disabled && (
            <X
              size={14}
              onClick={handleClearSingle}
              className="text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer shrink-0 ml-1.5"
            />
          )}
        </button>
      )}

      {/* Calendar Popover */}
      <Popover
        open={Boolean(anchorEl)}
        sx={{ zIndex: 10002 }}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              mt: 0.5,
              border: '1px solid #e4e4e7',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)',
              width: 280,
              maxWidth: 'calc(100vw - 32px)',
            },
          },
        }}
      >
        <div className="text-black dark:text-white">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3">
            <IconButton size="small" onClick={handlePrevMonth} className="text-zinc-650 dark:text-zinc-400">
              <ChevronLeft size={16} />
            </IconButton>
            <Typography variant="subtitle2" className="font-bold text-sm">
              {monthNames[currentMonth]} {currentYear}
            </Typography>
            <IconButton size="small" onClick={handleNextMonth} className="text-zinc-650 dark:text-zinc-400">
              <ChevronRight size={16} />
            </IconButton>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-zinc-400 uppercase mb-1">
            {weekDays.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }
              const selected = isSelected(day);
              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all text-center ${
                    selected
                      ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer for Multi-Select Mode */}
          {multiSelect && (
            <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500">
                {values.length} date{values.length === 1 ? '' : 's'} selected
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
};
