import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Project, Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { ArrowLeft, Plus, Upload, Trash2, CheckSquare, X, Pencil, Download, Loader2, Calendar } from 'lucide-react';
import { BulkUploadModal } from './BulkUploadModal';
import { PasteTasksModal } from '../tasks/PasteTasksModal';
import { TaskCard } from '../tasks/TaskCard';
import { classifyTask } from '../../utils/taskClassifier';
import { formatDateOnly } from '../../utils/time';

type ProjectFilterType = 'all' | 'incompleted' | 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'no_due_date' | 'completed' | 'assigned_to_me';

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
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isEditProjModalOpen, setIsEditProjModalOpen] = useState(false);
  const [editProjName, setEditProjName] = useState('');
  const [editProjDescription, setEditProjDescription] = useState('');
  const [editProjDate, setEditProjDate] = useState('');
  const [editProjError, setEditProjError] = useState<string | null>(null);

  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [copiedTasksCount, setCopiedTasksCount] = useState(0);

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

  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTaskIds([]);
    setLastSelectedTaskId(null);
  }, [activeFilter]);

  const handleDownloadReport = async () => {
    if (isDownloadingReport) return;
    setIsDownloadingReport(true);
    try {
      const response = await api.get(`/projects/${id}/export-report/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Fluxiflow_Project_Report_${project?.name.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Failed to generate/download project report. Please try again.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // Fetch Project details
  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await api.get(`/projects/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });

  const handleOpenEditProject = () => {
    if (project) {
      setEditProjName(project.name);
      setEditProjDescription(project.description || '');
      setEditProjDate(project.project_date || '');
      setEditProjError(null);
      setIsEditProjModalOpen(true);
    }
  };

  const editProjectMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      project_date?: string | null;
    }) => {
      const response = await api.patch(`/projects/${id}/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditProjModalOpen(false);
      setEditProjError(null);
    },
    onError: (err: any) => {
      if (err.response?.data?.name) {
        setEditProjError(err.response.data.name[0]);
      } else {
        setEditProjError('Failed to update project. Please try again.');
      }
    },
  });

  const handleEditProjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjName.trim()) {
      setEditProjError('Project name is required.');
      return;
    }
    editProjectMutation.mutate({
      name: editProjName,
      description: editProjDescription,
      project_date: editProjDate || null,
    });
  };

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
    mutationFn: async (taskId: string) => {
      const response = await api.post(`/tasks/${taskId}/reopen/`);
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
  const deduplicatedTasks = tasks ? Array.from(new Map(tasks.map(t => [t.id, t])).values()) : [];
  let filteredTasks = deduplicatedTasks;

  if (activeFilter === 'assigned_to_me') {
    filteredTasks = deduplicatedTasks.filter((t) => t.assignees.some((a) => a.id === user?.id));
  } else if (activeFilter === 'incompleted') {
    filteredTasks = deduplicatedTasks.filter((t) => t.status !== 'COMPLETED');
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
  const renderTaskTile = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      currentUser={user}
      isAdmin={isAdmin}
      onOpenDetail={(id) => setSelectedTaskId(id)}
      onToggleComplete={(targetTask) => {
        if (targetTask.status === 'COMPLETED') {
          reopenTaskMutation.mutate(targetTask.id);
        } else {
          completeTaskMutation.mutate(targetTask.id);
        }
      }}
      isMutating={completeTaskMutation.isPending || reopenTaskMutation.isPending}
      isSelected={selectedTaskIds.includes(task.id)}
      onToggleSelect={handleToggleSelect}
    />
  );

  const projectFilters: { value: ProjectFilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'incompleted', label: 'Incompleted Tasks' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'no_due_date', label: 'No Due Date' },
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.project_date && (
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                {formatDateOnly(project.project_date)}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-550 dark:text-zinc-400 leading-relaxed">
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

          <button
            onClick={handleDownloadReport}
            disabled={isDownloadingReport}
            className="p-2 border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white text-zinc-500 hover:text-black dark:hover:text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
            title="Download Project Report"
          >
            {isDownloadingReport ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>

          {isAdmin && (
            <>
              <button
                onClick={handleOpenEditProject}
                className="p-2 border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white text-zinc-500 hover:text-black dark:hover:text-white rounded-lg transition-colors"
                title="Edit Project"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsDeleteProjModalOpen(true)}
                className="p-2 border border-zinc-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-800 text-zinc-500 hover:text-red-650 hover:bg-red-50/20 rounded-lg transition-colors"
                title="Delete Project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
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
                onClick={() => setIsBulkUploadOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 md:gap-1.5 md:px-3 md:py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Bulk Upload</span>
                <span className="inline md:hidden">Upload</span>
              </button>
              <button
                onClick={() => {
                  setTaskToEdit(null);
                  setIsDeleteProjModalOpen(false);
                  setSelectedTaskId(null);
                  setIsTaskModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 md:gap-1.5 md:px-3 md:py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Add Task</span>
                <span className="inline md:hidden">Task</span>
              </button>
            </div>
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

        {/* Select All Action Bar */}
        {!isTasksLoading && filteredTasks.length > 0 && (
          <div className="flex justify-end pr-1">
            <button
              onClick={handleSelectAllToggle}
              className="text-xs font-bold text-zinc-555 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              {areAllVisibleSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}

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
                onClick={() => setIsTaskModalOpen(true)}
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

      {/* CREATE TASK MODAL OVERLAY */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={project.id}
      />

      {/* BULK UPLOAD MODAL */}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        projectId={project.id}
        projectName={project.name}
      />

      {/* EDIT PROJECT MODAL */}
      {isEditProjModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-6 shadow-lg relative animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white">
            <button
              onClick={() => setIsEditProjModalOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-bold text-base text-black dark:text-white mb-1">Edit Project</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Update name or description details for this company scope.
            </p>

            <form onSubmit={handleEditProjSubmit} className="space-y-4">
              {editProjError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 text-xs font-medium text-red-650 dark:text-red-400">
                  {editProjError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website Development"
                  value={editProjName}
                  onChange={(e) => setEditProjName(e.target.value)}
                  disabled={editProjectMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  placeholder="Provide details about the scope..."
                  value={editProjDescription}
                  onChange={(e) => setEditProjDescription(e.target.value)}
                  disabled={editProjectMutation.isPending}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Project Date
                </label>
                <input
                  type="date"
                  value={editProjDate}
                  onChange={(e) => setEditProjDate(e.target.value)}
                  disabled={editProjectMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsEditProjModalOpen(false)}
                  disabled={editProjectMutation.isPending}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editProjectMutation.isPending}
                  className="px-3 py-1.5 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-xs tracking-wide transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {editProjectMutation.isPending ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white dark:border-black border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
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
        defaultProjectId={project.id}
      />
    </div>
  );
};
