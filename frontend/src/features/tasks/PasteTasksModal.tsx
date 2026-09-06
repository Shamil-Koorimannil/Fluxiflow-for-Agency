import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Project, User } from '../../types';
import { X } from 'lucide-react';

import { CustomDropdown } from '../../components/common/CustomDropdown';

interface PasteTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultAssigneeId?: string;
}

export const PasteTasksModal: React.FC<PasteTasksModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId = '',
  defaultAssigneeId = ''
}) => {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync defaults when open changes
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId(defaultProjectId);
      setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
      setErrorMsg(null);
    }
  }, [isOpen, defaultProjectId, defaultAssigneeId]);

  // Read copied tasks from localStorage
  const getCopiedTasks = () => {
    const stored = localStorage.getItem('fluxiflow_copied_tasks');
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const copiedTasks = getCopiedTasks();

  // Fetch projects list
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects/');
      return response.data;
    },
    enabled: isOpen,
  });

  // Fetch team members list
  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get('/team/');
      return response.data;
    },
    enabled: isOpen,
  });

  // Mutation for bulk paste
  const pasteMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/tasks/bulk_paste/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['employee-workload'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      
      // Clear clipboard
      localStorage.removeItem('fluxiflow_copied_tasks');
      window.dispatchEvent(new Event('fluxiflow_copied_tasks_changed'));
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to paste tasks.';
      setErrorMsg(msg);
    }
  });

  if (!isOpen || copiedTasks.length === 0) return null;

  const handlePaste = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    pasteMutation.mutate({
      tasks: copiedTasks,
      destination_project_id: selectedProjectId || null,
      assignee_ids: selectedAssigneeIds
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/45 z-9999 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-6 shadow-lg relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white">
        
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-650 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-base font-bold mb-1">Paste {copiedTasks.length} Task{copiedTasks.length > 1 ? 's' : ''}</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-550 mb-4">
          Choose a destination project and assignees for the pasted copies.
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 text-xs font-semibold text-red-600 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handlePaste} className="space-y-4">
          {/* Destination Project Selector */}
          <div className="space-y-1">
            <CustomDropdown
              label="Destination Project"
              fullWidth
              value={selectedProjectId}
              onChange={(val) => setSelectedProjectId(val)}
              placeholder="No Project (Organization level)"
              searchable={true}
              searchPlaceholder="Search destination projects..."
              options={[
                { value: '', label: 'No Project (Organization level)' },
                ...(projects?.map((proj) => ({
                  value: proj.id,
                  label: proj.name,
                })) || []),
              ]}
            />
          </div>

          {/* Assignees Selector Checkboxes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block">
              Assign To
            </label>
            <div className="max-h-36 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-1.5 bg-white dark:bg-black">
              {teamMembers && teamMembers.length > 0 ? (
                teamMembers.map((member) => {
                  const isChecked = selectedAssigneeIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 cursor-pointer py-0.5 select-none text-xs text-zinc-700 dark:text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedAssigneeIds(selectedAssigneeIds.filter(id => id !== member.id));
                          } else {
                            setSelectedAssigneeIds([...selectedAssigneeIds, member.id]);
                          }
                        }}
                        className="rounded text-black dark:text-white border-zinc-300 focus:ring-0 shrink-0"
                      />
                      <span className="truncate">{member.name}</span>
                    </label>
                  );
                })
              ) : (
                <div className="text-zinc-400 text-center py-2">No team members available</div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pasteMutation.isPending}
              className="px-3.5 py-2 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {pasteMutation.isPending ? 'Pasting...' : 'Paste Tasks'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
};
