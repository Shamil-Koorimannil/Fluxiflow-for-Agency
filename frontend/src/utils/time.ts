export const getBusinessTodayString = (tz?: string): string => {
  const targetTz = tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: targetTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

export const formatLateDuration = (minutes?: number): string => {
  if (!minutes || minutes <= 0) return '';
  const days = Math.floor(minutes / 1440);
  const remaining = minutes % 1440;
  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;

  if (days > 0) {
    if (hours > 0) {
      return `${days}d ${hours}h`;
    }
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  if (hours > 0) {
    if (mins > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  return `${mins} min`;
};

export const formatDateOnly = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const parts = typeof dateStr === 'string' ? dateStr.split('T')[0].split('-') : [];
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      const dayStr = String(day).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${dayStr} ${months[month]} ${year}`;
    }
  }
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayStr = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayStr} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatDateShort = (dateStr: string | null | undefined, tz?: string): string => {
  if (!dateStr) return '';
  const parts = typeof dateStr === 'string' ? dateStr.split('T')[0].split('-') : [];
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = months[month] || '';
  
  const todayStr = getBusinessTodayString(tz);
  const currentYear = parseInt(todayStr.split('-')[0], 10);
  
  if (year === currentYear) {
    return `${day} ${monthStr}`;
  }
  return `${day} ${monthStr} ${year}`;
};

export const formatTimeOnly = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hrStr = String(hours).padStart(2, '0');
    const minStr = String(minutes).padStart(2, '0');
    return `${hrStr}:${minStr} ${ampm}`;
  }
  return timeStr;
};

export const formatDateTime = (dateStr: string | null | undefined, timeStr: string | null | undefined): string => {
  const d = formatDateOnly(dateStr);
  const t = formatTimeOnly(timeStr);
  if (d && t) {
    return `${d}, ${t}`;
  }
  return d || t || '';
};

export type TaskDateStatusType = 'today' | 'tomorrow' | 'yesterday' | 'overdue' | 'future' | 'completed' | 'none';

export interface TaskDateStatusDetails {
  type: TaskDateStatusType;
  label: string;
  colorClass: string;
  dotColorClass: string;
  hexColor: string;
}

export const getTaskDateStatusDetails = (
  dateStr: string | null | undefined,
  timeStr?: string | null,
  isCompleted?: boolean,
  tz?: string
): TaskDateStatusDetails => {
  if (!dateStr) {
    return {
      type: 'none',
      label: 'No due date',
      colorClass: 'text-zinc-400 dark:text-zinc-550',
      dotColorClass: 'bg-zinc-400',
      hexColor: '#9CA3AF',
    };
  }

  if (isCompleted) {
    return {
      type: 'completed',
      label: formatDateShort(dateStr, tz),
      colorClass: 'text-zinc-400 dark:text-zinc-550',
      dotColorClass: 'bg-zinc-400',
      hexColor: '#9CA3AF',
    };
  }

  const parts = typeof dateStr === 'string' ? dateStr.split('T')[0].split('-') : [];
  if (parts.length !== 3) {
    return {
      type: 'none',
      label: dateStr,
      colorClass: 'text-zinc-400 dark:text-zinc-550',
      dotColorClass: 'bg-zinc-400',
      hexColor: '#9CA3AF',
    };
  }

  const targetDateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  const businessTodayStr = getBusinessTodayString(tz);
  
  const [bYear, bMonth, bDay] = businessTodayStr.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(bYear, bMonth - 1, bDay));

  const yesterdayUtc = new Date(todayUtc);
  yesterdayUtc.setUTCDate(todayUtc.getUTCDate() - 1);
  const yesterdayStr = yesterdayUtc.toISOString().slice(0, 10);

  const tomorrowUtc = new Date(todayUtc);
  tomorrowUtc.setUTCDate(todayUtc.getUTCDate() + 1);
  const tomorrowStr = tomorrowUtc.toISOString().slice(0, 10);

  const timeDisplay = timeStr ? ` · ${formatTimeOnly(timeStr)}` : '';

  if (targetDateStr === businessTodayStr) {
    return {
      type: 'today',
      label: `Today${timeDisplay}`,
      colorClass: 'text-green-600 dark:text-green-400 font-bold',
      dotColorClass: 'bg-green-600 dark:bg-green-400',
      hexColor: '#16A34A',
    };
  }

  if (targetDateStr === tomorrowStr) {
    return {
      type: 'tomorrow',
      label: `Tomorrow${timeDisplay}`,
      colorClass: 'text-amber-700 dark:text-amber-400 font-semibold',
      dotColorClass: 'bg-amber-600 dark:bg-amber-400',
      hexColor: '#A16207',
    };
  }

  if (targetDateStr === yesterdayStr) {
    return {
      type: 'yesterday',
      label: `Yesterday${timeDisplay}`,
      colorClass: 'text-red-600 dark:text-red-400 font-semibold',
      dotColorClass: 'bg-red-600 dark:bg-red-400',
      hexColor: '#DC2626',
    };
  }

  if (targetDateStr < yesterdayStr) {
    return {
      type: 'overdue',
      label: `${formatDateShort(targetDateStr, tz)}${timeDisplay}`,
      colorClass: 'text-red-600 dark:text-red-400 font-semibold',
      dotColorClass: 'bg-red-600 dark:bg-red-400',
      hexColor: '#DC2626',
    };
  }

  return {
    type: 'future',
    label: `${formatDateShort(targetDateStr, tz)}${timeDisplay}`,
    colorClass: 'text-zinc-500 dark:text-zinc-400 font-medium',
    dotColorClass: 'bg-zinc-400 dark:bg-zinc-500',
    hexColor: '#6B7280',
  };
};

export type TaskDateStatus = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'completed' | 'none';

export const getTaskDateStatus = (dateStr: string | null | undefined, isCompleted?: boolean, tz?: string): TaskDateStatus => {
  const details = getTaskDateStatusDetails(dateStr, undefined, isCompleted, tz);
  if (details.type === 'future') return 'upcoming';
  if (details.type === 'yesterday') return 'overdue';
  return details.type;
};

export const formatDueDate = (dateStr: string | null | undefined, isCompleted?: boolean, tz?: string): string => {
  if (!dateStr) return '';
  const details = getTaskDateStatusDetails(dateStr, undefined, isCompleted, tz);
  return details.label;
};

export const formatDueDateTime = (dateStr: string | null | undefined, timeStr: string | null | undefined, isCompleted?: boolean, tz?: string): string => {
  if (!dateStr) return formatTimeOnly(timeStr);
  const details = getTaskDateStatusDetails(dateStr, timeStr, isCompleted, tz);
  return details.label;
};

export const getDueDateStyleClass = (dateStr: string | null | undefined, statusOrCompleted?: string | boolean, tz?: string): string => {
  const isCompleted = typeof statusOrCompleted === 'boolean' ? statusOrCompleted : statusOrCompleted === 'COMPLETED';
  const details = getTaskDateStatusDetails(dateStr, undefined, isCompleted, tz);
  return details.colorClass;
};

export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};
