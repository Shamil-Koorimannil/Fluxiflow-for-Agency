import React from 'react';
import { Tag } from 'lucide-react';
import type { TaskType } from '../../types';

interface TaskTypeBadgeProps {
  taskType?: TaskType | null;
  allocatedSeconds?: number | null;
}

export const TaskTypeBadge: React.FC<TaskTypeBadgeProps> = ({ taskType, allocatedSeconds }) => {
  if (!taskType && !allocatedSeconds) return null;

  const formatReadable = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  const name = taskType?.name;
  const secs = allocatedSeconds || taskType?.allocated_seconds || 0;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 text-[11px] font-medium border border-zinc-200/60 dark:border-zinc-700/60">
      <Tag className="h-3 w-3 text-zinc-400 shrink-0" />
      <span>
        {name ? `${name}${secs > 0 ? ` · ${formatReadable(secs)}` : ''}` : formatReadable(secs)}
      </span>
    </span>
  );
};
