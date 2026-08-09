import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Project, SubProject, Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { ArrowLeft, Plus, Trash2, Folder, CheckSquare, Users, X, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  // State for active tab
  const [activeTab, setActiveTab] = useState<'tasks' | 'subprojects' | 'team'>('tasks');
  
  // Modal states
  const [isSubProjModalOpen, setIsSubProjModalOpen] = useState(false);
  const [isDeleteProjModalOpen, setIsDeleteProjModalOpen] = useState(false);
  const [subProjDeleteTarget, setSubProjDeleteTarget] = useState<SubProject | null>(null);

  // Form states
  const [subProjName, setSubProjName] = useState('');
  const [subProjDesc, setSubProjDesc] = useState('');
  const [subProjError, setSubProjError] = useState<string | null>(null);

  // Fetch Project details
  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await api.get(`/projects/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch Project Subprojects
  const { data: subprojects, isLoading: isSubProjLoading } = useQuery<SubProject[]>({
    queryKey: ['subprojects', id],
    queryFn: async () => {
      const response = await api.get(`/projects/${id}/subprojects/`);
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch Project Tasks
  const { data: tasks, isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks', { project: id }],
    queryFn: async () => {
      const response = await api.get(`/tasks/?project=${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Create subproject mutation
  const createSubProjMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await api.post(`/projects/${id}/subprojects/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subprojects', id] });
      setIsSubProjModalOpen(false);
      setSubProjName('');
      setSubProjDesc('');
      setSubProjError(null);
    },
    onError: (err: any) => {
      if (err.response?.data?.name) {
        setSubProjError(err.response.data.name[0]);
      } else {
        setSubProjError('Failed to create sub-project.');
      }
    },
  });

  // Delete subproject mutation
  const deleteSubProjMutation = useMutation({
    mutationFn: async (subId: string) => {
      await api.delete(`/subprojects/${subId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subprojects', id] });
      setSubProjDeleteTarget(null);
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

  const handleCreateSubProj = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subProjName.trim()) {
      setSubProjError('Name is required.');
      return;
    }
    createSubProjMutation.mutate({ name: subProjName, description: subProjDesc });
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-50 text-red-700';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700';
      case 'LOW':
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-zinc-100 text-zinc-700';
    }
  };

  if (isProjectLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-6 w-24 bg-zinc-200 rounded"></div>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-zinc-200 rounded"></div>
            <div className="h-4 w-96 bg-zinc-200 rounded"></div>
          </div>
          <div className="h-10 w-24 bg-zinc-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Link to="/app/projects" className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Link>
        <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm font-medium text-red-600">
          Failed to load project details. It may have been deleted or you lack access permissions.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Breadcrumb back to projects */}
      <div>
        <Link
          to="/app/projects"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </div>

      {/* Project Meta Details Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            {project.description || 'No description provided.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {project.progress !== null ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 flex items-center gap-2.5">
              <div className="w-16 h-2 bg-zinc-200 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-black rounded-full"
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-black">{project.progress}% completed</span>
            </div>
          ) : (
            <span className="text-xs text-zinc-400 italic font-semibold">No tasks</span>
          )}

          {isAdmin && (
            <button
              onClick={() => setIsDeleteProjModalOpen(true)}
              className="p-2 border border-zinc-200 hover:border-red-200 text-zinc-500 hover:text-red-600 hover:bg-red-50/20 rounded-lg transition-colors"
              title="Delete Project"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="border-b border-zinc-200 flex gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 transition-all ${
            activeTab === 'tasks' ? 'border-b-2 border-black text-black' : 'text-zinc-400 hover:text-black'
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab('subprojects')}
          className={`pb-3 transition-all ${
            activeTab === 'subprojects' ? 'border-b-2 border-black text-black' : 'text-zinc-400 hover:text-black'
          }`}
        >
          Sub-projects
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`pb-3 transition-all ${
            activeTab === 'team' ? 'border-b-2 border-black text-black' : 'text-zinc-400 hover:text-black'
          }`}
        >
          Project Team
        </button>
      </div>

      {/* TAB CONTENTS */}
      <div className="pt-2">
        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Project Tasks ({tasks?.length || 0})
              </h3>
              {isAdmin && (
                <Link
                  to={`/app/tasks?create_project_id=${project.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Task
                </Link>
              )}
            </div>

            {isTasksLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-zinc-100 animate-pulse rounded-lg border border-zinc-200/50"></div>
                ))}
              </div>
            ) : !tasks || tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
                <CheckSquare className="h-6 w-6 text-zinc-400 mb-2" />
                <h3 className="font-semibold text-sm">No tasks assigned</h3>
                {isAdmin && (
                  <Link
                    to={`/app/tasks?create_project_id=${project.id}`}
                    className="mt-3 px-3 py-1.5 bg-black hover:bg-zinc-800 text-white font-semibold rounded-lg text-xs transition-colors"
                  >
                    Create Project Task
                  </Link>
                )}
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {tasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/app/tasks?task=${task.id}`}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      {task.status === 'COMPLETED' ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-zinc-400 shrink-0 mt-0.5 md:mt-0" />
                      ) : (
                        <Circle className="h-4.5 w-4.5 text-zinc-400 shrink-0 mt-0.5 md:mt-0" />
                      )}
                      <div>
                        <h4 className={`text-sm font-semibold ${task.status === 'COMPLETED' ? 'line-through text-zinc-400' : 'text-black'}`}>
                          {task.name}
                        </h4>
                        {task.sub_project_detail && (
                          <span className="text-[10px] bg-zinc-100 font-semibold px-2 py-0.5 rounded-full text-zinc-500 mt-1 inline-block">
                            {task.sub_project_detail.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-start md:self-auto shrink-0 text-xs">
                      {task.priority && (
                        <span className={`px-1.5 py-0.5 rounded-md font-semibold text-[10px] ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}

                      <div className="flex -space-x-1.5 overflow-hidden">
                        {task.assignees.map((a) => (
                          <div
                            key={a.id}
                            title={a.name}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 border border-white text-[9px] font-bold text-zinc-600 shrink-0"
                          >
                            {a.name[0].toUpperCase()}
                          </div>
                        ))}
                      </div>

                      <span className="text-zinc-500 font-medium">
                        Due: {new Date(task.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBPROJECTS TAB */}
        {activeTab === 'subprojects' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Sub-projects ({subprojects?.length || 0})
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setIsSubProjModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Sub-project
                </button>
              )}
            </div>

            {isSubProjLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-zinc-100 animate-pulse rounded-lg border border-zinc-200/50"></div>
                ))}
              </div>
            ) : !subprojects || subprojects.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
                <Folder className="h-6 w-6 text-zinc-400 mb-2" />
                <h3 className="font-semibold text-sm">No sub-projects</h3>
                {isAdmin && (
                  <button
                    onClick={() => setIsSubProjModalOpen(true)}
                    className="mt-3 px-3 py-1.5 bg-black hover:bg-zinc-800 text-white font-semibold rounded-lg text-xs transition-colors"
                  >
                    Add Sub-project
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {subprojects.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 hover:bg-zinc-50/50 transition-colors">
                    <div>
                      <h4 className="font-semibold text-sm text-black">{sub.name}</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">{sub.description || 'No description.'}</p>
                    </div>
                    
                    {isAdmin && (
                      <button
                        onClick={() => setSubProjDeleteTarget(sub)}
                        className="p-1.5 border border-zinc-100 text-zinc-400 hover:text-red-600 hover:bg-red-50/40 rounded-md transition-colors"
                        title="Delete Sub-project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Assigned Team Members ({project.members?.length || 0})
            </h3>
            
            {!project.members || project.members.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
                <Users className="h-6 w-6 text-zinc-400 mb-2" />
                <h3 className="font-semibold text-sm">No team members</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {project.members.map((member) => (
                  <div key={member.id} className="border border-zinc-200 bg-white rounded-xl p-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-600 shrink-0">
                      {member.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-black truncate">{member.name}</h4>
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                        {member.role === 'ADMIN' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONFIRM PROJECT DELETE MODAL */}
      {isDeleteProjModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-sm w-full p-6 shadow-lg text-center relative animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600 mb-4">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-black mb-1">Delete Project?</h3>
            <p className="text-xs text-zinc-500 mb-6">
              This action cannot be undone. All sub-projects and tasks in this project will also be deleted.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDeleteProjModalOpen(false)}
                className="px-3.5 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors flex-1"
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

      {/* CONFIRM SUB-PROJECT DELETE MODAL */}
      {subProjDeleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-sm w-full p-6 shadow-lg text-center relative animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600 mb-4">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-black mb-1">Delete Sub-project?</h3>
            <p className="text-xs text-zinc-500 mb-6">
              Delete sub-project "{subProjDeleteTarget.name}". This will remove it from its tasks.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setSubProjDeleteTarget(null)}
                className="px-3.5 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSubProjMutation.mutate(subProjDeleteTarget.id)}
                disabled={deleteSubProjMutation.isPending}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs transition-colors flex-1"
              >
                {deleteSubProjMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SUB-PROJECT MODAL */}
      {isSubProjModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-lg relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsSubProjModalOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-black transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-bold text-base text-black mb-1">Add Sub-project</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Create a child phase or department under this project.
            </p>

            <form onSubmit={handleCreateSubProj} className="space-y-4">
              {subProjError && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs font-medium text-red-600">
                  {subProjError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Sub-project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frontend Work"
                  value={subProjName}
                  onChange={(e) => setSubProjName(e.target.value)}
                  disabled={createSubProjMutation.isPending}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  placeholder="Details about this sub-phase..."
                  value={subProjDesc}
                  onChange={(e) => setSubProjDesc(e.target.value)}
                  disabled={createSubProjMutation.isPending}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsSubProjModalOpen(false)}
                  disabled={createSubProjMutation.isPending}
                  className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubProjMutation.isPending}
                  className="px-3 py-1.5 bg-black hover:bg-zinc-800 text-white font-semibold rounded-lg text-xs tracking-wide transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {createSubProjMutation.isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
