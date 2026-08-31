import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Shield, CheckCircle2,
  Folder, AlertCircle, RefreshCw, AlertTriangle
} from 'lucide-react';
import type { Task, MemberWorkload } from '../../types';
import { api } from '../../services/api';
import { WorkloadMonitor } from './WorkloadMonitor';
import { TaskTimer } from '../tasks/TaskTimer';
import { TaskTypeBadge } from '../tasks/TaskTypeBadge';
import { TaskFormModal } from '../tasks/TaskFormModal';

interface TeamMemberDetailResponse {
  summary: {
    id: string;
    name: string;
    role: 'ADMIN' | 'MEMBER';
    email: string;
    status: 'INVITED' | 'ACTIVE' | 'INACTIVE';
    is_active: boolean;
    deactivated_at: string | null;
    avatar_url: string | null;
    total_pending: number;
    due_today: number;
    completed_this_week: number;
    completed_this_month: number;
    health_score: number;
    health_status: string;
    overdue_tasks: number;
    on_time_completion_rate: number;
    late_completions: number;
  };
  workload_stats: MemberWorkload;
  workload: {
    today: Task[];
    tomorrow: Task[];
    overdue: Task[];
    upcoming: Task[];
    no_due_date: Task[];
    completed: Task[];
  };
  tasks: Task[];
}

export const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Task Filter state
  const [filter, setFilter] = useState<'ALL' | 'INCOMPLETED' | 'COMPLETED' | 'TODAY' | 'UPCOMING' | 'NO_DUE_DATE'>('ALL');
  
  // Selected task modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Fetch Member details and workload from backend endpoint
  const { data, isLoading, isError, error, refetch } = useQuery<TeamMemberDetailResponse>({
    queryKey: ['team-member', id],
    queryFn: async () => {
      if (!id) throw new Error('Member ID is required.');
      const response = await api.get(`/team/${id}/workload/`);
      return response.data;
    },
    enabled: Boolean(id),
  });

  const memberSummary = data?.summary;
  const workloadStats = data?.workload_stats;
  const tasks = data?.tasks || [];

  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (task.status === 'COMPLETED') {
        await api.post(`/tasks/${task.id}/reopen/`);
      } else {
        await api.post(`/tasks/${task.id}/complete/`);
      }
      queryClient.invalidateQueries({ queryKey: ['team-member', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update task completion status.');
    }
  };

  const isPastDue = (task: Task): boolean => {
    if (task.status === 'COMPLETED') return false;
    if (!task.due_date) return false;
    const due = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'INCOMPLETED') return task.status !== 'COMPLETED';
    if (filter === 'COMPLETED') return task.status === 'COMPLETED';
    if (filter === 'NO_DUE_DATE') return !task.due_date;
    
    if (filter === 'TODAY') {
      if (!task.due_date) return false;
      const due = new Date(task.due_date).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      return due === today;
    }

    if (filter === 'UPCOMING') {
      if (task.status === 'COMPLETED') return false;
      if (!task.due_date) return false;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      
      const dueParts = task.due_date.split('-');
      const dueDate = dueParts.length === 3
        ? new Date(parseInt(dueParts[0]), parseInt(dueParts[1]) - 1, parseInt(dueParts[2]))
        : new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      return dueDate >= tomorrowDate;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-zinc-400 gap-2 text-xs">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span>Loading team member details...</span>
      </div>
    );
  }

  if (isError || !memberSummary) {
    let errorMessage = 'Unable to load team member details right now. Please try again.';
    if (error) {
      const httpStatus = (error as any).response?.status;
      if (httpStatus === 404) {
        errorMessage = 'Team member could not be found.';
      } else if (httpStatus === 403) {
        errorMessage = 'You do not have permission to view this team member.';
      } else if (httpStatus === 401) {
        errorMessage = 'Your session has expired. Please sign in again.';
      } else if (httpStatus >= 500) {
        errorMessage = 'Server error occurred while loading team member details.';
      }
    }

    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/app/team')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Team
        </button>
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-medium">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-6 md:p-10">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/team')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Team
        </button>
      </div>

      {/* Member Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
              {memberSummary.avatar_url ? (
                <img src={memberSummary.avatar_url} alt={memberSummary.name} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                memberSummary.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {memberSummary.name}
                </h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${
                  memberSummary.role === 'ADMIN'
                    ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                }`}>
                  <Shield className="h-3 w-3" />
                  <span>{memberSummary.role === 'ADMIN' ? 'Admin / Manager' : 'Member'}</span>
                </span>
                {memberSummary.status === 'INACTIVE' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700">
                    Deactivated
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{memberSummary.email}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl min-w-[220px]">
            <div className="flex-1">
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">{tasks.length}</span>
              <span className="text-[11px] text-zinc-400 font-medium">Total Tasks</span>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-800">
              <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {tasks.filter(t => t.status === 'COMPLETED').length}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">Completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Workload Monitor */}
      {workloadStats && (
        <div className="mb-8">
          <WorkloadMonitor workload={workloadStats} />
        </div>
      )}

      {/* Task Filters & Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Assigned Tasks ({filteredTasks.length})
          </h2>

          {/* Filter Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'INCOMPLETED', label: 'Incomplete' },
              { key: 'COMPLETED', label: 'Completed' },
              { key: 'TODAY', label: 'Today' },
              { key: 'UPCOMING', label: 'Upcoming' },
              { key: 'NO_DUE_DATE', label: 'No Due Date' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filter === tab.key
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards List */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6">
            <CheckCircle2 className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No tasks match this filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map(task => {
              const pastDue = isPastDue(task);
              return (
                <div
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task);
                    setIsTaskModalOpen(true);
                  }}
                  className={`bg-white dark:bg-zinc-900 border rounded-2xl p-5 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                    pastDue
                      ? 'border-red-500/60 bg-red-50/20 dark:bg-red-950/10'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div>
                    {/* Past Due Warning Badge */}
                    {pastDue && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold mb-3">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>⚠ PAST DUE — Due date was {task.due_date}</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => handleToggleComplete(task, e)}
                          className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                            task.status === 'COMPLETED'
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-300 dark:border-zinc-700 hover:border-emerald-500'
                          }`}
                        >
                          {task.status === 'COMPLETED' && <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>
                        <div>
                          <h3 className={`font-bold text-sm text-zinc-900 dark:text-zinc-100 ${
                            task.status === 'COMPLETED' ? 'line-through text-zinc-400' : ''
                          }`}>
                            {task.name}
                          </h3>
                          {task.project_detail && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                              <Folder className="h-3 w-3 text-blue-500" />
                              <span>{task.project_detail.name}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Task Type Badge */}
                      <TaskTypeBadge
                        taskType={task.task_type_detail}
                        allocatedSeconds={task.allocated_seconds}
                      />
                    </div>

                    {task.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 pl-6">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Task Timer Component */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                    <TaskTimer
                      task={task}
                      onTimerChange={() => refetch()}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Edit/Detail Modal */}
      {selectedTask && (
        <TaskFormModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          initialData={selectedTask}
          onTaskSaved={() => refetch()}
        />
      )}
    </div>
  );
};
