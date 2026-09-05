import React from 'react';
import { CustomDropdown } from './CustomDropdown';

interface TimePickerProps {
  value: string; // "HH:MM" or ""
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, disabled }) => {
  // Parse value
  let selectedHour = '';
  let selectedMinute = '';
  let selectedAmPm = 'AM';

  if (value && value.includes(':')) {
    const parts = value.split(':');
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      
      if (!isNaN(h) && !isNaN(m)) {
        selectedAmPm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; // 0 becomes 12
        selectedHour = String(h).padStart(2, '0');
        selectedMinute = String(m).padStart(2, '0');
      }
    }
  }

  const handleHourChange = (hr: string) => {
    if (!hr) {
      onChange('');
      return;
    }
    const min = selectedMinute || '00';
    onChange(to24h(hr, min, selectedAmPm));
  };

  const handleMinuteChange = (min: string) => {
    if (!min) {
      onChange('');
      return;
    }
    const hr = selectedHour || '12';
    onChange(to24h(hr, min, selectedAmPm));
  };

  const handleAmPmChange = (ampm: string) => {
    const hr = selectedHour || '12';
    const min = selectedMinute || '00';
    onChange(to24h(hr, min, ampm));
  };

  const to24h = (hr: string, min: string, ampm: string) => {
    let h = parseInt(hr, 10);
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const hStr = String(h).padStart(2, '0');
    const mStr = String(min).padStart(2, '0');
    return `${hStr}:${mStr}`;
  };

  // Lists
  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="flex items-center gap-1">
      {/* Hour select */}
      <CustomDropdown
        size="sm"
        disabled={disabled}
        value={selectedHour}
        onChange={handleHourChange}
        placeholder="--"
        options={[
          { value: '', label: '--' },
          ...hoursList.map((hr) => ({ value: hr, label: hr })),
        ]}
      />

      <span className="text-zinc-400 dark:text-zinc-600 font-bold select-none">:</span>

      {/* Minute select */}
      <CustomDropdown
        size="sm"
        disabled={disabled}
        value={selectedMinute}
        onChange={handleMinuteChange}
        placeholder="--"
        options={[
          { value: '', label: '--' },
          ...minutesList.map((min) => ({ value: min, label: min })),
        ]}
      />

      {/* AM/PM select */}
      <CustomDropdown
        size="sm"
        disabled={disabled}
        value={selectedAmPm}
        onChange={handleAmPmChange}
        options={[
          { value: 'AM', label: 'AM' },
          { value: 'PM', label: 'PM' },
        ]}
      />

      {/* Clear/Reset shortcut helper if values are entered */}
      {(selectedHour || selectedMinute) && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('')}
          className="text-[10px] text-zinc-400 hover:text-red-500 font-semibold ml-1.5 transition-colors"
          title="Clear time"
        >
          Clear
        </button>
      )}
    </div>
  );
};

