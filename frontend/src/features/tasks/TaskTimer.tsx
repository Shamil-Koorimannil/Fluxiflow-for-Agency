import React, { useState, useEffect } from 'react';
import { Play, Pause, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Task } from '../../types';
import { api } from '../../services/api';

interface TaskTimerProps {
  task: Task;
  onTimerChange?: (updatedTask: Task) => void;
  compact?: boolean;
}

export const TaskTimer: React.FC<TaskTimerProps> = ({ task, onTimerChange, compact = false }) => {
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Ticker for running timer
  useEffect(() => {
    if (task.timer_status !== 'RUNNING') return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [task.timer_status]);

  // Calculate live elapsed seconds based on server timestamp
  const calculateCurrentElapsed = (): number => {
    if (task.status === 'COMPLETED' && task.actual_duration_seconds !== null && task.actual_duration_seconds !== undefined) {
      return task.actual_duration_seconds;
    }
    if (task.timer_status === 'RUNNING' && task.timer_started_at) {
      const startedAt = new Date(task.timer_started_at).getTime();
      const diffSecs = Math.max(0, Math.floor((now - startedAt) / 1000));
      return (task.elapsed_seconds || 0) + diffSecs;
    }
    return task.elapsed_seconds || 0;
  };

  const currentElapsed = calculateCurrentElapsed();
  const allocated = task.allocated_seconds || 0;
  const isOvertime = allocated > 0 && currentElapsed > allocated;
  const overtimeSeconds = isOvertime ? currentElapsed - allocated : 0;
  const remainingSeconds = allocated > 0 ? Math.max(0, allocated - currentElapsed) : 0;

  const formatDuration = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const formatReadable = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    if (hrs === 0 && (secs > 0 || parts.length === 0)) parts.push(`${secs}s`);
    return parts.join(' ');
  };

  const handleStartTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post<Task>(`/tasks/${task.id}/timer/start/`);
      if (onTimerChange) onTimerChange(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start timer.');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post<Task>(`/tasks/${task.id}/timer/pause/`);
      if (onTimerChange) onTimerChange(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to pause timer.');
    } finally {
      setLoading(false);
    }
  };

  // Completed Task Display
  if (task.status === 'COMPLETED') {
    return (
      <div className={`inline-flex items-center gap-2 rounded-xl text-xs font-semibold ${
        compact ? 'p-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' : 'px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
      }`}>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span>Actual: {formatReadable(currentElapsed)}</span>
        {allocated > 0 && (
          <span className="text-[11px] text-zinc-400">
            (Allocated: {formatReadable(allocated)})
          </span>
        )}
        {isOvertime && (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            + {formatReadable(overtimeSeconds)} overtime
          </span>
        )}
      </div>
    );
  }

  // Compact Mode (used in task tiles)
  if (compact) {
    return (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {task.timer_status === 'RUNNING' ? (
          <button
            onClick={handlePauseTimer}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-[11px] font-bold shadow-sm hover:bg-amber-600 transition-colors"
          >
            <Pause className="h-3 w-3 fill-current" />
            <span>{isOvertime ? `-${formatDuration(overtimeSeconds)}` : formatDuration(remainingSeconds)}</span>
          </button>
        ) : (
          <button
            onClick={handleStartTimer}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-[11px] font-semibold transition-colors"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>{currentElapsed > 0 ? formatDuration(currentElapsed) : (allocated > 0 ? formatReadable(allocated) : 'Start')}</span>
          </button>
        )}
      </div>
    );
  }

  // Expanded Mode (used in task detail modal / member view)
  return (
    <div className={`p-3 rounded-2xl border transition-all ${
      isOvertime
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
        : task.timer_status === 'RUNNING'
        ? 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className={`h-4 w-4 ${
            isOvertime ? 'text-amber-500 animate-pulse' : task.timer_status === 'RUNNING' ? 'text-blue-500 animate-spin' : 'text-zinc-400'
          }`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-tight">
                {isOvertime ? `-${formatDuration(overtimeSeconds)}` : formatDuration(remainingSeconds)}
              </span>
              {isOvertime && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 uppercase">
                  <AlertTriangle className="h-3 w-3" /> Overtime
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Allocated: {formatReadable(allocated || 0)} · Tracked: {formatReadable(currentElapsed)}
            </div>
          </div>
        </div>

        {/* Timer Control Button */}
        <div>
          {task.timer_status === 'RUNNING' ? (
            <button
              onClick={handlePauseTimer}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span>Pause Timer</span>
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{currentElapsed > 0 ? 'Resume Timer' : 'Start Timer'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
