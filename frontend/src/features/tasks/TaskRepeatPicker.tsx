import React, { useState, useEffect } from 'react';
import { Popover } from '@mui/material';
import { Repeat, Check, AlertCircle } from 'lucide-react';
import type { RecurrenceConfig } from '../../types';
import { DatePicker } from '../../components/common/DatePicker';
import { CustomDropdown } from '../../components/common/CustomDropdown';

interface TaskRepeatPickerProps {
  value: RecurrenceConfig | null;
  onChange: (val: RecurrenceConfig | null) => void;
  disabled?: boolean;
  hasSubtasks?: boolean;
  startDate?: string | null; // "YYYY-MM-DD"
}

const WEEKDAYS = [
  { label: 'M', value: 'MO', full: 'Monday' },
  { label: 'T', value: 'TU', full: 'Tuesday' },
  { label: 'W', value: 'WE', full: 'Wednesday' },
  { label: 'T', value: 'TH', full: 'Thursday' },
  { label: 'F', value: 'FR', full: 'Friday' },
  { label: 'S', value: 'SA', full: 'Saturday' },
  { label: 'S', value: 'SU', full: 'Sunday' },
];

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function getDayNameFromDateStr(dateStr?: string | null): { weekdayCode: string; dayOfMonth: number; weekdayName: string } {
  if (!dateStr) return { weekdayCode: 'MO', dayOfMonth: 1, weekdayName: 'Monday' };
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return { weekdayCode: 'MO', dayOfMonth: 1, weekdayName: 'Monday' };
  const dateObj = new Date(y, m - 1, d);
  const wdayIndex = dateObj.getDay(); // 0 = Sun
  const isoIndex = wdayIndex === 0 ? 6 : wdayIndex - 1; // 0 = Mon, 6 = Sun
  const code = WEEKDAYS[isoIndex]?.value || 'MO';
  const name = WEEKDAYS[isoIndex]?.full || 'Monday';
  return { weekdayCode: code, dayOfMonth: d, weekdayName: name };
}

export const formatRecurrenceSummary = (config: RecurrenceConfig | null, startDate?: string | null): string => {
  if (!config || config.frequency === ('none' as any)) return 'Does not repeat';

  const freq = config.frequency.toLowerCase();
  const interval = config.interval || 1;
  const { weekdayName, dayOfMonth } = getDayNameFromDateStr(startDate);

  let mainStr = '';

  if (freq === 'day') {
    mainStr = interval === 1 ? 'Every day' : `Every ${interval} days`;
  } else if (freq === 'week') {
    if (interval === 1) {
      if (config.weekdays && config.weekdays.length > 0) {
        if (config.weekdays.length === 1) {
          const matched = WEEKDAYS.find((w) => w.value === config.weekdays![0].toUpperCase());
          mainStr = `Every ${matched ? matched.full : 'week'}`;
        } else {
          const shortNames = config.weekdays.map((w) => {
            const m = WEEKDAYS.find((item) => item.value === w.toUpperCase());
            return m ? m.full.substring(0, 3) : w;
          }).join(', ');
          mainStr = `Every ${shortNames}`;
        }
      } else {
        mainStr = `Every ${weekdayName}`;
      }
    } else {
      mainStr = `Every ${interval} weeks`;
    }
  } else if (freq === 'month') {
    const targetDay = config.month_day || dayOfMonth;
    mainStr = interval === 1
      ? `Every month on the ${getOrdinalSuffix(targetDay)}`
      : `Every ${interval} months`;
  } else if (freq === 'year') {
    mainStr = interval === 1 ? 'Every year' : `Every ${interval} years`;
  } else {
    mainStr = 'Custom repeat';
  }

  let endStr = '';
  if (config.end_type === 'on' && config.end_date) {
    const [y, m, d] = config.end_date.split('-').map(Number);
    if (y && m && d) {
      const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      endStr = ` · Ends ${formattedDate}`;
    }
  } else if (config.end_type === 'after' && config.occurrence_count) {
    endStr = ` · After ${config.occurrence_count} occurrence${config.occurrence_count > 1 ? 's' : ''}`;
  }

  return `${mainStr}${endStr}`;
};

export const TaskRepeatPicker: React.FC<TaskRepeatPickerProps> = ({
  value,
  onChange,
  disabled = false,
  hasSubtasks = false,
  startDate,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Custom configuration form state
  const [freq, setFreq] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [interval, setIntervalVal] = useState<number>(1);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [monthDay, setMonthDay] = useState<number>(15);
  const [endType, setEndType] = useState<'never' | 'on' | 'after'>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [occurrenceCount, setOccurrenceCount] = useState<number>(10);

  const { weekdayCode, dayOfMonth } = getDayNameFromDateStr(startDate);

  useEffect(() => {
    if (value && value.frequency !== ('none' as any)) {
      setFreq(value.frequency);
      setIntervalVal(value.interval || 1);
      setSelectedWeekdays(value.weekdays || [weekdayCode]);
      setMonthDay(value.month_day || dayOfMonth);
      setEndType(value.end_type || 'never');
      setEndDate(value.end_date || '');
      setOccurrenceCount(value.occurrence_count || 10);
    } else {
      setFreq('week');
      setIntervalVal(1);
      setSelectedWeekdays([weekdayCode]);
      setMonthDay(dayOfMonth);
      setEndType('never');
      setEndDate('');
      setOccurrenceCount(10);
    }
  }, [value, startDate, weekdayCode, dayOfMonth]);

  const handleClickTrigger = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || hasSubtasks) return;
    setAnchorEl(e.currentTarget);
    setIsCustomMode(false);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsCustomMode(false);
  };

  const handleSelectPreset = (preset: 'none' | 'day' | 'week' | 'month' | 'year' | 'custom') => {
    if (preset === 'none') {
      onChange(null);
      handleClose();
    } else if (preset === 'custom') {
      setIsCustomMode(true);
    } else {
      let config: RecurrenceConfig;
      if (preset === 'day') {
        config = { frequency: 'day', interval: 1, end_type: 'never' };
      } else if (preset === 'week') {
        config = { frequency: 'week', interval: 1, weekdays: [weekdayCode], end_type: 'never' };
      } else if (preset === 'month') {
        config = { frequency: 'month', interval: 1, month_day: dayOfMonth, end_type: 'never' };
      } else {
        config = { frequency: 'year', interval: 1, end_type: 'never' };
      }
      onChange(config);
      handleClose();
    }
  };

  const toggleWeekday = (code: string) => {
    if (selectedWeekdays.includes(code)) {
      if (selectedWeekdays.length > 1) {
        setSelectedWeekdays(selectedWeekdays.filter((w) => w !== code));
      }
    } else {
      setSelectedWeekdays([...selectedWeekdays, code]);
    }
  };

  const handleSaveCustom = () => {
    const config: RecurrenceConfig = {
      frequency: freq,
      interval: Math.max(1, interval),
      end_type: endType,
    };

    if (freq === 'week') {
      config.weekdays = selectedWeekdays.length > 0 ? selectedWeekdays : [weekdayCode];
    } else if (freq === 'month') {
      config.month_day = monthDay;
    }

    if (endType === 'on') {
      config.end_date = endDate || null;
    } else if (endType === 'after') {
      config.occurrence_count = Math.max(1, occurrenceCount);
    }

    onChange(config);
    handleClose();
  };

  const summaryText = formatRecurrenceSummary(value, startDate);

  return (
    <div>
      <button
        type="button"
        disabled={disabled || hasSubtasks}
        onClick={handleClickTrigger}
        className={`w-full px-3 py-2 bg-white dark:bg-zinc-950 border rounded-xl text-xs flex items-center justify-between transition-colors focus:outline-none ${
          hasSubtasks
            ? 'border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 opacity-70 cursor-not-allowed'
            : value
            ? 'border-blue-500/50 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20'
            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
        } disabled:opacity-50`}
      >
        <span className="flex items-center gap-2 font-medium truncate">
          <Repeat className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
          <span className="truncate">{hasSubtasks ? 'Tasks with subtasks cannot be repeated' : summaryText}</span>
        </span>
        {hasSubtasks && <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 ml-1" />}
      </button>

      <Popover
        open={Boolean(anchorEl)}
        sx={{ zIndex: 10002 }}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'transparent',
              boxShadow: 'none',
              overflow: 'visible',
              marginTop: '4px',
            },
          },
        }}
      >
        <div className="w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 text-xs text-zinc-900 dark:text-zinc-100">
          {hasSubtasks ? (
            <div className="p-3 text-center text-amber-600 dark:text-amber-400 font-medium">
              Tasks with subtasks cannot be repeated.
            </div>
          ) : !isCustomMode ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">
                Recurrence
              </div>
              <button
                type="button"
                onClick={() => handleSelectPreset('none')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between font-medium"
              >
                <span>Does not repeat</span>
                {(!value || value.frequency === ('none' as any)) && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('day')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between font-medium"
              >
                <span>Every day</span>
                {value?.frequency === 'day' && value.interval === 1 && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('week')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between font-medium"
              >
                <span>Every week</span>
                {value?.frequency === 'week' && value.interval === 1 && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('month')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between font-medium"
              >
                <span>Every month</span>
                {value?.frequency === 'month' && value.interval === 1 && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('year')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between font-medium"
              >
                <span>Every year</span>
                {value?.frequency === 'year' && value.interval === 1 && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>

              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('custom')}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between font-semibold text-blue-600 dark:text-blue-400"
                >
                  <span>Custom...</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                Custom recurrence
              </div>

              {/* Repeat Every N Unit */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Repeat every
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={interval}
                    onChange={(e) => setIntervalVal(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center font-medium focus:outline-none focus:border-blue-500"
                  />
                  <CustomDropdown<'day' | 'week' | 'month' | 'year'>
                    value={freq}
                    onChange={(val) => setFreq(val)}
                    size="sm"
                    className="flex-1"
                    options={[
                      { value: 'day', label: interval === 1 ? 'Day' : 'Days' },
                      { value: 'week', label: interval === 1 ? 'Week' : 'Weeks' },
                      { value: 'month', label: interval === 1 ? 'Month' : 'Months' },
                      { value: 'year', label: interval === 1 ? 'Year' : 'Years' },
                    ]}
                  />
                </div>
              </div>

              {/* Weekly Weekday Pickers */}
              {freq === 'week' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Repeat on
                  </label>
                  <div className="flex items-center justify-between gap-1">
                    {WEEKDAYS.map((w) => {
                      const isSelected = selectedWeekdays.includes(w.value);
                      return (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => toggleWeekday(w.value)}
                          className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly Day Picker */}
              {freq === 'month' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Day of month
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">On the</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={monthDay}
                      onChange={(e) => setMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-16 px-2 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center font-medium"
                    />
                    <span className="text-zinc-500">{getOrdinalSuffix(monthDay)} day</span>
                  </div>
                </div>
              )}

              {/* End Conditions */}
              <div className="space-y-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Ends
                </label>

                {/* Never */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="endType"
                    checked={endType === 'never'}
                    onChange={() => setEndType('never')}
                    className="accent-blue-600"
                  />
                  <span>Never</span>
                </label>

                {/* On Date */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      checked={endType === 'on'}
                      onChange={() => setEndType('on')}
                      className="accent-blue-600"
                    />
                    <span>On date</span>
                  </label>
                  {endType === 'on' && (
                    <div className="pl-6">
                      <DatePicker
                        value={endDate}
                        onChange={(d) => setEndDate(d)}
                        placeholder="Select end date"
                      />
                    </div>
                  )}
                </div>

                {/* After Occurrences */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      checked={endType === 'after'}
                      onChange={() => setEndType('after')}
                      className="accent-blue-600"
                    />
                    <span>After</span>
                  </label>
                  {endType === 'after' && (
                    <div className="pl-6 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={occurrenceCount}
                        onChange={(e) => setOccurrenceCount(parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center font-medium"
                      />
                      <span className="text-zinc-500">occurrences</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
};
