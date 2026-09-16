import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Popover } from '@mui/material';
import { Check } from 'lucide-react';
import { api } from '../../services/api';
import type { Task, User } from '../../types';

interface TaskAssigneePickerProps {
  task: Task;
  currentUser: User | null;
  isAdmin: boolean;
  renderAssigneesList: (assignees: Task['assignees']) => React.ReactNode;
}

export const TaskAssigneePicker: React.FC<TaskAssigneePickerProps> = ({
  task,
  currentUser,
  isAdmin,
  renderAssigneesList,
}) => {
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const isAssigned = task.assignees?.some((a) => String(a.id) === String(currentUser?.id));
  const canEditAssignee = isAdmin || isAssigned;

  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get('/team/');
      return response.data;
    },
    enabled: Boolean(anchorEl),
  });

  const updateAssigneesMutation = useMutation({
    mutationFn: async (assigneeIds: string[]) => {
      const isSubtask = task.is_subtask || task.id.startsWith('subtask_');
      const realId = isSubtask ? task.id.replace('subtask_', '') : task.id;
      const endpoint = isSubtask ? `/subtasks/${realId}/` : `/tasks/${realId}/`;
      const response = await api.patch(endpoint, { assignee_ids: assigneeIds });
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
      if (task.project) {
        queryClient.invalidateQueries({ queryKey: ['project', task.project] });
      }
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const handleOpen = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (canEditAssignee) {
      setAnchorEl(e.currentTarget);
    }
  };

  const handleClose = (_event?: {}, _reason?: string) => {
    setAnchorEl(null);
  };

  const currentAssigneeIds = task.assignees?.map((a) => String(a.id)) || [];

  const handleToggleAssignee = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let nextIds: string[];
    if (currentAssigneeIds.includes(memberId)) {
      nextIds = currentAssigneeIds.filter((id) => id !== memberId);
    } else {
      nextIds = [...currentAssigneeIds, memberId];
    }
    updateAssigneesMutation.mutate(nextIds);
  };

  return (
    <div
      onClick={handleOpen}
      className={`inline-block ${canEditAssignee ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
      title={canEditAssignee ? 'Click to edit assignees' : undefined}
    >
      {renderAssigneesList(task.assignees)}

      {canEditAssignee && (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          onClick={(e) => e.stopPropagation()}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          slotProps={{
            paper: {
              className:
                'p-3 max-w-xs w-64 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl text-black dark:text-white',
            },
          }}
        >
          <div className="space-y-2 select-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Assignees
              </span>
              <span className="text-[10px] font-semibold text-zinc-400">
                {currentAssigneeIds.length} selected
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 no-scrollbar">
              {teamMembers?.map((m) => {
                const isSelected = currentAssigneeIds.includes(String(m.id));
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => handleToggleAssignee(String(m.id), e)}
                    disabled={updateAssigneesMutation.isPending}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="truncate min-w-0 pr-2">
                      <div className="truncate font-semibold">{m.name}</div>
                      <div className="text-[10px] text-zinc-400 truncate">{m.email}</div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </Popover>
      )}
    </div>
  );
};
