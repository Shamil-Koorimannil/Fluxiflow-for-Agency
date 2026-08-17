import React from 'react';

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

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hr = e.target.value;
    if (!hr) {
      onChange('');
      return;
    }
    const min = selectedMinute || '00';
    onChange(to24h(hr, min, selectedAmPm));
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const min = e.target.value;
    if (!min) {
      onChange('');
      return;
    }
    const hr = selectedHour || '12';
    onChange(to24h(hr, min, selectedAmPm));
  };

  const handleAmPmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ampm = e.target.value;
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

  const selectClassName = "px-2.5 py-1.5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-all cursor-pointer";

  return (
    <div className="flex items-center gap-1">
      {/* Hour select */}
      <select
        value={selectedHour}
        onChange={handleHourChange}
        disabled={disabled}
        className={selectClassName}
      >
        <option value="">--</option>
        {hoursList.map((hr) => (
          <option key={hr} value={hr} className="bg-white dark:bg-black">
            {hr}
          </option>
        ))}
      </select>

      <span className="text-zinc-400 dark:text-zinc-600 font-bold select-none">:</span>

      {/* Minute select */}
      <select
        value={selectedMinute}
        onChange={handleMinuteChange}
        disabled={disabled}
        className={selectClassName}
      >
        <option value="">--</option>
        {minutesList.map((min) => (
          <option key={min} value={min} className="bg-white dark:bg-black">
            {min}
          </option>
        ))}
      </select>

      {/* AM/PM select */}
      <select
        value={selectedAmPm}
        onChange={handleAmPmChange}
        disabled={disabled}
        className={selectClassName}
      >
        <option value="AM" className="bg-white dark:bg-black">AM</option>
        <option value="PM" className="bg-white dark:bg-black">PM</option>
      </select>

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
