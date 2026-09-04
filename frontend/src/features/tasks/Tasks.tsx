import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TaskDetailPanel } from './TaskDetailPanel';
import { TaskFormModal } from './TaskFormModal';
import { Plus, CheckSquare, AlertCircle } from 'lucide-react';
import { classifyTask } from '../../utils/taskClassifier';
import { getLocalDateString } from '../../utils/time';
import { PasteTasksModal } from './PasteTasksModal';
import { TaskCard } from './TaskCard';
import { useTaskDragSelect } from '../../hooks/useTaskDragSelect';
import { SelectionToolbar } from '../../components/common/SelectionToolbar';

import { useOrganization } from '../../context/OrganizationContext';

type FilterType = 'all' | 'incompleted' | 'today' | 'tomorrow' | 'upcoming' | 'no_due_date' | 'completed' | 'late';

export const Tasks: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useOrganization();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTaskIdParam = searchParams.get('task');
  const createProjectIdParam = searchParams.get('create_project_id');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [copiedTasksCount, setCopiedTasksCount] = useState(0);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');



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
  } else if (activeFilter === 'incompleted') {
    filteredTasks = deduplicatedTasks.filter((t) => t.status !== 'COMPLETED');
  } else if (activeFilter === 'upcoming') {
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrowDate);
    filteredTasks = deduplicatedTasks.filter(
      (t) => t.status !== 'COMPLETED' && t.due_date && t.due_date >= tomorrowStr
    );
  } else if (activeFilter !== 'all') {
    filteredTasks = deduplicatedTasks.filter((t) => classifyTask(t) === activeFilter);
  }

  const dragSelect = useTaskDragSelect({
    visibleTasks: filteredTasks,
    onOpenDetail: handleOpenDetail,
  });

  useEffect(() => {
    dragSelect.clearSelection();
  }, [activeFilter]);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const response = await api.post('/tasks/bulk-delete/', { task_ids: taskIds });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      dragSelect.clearSelection();
    },
  });


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




  const renderTaskCard = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      currentUser={user}
      isAdmin={isAdmin}
      onOpenDetail={handleOpenDetail}
      onEdit={(t) => {
        setTaskToEdit(t);
        setIsFormModalOpen(true);
      }}
      onToggleComplete={(targetTask) => {
        if (targetTask.status === 'COMPLETED') {
          reopenTaskMutation.mutate(targetTask.id);
        } else {
          completeTaskMutation.mutate(targetTask.id);
        }
      }}
      isMutating={completeTaskMutation.isPending || reopenTaskMutation.isPending}
      isSelected={dragSelect.isSelected(task.id)}
      onToggleSelect={(id, shift) => dragSelect.toggleSelect(id, shift)}
      onPointerDown={dragSelect.handlePointerDown}
      onPointerMove={dragSelect.handlePointerMove}
      onPointerUp={dragSelect.handlePointerUpOrCancel}
      onPointerCancel={dragSelect.handlePointerUpOrCancel}
      onCardClick={dragSelect.handleCardClick}
      isSelectionActive={dragSelect.isSelectionActive}
    />
  );

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
    { value: 'incompleted', label: 'Incompleted Tasks' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'upcoming', label: 'Upcoming' },
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
            onClick={() => {
              const areAllSelected = filteredTasks.length > 0 && filteredTasks.every((t) => dragSelect.isSelected(t.id));
              if (areAllSelected) {
                dragSelect.clearSelection();
              } else {
                dragSelect.selectAll();
              }
            }}
            className="text-xs font-bold text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            {filteredTasks.length > 0 && filteredTasks.every((t) => dragSelect.isSelected(t.id)) ? 'Deselect All' : 'Select All'}
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
              filteredTasks
            )
          )}
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      <TaskFormModal
        key={taskToEdit ? `edit-${taskToEdit.id}` : 'create-task-modal'}
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

      {/* Floating Selection & Bulk Delete Toolbar */}
      <SelectionToolbar
        selectedCount={dragSelect.selectedTaskIds.length}
        totalVisibleCount={filteredTasks.length}
        onClearSelection={dragSelect.clearSelection}
        onSelectAll={() => dragSelect.selectAll()}
        areAllSelected={filteredTasks.length > 0 && filteredTasks.every((t) => dragSelect.isSelected(t.id))}
        onConfirmDelete={() => bulkDeleteMutation.mutateAsync(dragSelect.selectedTaskIds)}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Paste Tasks Modal */}
      <PasteTasksModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
      />
    </div>
  );
};
