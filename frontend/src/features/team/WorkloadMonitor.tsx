import React from 'react';
import { Clock, CheckCircle2, AlertTriangle, Layers, Zap } from 'lucide-react';
import type { MemberWorkload } from '../../types';

interface WorkloadMonitorProps {
  workload: MemberWorkload;
  compact?: boolean;
}

export const WorkloadMonitor: React.FC<WorkloadMonitorProps> = ({ workload, compact = false }) => {
  const getStatusColor = (status: MemberWorkload['workload_status']) => {
    switch (status) {
      case 'Underloaded':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Balanced':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'High':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Overloaded':
        return 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    }
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage < 70) return 'bg-blue-500';
    if (percentage <= 100) return 'bg-emerald-500';
    if (percentage <= 120) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (compact) {
    return (
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-zinc-500 font-medium">
          <span>Assigned: <strong className="text-zinc-900 dark:text-zinc-100">{workload.total_allocated_hours}h</strong></span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(workload.workload_status)}`}>
            {workload.workload_status} ({workload.workload_percentage}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getProgressBarColor(workload.workload_percentage)}`}
            style={{ width: `${Math.min(100, workload.workload_percentage)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Workload Monitor
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Capacity-based time allocation for assigned work.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${getStatusColor(workload.workload_status)}`}>
            {workload.workload_status}
          </span>
          <div className="text-right">
            <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
              {workload.workload_percentage}%
            </span>
            <span className="block text-[10px] text-zinc-400 font-medium">of {workload.capacity_hours}h capacity</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(workload.workload_percentage)}`}
            style={{ width: `${Math.min(100, workload.workload_percentage)}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="font-semibold">Assigned Work</span>
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {workload.total_allocated_hours}h
          </span>
          <span className="block text-[10px] text-zinc-400 font-medium">
            {workload.total_tasks_count} tasks assigned
          </span>
        </div>

        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold">Completed Work</span>
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {workload.completed_allocated_hours}h
          </span>
          <span className="block text-[10px] text-zinc-400 font-medium">
            {workload.completed_tasks_count} tasks done
          </span>
        </div>

        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Layers className="h-4 w-4 text-amber-500" />
            <span className="font-semibold">Remaining Work</span>
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {workload.remaining_allocated_hours}h
          </span>
          <span className="block text-[10px] text-zinc-400 font-medium">
            {workload.active_tasks_count} active tasks
          </span>
        </div>

        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <AlertTriangle className="h-4 w-4 text-purple-500" />
            <span className="font-semibold">Actual Tracked</span>
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {workload.total_tracked_hours}h
          </span>
          {workload.unestimated_task_count > 0 ? (
            <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
              {workload.unestimated_task_count} unestimated task{workload.unestimated_task_count === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="block text-[10px] text-zinc-400 font-medium">All tasks estimated</span>
          )}
        </div>
      </div>
    </div>
  );
};
