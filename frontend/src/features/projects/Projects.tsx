import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { Project } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { Folder, Plus, X } from 'lucide-react';

export const Projects: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  // Fetch projects list
  const { data: projects, isLoading, error: fetchError } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects/');
      return response.data;
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await api.post('/projects/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setError(null);
    },
    onError: (err: any) => {
      if (err.response?.data?.name) {
        setError(err.response.data.name[0]);
      } else {
        setError('Failed to create project. Please try again.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    createProjectMutation.mutate({ name, description });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"></div>
          <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-zinc-150 dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50"></div>
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 text-sm font-medium text-red-600 dark:text-red-400">
        Failed to load projects. Please verify connection and auth state.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Projects</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage company client scopes and project hierarchies.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 md:gap-2 md:px-4 md:py-2 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-medium rounded-lg text-xs md:text-sm transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">Create Project</span>
            <span className="inline md:hidden">Project</span>
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {!projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black p-12 text-center text-black dark:text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-550 mb-4">
            <Folder className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">No projects yet</h3>
          {isAdmin ? (
            <>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                Create your first project to begin grouping sub-projects and tasks.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
              >
                Create Project
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              No projects have been created yet. Ask your manager to set up a project.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/app/projects/${project.id}`}
              className="group border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white bg-white dark:bg-black rounded-xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-200 text-black dark:text-white"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <Folder className="h-4 w-4 text-zinc-400 group-hover:text-black dark:group-hover:text-white shrink-0" />
                  <h3 className="font-semibold text-sm text-black dark:text-white truncate">{project.name}</h3>
                </div>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>
              </div>

              {/* Progress and task count bar */}
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-semibold uppercase tracking-wider">
                  {project.task_count ?? 0} {project.task_count === 1 ? 'task' : 'tasks'}
                </span>
                
                {project.progress !== null ? (
                  <div className="flex items-center gap-2">
                    {/* Visual Bar */}
                    <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full"
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-black dark:text-white">{project.progress}%</span>
                  </div>
                ) : (
                  <span className="text-zinc-400 italic font-medium">No tasks yet</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-none z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-6 shadow-lg relative animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-bold text-base text-black dark:text-white mb-1">Create Project</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Add a new primary company scope to organize assignments.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 text-xs font-medium text-red-650 dark:text-red-400">
                  {error}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={createProjectMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  placeholder="Provide details about the scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={createProjectMutation.isPending}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={createProjectMutation.isPending}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="px-3 py-1.5 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-xs tracking-wide transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white dark:border-black border-t-transparent"></div>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
