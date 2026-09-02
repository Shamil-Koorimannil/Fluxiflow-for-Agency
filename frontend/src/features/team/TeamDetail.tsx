import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Shield, CheckCircle2,
  Folder, AlertCircle, RefreshCw, Heart, Calendar
} from 'lucide-react';
import type { Task, MemberWorkload } from '../../types';
import { api } from '../../services/api';
import { WorkloadMonitor } from './WorkloadMonitor';
import { TaskTimer } from '../tasks/TaskTimer';
import { TaskTypeBadge } from '../tasks/TaskTypeBadge';
import { TaskDatePicker } from '../tasks/TaskDatePicker';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { useTaskDragSelect } from '../../hooks/useTaskDragSelect';
import { SelectionToolbar } from '../../components/common/SelectionToolbar';
import { getLocalDateString, formatDateOnly } from '../../utils/time';

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

export interface TaskDateGroup {
  dateKey: string | null;
  formattedDate: string;
  isPassed: boolean;
  isToday: boolean;
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

  const dragSelect = useTaskDragSelect({
    visibleTasks: tasks,
    onOpenDetail: (taskId) => {
      const targetTask = tasks.find((t) => t.id === taskId);
      if (targetTask) {
        setSelectedTask(targetTask);
        setIsTaskModalOpen(true);
      }
    },
  });

  const invalidateMemberQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['team-member', id] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['team'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    refetch();
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const response = await api.post('/tasks/bulk-delete/', { task_ids: taskIds });
      return response.data;
    },
    onSuccess: () => {
      invalidateMemberQueries();
      dragSelect.clearSelection();
    },
  });

  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (task.status === 'COMPLETED') {
        await api.post(`/tasks/${task.id}/reopen/`);
      } else {
        await api.post(`/tasks/${task.id}/complete/`);
      }
      invalidateMemberQueries();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update task completion status.');
    }
  };

  const todayStr = getLocalDateString(new Date());

  const incompleteTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'COMPLETED');
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'COMPLETED');
  }, [tasks]);

  // Build Chronological Datewise Groups for Incomplete Tasks
  const incompleteDateGroups = useMemo((): TaskDateGroup[] => {
    const groupsMap = new Map<string | null, Task[]>();

    incompleteTasks.forEach((task) => {
      let datesToAssign: (string | null)[] = [];
      if (task.dates && task.dates.length > 0) {
        datesToAssign = Array.from(new Set(task.dates));
      } else if (task.due_date) {
        datesToAssign = [task.due_date];
      } else {
        datesToAssign = [null];
      }

      datesToAssign.forEach((dKey) => {
        const key = dKey ? dKey.split('T')[0] : null;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, []);
        }
        groupsMap.get(key)!.push(task);
      });
    });

    const dateKeys = Array.from(groupsMap.keys());

    // Passed dates -> Today -> Upcoming dates -> No Due Date
    const sortedKeys = dateKeys.sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((key) => {
      const isToday = key === todayStr;
      const isPassed = Boolean(key && key < todayStr);

      let formattedDate = 'No Due Date';
      if (key) {
        const formatted = formatDateOnly(key);
        formattedDate = isToday ? `${formatted} — Today` : formatted;
      }

      return {
        dateKey: key,
        formattedDate,
        isPassed,
        isToday,
        tasks: groupsMap.get(key) || [],
      };
    });
  }, [incompleteTasks, todayStr]);

  // Filtered Date Groups according to active filter tab
  const filteredDateGroups = useMemo(() => {
    if (filter === 'TODAY') {
      return incompleteDateGroups.filter((g) => g.isToday);
    }
    if (filter === 'UPCOMING') {
      return incompleteDateGroups.filter((g) => g.dateKey && g.dateKey > todayStr);
    }
    if (filter === 'NO_DUE_DATE') {
      return incompleteDateGroups.filter((g) => g.dateKey === null);
    }
    return incompleteDateGroups;
  }, [incompleteDateGroups, filter, todayStr]);

  const getHealthColor = (score?: number, status?: string) => {
    if (score === undefined || score === null || status === 'no_data') {
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700';
    }
    if (score >= 90) return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    if (score >= 80) return 'bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    if (score >= 40) return 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    return 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
  };

  const getHealthBarColor = (score?: number) => {
    if (score === undefined || score === null) return 'bg-zinc-400';
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

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

  const renderTaskTile = (task: Task, isPassedDate = false, dateKey: string | null = null) => {
    const isSelected = dragSelect.isSelected(task.id);
    return (
      <div
        key={`${dateKey || 'nodate'}-${task.id}`}
        data-task-id={task.id}
        onPointerDown={(e) => dragSelect.handlePointerDown(e, task.id)}
        onPointerMove={dragSelect.handlePointerMove}
        onPointerUp={dragSelect.handlePointerUpOrCancel}
        onPointerCancel={dragSelect.handlePointerUpOrCancel}
        onClick={(e) => dragSelect.handleCardClick(e, task.id)}
        className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
          isSelected
            ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/30 dark:bg-blue-950/30 shadow-md'
            : ''
        }`}
      >
        <div>
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

            <div className="flex items-center gap-2">
              {/* Selection checkmark */}
              {(dragSelect.isSelectionActive || isSelected) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    dragSelect.toggleSelect(task.id, e.shiftKey);
                  }}
                  className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-xs'
                      : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:border-blue-400'
                  }`}
                >
                  {isSelected && <span className="text-xs">✓</span>}
                </div>
              )}

              {/* Task Type Badge */}
              <TaskTypeBadge
                taskType={task.task_type_detail}
                allocatedSeconds={task.allocated_seconds}
              />
            </div>
          </div>

          {task.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 pl-6 mb-2">
              {task.description}
            </p>
          )}

          {/* Task Due Date Display */}
          <div className="pl-6 flex items-center gap-1.5 text-xs font-semibold">
            {isPassedDate && task.status !== 'COMPLETED' ? (
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-lg border border-red-200 dark:border-red-900/50">
                <span className="shrink-0 text-red-500">🔴</span>
                <span>📅 {formatDateOnly(dateKey!)}</span>
              </div>
            ) : (
              <TaskDatePicker task={task} />
            )}
          </div>
        </div>

        {/* Task Timer Component */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80" onClick={(e) => e.stopPropagation()}>
          <TaskTimer
            task={task}
            onTimerChange={() => invalidateMemberQueries()}
          />
        </div>
      </div>
    );
  };

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

      {/* Member Header Card with Workload Health Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm mb-8 space-y-6">
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

              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{memberSummary.email}</span>
                </div>
                <span>•</span>
                <span>
                  {tasks.length} Tasks • {completedTasks.length} Completed • {incompleteTasks.length} Incomplete
                </span>
              </div>
            </div>
          </div>

          {/* Member Stats Box */}
          <div className="flex items-center gap-4 text-center p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl min-w-[240px]">
            <div className="flex-1">
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">{tasks.length}</span>
              <span className="text-[11px] text-zinc-400 font-medium">Total Tasks</span>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-800">
              <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {completedTasks.length}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">Completed</span>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-800">
              <span className="block text-xl font-bold text-blue-600 dark:text-blue-400">
                {incompleteTasks.length}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">Incomplete</span>
            </div>
          </div>
        </div>

        {/* Member Health Progress Bar */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500 fill-red-500/20" />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Health
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border tracking-wide ${getHealthColor(memberSummary.health_score, memberSummary.health_status)}`}>
                {memberSummary.health_status === 'no_data' ? 'no data' : (memberSummary.health_status?.replace('_', ' ') || 'healthy')}
              </span>
            </div>
            <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
              {memberSummary.health_score !== null && memberSummary.health_score !== undefined ? `${memberSummary.health_score}%` : '—'}
            </span>
          </div>

          <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getHealthBarColor(memberSummary.health_score)}`}
              style={{ width: `${Math.min(100, Math.max(0, memberSummary.health_score ?? 0))}%` }}
            />
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
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Assigned Tasks ({filter === 'COMPLETED' ? completedTasks.length : incompleteTasks.length})
          </h2>

          {/* Filter Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'INCOMPLETED', label: `Incomplete (${incompleteTasks.length})` },
              { key: 'COMPLETED', label: `Completed (${completedTasks.length})` },
              { key: 'TODAY', label: 'Today' },
              { key: 'UPCOMING', label: 'Upcoming' },
              { key: 'NO_DUE_DATE', label: 'No Due Date' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filter === tab.key
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* INCOMPLETE TASKS SECTION (Datewise Chronological) */}
        {filter !== 'COMPLETED' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                INCOMPLETE TASKS ({incompleteTasks.length})
              </h3>
            </div>

            {filteredDateGroups.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6">
                <CheckCircle2 className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No incomplete tasks match this filter</p>
              </div>
            ) : (
              filteredDateGroups.map((dateGroup) => (
                <div key={dateGroup.dateKey || 'no-date-group'} className="space-y-4">
                  {/* Date Group Header */}
                  <div className="flex items-center gap-2 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-2">
                    {dateGroup.isPassed ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                        <span className="shrink-0 text-red-500">🔴</span>
                        <span>{dateGroup.formattedDate}</span>
                        <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                          {dateGroup.tasks.length} task{dateGroup.tasks.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : dateGroup.isToday ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        <Calendar className="h-3.5 w-3.5 text-blue-500" />
                        <span>{dateGroup.formattedDate}</span>
                        <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          {dateGroup.tasks.length} task{dateGroup.tasks.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{dateGroup.formattedDate}</span>
                        <span className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                          {dateGroup.tasks.length} task{dateGroup.tasks.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tasks Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dateGroup.tasks.map((task) =>
                      renderTaskTile(task, dateGroup.isPassed, dateGroup.dateKey)
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COMPLETED TASKS SECTION */}
        {(filter === 'ALL' || filter === 'COMPLETED') && completedTasks.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              COMPLETED TASKS ({completedTasks.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedTasks.map((task) => renderTaskTile(task))}
            </div>
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
          onTaskSaved={() => invalidateMemberQueries()}
        />
      )}

      {/* Selection Toolbar */}
      <SelectionToolbar
        selectedCount={dragSelect.selectedTaskIds.length}
        totalVisibleCount={tasks.length}
        onClearSelection={dragSelect.clearSelection}
        onSelectAll={() => dragSelect.selectAll()}
        areAllSelected={tasks.length > 0 && tasks.every((t) => dragSelect.isSelected(t.id))}
        onConfirmDelete={() => bulkDeleteMutation.mutateAsync(dragSelect.selectedTaskIds)}
        isDeleting={bulkDeleteMutation.isPending}
      />
    </div>
  );
};
