import React, { useState } from 'react';
import { Popover, IconButton, Typography } from '@mui/material';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  required = false
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  
  // Keep track of the month/year currently shown in the calendar view
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
    // Initialize view calendar month to selected value or current month
    if (value) {
      const [y, m] = value.split('-').map(Number);
      setViewDate(new Date(y, m - 1, 1));
    } else {
      setViewDate(new Date());
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth(); // 0-11

  // Navigation helpers
  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Days in month logic
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0: Sunday, etc.

  const selectDay = (day: number) => {
    const yStr = String(currentYear);
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    onChange(`${yStr}-${mStr}-${dStr}`);
    handleClose();
  };

  // Format date for input display (e.g. "Aug 18, 2026")
  const getDisplayValue = () => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Generate days array (including padding for leading blank days)
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

  // Check if a specific day is the selected day
  const isSelected = (day: number) => {
    if (!value) return false;
    const [y, m, d] = value.split('-').map(Number);
    return y === currentYear && (m - 1) === currentMonth && d === day;
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-left text-black dark:text-white hover:border-black dark:hover:border-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={16} className="text-zinc-400 shrink-0" />
          <span className={getDisplayValue() ? 'truncate' : 'text-zinc-400 truncate'}>
            {getDisplayValue() || placeholder}
          </span>
        </div>
        {!required && value && !disabled && (
          <X
            size={14}
            onClick={handleClear}
            className="text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer shrink-0 ml-1.5"
          />
        )}
      </button>

      <Popover
        open={Boolean(anchorEl)}
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
            }
          }
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
            {weekDays.map(d => (
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
        </div>
      </Popover>
    </div>
  );
};
