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
  // Avoid timezone shifts by manual parsing
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
  
  // Fallback
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayStr = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayStr} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatTimeOnly = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
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
