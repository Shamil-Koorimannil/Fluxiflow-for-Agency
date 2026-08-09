import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { TeamWorkload, Task } from '../../types';
import { ArrowLeft, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

export const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: workloadData, isLoading, error } = useQuery<TeamWorkload>({
    queryKey: ['teamWorkload', id],
    queryFn: async () => {
      const response = await api.get(`/team/${id}/workload/`);
      return response.data;
    },
    enabled: !!id,
  });

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'border-l-4 border-red-500';
      case 'MEDIUM':
        return 'border-l-4 border-amber-500';
      case 'LOW':
        return 'border-l-4 border-blue-500';
      default:
        return 'border-l-4 border-zinc-200';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-6 w-24 bg-zinc-200 rounded"></div>
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-zinc-200 rounded"></div>
          <div className="h-4 w-32 bg-zinc-200 rounded"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-zinc-100 rounded-xl border border-zinc-200/50"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !workloadData) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Link to="/app/team" className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Team
        </Link>
        <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm font-medium text-red-600">
          Failed to load employee workload details.
        </div>
      </div>
    );
  }

  const { summary, workload } = workloadData;

  const renderTaskSection = (title: string, tasks: Task[], showOverdueAlert = false) => {
    if (tasks.length === 0) return null;
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          {title} ({tasks.length})
          {showOverdueAlert && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full lowercase normal-case">
              <AlertCircle className="h-3 w-3" /> overdue
            </span>
          )}
        </h3>
        
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-start md:items-center justify-between p-4 gap-3 transition-colors ${getPriorityColor(
                task.priority
              )}`}
            >
              <div className="flex items-start md:items-center gap-3">
                {task.status === 'COMPLETED' ? (
                  <CheckCircle2 className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5 md:mt-0" />
                ) : (
                  <Circle className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5 md:mt-0" />
                )}
                
                <div>
                  <h4 className={`text-sm font-semibold ${task.status === 'COMPLETED' ? 'line-through text-zinc-400' : 'text-black'}`}>
                    {task.name}
                  </h4>
                  {task.project_detail && (
                    <span className="text-[11px] text-zinc-400 font-medium mt-0.5 block">
                      {task.project_detail.name} {task.sub_project_detail && `· ${task.sub_project_detail.name}`}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <span className="text-xs text-zinc-500 font-medium">
                  {task.due_time ? `${task.due_date} · ${task.due_time.substring(0, 5)}` : task.due_date}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasNoTasks =
    workload.today.length === 0 &&
    workload.tomorrow.length === 0 &&
    workload.yesterday.length === 0 &&
    workload.pending.length === 0 &&
    workload.upcoming.length === 0 &&
    workload.completed.length === 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back button */}
      <div>
        <Link
          to="/app/team"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Team
        </Link>
      </div>

      {/* Header Profile Info */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-sm text-zinc-500">
          Workload overview and assigned task backlog for {summary.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}.
        </p>
      </div>

      {/* Workload Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Pending Tasks
          </span>
          <span className="block text-2xl font-bold text-black mt-1">
            {summary.total_pending}
          </span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Due Today
          </span>
          <span className="block text-2xl font-bold text-black mt-1">
            {summary.due_today}
          </span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Completed (Week)
          </span>
          <span className="block text-2xl font-bold text-black mt-1">
            {summary.completed_this_week}
          </span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Completed (Month)
          </span>
          <span className="block text-2xl font-bold text-black mt-1">
            {summary.completed_this_month}
          </span>
        </div>
      </div>

      {/* Grouped Workload Backlog */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
          <h3 className="font-semibold text-sm">No tasks assigned</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            This employee is not assigned to any project tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          {renderTaskSection('Today', workload.today)}
          {renderTaskSection('Tomorrow', workload.tomorrow)}
          {renderTaskSection('Yesterday', workload.yesterday)}
          {renderTaskSection('Pending / Overdue', workload.pending, true)}
          {renderTaskSection('Upcoming', workload.upcoming)}
          {renderTaskSection('Completed', workload.completed)}
        </div>
      )}
    </div>
  );
};
