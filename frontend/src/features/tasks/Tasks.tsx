import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TaskFormModal } from './TaskFormModal';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CheckSquare, Plus, Clock, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

export const Tasks: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Search parameters for handling search links and quick creations
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTaskIdParam = searchParams.get('task');
  const createProjectIdParam = searchParams.get('create_project_id');

  // Modal and detail panel states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Auto-open panel from search navigation URL
  useEffect(() => {
    if (activeTaskIdParam) {
      setSelectedTaskId(activeTaskIdParam);
    }
  }, [activeTaskIdParam]);

  // Auto-open create modal from project navigation URL
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
        return 'text-red-600 bg-red-50';
      case 'MEDIUM':
        return 'text-amber-600 bg-amber-50';
      case 'LOW':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-zinc-500 bg-zinc-100';
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
        return 'border-l-4 border-zinc-200';
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
  // Today: Earliest due time first. Tasks without time follow timed tasks.
  todayList.sort((a, b) => {
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  // Upcoming: Nearest due date first
  upcomingList.sort((a, b) => {
    const dateCompare = a.due_date.localeCompare(b.due_date);
    if (dateCompare !== 0) return dateCompare;
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  // Pending (Overdue): Most overdue first (earliest due date first)
  pendingList.sort((a, b) => {
    const dateCompare = a.due_date.localeCompare(b.due_date);
    if (dateCompare !== 0) return dateCompare;
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  // Completed: Most recently completed first
  completedList.sort((a, b) => {
    const completedAtA = a.completed_at || '';
    const completedAtB = b.completed_at || '';
    return completedAtB.localeCompare(completedAtA);
  });

  const renderTaskCard = (task: Task) => {
    const isAssigned = task.assignees.some((a) => a.id === user?.id);
    const canComplete = isAdmin || isAssigned;

    return (
      <div
        key={task.id}
        className={`bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-black transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-sm animate-slide-up ${getPriorityBorder(
          task.priority
        )}`}
        onClick={() => handleOpenDetail(task.id)}
      >
        <div className="flex items-start md:items-center gap-3 min-w-0">
          {/* Checkbox */}
          <button
            type="button"
            disabled={!canComplete || completeTaskMutation.isPending || reopenTaskMutation.isPending}
            onClick={(e) => {
              e.stopPropagation(); // prevent opening details
              if (task.status === 'COMPLETED') {
                reopenTaskMutation.mutate(task.id);
              } else {
                completeTaskMutation.mutate(task.id);
              }
            }}
            className="text-zinc-400 hover:text-black shrink-0 disabled:opacity-50 transition-all duration-200 active:scale-90 hover:scale-110 mt-0.5 md:mt-0"
          >
            {task.status === 'COMPLETED' ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-zinc-400 animate-pop" />
            ) : (
              <Circle className="h-4.5 w-4.5 transition-transform duration-200" />
            )}
          </button>

          {/* Details */}
          <div className="min-w-0">
            <h4
              className={`text-sm font-semibold truncate ${
                task.status === 'COMPLETED' ? 'strike-through-anim text-zinc-400' : 'text-black'
              }`}
            >
              {task.name}
            </h4>

            {/* Sub-label showing time & project info */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-400 mt-1">
              {task.due_time && (
                <div className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{task.due_time.substring(0, 5)}</span>
                </div>
              )}
              {task.project_detail && (
                <span className="font-semibold text-zinc-500 uppercase tracking-wide">
                  {task.project_detail.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Badges / Assignees */}
        <div
          className="flex items-center gap-3 shrink-0"
          onClick={(e) => e.stopPropagation()} // keep interactive
        >
          {task.priority && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getPriorityColor(
                task.priority
              )}`}
            >
              {task.priority}
            </span>
          )}

          {/* Assignees avatars */}
          <div className="flex -space-x-1.5 overflow-hidden">
            {task.assignees.map((assignee) => (
              <div
                key={assignee.id}
                title={assignee.name}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-50 border border-white text-[9px] font-bold text-zinc-600 shrink-0"
              >
                {getInitials(assignee.name)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, list: Task[], isOverdue = false) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          {title} ({list.length})
          {isOverdue && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full uppercase lowercase normal-case">
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
          <div className="h-8 w-24 bg-zinc-200 animate-pulse rounded"></div>
          <div className="h-10 w-28 bg-zinc-200 animate-pulse rounded"></div>
        </div>
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-20 bg-zinc-200 animate-pulse rounded"></div>
              <div className="h-14 bg-zinc-100 animate-pulse rounded-lg border border-zinc-200/50"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm font-medium text-red-600">
        Failed to load tasks. Please verify database connection and login credentials.
      </div>
    );
  }

  const hasNoTasks =
    completedList.length === 0 &&
    todayList.length === 0 &&
    pendingList.length === 0 &&
    upcomingList.length === 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-zinc-500">
            {isAdmin ? 'Manage corporate deliverables backlog.' : 'Your assigned projects and deliverables.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-zinc-800 text-white font-medium rounded-lg text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
        )}
      </div>

      {/* Grouped lists */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-zinc-400 mb-4">
            <CheckSquare className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">All caught up!</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            {isAdmin
              ? 'No tasks exist in the system. Click Create Task to add one.'
              : 'You have no assigned tasks. Enjoy the downtime!'}
          </p>
        </div>
      ) : (
        <div className="space-y-8 pt-2">
          {renderSection('Today', todayList)}
          {renderSection('Pending', pendingList, true)}
          {renderSection('Upcoming', upcomingList)}
          {renderSection('Completed', completedList)}
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
