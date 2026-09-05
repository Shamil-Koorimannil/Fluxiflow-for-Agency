import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Tag, RefreshCw, AlertCircle, Check } from 'lucide-react';
import type { TaskType, OrganizationSettings } from '../../types';
import { api } from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { TaskTypeModal } from './TaskTypeModal';

export const TaskTypeSettings: React.FC = () => {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [settings, setSettings] = useState<OrganizationSettings>({
    enable_task_types: true,
    weekly_capacity_hours: 40
  });

  const [loading, setLoading] = useState(true);
  const [savingSetting, setSavingSetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | null>(null);

  const { isAdmin } = useOrganization();

  const fetchSettingsAndTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, typesRes] = await Promise.all([
        api.get<OrganizationSettings>('/organization-settings/'),
        api.get<TaskType[]>('/task-types/')
      ]);
      setSettings(settingsRes.data);
      setTaskTypes(typesRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load Task Type settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettingsAndTypes();
  }, [fetchSettingsAndTypes]);

  const handleToggleEnable = async () => {
    setSavingSetting(true);
    setError(null);
    const updatedStatus = !settings.enable_task_types;
    try {
      const res = await api.post<OrganizationSettings>('/organization-settings/', {
        enable_task_types: updatedStatus
      });
      setSettings(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update Task Types setting.');
    } finally {
      setSavingSetting(false);
    }
  };

  const handleCapacityChange = async (newCapacity: number) => {
    setSavingSetting(true);
    setError(null);
    try {
      const res = await api.post<OrganizationSettings>('/organization-settings/', {
        weekly_capacity_hours: newCapacity
      });
      setSettings(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update weekly capacity hours.');
    } finally {
      setSavingSetting(false);
    }
  };

  const handleToggleActive = async (taskType: TaskType) => {
    setError(null);
    try {
      const res = await api.patch<TaskType>(`/task-types/${taskType.id}/`, {
        is_active: !taskType.is_active
      });
      setTaskTypes(prev => prev.map(t => t.id === taskType.id ? res.data : t));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to toggle Task Type status.');
    }
  };

  const handleDeleteTaskType = async (taskType: TaskType) => {
    if (!confirm(`Are you sure you want to delete Task Type "${taskType.name}"? Existing tasks will retain their snapshotted duration.`)) return;
    setError(null);
    try {
      await api.delete(`/task-types/${taskType.id}/`);
      setTaskTypes(prev => prev.filter(t => t.id !== taskType.id));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete Task Type.');
    }
  };

  const formatReadable = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  if (!isAdmin) {
    return (
      <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 font-medium">
        Task Type management is restricted to organization administrators and project managers.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400 gap-2 text-xs">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Loading Task Type settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Feature Toggle Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-500" />
              <span>Enable Task Types</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
              Allow defining standard work categories (e.g. Logo Design, Video Editing) and allocated duration for accurate workload tracking.
            </p>
          </div>

          <button
            type="button"
            disabled={savingSetting}
            onClick={handleToggleEnable}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              settings.enable_task_types ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                settings.enable_task_types ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Weekly Capacity Hours Input */}
        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Default Weekly Member Capacity</span>
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">Used to calculate team member workload percentages (e.g. 40 hours/week).</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="168"
              value={settings.weekly_capacity_hours || 40}
              onChange={(e) => handleCapacityChange(parseInt(e.target.value) || 40)}
              className="w-20 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none text-center"
            />
            <span className="font-semibold text-zinc-500">hours / week</span>
          </div>
        </div>
      </div>

      {/* Task Types Management Section */}
      {settings.enable_task_types && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Task Types & Duration Specs
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage preset work categories and their expected durations.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedTaskType(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Task Type</span>
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {taskTypes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/50 dark:bg-zinc-900/40 p-6">
              <Tag className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">No Task Types created yet</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Add your agency's common deliverables (e.g., Logo Design, Video Editing, Social Media Post).</p>
              <button
                onClick={() => {
                  setSelectedTaskType(null);
                  setIsModalOpen(true);
                }}
                className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-semibold rounded-xl"
              >
                + Add First Task Type
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Task Type</th>
                      <th className="py-3 px-4">Allocated Duration</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
                    {taskTypes.map(tt => (
                      <tr key={tt.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold">
                          <div>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{tt.name}</span>
                            {tt.description && (
                              <p className="text-[11px] text-zinc-400 font-normal truncate max-w-xs">{tt.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs border border-blue-200 dark:border-blue-800">
                            {formatReadable(tt.allocated_seconds)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(tt)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                              tt.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700'
                            }`}
                          >
                            {tt.is_active && <Check className="h-3 w-3" />}
                            <span>{tt.is_active ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1">
                          <button
                            onClick={() => {
                              setSelectedTaskType(tt);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Edit Task Type"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTaskType(tt)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="Delete Task Type"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Type Add/Edit Modal */}
      <TaskTypeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => fetchSettingsAndTypes()}
        initialData={selectedTaskType}
      />
    </div>
  );
};
