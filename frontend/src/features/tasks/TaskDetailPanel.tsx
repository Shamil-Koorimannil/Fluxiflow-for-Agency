import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { X, CheckSquare, Calendar, Clock, AlertCircle, Trash2, Edit, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { formatLateDuration } from '../../utils/time';

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

  // Subtask Completion Mutation
  const completeSubTaskMutation = useMutation({
    mutationFn: async (subTaskId: string) => {
      const response = await api.post(`/subtasks/${subTaskId}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Subtask Reopen Mutation
  const reopenSubTaskMutation = useMutation({
    mutationFn: async (subTaskId: string) => {
      const response = await api.post(`/subtasks/${subTaskId}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Create Subtask Mutation
  const createSubTaskMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post(`/subtasks/`, {
        task: taskId,
        name,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSubTaskName('');
    },
  });

  // Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/tasks/${taskId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsDeleteModalOpen(false);
      onClose();
    },
  });

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-650 bg-red-50 dark:text-red-400 dark:bg-red-950/20';
      case 'MEDIUM':
        return 'text-amber-650 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20';
      case 'LOW':
        return 'text-blue-650 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20';
      default:
        return 'text-zinc-550 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-900';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleSubTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTaskName.trim()) return;
    createSubTaskMutation.mutate(subTaskName.trim());
  };

  const isAssigned = task?.assignees.some((a) => a.id === user?.id) || false;
  const canComplete = isAdmin || isAssigned;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Sliding details drawer sheet */}
      <div className="relative w-full md:max-w-md h-full bg-white dark:bg-black border-l border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 z-10 text-black dark:text-white">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-850">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Task Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-650 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Main Body Scroll Container */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-16 bg-zinc-100 dark:bg-zinc-900 rounded-lg"></div>
              <div className="h-10 bg-zinc-100 dark:bg-zinc-900 rounded-lg"></div>
            </div>
          ) : error || !task ? (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 text-xs font-medium text-red-600 dark:text-red-400">
              Failed to load task details. The task may have been deleted.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Task Title heading */}
              <div className="space-y-2">
                <h3 className={`text-lg font-bold ${task.status === 'COMPLETED' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-black dark:text-white'}`}>
                  {task.name}
                </h3>
                {task.priority && (
                  <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                    {task.priority} Priority
                  </span>
                )}
              </div>

              {/* Scope/Due Dates Panel Grid */}
              <div className="grid grid-cols-2 gap-4 border border-zinc-100 dark:border-zinc-850 bg-zinc-50/20 dark:bg-black p-4 rounded-xl text-xs">
                <div className="space-y-1">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                    Due Date
                  </span>
                  <div className="flex items-center gap-1.5 font-medium text-black dark:text-white">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{task.due_date}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                    Due Time
                  </span>
                  <div className="flex items-center gap-1.5 font-medium text-black dark:text-white">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{task.due_time ? task.due_time.substring(0, 5) : 'N/A'}</span>
                  </div>
                </div>

                {task.project_detail && (
                  <div className="space-y-1 col-span-2">
                    <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                      Scope Location
                    </span>
                    <span className="font-semibold text-black dark:text-white">
                      {task.project_detail.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Completion details */}
              {task.status === 'COMPLETED' && (
                <div className="border border-zinc-150 dark:border-zinc-805 bg-zinc-50/50 dark:bg-black p-4 rounded-xl text-xs space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">
                    Completion Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                        Submission Status
                      </span>
                      <span className={`font-semibold ${task.submission_status === 'LATE' ? 'text-red-500' : 'text-green-500'}`}>
                        {task.submission_status === 'LATE' ? '🔴 Late' : '🟢 On Time'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                        Completed At
                      </span>
                      <span className="font-semibold text-black dark:text-white">
                        {task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    {task.submission_status === 'LATE' && task.late_by_minutes && (
                      <div className="space-y-1 col-span-2">
                        <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                          Late By
                        </span>
                        <span className="font-bold text-red-500">
                          {formatLateDuration(task.late_by_minutes)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Assignees list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Assignees
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.length === 0 ? (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black rounded-lg text-xs text-zinc-400 dark:text-zinc-550">
                      <span>👤 Unassigned</span>
                    </div>
                  ) : (
                    task.assignees.map((assignee) => {
                      const isDeactivated = assignee.status === 'INACTIVE';
                      return (
                        <div
                          key={assignee.id}
                          className="flex items-center justify-between w-full gap-3 px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black rounded-lg text-xs text-black dark:text-white"
                        >
                          <div className="flex items-center gap-2">
                            {assignee.avatar_url ? (
                              <img
                                src={assignee.avatar_url}
                                alt={assignee.name}
                                className="h-5 w-5 rounded-full object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                              />
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-bold text-zinc-650 dark:text-zinc-400 shrink-0">
                                {getInitials(assignee.name)}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className="font-medium text-zinc-850 dark:text-zinc-300 truncate">
                                {assignee.name} {isDeactivated && <span className="text-red-500 font-semibold ml-1">(Deactivated)</span>}
                              </span>
                              {assignee.completed ? (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                  assignee.submission_status === 'LATE'
                                    ? 'bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400'
                                    : 'bg-green-50 dark:bg-green-950/20 text-green-650 dark:text-green-400'
                                }`}>
                                  {assignee.submission_status === 'LATE'
                                    ? `Late by ${formatLateDuration(assignee.late_by_minutes)}`
                                    : 'On Time'}
                                </span>
                              ) : (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                  assignee.submission_status === 'OVERDUE'
                                    ? 'bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400'
                                    : 'bg-zinc-100 dark:bg-zinc-850/50 text-zinc-500 dark:text-zinc-400'
                                }`}>
                                  {assignee.submission_status === 'OVERDUE' ? 'Overdue' : 'Pending'}
                                </span>
                              )}
                            </div>
                          </div>
                          {isDeactivated && isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(task);
                              }}
                              className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded text-[10px] font-bold transition-colors shrink-0"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Description box */}
              {task.description && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Description
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50/50 dark:bg-black border border-zinc-100 dark:border-zinc-850 p-4 rounded-xl whitespace-pre-line">
                    {task.description}
                  </p>
                </div>
              )}

              {/* Subtasks Backlog */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Subtasks ({task.subtasks.length})
                </h4>

                {/* Subtasks lists */}
                {task.subtasks.length > 0 && (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-850 overflow-hidden bg-white dark:bg-black text-black dark:text-white">
                    {task.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-3 hover:bg-zinc-50/50 dark:hover:bg-white/10 transition-colors text-xs"
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
                            className="text-zinc-400 hover:text-black dark:hover:text-white shrink-0 disabled:opacity-50 transition-all duration-200 active:scale-90 hover:scale-110"
                          >
                            {sub.status === 'COMPLETED' ? (
                              <CheckCircle2 className="h-4.5 w-4.5 text-zinc-400 dark:text-zinc-550 animate-pop" />
                            ) : (
                              <Circle className="h-4.5 w-4.5 transition-transform duration-200" />
                            )}
                          </button>
                          
                          <span className={`${sub.status === 'COMPLETED' ? 'strike-through-anim text-zinc-400 dark:text-zinc-500' : 'text-zinc-850 dark:text-zinc-300'}`}>
                            {sub.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Subtask Inline Form */}
                {canComplete && (
                  <form onSubmit={handleSubTaskSubmit} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a new checklist subtask..."
                      value={subTaskName}
                      onChange={(e) => setSubTaskName(e.target.value)}
                      disabled={createSubTaskMutation.isPending}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={createSubTaskMutation.isPending || !subTaskName.trim()}
                      className="px-3 py-1.5 bg-black hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Action Buttons Footer */}
        {task && !isLoading && (
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-black flex gap-3">
            {task.status === 'PENDING' ? (
              <button
                type="button"
                disabled={!canComplete || completeTaskMutation.isPending}
                onClick={() => completeTaskMutation.mutate()}
                className="flex-1 py-2 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                  className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hover:bg-zinc-50 dark:hover:bg-white/10 text-black dark:text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
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
                  className="p-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hover:bg-zinc-50 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors"
                  title="Edit Task"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hover:border-red-50 hover:bg-red-50/20 text-zinc-600 dark:text-zinc-300 hover:text-red-650 rounded-lg transition-colors"
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
          <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-sm w-full p-6 shadow-lg text-center relative animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 text-red-600 mb-4">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-black dark:text-white mb-1">Delete Task?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              This action cannot be undone. This task will be removed from all projects and assignees.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors flex-1 text-black dark:text-white"
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
