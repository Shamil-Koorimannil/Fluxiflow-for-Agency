import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task, Project, User, TaskType, OrganizationSettings, RecurrenceConfig } from '../../types';
import { X, Tag, Plus, Trash2, Pencil, ListTodo } from 'lucide-react';
import { TimePicker } from '../../components/common/TimePicker';
import { DatePicker } from '../../components/common/DatePicker';
import { CustomDropdown } from '../../components/common/CustomDropdown';
import { TaskRepeatPicker } from './TaskRepeatPicker';
import { useOrganization } from '../../context/OrganizationContext';

interface SubtaskItemState {
  id: string;
  name: string;
  due_date: string | null;
  due_time: string | null;
  assignee_ids: string[];
  status?: string;
  isNew?: boolean;
  isEdited?: boolean;
}

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

  // Primary task form states
  const [name, setName] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<string | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(null);
  const { activeOrganization } = useOrganization();
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [selectedApproverId, setSelectedApproverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subtasks state
  const [subtasks, setSubtasks] = useState<SubtaskItemState[]>([]);
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<string[]>([]);

  // Add new subtask inline form states
  const [showAddSubForm, setShowAddSubForm] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubDueDate, setNewSubDueDate] = useState('');
  const [newSubDueTime, setNewSubDueTime] = useState('');
  const [newSubAssigneeIds, setNewSubAssigneeIds] = useState<string[]>([]);

  // Edit existing subtask inline form states
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubDueDate, setEditSubDueDate] = useState('');
  const [editSubDueTime, setEditSubDueTime] = useState('');
  const [editSubAssigneeIds, setEditSubAssigneeIds] = useState<string[]>([]);

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
        setRecurrence(taskToEdit.recurrence || null);
        setApprovalRequired(taskToEdit.approval_required !== false);
        setSelectedApproverId(taskToEdit.approver || taskToEdit.approver_detail?.id || null);
        setSelectedAssigneeIds(
          taskToEdit.assignees
            ? taskToEdit.assignees.map((a: any) => String(a.id || a.user?.id || a.user_id))
            : []
        );

        if (taskToEdit.subtasks && Array.isArray(taskToEdit.subtasks)) {
          setSubtasks(
            taskToEdit.subtasks.map((s: any) => ({
              id: String(s.id),
              name: s.name,
              due_date: s.due_date || null,
              due_time: s.due_time ? String(s.due_time).substring(0, 5) : null,
              assignee_ids: s.assignees
                ? s.assignees.map((a: any) => String(a.id || a.user?.id || a.user_id))
                : [],
              status: s.status || 'PENDING',
            }))
          );
        } else {
          setSubtasks([]);
        }
      } else {
        setName('');
        setDates([]);
        setDueTime('');
        setPriority('MEDIUM');
        setDescription('');
        setProjectId(projectIdProp || defaultProjectId || '');
        setSelectedTaskTypeId(null);
        setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
        setRecurrence(null);
        setApprovalRequired(true);
        setSelectedApproverId(null);
        setSubtasks([]);
      }
      setDeletedSubtaskIds([]);
      setShowAddSubForm(false);
      setEditingSubId(null);
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

  const selectedTypeObj = taskTypes?.find((t) => t.id === selectedTaskTypeId);

  const formatReadableDuration = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  // Subtask local state actions
  const handleAddSubtask = () => {
    if (!newSubName.trim()) return;
    const newSub: SubtaskItemState = {
      id: `temp-${Date.now()}-${Math.random()}`,
      name: newSubName.trim(),
      due_date: newSubDueDate || null,
      due_time: newSubDueTime || null,
      assignee_ids: newSubAssigneeIds,
      status: 'PENDING',
      isNew: true,
    };
    setSubtasks((prev) => [...prev, newSub]);
    setNewSubName('');
    setNewSubDueDate('');
    setNewSubDueTime('');
    setNewSubAssigneeIds([]);
    setShowAddSubForm(false);
  };

  const handleStartEditSubtask = (st: SubtaskItemState) => {
    setEditingSubId(st.id);
    setEditSubName(st.name);
    setEditSubDueDate(st.due_date || '');
    setEditSubDueTime(st.due_time || '');
    setEditSubAssigneeIds(st.assignee_ids || []);
  };

  const handleSaveEditSubtask = (stId: string) => {
    if (!editSubName.trim()) return;
    setSubtasks((prev) =>
      prev.map((s) => {
        if (s.id === stId) {
          return {
            ...s,
            name: editSubName.trim(),
            due_date: editSubDueDate || null,
            due_time: editSubDueTime || null,
            assignee_ids: editSubAssigneeIds,
            isEdited: !s.isNew,
          };
        }
        return s;
      })
    );
    setEditingSubId(null);
  };

  const handleDeleteSubtask = (stId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== stId));
    if (!stId.startsWith('temp-')) {
      setDeletedSubtaskIds((prev) => [...prev, stId]);
    }
  };

  // Create or Update mutation
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      let savedTask: any;
      if (isEditMode && taskToEdit) {
        const response = await api.patch(`/tasks/${taskToEdit.id}/`, data);
        savedTask = response.data;
      } else {
        const response = await api.post('/tasks/', data);
        const responseData = response.data;
        savedTask = Array.isArray(responseData) ? responseData[0] : responseData;
      }

      const parentTaskId = savedTask?.id || taskToEdit?.id;

      if (parentTaskId) {
        // 1. Delete removed existing subtasks
        for (const subId of deletedSubtaskIds) {
          if (!subId.startsWith('temp-')) {
            try {
              await api.delete(`/subtasks/${subId}/`);
            } catch (e) {
              console.error(`Failed to delete subtask ${subId}:`, e);
            }
          }
        }

        // 2. Create or update subtasks
        for (const sub of subtasks) {
          const subPayload: any = {
            name: sub.name,
            due_date: sub.due_date || null,
            due_time: sub.due_time ? (sub.due_time.length === 5 ? `${sub.due_time}:00` : sub.due_time) : null,
            assignee_ids: sub.assignee_ids,
          };

          if (sub.isNew || sub.id.startsWith('temp-')) {
            subPayload.task = parentTaskId;
            await api.post('/subtasks/', subPayload);
          } else if (sub.isEdited) {
            await api.patch(`/subtasks/${sub.id}/`, subPayload);
          }
        }
      }

      return savedTask;
    },
    onSuccess: async (savedTask) => {
      const targetTaskId = savedTask?.id || taskToEdit?.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['teamTasks'] }),
        queryClient.invalidateQueries({ queryKey: ['teamWorkload'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-workload'] }),
        queryClient.invalidateQueries({ queryKey: ['team'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
      if (targetTaskId) {
        await queryClient.invalidateQueries({ queryKey: ['task', targetTaskId] });
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

    if (activeOrganization?.enable_task_approval !== false && approvalRequired && !selectedApproverId) {
      setError('Please select an approver.');
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
      recurrence: subtasks.length > 0 ? null : recurrence,
      approval_required: activeOrganization?.enable_task_approval !== false ? approvalRequired : false,
      approver: (activeOrganization?.enable_task_approval !== false && approvalRequired) ? selectedApproverId : null,
    };

    if (!isEditMode) {
      payload.dates = dates;
    }

    if (dueTime) {
      payload.due_time = dueTime.length === 5 ? `${dueTime}:00` : dueTime;
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
          {isEditMode ? 'Modify details and subtasks of the existing task.' : 'Add a new action item and assign it to team members.'}
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
                searchable={true}
                searchPlaceholder="Search task types..."
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Repeat
              </label>
              <TaskRepeatPicker
                value={subtasks.length > 0 ? null : recurrence}
                onChange={setRecurrence}
                disabled={submitMutation.isPending}
                hasSubtasks={subtasks.length > 0}
                startDate={dates[0] || null}
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
              searchable={true}
              searchPlaceholder="Search projects..."
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
                multiple={true}
                disabled={submitMutation.isPending}
                value={selectedAssigneeIds}
                onChange={(val) => setSelectedAssigneeIds(val as string[])}
                placeholder="Unassigned"
                searchable={true}
                searchPlaceholder="Search members by name or email..."
                options={[
                  ...(teamMembers?.map((m) => ({
                    value: m.id,
                    label: m.name,
                    description: m.email,
                  })) || []),
                ]}
              />
            </div>
          </div>

          {/* APPROVAL SECTION */}
          {activeOrganization?.enable_task_approval !== false && (
            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">
                Approval
              </label>
              <div className="flex items-center gap-6 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="approvalRequired"
                    checked={approvalRequired}
                    onChange={() => setApprovalRequired(true)}
                    disabled={submitMutation.isPending}
                    className="text-black dark:text-white focus:ring-black dark:focus:ring-white"
                  />
                  <span>Need approval</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="approvalRequired"
                    checked={!approvalRequired}
                    onChange={() => {
                      setApprovalRequired(false);
                      setSelectedApproverId(null);
                    }}
                    disabled={submitMutation.isPending}
                    className="text-black dark:text-white focus:ring-black dark:focus:ring-white"
                  />
                  <span>No approval</span>
                </label>
              </div>

              {approvalRequired && (
                <div className="pt-1 space-y-1.5">
                  <CustomDropdown
                    label="Approver"
                    fullWidth
                    disabled={submitMutation.isPending}
                    value={selectedApproverId || ''}
                    onChange={(val) => setSelectedApproverId(val as string)}
                    placeholder="Select member"
                    searchable={true}
                    searchPlaceholder="Search approver by name..."
                    options={
                      teamMembers?.map((m) => ({
                        value: m.id,
                        label: m.name,
                        description: m.email,
                      })) || []
                    }
                  />
                  {selectedApproverId && (
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Task requires approval from {teamMembers?.find(m => m.id === selectedApproverId)?.name || 'selected approver'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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

          {/* SUBTASKS SECTION */}
          <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5 text-zinc-400" />
                Subtasks ({subtasks.length})
              </label>
              {!showAddSubForm && (
                <button
                  type="button"
                  disabled={submitMutation.isPending}
                  onClick={() => {
                    setShowAddSubForm(true);
                    setNewSubName('');
                    setNewSubDueDate('');
                    setNewSubDueTime('');
                    setNewSubAssigneeIds([]);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Subtask
                </button>
              )}
            </div>

            {/* List of current subtasks */}
            {subtasks.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
                  >
                    {editingSubId === st.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editSubName}
                          onChange={(e) => setEditSubName(e.target.value)}
                          placeholder="Subtask title *"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <DatePicker
                            multiSelect={false}
                            value={editSubDueDate}
                            onChange={(val) => setEditSubDueDate(val)}
                            placeholder="Due date"
                          />
                          <TimePicker
                            value={editSubDueTime}
                            onChange={(val) => setEditSubDueTime(val)}
                          />
                        </div>
                        <CustomDropdown
                          label="Subtask Assignees"
                          fullWidth
                          multiple={true}
                          value={editSubAssigneeIds}
                          onChange={(val) => setEditSubAssigneeIds(val as string[])}
                          placeholder="Unassigned"
                          options={
                            teamMembers?.map((m) => ({
                              value: m.id,
                              label: m.name,
                            })) || []
                          }
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingSubId(null)}
                            className="px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditSubtask(st.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-black text-white dark:bg-white dark:text-black rounded-lg"
                          >
                            Save Subtask
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="h-2 w-2 rounded-full bg-zinc-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                              {st.name}
                            </span>
                            {(st.due_date || st.assignee_ids.length > 0) && (
                              <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {st.due_date && <span>Due: {st.due_date}</span>}
                                {st.assignee_ids.length > 0 && (
                                  <span>
                                    Assignees: {st.assignee_ids.length} member{st.assignee_ids.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditSubtask(st)}
                            className="p-1 text-zinc-400 hover:text-black dark:hover:text-white rounded-md"
                            title="Edit subtask"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubtask(st.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 rounded-md"
                            title="Remove subtask"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New Subtask Input Form */}
            {showAddSubForm && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 animate-in fade-in duration-150">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  New Subtask
                </span>
                <input
                  type="text"
                  placeholder="Subtask title *"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    multiSelect={false}
                    value={newSubDueDate}
                    onChange={(val) => setNewSubDueDate(val)}
                    placeholder="Due date"
                  />
                  <TimePicker
                    value={newSubDueTime}
                    onChange={(val) => setNewSubDueTime(val)}
                  />
                </div>
                <CustomDropdown
                  label="Subtask Assignees"
                  fullWidth
                  multiple={true}
                  value={newSubAssigneeIds}
                  onChange={(val) => setNewSubAssigneeIds(val as string[])}
                  placeholder="Unassigned"
                  searchable={true}
                  searchPlaceholder="Search members..."
                  options={
                    teamMembers?.map((m) => ({
                      value: m.id,
                      label: m.name,
                    })) || []
                  }
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddSubForm(false)}
                    className="px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    className="px-3 py-1 text-xs font-semibold bg-black text-white dark:bg-white dark:text-black rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
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
