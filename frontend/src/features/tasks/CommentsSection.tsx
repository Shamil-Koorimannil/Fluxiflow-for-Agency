import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { TaskComment } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { MessageSquare, Edit2, Trash2, Send, X } from 'lucide-react';

interface CommentsSectionProps {
  taskId: string;
  subtaskId?: string | null;
  title?: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  taskId,
  subtaskId = null,
  title = "Comments",
}) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const queryKey = ['comments', taskId, subtaskId || 'direct'];

  const { data: comments = [], isLoading } = useQuery<TaskComment[]>({
    queryKey,
    queryFn: async () => {
      const endpoint = subtaskId ? `/comments/?subtask=${subtaskId}` : `/comments/?task=${taskId}`;
      const response = await api.get(endpoint);
      return response.data;
    },
    enabled: !!taskId,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const payload: { task: string; subtask?: string; content: string } = {
        task: taskId,
        content,
      };
      if (subtaskId) {
        payload.subtask = subtaskId;
      }
      const response = await api.post('/comments/', payload);
      return response.data;
    },
    onSuccess: () => {
      setNewComment('');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Unable to post comment.";
      setErrorMsg(msg);
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await api.patch(`/comments/${id}/`, { content });
      return response.data;
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditText('');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Unable to edit comment.";
      setErrorMsg(msg);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/comments/${id}/`);
    },
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Unable to delete comment.";
      setErrorMsg(msg);
    },
  });

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || createCommentMutation.isPending) return;
    createCommentMutation.mutate(newComment.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">
          {title} ({comments.length})
        </h4>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-12 bg-zinc-100 dark:bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-100 dark:bg-zinc-900 rounded-lg"></div>
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No comments yet. Write one below!</p>
        ) : (
          comments.map((comment) => {
            const author = comment.author_detail;
            const canManage = currentUser && (currentUser.id === comment.author || isAdmin);
            const isEditing = editingCommentId === comment.id;

            return (
              <div
                key={comment.id}
                className="p-3 bg-zinc-50/50 dark:bg-black border border-zinc-100 dark:border-zinc-850 rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {author?.avatar_url ? (
                      <img
                        src={author.avatar_url}
                        alt={author.name}
                        className="h-5 w-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[9px] font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                        {getInitials(author?.name)}
                      </div>
                    )}
                    <span className="font-semibold text-black dark:text-white">
                      {author?.name || 'Unknown User'}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      • {formatTimestamp(comment.created_at)}
                    </span>
                  </div>

                  {canManage && !isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditText(comment.content);
                        }}
                        className="p-1 text-zinc-400 hover:text-black dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Edit comment"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this comment?")) {
                            deleteCommentMutation.mutate(comment.id);
                          }
                        }}
                        className="p-1 text-zinc-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none resize-none"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCommentId(null)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-zinc-500 hover:text-black dark:hover:text-white rounded-lg border border-zinc-200 dark:border-zinc-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={updateCommentMutation.isPending || !editText.trim()}
                        onClick={() => updateCommentMutation.mutate({ id: comment.id, content: editText.trim() })}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line pl-7">
                    {comment.content}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Input */}
      <form onSubmit={handlePost} className="space-y-2 pt-1">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-850 rounded-xl text-xs text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-650 resize-none transition-colors"
          rows={2}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createCommentMutation.isPending || !newComment.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            <span>Post</span>
          </button>
        </div>
      </form>
    </div>
  );
};
