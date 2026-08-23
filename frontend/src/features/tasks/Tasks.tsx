import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TaskDetailPanel } from './TaskDetailPanel';
import { TaskFormModal } from './TaskFormModal';
import { Plus, CheckCircle2, Circle, CheckSquare, AlertCircle } from 'lucide-react';
import { classifyTask } from '../../utils/taskClassifier';
import { TaskDatePicker } from './TaskDatePicker';
import { PasteTasksModal } from './PasteTasksModal';

type FilterType = 'all' | 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'no_due_date' | 'completed' | 'late';

export const Tasks: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTaskIdParam = searchParams.get('task');
  const createProjectIdParam = searchParams.get('create_project_id');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [copiedTasksCount, setCopiedTasksCount] = useState(0);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTaskIds([]);
    setLastSelectedTaskId(null);
  }, [activeFilter]);

  const formatLateDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;
    return `${days}d ${hrs}h`;
  };

  useEffect(() => {
    const updateCount = () => {
      const stored = localStorage.getItem('fluxiflow_copied_tasks');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCopiedTasksCount(Array.isArray(parsed) ? parsed.length : 0);
        } catch {
          setCopiedTasksCount(0);
        }
      } else {
        setCopiedTasksCount(0);
      }
    };
    updateCount();
    window.addEventListener('fluxiflow_copied_tasks_changed', updateCount);
    return () => window.removeEventListener('fluxiflow_copied_tasks_changed', updateCount);
  }, []);

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

  const { data: tasks, isLoading, error } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/tasks/');
      return response.data;
    },
  });

  useEffect(() => {
    if (error) {
      console.error('[Developer Diagnostics] Failed to load tasks error:', error);
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const axiosErr = error as any;
        console.error('[Developer Diagnostics] Axios HTTP Status:', axiosErr.response?.status);
        console.error('[Developer Diagnostics] Axios Response Body:', axiosErr.response?.data);
      }
    }
  }, [error]);

  // Task inline completion mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('subtask_')) {
        const subtaskId = id.replace('subtask_', '');
        const response = await api.post(`/subtasks/${subtaskId}/complete/`);
        return response.data;
      }
      const response = await api.post(`/tasks/${id}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['employee-workload'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });

  // Task inline reopen mutation
  const reopenTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('subtask_')) {
        const subtaskId = id.replace('subtask_', '');
        const response = await api.post(`/subtasks/${subtaskId}/reopen/`);
        return response.data;
      }
      const response = await api.post(`/tasks/${id}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['employee-workload'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
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

  // Grouping and Sorting Logic using the classifier
  const deduplicatedTasks = tasks ? Array.from(new Map(tasks.map(t => [t.id, t])).values()) : [];
  let filteredTasks = deduplicatedTasks;

  if (activeFilter === 'late') {
    filteredTasks = deduplicatedTasks.filter((t) => t.status === 'COMPLETED' && t.submission_status === 'LATE');
  } else if (activeFilter !== 'all') {
    filteredTasks = deduplicatedTasks.filter((t) => classifyTask(t) === activeFilter);
  }
  const handleToggleSelect = (taskId: string, isShiftPressed?: boolean) => {
    if (isShiftPressed && lastSelectedTaskId) {
      const startIdx = filteredTasks.findIndex(t => t.id === lastSelectedTaskId);
      const endIdx = filteredTasks.findIndex(t => t.id === taskId);
      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const rangeIds = filteredTasks.slice(minIdx, maxIdx + 1).map(t => t.id);
        setSelectedTaskIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(id => next.add(id));
          return Array.from(next);
        });
        setLastSelectedTaskId(taskId);
        return;
      }
    }
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
    setLastSelectedTaskId(taskId);
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
    setLastSelectedTaskId(null);
  };

  const handleBulkCopy = () => {
    const tasksToCopy = filteredTasks.filter(t => selectedTaskIds.includes(t.id));
    const serialized = tasksToCopy.map(t => ({
      name: t.name,
      description: t.description,
      priority: t.priority,
      due_date: t.due_date,
      due_time: t.due_time,
      subtasks: t.subtasks?.map(s => ({
        name: s.name,
        due_date: s.due_date,
        due_time: s.due_time
      })) || []
    }));
    localStorage.setItem('fluxiflow_copied_tasks', JSON.stringify(serialized));
    setSelectedTaskIds([]);
    window.dispatchEvent(new Event('fluxiflow_copied_tasks_changed'));
  };

  const areAllVisibleSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.includes(t.id));

  const handleSelectAllToggle = () => {
    if (areAllVisibleSelected) {
      const visibleIds = filteredTasks.map(t => t.id);
      setSelectedTaskIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        filteredTasks.forEach(t => next.add(t.id));
        return Array.from(next);
      });
    }
  };
  const completedList: Task[] = [];
  const todayList: Task[] = [];
  const tomorrowList: Task[] = [];
  const upcomingList: Task[] = [];
  const overdueList: Task[] = [];
  const noDueDateList: Task[] = [];

  deduplicatedTasks.forEach((task) => {
    const category = classifyTask(task);
    if (category === 'completed') {
      completedList.push(task);
    } else if (category === 'today') {
      todayList.push(task);
    } else if (category === 'tomorrow') {
      tomorrowList.push(task);
    } else if (category === 'upcoming') {
      upcomingList.push(task);
    } else if (category === 'overdue') {
      overdueList.push(task);
    } else if (category === 'no_due_date') {
      noDueDateList.push(task);
    }
  });

  noDueDateList.sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Sort helper functions
  todayList.sort((a, b) => {
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  tomorrowList.sort((a, b) => {
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  upcomingList.sort((a, b) => {
    if (!a.due_date || !b.due_date) return 0;
    const dateCompare = a.due_date.localeCompare(b.due_date);
    if (dateCompare !== 0) return dateCompare;
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  overdueList.sort((a, b) => {
    if (!a.due_date || !b.due_date) return 0;
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


  const renderAssigneesList = (assignees: Task['assignees']) => {
    if (assignees.length === 0) {
      return (
        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-850 select-none uppercase tracking-wider">
          👤 Unassigned
        </span>
      );
    }

    const completedCount = assignees.filter(a => a.completed).length;

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Avatars */}
        <div className="flex -space-x-1.5 overflow-hidden py-0.5">
          {assignees.map((a) => (
            <div
              key={a.id}
              title={`${a.name} (${a.completed ? 'Completed' : 'Pending'})`}
              className={`relative flex h-5 w-5 items-center justify-center rounded-full border text-[8px] font-bold shrink-0 ${
                a.completed
                  ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {getInitials(a.name)}
              {a.completed && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 items-center justify-center rounded-full bg-green-500 text-[6px] text-white font-extrabold shadow-sm border border-white dark:border-zinc-950">
                  ✓
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Text Details */}
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          {assignees.length > 1 ? (
            <span>
              {completedCount}/{assignees.length} completed
            </span>
          ) : (
            <span>{assignees[0].name}</span>
          )}
        </span>
      </div>
    );
  };

  const renderTaskCard = (task: Task) => {
    const isAssigned = task.assignees.some((a) => a.id === user?.id);
    const canComplete = isAdmin || isAssigned;
    const isSelected = selectedTaskIds.includes(task.id);

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-black dark:hover:border-white transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-sm animate-slide-up ${
          task.is_subtask ? 'ml-6 md:ml-8 border-dashed' : ''
        } ${getPriorityBorder(task.priority)}`}
        onClick={() => handleOpenDetail(task.is_subtask ? task.parent_task_id! : task.id)}
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
              <CheckCircle2 className="h-4.5 w-4.5 text-green-550 dark:text-green-400 animate-pop" />
            ) : (
              <Circle className="h-4.5 w-4.5 transition-transform duration-200" />
            )}
          </button>

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <h4
              className={`text-sm font-semibold truncate ${
                task.status === 'COMPLETED' ? 'line-through text-zinc-400 dark:text-zinc-555' : 'text-black dark:text-white'
              }`}
            >
              {task.name}
            </h4>

            {/* Project name row */}
            {task.project_detail && (
              <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-555 uppercase tracking-widest leading-none">
                {task.project_detail.name} {task.is_subtask && task.parent_task_name && ` / Parent: ${task.parent_task_name}`}
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
                <TaskDatePicker task={task} />
              </div>

              {task.priority && (
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                  {task.priority} Priority
                </span>
              )}
              {task.is_subtask && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-250 dark:border-zinc-750">
                  Subtask
                </span>
              )}
              {task.overall_status && (
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                  task.overall_status === 'COMPLETED'
                    ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                    : task.overall_status === 'IN_PROGRESS'
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-550'
                }`}>
                  {task.overall_status === 'IN_PROGRESS' ? 'In Progress' : task.overall_status}
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

        {/* Selection Checkbox (Moved to right) */}
        <div className="flex items-center shrink-0 px-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSelect(task.id, e.shiftKey);
            }}
            onChange={() => {}}
            className="rounded border-zinc-300 dark:border-zinc-700 text-black focus:ring-black focus:ring-0 cursor-pointer w-4 h-4"
          />
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

  const hasNoTasks = filteredTasks.length === 0;

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'no_due_date', label: 'No Due Date' },
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
          <div className="flex items-center gap-2">
            {copiedTasksCount > 0 && (
              <button
                onClick={() => setIsPasteModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
              >
                Paste ({copiedTasksCount})
              </button>
            )}
            <button
              onClick={() => setIsFormModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 md:gap-2 md:px-4 md:py-2 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-xs md:text-sm transition-colors"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Create Task</span>
              <span className="inline md:hidden">Task</span>
            </button>
          </div>
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

      {/* Select All Action Bar */}
      {!hasNoTasks && (
        <div className="flex justify-end pr-1">
          <button
            onClick={handleSelectAllToggle}
            className="text-xs font-bold text-zinc-555 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            {areAllVisibleSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}

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
          {activeFilter === 'all' ? (
            <>
              {renderSection('Today', todayList)}
              {renderSection('Tomorrow', tomorrowList)}
              {renderSection('Overdue', overdueList, true)}
              {renderSection('Upcoming', upcomingList)}
              {renderSection('No Due Date', noDueDateList)}
              {renderSection('Completed', completedList)}
            </>
          ) : (
            renderSection(
              filters.find((f) => f.value === activeFilter)?.label || 'Tasks',
              filteredTasks,
              activeFilter === 'overdue'
            )
          )}
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

      {/* Floating Bulk Action Toolbar */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-lg z-50 flex items-center gap-4 animate-in fade-in slide-in-from-bottom duration-200 text-xs text-black dark:text-white">
          <span className="font-bold">{selectedTaskIds.length} Task{selectedTaskIds.length > 1 ? 's' : ''} Selected</span>
          <div className="h-4 w-px bg-zinc-250 dark:bg-zinc-800" />
          <button
            onClick={handleBulkCopy}
            className="font-bold text-zinc-650 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            Copy
          </button>
          <button
            onClick={handleClearSelection}
            className="font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Paste Tasks Modal */}
      <PasteTasksModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
      />
    </div>
  );
};
