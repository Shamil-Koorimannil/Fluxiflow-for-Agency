import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { TaskAttachment } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { Paperclip, Plus, Trash2, Eye, Download, FileText, Image as ImageIcon, Archive, File, X, Loader2 } from 'lucide-react';

interface AttachmentsSectionProps {
  taskId: string;
  subtaskId?: string | null;
  title?: string;
}

import { useOrganization } from '../../context/OrganizationContext';

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  taskId,
  subtaskId = null,
  title = "Attachments",
}) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { isAdmin } = useOrganization();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const queryKey = ['attachments', taskId, subtaskId || 'direct'];

  const { data: attachments = [], isLoading } = useQuery<TaskAttachment[]>({
    queryKey,
    queryFn: async () => {
      const endpoint = subtaskId ? `/attachments/?subtask=${subtaskId}` : `/attachments/?task=${taskId}`;
      const response = await api.get(endpoint);
      return response.data;
    },
    enabled: !!taskId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('task', taskId);
      if (subtaskId) {
        formData.append('subtask', subtaskId);
      }
      const response = await api.post('/attachments/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      setErrorMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Unable to upload the file.";
      setErrorMsg(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/attachments/${id}/`);
    },
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Unable to delete file.";
      setErrorMsg(msg);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    uploadMutation.mutate(file);
  };

  const handleDownload = async (attachment: TaskAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const response = await api.get(`/attachments/${attachment.id}/download/`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: attachment.mime_type });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.original_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg("You do not have permission to access this file.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (attachment: TaskAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const response = await api.get(`/attachments/${attachment.id}/download/`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: attachment.mime_type });
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewAttachment(attachment);
    } catch (err: any) {
      setErrorMsg("You do not have permission to access this file.");
    } finally {
      setDownloadingId(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewAttachment(null);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isImage = (mimeType: string, filename: string) => {
    if (mimeType && mimeType.startsWith('image/')) return true;
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext || '');
  };

  const isPdf = (mimeType: string, filename: string) => {
    if (mimeType === 'application/pdf') return true;
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (isImage(mimeType, filename)) return <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />;
    if (isPdf(mimeType, filename)) return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    if (mimeType.includes('zip') || filename.endsWith('.zip')) return <Archive className="h-4 w-4 text-amber-500 shrink-0" />;
    return <File className="h-4 w-4 text-zinc-400 shrink-0" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">
            {title} ({attachments.length})
          </h4>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.svg,.txt,.zip"
          />
          <button
            type="button"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-black dark:text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>Attach File</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attachments List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-zinc-100 dark:bg-zinc-900 rounded-lg"></div>
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No attachments added yet.</p>
        ) : (
          attachments.map((attachment) => {
            const canDelete = currentUser && (currentUser.id === attachment.uploaded_by || isAdmin);
            const canPreview = isImage(attachment.mime_type, attachment.original_name) || isPdf(attachment.mime_type, attachment.original_name);
            const isDownloading = downloadingId === attachment.id;

            return (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-2.5 bg-zinc-50/50 dark:bg-black border border-zinc-100 dark:border-zinc-850 rounded-xl text-xs gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {getFileIcon(attachment.mime_type, attachment.original_name)}
                  <div className="min-w-0">
                    <span className="font-semibold text-black dark:text-white truncate block max-w-50 sm:max-w-70">
                      {attachment.original_name}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                      {formatFileSize(attachment.size)} • {attachment.uploaded_by_detail?.name || 'User'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canPreview && (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => handlePreview(attachment)}
                      className="p-1.5 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Preview file"
                    >
                      {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => handleDownload(attachment)}
                    className="p-1.5 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Download file"
                  >
                    {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Are you sure you want to delete this file attachment?")) {
                          deleteMutation.mutate(attachment.id);
                        }
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Delete attachment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preview Modal */}
      {previewAttachment && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 truncate">
                {getFileIcon(previewAttachment.mime_type, previewAttachment.original_name)}
                <span className="font-bold text-sm text-black dark:text-white truncate">
                  {previewAttachment.original_name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(previewAttachment)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-black dark:text-white rounded-lg transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="p-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-auto flex items-center justify-center min-h-75 bg-zinc-50 dark:bg-black">
              {isImage(previewAttachment.mime_type, previewAttachment.original_name) ? (
                <img
                  src={previewUrl}
                  alt={previewAttachment.original_name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                />
              ) : isPdf(previewAttachment.mime_type, previewAttachment.original_name) ? (
                <iframe
                  src={previewUrl}
                  title={previewAttachment.original_name}
                  className="w-full h-[70vh] rounded-lg border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <p className="text-xs text-zinc-500">Preview not supported for this file type.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
