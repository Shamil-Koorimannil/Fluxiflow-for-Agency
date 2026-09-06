import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task, Project, User, TaskType, OrganizationSettings } from '../../types';
import { X, Tag } from 'lucide-react';
import { TimePicker } from '../../components/common/TimePicker';
import { DatePicker } from '../../components/common/DatePicker';
import { CustomDropdown } from '../../components/common/CustomDropdown';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Task | null;
  taskToEdit?: Task | null;
  defaultProjectId?: string | null;
  defaultAssigneeId?: string | null;
  projectId?: string;
  preselectedClientId?: string;
  onTaskSaved?: () => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  taskToEdit: propTaskToEdit,
  defaultProjectId,
  defaultAssigneeId,
  projectId: projectIdProp,
  onTaskSaved,
}) => {
  const queryClient = useQueryClient();
  const taskToEdit = initialData || propTaskToEdit;
  const isEditMode = !!taskToEdit;

  // Form states
  const [name, setName] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<string | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load data on edit or defaults
  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setName(taskToEdit.name);
        const taskDates = taskToEdit.due_date ? [taskToEdit.due_date] : [];
        setDates(taskDates);
        setDueTime(taskToEdit.due_time ? taskToEdit.due_time.substring(0, 5) : '');
        setPriority(taskToEdit.priority || 'MEDIUM');
        setDescription(taskToEdit.description || '');
        setProjectId(taskToEdit.project || projectIdProp || defaultProjectId || '');
        setSelectedTaskTypeId(taskToEdit.task_type || taskToEdit.task_type_detail?.id || null);
        setSelectedAssigneeIds(taskToEdit.assignees ? taskToEdit.assignees.map((a) => a.id) : []);
      } else {
        setName('');
        setDates([]);
        setDueTime('');
        setPriority('MEDIUM');
        setDescription('');
        setProjectId(projectIdProp || defaultProjectId || '');
        setSelectedTaskTypeId(null);
        setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
      }
      setError(null);
    }
  }, [isOpen, taskToEdit, defaultProjectId, defaultAssigneeId, projectIdProp]);

  // Fetch Organization Settings (to check if Task Types feature is enabled)
  const { data: orgSettings } = useQuery<OrganizationSettings>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await api.get('/organization-settings/');
      return response.data;
    },
    enabled: isOpen,
  });

  // Fetch Task Types list
  const { data: taskTypes } = useQuery<TaskType[]>({
    queryKey: ['task-types'],
    queryFn: async () => {
      const response = await api.get('/task-types/');
      return response.data;
    },
    enabled: isOpen && !!orgSettings?.enable_task_types,
  });

  // Fetch projects list
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects/');
      return response.data;
    },
    enabled: isOpen,
  });

  // Fetch team members list
  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get('/team/');
      return response.data;
    },
    enabled: isOpen,
  });


  const selectedTypeObj = taskTypes?.find(t => t.id === selectedTaskTypeId);

  const formatReadableDuration = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  // Create or Update mutation
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditMode && taskToEdit) {
        const response = await api.patch(`/tasks/${taskToEdit.id}/`, data);
        return response.data;
      } else {
        const response = await api.post('/tasks/', data);
        return response.data;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['teamTasks'] }),
        queryClient.invalidateQueries({ queryKey: ['teamWorkload'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-workload'] }),
        queryClient.invalidateQueries({ queryKey: ['team'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
      if (isEditMode) {
        await queryClient.invalidateQueries({ queryKey: ['task', taskToEdit?.id] });
      }
      if (projectId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['tasks', { project: projectId }] }),
        ]);
      }
      if (onTaskSaved) onTaskSaved();
      onClose();
    },
    onError: (err: any) => {
      if (err.response?.data) {
        const errData = err.response.data;
        if (typeof errData === 'object') {
          const firstErr = Object.values(errData)[0];
          setError(Array.isArray(firstErr) ? firstErr[0] : String(firstErr));
        } else {
          setError('An error occurred during submission.');
        }
      } else {
        setError('Connection error. Please try again.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Task Name is required.');
      return;
    }
    if (!projectId) {
      setError('Project is required.');
      return;
    }

    const payload: any = {
      name: name.trim(),
      due_date: dates.length > 0 ? dates[0] : null,
      priority,
      description: description || null,
      assignee_ids: selectedAssigneeIds,
      project: projectId,
      task_type: selectedTaskTypeId || null,
    };

    if (!isEditMode) {
      payload.dates = dates;
    }

    if (dueTime) {
      payload.due_time = `${dueTime}:00`;
    } else {
      payload.due_time = null;
    }

    submitMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 pointer-events-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 text-black dark:text-white pointer-events-auto">
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 mb-1">
          {isEditMode ? 'Edit Task' : 'Create Task'}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          {isEditMode ? 'Modify details of the existing task.' : 'Add a new action item and assign it to team members.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3 text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Task Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Design Landing Page"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitMutation.isPending}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-black dark:focus:border-white disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Task Type Selector (When Enabled) */}
          {orgSettings?.enable_task_types && (
            <div className="space-y-1">
              <CustomDropdown
                label="Task Type"
                fullWidth
                disabled={submitMutation.isPending}
                value={selectedTaskTypeId || ''}
                onChange={(val) => setSelectedTaskTypeId(val || null)}
                placeholder="No Task Type"
                icon={<Tag className="h-3.5 w-3.5 text-blue-500" />}
                options={[
                  { value: '', label: 'No Task Type' },
                  ...(taskTypes
                    ?.filter((tt) => tt.is_active || tt.id === selectedTaskTypeId)
                    .map((tt) => ({
                      value: tt.id,
                      label: `${tt.name} (${formatReadableDuration(tt.allocated_seconds)})`,
                    })) || []),
                ]}
              />

              {selectedTypeObj && (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 mt-1">
                  <span className="font-semibold">{selectedTypeObj.name}</span>
                  <span className="font-mono font-bold">Allocated Time: {formatReadableDuration(selectedTypeObj.allocated_seconds)}</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                {isEditMode ? 'Due Date' : 'Task Dates'}
              </label>
              {isEditMode ? (
                <DatePicker
                  multiSelect={false}
                  value={dates[0] || ''}
                  onChange={(val) => setDates(val ? [val] : [])}
                  disabled={submitMutation.isPending}
                />
              ) : (
                <DatePicker
                  multiSelect={true}
                  values={dates}
                  onMultiChange={setDates}
                  disabled={submitMutation.isPending}
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Due Time
              </label>
              <TimePicker
                value={dueTime}
                onChange={setDueTime}
                disabled={submitMutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-1">
            <CustomDropdown
              label="Project *"
              fullWidth
              disabled={submitMutation.isPending || !!projectIdProp}
              value={projectId}
              onChange={(val) => setProjectId(val)}
              placeholder="Select Project *"
              options={[
                ...(projects?.map((p) => ({
                  value: p.id,
                  label: p.name,
                })) || []),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <CustomDropdown
                label="Priority"
                fullWidth
                disabled={submitMutation.isPending}
                value={priority}
                onChange={(val) => setPriority(val as any)}
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                ]}
              />
            </div>

            <div className="space-y-1">
              <CustomDropdown
                label="Assignee"
                fullWidth
                disabled={submitMutation.isPending}
                value={selectedAssigneeIds[0] || ''}
                onChange={(val) => setSelectedAssigneeIds(val ? [val] : [])}
                placeholder="Unassigned"
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(teamMembers?.map((m) => ({
                    value: m.id,
                    label: m.name,
                  })) || []),
                ]}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Task details and instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitMutation.isPending}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-black dark:focus:border-white disabled:opacity-50 transition-colors resize-none"
            />
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="px-4 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
