import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { X, CheckSquare, Calendar, Clock, AlertCircle, Trash2, Edit, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  taskId,
  onClose,
  onEdit,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Local state for subtask form
  const [subTaskName, setSubTaskName] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch individual Task details
  const { data: task, isLoading, error } = useQuery<Task>({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}/`);
      return response.data;
    },
    enabled: !!taskId,
  });

  // Task Completion Mutation
  const completeTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/tasks/${taskId}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Task Reopen Mutation
  const reopenTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/tasks/${taskId}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Task Delete Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/tasks/${taskId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
  });

  // Create Subtask Mutation
  const createSubTaskMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post(`/tasks/${taskId}/subtasks/`, { name });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setSubTaskName('');
    },
  });

  // Complete Subtask Mutation
  const completeSubTaskMutation = useMutation({
    mutationFn: async (subId: string) => {
      const response = await api.post(`/subtasks/${subId}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // Reopen Subtask Mutation
  const reopenSubTaskMutation = useMutation({
    mutationFn: async (subId: string) => {
      const response = await api.post(`/subtasks/${subId}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // Delete Subtask Mutation
  const deleteSubTaskMutation = useMutation({
    mutationFn: async (subId: string) => {
      await api.delete(`/subtasks/${subId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((item) => item[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleAddSubTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTaskName.trim()) return;
    createSubTaskMutation.mutate(subTaskName.trim());
  };

  const isAssignedToMe = task?.assignees.some((a) => a.id === user?.id) || false;
  const canComplete = isAdmin || isAssignedToMe;

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Sliding details drawer sheet */}
      <div className="relative w-full md:max-w-md h-full bg-white border-l border-zinc-200 shadow-xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 z-10 text-black">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Task Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-zinc-100 hover:border-zinc-300 text-zinc-400 hover:text-black rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Body content */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 w-3/4 bg-zinc-200 rounded"></div>
              <div className="h-4 w-1/2 bg-zinc-200 rounded"></div>
              <div className="space-y-2 pt-4">
                <div className="h-3 w-1/3 bg-zinc-200 rounded"></div>
                <div className="h-3 w-1/4 bg-zinc-200 rounded"></div>
              </div>
            </div>
          ) : error || !task ? (
            <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-xs font-medium text-red-600">
              Failed to load task. It may have been deleted or access was revoked.
            </div>
          ) : (
            <>
              {/* Task Title & Status Badges */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      task.status === 'COMPLETED'
                        ? 'bg-zinc-100 text-zinc-500'
                        : 'bg-black text-white'
                    }`}
                  >
                    {task.status}
                  </span>
                  
                  {task.priority && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        task.priority === 'HIGH'
                          ? 'bg-red-50 text-red-700'
                          : task.priority === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {task.priority} Priority
                    </span>
                  )}
                </div>
                
                <h2 className="text-xl font-bold tracking-tight text-black leading-tight">
                  {task.status === 'COMPLETED' ? (
                    <span className="line-through text-zinc-400">{task.name}</span>
                  ) : (
                    task.name
                  )}
                </h2>
              </div>

              {/* Task Meta Stats Grid */}
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-100 text-xs">
                <div className="space-y-1">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                    Due Date
                  </span>
                  <div className="flex items-center gap-1.5 font-medium text-black">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{task.due_date}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                    Due Time
                  </span>
                  <div className="flex items-center gap-1.5 font-medium text-black">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{task.due_time ? task.due_time.substring(0, 5) : 'No time set'}</span>
                  </div>
                </div>

                {task.project_detail && (
                  <div className="space-y-1 col-span-2">
                    <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                      Scope Location
                    </span>
                    <span className="font-semibold text-black">
                      {task.project_detail.name}
                      {task.sub_project_detail && ` · ${task.sub_project_detail.name}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Assignees Avatars list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Assignees
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 border border-zinc-200 bg-zinc-50/50 rounded-lg text-xs"
                    >
                      {assignee.avatar_url ? (
                        <img
                          src={assignee.avatar_url}
                          alt={assignee.name}
                          className="h-5 w-5 rounded-full object-cover border border-zinc-200 shrink-0"
                        />
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-[9px] font-bold text-zinc-600 shrink-0">
                          {getInitials(assignee.name)}
                        </div>
                      )}
                      <span className="font-medium text-zinc-800">{assignee.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Description
                </h4>
                <p className="text-sm text-zinc-600 leading-relaxed bg-zinc-50/30 border border-zinc-100 rounded-lg p-3 whitespace-pre-wrap">
                  {task.description || 'No description provided.'}
                </p>
              </div>

              {/* Subtasks Backlog */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Subtasks ({task.subtasks.length})
                </h4>

                {/* Subtasks lists */}
                {task.subtasks.length > 0 && (
                  <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 overflow-hidden bg-white">
                    {task.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-3 hover:bg-zinc-50/50 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={!canComplete || completeSubTaskMutation.isPending || reopenSubTaskMutation.isPending}
                            onClick={() => {
                              if (sub.status === 'COMPLETED') {
                                reopenSubTaskMutation.mutate(sub.id);
                              } else {
                                completeSubTaskMutation.mutate(sub.id);
                              }
                            }}
                            className="text-zinc-400 hover:text-black shrink-0 disabled:opacity-50 transition-all duration-200 active:scale-90 hover:scale-110"
                          >
                            {sub.status === 'COMPLETED' ? (
                              <CheckCircle2 className="h-4.5 w-4.5 text-zinc-400 animate-pop" />
                            ) : (
                              <Circle className="h-4.5 w-4.5 transition-transform duration-200" />
                            )}
                          </button>
                          
                          <span className={`${sub.status === 'COMPLETED' ? 'strike-through-anim text-zinc-400' : 'text-zinc-800'}`}>
                            {sub.name}
                          </span>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => deleteSubTaskMutation.mutate(sub.id)}
                            disabled={deleteSubTaskMutation.isPending}
                            className="text-zinc-400 hover:text-red-600 p-1 rounded hover:bg-red-50/50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Subtask box (Admin only) */}
                {isAdmin && (
                  <form onSubmit={handleAddSubTask} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add subtask..."
                      value={subTaskName}
                      onChange={(e) => setSubTaskName(e.target.value)}
                      disabled={createSubTaskMutation.isPending}
                      className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-black transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={createSubTaskMutation.isPending || !subTaskName.trim()}
                      className="px-3 py-1.5 bg-black hover:bg-zinc-800 text-white font-semibold rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>

              {/* Creators & Timestamps footer details */}
              <div className="pt-4 border-t border-zinc-100 text-[10px] text-zinc-400 space-y-1">
                <div>Created by: {task.created_by_detail.name}</div>
                <div>Created: {new Date(task.created_at).toLocaleString()}</div>
                <div>Updated: {new Date(task.updated_at).toLocaleString()}</div>
                {task.status === 'COMPLETED' && task.completed_by_detail && (
                  <div className="text-zinc-500 font-medium">
                    Completed by {task.completed_by_detail.name} on{' '}
                    {new Date(task.completed_at!).toLocaleString()}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Actions Footer */}
        {task && !isLoading && (
          <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex gap-2">
            {/* Task complete checkbox toggle */}
            {task.status === 'PENDING' ? (
              <button
                type="button"
                disabled={!canComplete || completeTaskMutation.isPending}
                onClick={() => completeTaskMutation.mutate()}
                className="flex-1 py-2 bg-black hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete Task
              </button>
            ) : (
              canComplete && (
                <button
                  type="button"
                  disabled={reopenTaskMutation.isPending}
                  onClick={() => reopenTaskMutation.mutate()}
                  className="flex-1 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-black text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <AlertCircle className="h-4 w-4" />
                  Reopen Task
                </button>
              )
            )}

            {/* Admin modifications buttons */}
            {isAdmin && (
              <>
                <button
                  onClick={() => onEdit(task)}
                  className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 rounded-lg transition-colors"
                  title="Edit Task"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="p-2 border border-zinc-200 bg-white hover:border-red-50 hover:bg-red-50/20 text-zinc-600 hover:text-red-600 rounded-lg transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* CONFIRM TASK DELETE DIALOG */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-sm w-full p-6 shadow-lg text-center relative animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600 mb-4">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-black mb-1">Delete Task?</h3>
            <p className="text-xs text-zinc-500 mb-6">
              This action cannot be undone. This task will be removed from all projects and assignees.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold rounded-lg transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTaskMutation.mutate()}
                disabled={deleteTaskMutation.isPending}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs transition-colors flex-1"
              >
                {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
