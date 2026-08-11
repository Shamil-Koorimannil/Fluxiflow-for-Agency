import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Project, Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { ArrowLeft, Plus, Trash2, CheckSquare, CheckCircle2, Circle } from 'lucide-react';
import { formatLateDuration } from '../../utils/time';

type ProjectFilterType = 'all' | 'today' | 'pending' | 'upcoming' | 'completed' | 'assigned_to_me';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [isDeleteProjModalOpen, setIsDeleteProjModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [activeFilter, setActiveFilter] = useState<ProjectFilterType>('all');

  // Fetch Project details
  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await api.get(`/projects/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch Project Tasks
  const { data: tasks, isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks', { project: id }],
    queryFn: async () => {
      const response = await api.get(`/tasks/?project=${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Task inline completion mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post(`/tasks/${taskId}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', { project: id }] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  // Task inline reopen mutation
  const reopenTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post(`/tasks/${taskId}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', { project: id }] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/projects/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/app/projects');
    },
  });

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-650 bg-red-50 dark:text-red-450 dark:bg-red-950/20';
      case 'MEDIUM':
        return 'text-amber-650 bg-amber-50 dark:text-amber-450 dark:bg-amber-950/20';
      case 'LOW':
        return 'text-blue-650 bg-blue-50 dark:text-blue-450 dark:bg-blue-950/20';
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const renderAssigneesList = (assignees: Task['assignees']) => {
    if (assignees.length === 0) {
      return (
        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-850 select-none uppercase tracking-wider">
          👤 Unassigned
        </span>
      );
    }
    
    // Single assignee
    if (assignees.length === 1) {
      const single = assignees[0];
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
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

  if (isProjectLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            <div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          </div>
          <div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Link to="/app/projects" className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black dark:hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-4 text-sm font-medium text-red-650 dark:text-red-400">
          Failed to load project details. It may have been deleted or you lack access permissions.
        </div>
      </div>
    );
  }

  // Local filtering logic
  const todayStr = new Date().toISOString().split('T')[0];
  let filteredTasks = tasks || [];

  if (tasks) {
    if (activeFilter === 'today') {
      filteredTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.due_date === todayStr);
    } else if (activeFilter === 'pending') {
      filteredTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.due_date < todayStr);
    } else if (activeFilter === 'upcoming') {
      filteredTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.due_date > todayStr);
    } else if (activeFilter === 'completed') {
      filteredTasks = tasks.filter((t) => t.status === 'COMPLETED');
    } else if (activeFilter === 'assigned_to_me') {
      filteredTasks = tasks.filter((t) => t.assignees.some((a) => a.id === user?.id));
    }
  }

  const renderTaskTile = (task: Task) => {
    const isAssigned = task.assignees.some((a) => a.id === user?.id);
    const canComplete = isAdmin || isAssigned;

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-black dark:hover:border-white transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-sm animate-slide-up ${getPriorityBorder(
          task.priority
        )}`}
        onClick={() => {
          setSelectedTaskId(task.id);
        }}
      >
        <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
          {/* Interactive Checkbox Button */}
          <button
            type="button"
            disabled={!canComplete || completeTaskMutation.isPending || reopenTaskMutation.isPending}
            title={canComplete ? "" : "Not assigned to you"}
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
              <CheckCircle2 className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-550" />
            ) : (
              <Circle className="h-4.5 w-4.5" />
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

            {/* Assignees list rendering */}
            <div className="flex items-center gap-1.5">
              {renderAssigneesList(task.assignees)}
            </div>

            {/* Sub-label showing backend relative date indicator & Priority */}
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
                  task.date_color === 'amber' ? 'text-amber-550 font-semibold dark:text-amber-500' :
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

  const projectFilters: { value: ProjectFilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'pending', label: 'Pending' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
    { value: 'assigned_to_me', label: 'Assigned to Me' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Breadcrumb back to projects */}
      <div>
        <Link
          to="/app/projects"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </div>

      {/* Project Meta Details Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {project.description || 'No description provided.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {project.progress !== null ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 flex items-center gap-2.5">
              <div className="w-16 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-black dark:bg-white rounded-full"
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-black dark:text-white">{project.progress}% completed</span>
            </div>
          ) : (
            <span className="text-xs text-zinc-400 italic font-semibold">No tasks</span>
          )}

          {isAdmin && (
            <button
              onClick={() => setIsDeleteProjModalOpen(true)}
              className="p-2 border border-zinc-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-800 text-zinc-500 hover:text-red-650 hover:bg-red-50/20 rounded-lg transition-colors"
              title="Delete Project"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* TASKS LIST SECTION (Rendered Directly without Team Tab) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Project Tasks ({filteredTasks.length})
          </h3>
          {isAdmin && (
            <button
              onClick={() => {
                setTaskToEdit(null);
                setIsDeleteProjModalOpen(false);
                setSelectedTaskId(null);
                navigate(`/app/tasks?create_project_id=${project.id}`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          )}
        </div>

        {/* project level filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none no-scrollbar">
          {projectFilters.map((f) => {
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

        {isTasksLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg border border-zinc-200/50 dark:border-zinc-800/50"></div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black p-12 text-center">
            <CheckSquare className="h-6 w-6 text-zinc-400 mb-2" />
            <h3 className="font-semibold text-sm">No tasks match this filter</h3>
            {isAdmin && (
              <button
                onClick={() => navigate(`/app/tasks?create_project_id=${project.id}`)}
                className="mt-3 px-3 py-1.5 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-xs transition-colors"
              >
                Create Project Task
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(renderTaskTile)}
          </div>
        )}
      </div>

      {/* CONFIRM PROJECT DELETE MODAL */}
      {isDeleteProjModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-sm w-full p-6 shadow-lg text-center relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-black dark:text-white mb-1">Delete Project?</h3>
            <p className="text-xs text-zinc-555 dark:text-zinc-400 mb-6">
              This action cannot be undone. All tasks in this project will also be deleted.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDeleteProjModalOpen(false)}
                className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs font-semibold rounded-lg transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProjectMutation.mutate()}
                disabled={deleteProjectMutation.isPending}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs transition-colors flex-1"
              >
                {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL SIDE PANEL DRAWER */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onEdit={(task) => {
            setSelectedTaskId(null);
            setTaskToEdit(task);
          }}
        />
      )}

      {/* EDIT MODAL OVERLAY */}
      {taskToEdit && (
        <TaskFormModal
          isOpen={true}
          onClose={() => setTaskToEdit(null)}
          taskToEdit={taskToEdit}
          defaultProjectId={project.id}
        />
      )}
    </div>
  );
};
