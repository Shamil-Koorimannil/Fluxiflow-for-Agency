import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import type { Client, Project, ProjectTemplate, TemplateTask } from '../../types';
import { api } from '../../services/api';
import { CustomDropdown } from '../../components/common/CustomDropdown';
import { useOrganization } from '../../context/OrganizationContext';

interface TemplateCustomizeModalProps {
  template: ProjectTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
  preselectedClientId?: string;
}

export const TemplateCustomizeModal: React.FC<TemplateCustomizeModalProps> = ({
  template,
  isOpen,
  onClose,
  onProjectCreated,
  preselectedClientId
}) => {
  const queryClient = useQueryClient();
  const { isAdmin } = useOrganization();

  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [projectDate, setProjectDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [clients, setClients] = useState<Client[]>([]);

  const [tasksSnapshot, setTasksSnapshot] = useState<TemplateTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingTemplate, setFetchingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients for admin
  useEffect(() => {
    if (isOpen && isAdmin) {
      api.get<Client[]>('/clients/')
        .then(res => setClients(res.data))
        .catch(() => setClients([]));
    }
  }, [isOpen, isAdmin]);

  // Load template structure when modal opens
  useEffect(() => {
    if (isOpen && template) {
      setProjectName(template.name || '');
      setDescription(template.description || '');
      setProjectDate('');
      setSelectedClientId(preselectedClientId || '');
      setError(null);

      if (template.tasks && template.tasks.length > 0) {
        setTasksSnapshot(JSON.parse(JSON.stringify(template.tasks)));
      } else {
        setFetchingTemplate(true);
        api.get<ProjectTemplate>(`/templates/${template.id}/`)
          .then(res => {
            if (res.data.tasks) {
              setTasksSnapshot(JSON.parse(JSON.stringify(res.data.tasks)));
            }
          })
          .catch(() => setTasksSnapshot([]))
          .finally(() => setFetchingTemplate(false));
      }
    }
  }, [isOpen, template, preselectedClientId]);

  if (!isOpen || !template) return null;

  // Task snapshot manipulation functions
  const handleTaskNameChange = (tIdx: number, val: string) => {
    setTasksSnapshot(prev => {
      const updated = [...prev];
      updated[tIdx] = { ...updated[tIdx], name: val };
      return updated;
    });
  };

  const handleTaskPriorityChange = (tIdx: number, val: 'LOW' | 'MEDIUM' | 'HIGH') => {
    setTasksSnapshot(prev => {
      const updated = [...prev];
      updated[tIdx] = { ...updated[tIdx], priority: val };
      return updated;
    });
  };

  const handleAddTask = () => {
    setTasksSnapshot(prev => [
      ...prev,
      {
        name: `New Task ${prev.length + 1}`,
        description: '',
        priority: 'MEDIUM',
        position: prev.length,
        subtasks: []
      }
    ]);
  };

  const handleRemoveTask = (tIdx: number) => {
    setTasksSnapshot(prev => prev.filter((_, idx) => idx !== tIdx));
  };

  const handleMoveTask = (tIdx: number, direction: 'UP' | 'DOWN') => {
    setTasksSnapshot(prev => {
      const updated = [...prev];
      const targetIdx = direction === 'UP' ? tIdx - 1 : tIdx + 1;
      if (targetIdx < 0 || targetIdx >= updated.length) return prev;
      const temp = updated[tIdx];
      updated[tIdx] = updated[targetIdx];
      updated[targetIdx] = temp;
      return updated;
    });
  };

  // Subtask snapshot manipulation functions
  const handleSubtaskNameChange = (tIdx: number, sIdx: number, val: string) => {
    setTasksSnapshot(prev => {
      const updated = [...prev];
      const subtasks = [...(updated[tIdx].subtasks || [])];
      subtasks[sIdx] = { ...subtasks[sIdx], name: val };
      updated[tIdx] = { ...updated[tIdx], subtasks };
      return updated;
    });
  };

  const handleAddSubtask = (tIdx: number) => {
    setTasksSnapshot(prev => {
      const updated = [...prev];
      const subtasks = [...(updated[tIdx].subtasks || [])];
      subtasks.push({
        name: `New Subtask ${subtasks.length + 1}`,
        position: subtasks.length
      });
      updated[tIdx] = { ...updated[tIdx], subtasks };
      return updated;
    });
  };

  const handleRemoveSubtask = (tIdx: number, sIdx: number) => {
    setTasksSnapshot(prev => {
      const updated = [...prev];
      const subtasks = (updated[tIdx].subtasks || []).filter((_, idx) => idx !== sIdx);
      updated[tIdx] = { ...updated[tIdx], subtasks };
      return updated;
    });
  };

  const handleMoveSubtask = (tIdx: number, sIdx: number, direction: 'UP' | 'DOWN') => {
    setTasksSnapshot(prev => {
      const updated = [...prev];
      const subtasks = [...(updated[tIdx].subtasks || [])];
      const targetIdx = direction === 'UP' ? sIdx - 1 : sIdx + 1;
      if (targetIdx < 0 || targetIdx >= subtasks.length) return prev;
      const temp = subtasks[sIdx];
      subtasks[sIdx] = subtasks[targetIdx];
      subtasks[targetIdx] = temp;
      updated[tIdx] = { ...updated[tIdx], subtasks };
      return updated;
    });
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: projectName.trim(),
      description: description.trim() || null,
      client: selectedClientId || null,
      project_date: projectDate || null,
      tasks: tasksSnapshot.map((t, idx) => ({
        name: t.name.trim(),
        description: t.description || null,
        priority: t.priority || 'MEDIUM',
        position: idx,
        subtasks: (t.subtasks || []).map((st, sIdx) => ({
          name: typeof st === 'string' ? st : st.name.trim(),
          position: sIdx
        }))
      }))
    };

    try {
      const res = await api.post<Project>(`/templates/${template.id}/create-project/`, payload);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (onProjectCreated) {
        onProjectCreated(res.data);
      }
      onClose();
    } catch (err: any) {
      if (err.response?.data?.name) {
        setError(err.response.data.name[0]);
      } else {
        setError('Failed to create project from template. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Customize Template Snapshot
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {template.name} ({template.industry_name}) — Original template will remain unchanged.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Details Section */}
          <div className="space-y-4 bg-zinc-50/70 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Project Information
            </h3>

            {/* Project Name */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Acme Brand Strategy"
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white transition-colors"
              />
            </div>

            {/* Client Selection (Admin Only) */}
            {isAdmin && (
              <div>
                <CustomDropdown
                  label="Client (Optional)"
                  fullWidth
                  value={selectedClientId}
                  onChange={(val) => setSelectedClientId(val)}
                  placeholder="No Client (Internal Agency Project)"
                  searchable={true}
                  searchPlaceholder="Search clients..."
                  options={[
                    { value: '', label: 'No Client (Internal Agency Project)' },
                    ...clients.map((c) => ({
                      value: c.id,
                      label: `${c.name} ${c.company_name ? `(${c.company_name})` : ''}`,
                    })),
                  ]}
                />
              </div>
            )}

            {/* Project Date & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Project Date / Month (Optional)
                </label>
                <input
                  type="date"
                  value={projectDate}
                  onChange={(e) => setProjectDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope or brief notes..."
                  className="w-full px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white"
                />
              </div>
            </div>
          </div>

          {/* Workflow Customization Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Customizable Tasks & Subtasks
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Rename, reorder, add, or remove items for this specific project.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTask}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            {fetchingTemplate ? (
              <div className="flex items-center justify-center py-12 text-zinc-400">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                <span>Loading template tasks...</span>
              </div>
            ) : tasksSnapshot.length === 0 ? (
              <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-400">
                No tasks in customization. Click "Add Task" above to add your first task.
              </div>
            ) : (
              <div className="space-y-3">
                {tasksSnapshot.map((task, tIdx) => (
                  <div
                    key={tIdx}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 transition-colors"
                  >
                    {/* Task Header Bar */}
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                        {tIdx + 1}
                      </span>

                      {/* Inline Task Name Input */}
                      <input
                        type="text"
                        value={task.name}
                        onChange={(e) => handleTaskNameChange(tIdx, e.target.value)}
                        placeholder="Task Name"
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold outline-none focus:border-black dark:focus:border-white"
                      />

                      {/* Priority selector */}
                      <select
                        value={task.priority || 'MEDIUM'}
                        onChange={(e) => handleTaskPriorityChange(tIdx, e.target.value as any)}
                        className="px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 outline-none"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>

                      {/* Reorder & Remove Task */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={tIdx === 0}
                          onClick={() => handleMoveTask(tIdx, 'UP')}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={tIdx === tasksSnapshot.length - 1}
                          onClick={() => handleMoveTask(tIdx, 'DOWN')}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(tIdx)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subtasks Section */}
                    <div className="ml-7 space-y-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                      {task.subtasks && task.subtasks.map((subtask, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2">
                          <CornerDownRight className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={typeof subtask === 'string' ? subtask : subtask.name}
                            onChange={(e) => handleSubtaskNameChange(tIdx, sIdx, e.target.value)}
                            placeholder="Subtask Name"
                            className="flex-1 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:border-black dark:focus:border-white"
                          />
                          <button
                            type="button"
                            disabled={sIdx === 0}
                            onClick={() => handleMoveSubtask(tIdx, sIdx, 'UP')}
                            className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={sIdx === (task.subtasks?.length || 0) - 1}
                            onClick={() => handleMoveSubtask(tIdx, sIdx, 'DOWN')}
                            className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtask(tIdx, sIdx)}
                            className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-md"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddSubtask(tIdx)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Subtask</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Submit Bar */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
