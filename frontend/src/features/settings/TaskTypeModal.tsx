import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import type { TaskType } from '../../types';
import { api } from '../../services/api';

interface TaskTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (taskType: TaskType) => void;
  initialData?: TaskType | null;
}

export const TaskTypeModal: React.FC<TaskTypeModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialData
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || '');
        const totalSecs = initialData.allocated_seconds || 3600;
        setHours(Math.floor(totalSecs / 3600));
        setMinutes(Math.floor((totalSecs % 3600) / 60));
        setIsActive(initialData.is_active);
      } else {
        setName('');
        setDescription('');
        setHours(1);
        setMinutes(0);
        setIsActive(true);
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Task type name is required.');
      return;
    }

    const totalSeconds = (hours * 3600) + (minutes * 60);
    if (totalSeconds <= 0) {
      setError('Duration must be greater than 0 minutes.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let res;
      if (initialData) {
        res = await api.patch<TaskType>(`/task-types/${initialData.id}/`, {
          name: name.trim(),
          description: description.trim() || null,
          allocated_seconds: totalSeconds,
          is_active: isActive
        });
      } else {
        res = await api.post<TaskType>('/task-types/', {
          name: name.trim(),
          description: description.trim() || null,
          allocated_seconds: totalSeconds,
          is_active: isActive
        });
      }
      onSaved(res.data);
      onClose();
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data?.name) {
        setError(`Name error: ${err.response.data.name.join(' ')}`);
      } else {
        setError('Failed to save Task Type. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {initialData ? 'Edit Task Type' : 'Add Task Type'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Task Type Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Logo Design, Video Editing, Social Media Post"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the work scope or guidelines"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors resize-none"
            />
          </div>

          {/* Allocated Duration inputs */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Allocated Duration <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Hours</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Total allocated time: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{hours}h {minutes}m</span> ({((hours * 3600) + (minutes * 60))} seconds)
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between pt-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Status</span>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Footer */}
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
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>{initialData ? 'Save Changes' : 'Create Task Type'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
