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
