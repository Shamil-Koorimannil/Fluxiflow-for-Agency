import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Search, Folder, RefreshCw, AlertCircle, Check } from 'lucide-react';
import type { Project } from '../../types';
import { api } from '../../services/api';

interface AddExistingProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onProjectsAdded: () => void;
}

export const AddExistingProjectModal: React.FC<AddExistingProjectModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  onProjectsAdded
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [unassignedProjects, setUnassignedProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUnassignedProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const res = await api.get<Project[]>(`/clients/unassigned-projects/?${params.toString()}`);
      setUnassignedProjects(res.data);
    } catch (err: any) {
      setError('Failed to fetch available projects.');
    } finally {
      setLoading(false);
    }
  }, [clientId, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchUnassignedProjects();
      setSelectedProjectIds(new Set());
      setSearchQuery('');
    }
  }, [isOpen, fetchUnassignedProjects]);

  if (!isOpen) return null;

  const toggleSelectProject = (id: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedProjectIds.size === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.post(`/clients/${clientId}/projects/add-existing/`, {
        project_ids: Array.from(selectedProjectIds)
      });
      onProjectsAdded();
      onClose();
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to associate project(s). Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Add Existing Project
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Associate existing organization projects with <span className="font-semibold text-zinc-700 dark:text-zinc-300">{clientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by name..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {/* List of unassigned projects */}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-400 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading projects...</span>
            </div>
          ) : unassignedProjects.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold">No available projects found</p>
              <p className="text-[11px] mt-0.5">All projects in your organization are already linked or no projects match your query.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {unassignedProjects.map(project => {
                const isSelected = selectedProjectIds.has(project.id);
                return (
                  <div
                    key={project.id}
                    onClick={() => toggleSelectProject(project.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate">{project.name}</p>
                        {project.client_display_name && (
                          <p className="text-[10px] text-zinc-400 truncate">Current client: {project.client_display_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {selectedProjectIds.size} selected
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedProjectIds.size === 0 || submitting}
              onClick={handleAddSelected}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>Add Selected ({selectedProjectIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
