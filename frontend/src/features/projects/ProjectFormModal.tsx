import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X, Folder, AlertCircle, RefreshCw } from 'lucide-react';
import type { Client, Project } from '../../types';
import { api } from '../../services/api';

import { CustomDropdown } from '../../components/common/CustomDropdown';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedClientId?: string;
  onProjectCreated?: () => void;
}

import { useOrganization } from '../../context/OrganizationContext';

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  preselectedClientId,
  onProjectCreated
}) => {
  const queryClient = useQueryClient();
  const { isAdmin } = useOrganization();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectDate, setProjectDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [clients, setClients] = useState<Client[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedClientId) {
      setSelectedClientId(preselectedClientId);
    }
  }, [preselectedClientId]);

  // Fetch clients if user is admin
  useEffect(() => {
    if (isOpen && isAdmin) {
      api.get<Client[]>('/clients/')
        .then(res => setClients(res.data))
        .catch(() => setClients([]));
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      project_date: projectDate || null,
      client: selectedClientId || null
    };

    try {
      await api.post<Project>('/projects/', payload);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (onProjectCreated) onProjectCreated();
      onClose();
      setName('');
      setDescription('');
      setProjectDate('');
      setSelectedClientId(preselectedClientId || '');
    } catch (err: any) {
      if (err.response?.data?.name) {
        setError(err.response.data.name[0]);
      } else {
        setError('Failed to create project. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Create New Project
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white transition-colors"
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
                searchPlaceholder="Search clients by name or company..."
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

          {/* Project Date */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Project Date / Month (Optional)
            </label>
            <input
              type="date"
              value={projectDate}
              onChange={(e) => setProjectDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope of work, deliverables, key milestones..."
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white resize-none"
            />
          </div>

          {/* Footer */}
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
