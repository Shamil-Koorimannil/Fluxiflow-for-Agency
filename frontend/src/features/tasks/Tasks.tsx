import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TaskFormModal } from './TaskFormModal';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CheckSquare, Plus, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { formatLateDuration } from '../../utils/time';
type FilterType = 'all' | 'today' | 'pending' | 'upcoming' | 'completed' | 'late';

export const Tasks: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTaskIdParam = searchParams.get('task');
  const createProjectIdParam = searchParams.get('create_project_id');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (activeTaskIdParam) {
      setSelectedTaskId(activeTaskIdParam);
    }
  }, [activeTaskIdParam]);

  useEffect(() => {
    if (createProjectIdParam && isAdmin) {
      setIsFormModalOpen(true);
    }
  }, [createProjectIdParam, isAdmin]);

  // Fetch tasks
  const { data: tasks, isLoading, error } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/tasks/');
      return response.data;
    },
  });

  // Task inline completion mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/tasks/${id}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Task inline reopen mutation
  const reopenTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/tasks/${id}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-650 bg-red-50 dark:text-red-400 dark:bg-red-950/20';
      case 'MEDIUM':
        return 'text-amber-650 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20';
      case 'LOW':
        return 'text-blue-650 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20';
      default:
        return 'text-zinc-500 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-900';
    }
  };

  const getPriorityBorder = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'border-l-4 border-red-500';
      case 'MEDIUM':
        return 'border-l-4 border-amber-500';
      case 'LOW':
        return 'border-l-4 border-blue-500';
      default:
        return 'border-l-4 border-zinc-200 dark:border-zinc-800';
    }
  };

  const handleOpenDetail = (id: string) => {
    setSelectedTaskId(id);
    setSearchParams({ task: id });
  };

  const handleCloseDetail = () => {
    setSelectedTaskId(null);
    setSearchParams({});
  };

  const handleOpenEdit = (task: Task) => {
    setTaskToEdit(task);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setTaskToEdit(null);
    if (createProjectIdParam) {
      setSearchParams({});
    }
  };

  // Grouping and Sorting Logic
  const todayStr = new Date().toISOString().split('T')[0];

  const completedList: Task[] = [];
  const todayList: Task[] = [];
  const pendingList: Task[] = [];
  const upcomingList: Task[] = [];

  if (tasks) {
    tasks.forEach((task) => {
      if (task.status === 'COMPLETED') {
        completedList.push(task);
      } else {
        if (task.due_date === todayStr) {
          todayList.push(task);
        } else if (task.due_date < todayStr) {
          pendingList.push(task);
        } else {
          upcomingList.push(task);
        }
      }
    });
  }

  // Sort helper functions
  todayList.sort((a, b) => {
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  upcomingList.sort((a, b) => {
    const dateCompare = a.due_date.localeCompare(b.due_date);
    if (dateCompare !== 0) return dateCompare;
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  pendingList.sort((a, b) => {
    const dateCompare = a.due_date.localeCompare(b.due_date);
    if (dateCompare !== 0) return dateCompare;
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  completedList.sort((a, b) => {
    const completedAtA = a.completed_at || '';
    const completedAtB = b.completed_at || '';
    return completedAtB.localeCompare(completedAtA);
  });

  const lateList = completedList.filter((t) => t.submission_status === 'LATE');

  const renderAssigneesList = (assignees: Task['assignees']) => {
    if (assignees.length === 0) {
      return (
        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-850 select-none uppercase tracking-wider">
          👤 Unassigned
        </span>
      );
    }
    
    // Single assignee
    if (assignees.length === 1) {
      const single = assignees[0];
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-650 dark:text-zinc-400">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-bold text-zinc-600 dark:text-zinc-400">
            {getInitials(single.name)}
          </div>
          <span>{single.name}</span>
        </div>
      );
    }

    // Multiple assignees
    const firstTwo = assignees.slice(0, 2);
    const overflowCount = assignees.length - 2;
    const tooltipText = assignees.map(a => a.name).join('\n');
    
    return (
      <div 
        className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-650 dark:text-zinc-400 cursor-help"
        title={tooltipText}
      >
        <div className="flex -space-x-1.5 overflow-hidden">
          {firstTwo.map((a) => (
            <div
              key={a.id}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-white dark:border-zinc-950 text-[9px] font-bold text-zinc-600 dark:text-zinc-455 shrink-0"
            >
              {getInitials(a.name)}
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-250 dark:bg-zinc-700 border border-white dark:border-zinc-950 text-[8px] font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
              +{overflowCount}
            </div>
          )}
        </div>
        <span>
          {firstTwo.map(a => a.name).join(' · ')}
          {overflowCount > 0 ? ` +${overflowCount}` : ''}
        </span>
      </div>
    );
  };

  const renderTaskCard = (task: Task) => {
    const isAssigned = task.assignees.some((a) => a.id === user?.id);
    const canComplete = isAdmin || isAssigned;

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-black dark:hover:border-white transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-sm animate-slide-up ${getPriorityBorder(
          task.priority
        )}`}
        onClick={() => handleOpenDetail(task.id)}
      >
        <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
          {/* Checkbox Button */}
          <button
            type="button"
            disabled={!canComplete || completeTaskMutation.isPending || reopenTaskMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              if (task.status === 'COMPLETED') {
                reopenTaskMutation.mutate(task.id);
              } else {
                completeTaskMutation.mutate(task.id);
              }
            }}
            className="text-zinc-400 hover:text-black dark:hover:text-white shrink-0 disabled:opacity-50 transition-all duration-200 active:scale-90 hover:scale-110 mt-0.5 md:mt-0"
          >
            {task.status === 'COMPLETED' ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-550 animate-pop" />
            ) : (
              <Circle className="h-4.5 w-4.5 transition-transform duration-200" />
            )}
          </button>

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <h4
              className={`text-sm font-semibold truncate ${
                task.status === 'COMPLETED' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-black dark:text-white'
              }`}
            >
              {task.name}
            </h4>

            {/* Project name row */}
            {task.project_detail && (
              <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest leading-none">
                {task.project_detail.name}
              </div>
            )}

            {/* Assignees block */}
            <div className="flex items-center gap-1.5">
              {renderAssigneesList(task.assignees)}
            </div>

            {/* Date display & Priority indicator */}
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-450 mt-1">
              <div className="flex items-center gap-1.5 font-medium">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  task.date_color === 'red' ? 'bg-red-500' :
                  task.date_color === 'amber' ? 'bg-amber-500' :
                  task.date_color === 'green' ? 'bg-green-500' :
                  'bg-zinc-400'
                }`} />
                <span className={
                  task.date_color === 'red' ? 'text-red-500 font-semibold' :
                  task.date_color === 'amber' ? 'text-amber-550 font-semibold dark:text-amber-550' :
                  task.date_color === 'green' ? 'text-green-500 font-semibold' :
                  'text-zinc-450 dark:text-zinc-400'
                }>
                  {task.date_display}
                </span>
              </div>

              {task.priority && (
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                  {task.priority} Priority
                </span>
              )}
            </div>

            {task.status === 'COMPLETED' && task.submission_status === 'LATE' && (
              <div className="flex flex-col gap-0.5 mt-2 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-2 rounded-lg text-red-650 dark:text-red-400">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="shrink-0 text-red-500">🔴</span>
                  <span>Late Submission</span>
                </div>
                {task.late_by_minutes && (
                  <div className="text-[10px] font-bold text-red-500/80 ml-5">
                    Late by: {formatLateDuration(task.late_by_minutes)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, list: Task[], isOverdue = false) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          {title} ({list.length})
          {isOverdue && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded-full uppercase">
              <AlertCircle className="h-3 w-3" /> overdue
            </span>
          )}
        </h3>
        <div className="space-y-2">{list.map(renderTaskCard)}</div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"></div>
          <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"></div>
        </div>
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"></div>
              <div className="h-14 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg border border-zinc-200/50 dark:border-zinc-800/50"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-4 text-sm font-medium text-red-650 dark:text-red-400">
        Failed to load tasks. Please verify database connection and login credentials.
      </div>
    );
  }

  const hasNoTasks =
    activeFilter === 'late'
      ? lateList.length === 0
      : completedList.length === 0 &&
        todayList.length === 0 &&
        pendingList.length === 0 &&
        upcomingList.length === 0;

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'pending', label: 'Pending' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
    { value: 'late', label: 'Late' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isAdmin ? 'Manage corporate deliverables backlog.' : 'Your assigned projects and deliverables.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
        )}
      </div>

      {/* FILTER PILLS BUTTONS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none no-scrollbar">
        {filters.map((f) => {
          const isSelected = activeFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                isSelected
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-zinc-100 text-black border border-zinc-200/50 hover:bg-zinc-200 dark:bg-black dark:text-white dark:border-zinc-800 dark:hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Grouped lists */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 mb-4">
            <CheckSquare className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">All caught up!</h3>
          <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-1 max-w-xs">
            {isAdmin
              ? 'No tasks exist in the system. Click Create Task to add one.'
              : 'You have no assigned tasks. Enjoy the downtime!'}
          </p>
        </div>
      ) : (
        <div className="space-y-8 pt-2">
          {(activeFilter === 'all' || activeFilter === 'today') && renderSection('Today', todayList)}
          {(activeFilter === 'all' || activeFilter === 'pending') && renderSection('Pending', pendingList, true)}
          {(activeFilter === 'all' || activeFilter === 'upcoming') && renderSection('Upcoming', upcomingList)}
          {(activeFilter === 'all' || activeFilter === 'completed') && renderSection('Completed', completedList)}
          {activeFilter === 'late' && renderSection('Late Submissions', lateList)}
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      <TaskFormModal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        taskToEdit={taskToEdit}
        defaultProjectId={createProjectIdParam}
      />

      {/* DETAIL SIDE PANEL DRAWER */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseDetail}
          onEdit={(task) => {
            setSelectedTaskId(null); // close detail
            handleOpenEdit(task); // open edit form
          }}
        />
      )}
    </div>
  );
};
