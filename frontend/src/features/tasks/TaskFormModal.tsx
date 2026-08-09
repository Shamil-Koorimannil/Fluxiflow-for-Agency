import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task, Project, SubProject, User } from '../../types';
import { X } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  defaultProjectId?: string | null;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  defaultProjectId,
}) => {
  const queryClient = useQueryClient();
  const isEditMode = !!taskToEdit;

  // Form states
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [subProjectId, setSubProjectId] = useState<string>('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load data on edit or defaults
  useEffect(() => {
    if (taskToEdit) {
      setName(taskToEdit.name);
      setDueDate(taskToEdit.due_date);
      setDueTime(taskToEdit.due_time ? taskToEdit.due_time.substring(0, 5) : '');
      setPriority(taskToEdit.priority || 'MEDIUM');
      setDescription(taskToEdit.description || '');
      setProjectId(taskToEdit.project || '');
      setSubProjectId(taskToEdit.sub_project || '');
      setSelectedAssigneeIds(taskToEdit.assignees.map((a) => a.id));
    } else {
      setName('');
      setDueDate(new Date().toISOString().split('T')[0]); // default to today
      setDueTime('');
      setPriority('MEDIUM');
      setDescription('');
      setProjectId(defaultProjectId || '');
      setSubProjectId('');
      setSelectedAssigneeIds([]);
    }
    setError(null);
  }, [taskToEdit, defaultProjectId, isOpen]);

  // Fetch projects list for selection
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects/');
      return response.data;
    },
    enabled: isOpen,
  });

  // Fetch subprojects of selected project
  const { data: subprojects } = useQuery<SubProject[]>({
    queryKey: ['subprojects', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}/subprojects/`);
      return response.data;
    },
    enabled: isOpen && !!projectId,
  });

  // Fetch team members list for assignees selection
  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get('/team/');
      return response.data;
    },
    enabled: isOpen,
  });

  // Reset subproject when project changes
  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProjectId(e.target.value);
    setSubProjectId('');
  };

  const handleAssigneeToggle = (userId: string) => {
    if (selectedAssigneeIds.includes(userId)) {
      setSelectedAssigneeIds(selectedAssigneeIds.filter((id) => id !== userId));
    } else {
      setSelectedAssigneeIds([...selectedAssigneeIds, userId]);
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['task', taskToEdit?.id] });
      }
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }
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
    if (!dueDate) {
      setError('Due Date is required.');
      return;
    }
    if (selectedAssigneeIds.length === 0) {
      setError('At least one assignee is required.');
      return;
    }

    const payload: any = {
      name,
      due_date: dueDate,
      priority,
      description: description || null,
      assignee_ids: selectedAssigneeIds,
      project: projectId || null,
      sub_project: subProjectId || null,
    };

    if (dueTime) {
      payload.due_time = `${dueTime}:00`;
    } else {
      payload.due_time = null;
    }

    submitMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-6 shadow-lg relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-black transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="font-bold text-base text-black mb-1">
          {isEditMode ? 'Edit Task' : 'Create Task'}
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          {isEditMode ? 'Modify details of the existing task.' : 'Add a new action item and assign it.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Task Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Create landing page"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitMutation.isPending}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={submitMutation.isPending}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Due Time (optional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={submitMutation.isPending}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Project (optional)
              </label>
              <select
                value={projectId}
                onChange={handleProjectChange}
                disabled={submitMutation.isPending}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors"
              >
                <option value="">No Project</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Sub-project (optional)
              </label>
              <select
                value={subProjectId}
                onChange={(e) => setSubProjectId(e.target.value)}
                disabled={submitMutation.isPending || !projectId}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors disabled:bg-zinc-50 disabled:text-zinc-400"
              >
                <option value="">No Sub-project</option>
                {subprojects?.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                disabled={submitMutation.isPending}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            {/* Assignees list multiselect */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                Assignees *
              </label>
              <div className="border border-zinc-200 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1.5 bg-white">
                {teamMembers?.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 text-xs font-medium text-black cursor-pointer hover:bg-zinc-50 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssigneeIds.includes(member.id)}
                      onChange={() => handleAssigneeToggle(member.id)}
                      disabled={submitMutation.isPending}
                      className="rounded border-zinc-300 text-black focus:ring-black"
                    />
                    <span>{member.name}</span>
                  </label>
                ))}
                {(!teamMembers || teamMembers.length === 0) && (
                  <span className="text-xs text-zinc-400 italic">No team members loaded.</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Description
            </label>
            <textarea
              placeholder="Task details and instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitMutation.isPending}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitMutation.isPending}
              className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white font-semibold rounded-lg text-xs tracking-wide transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : isEditMode ? (
                'Save Changes'
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
