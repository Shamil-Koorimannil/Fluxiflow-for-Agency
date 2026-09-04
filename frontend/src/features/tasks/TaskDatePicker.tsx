import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { DatePicker } from '../../components/common/DatePicker';
import { useOrganization } from '../../context/OrganizationContext';

interface TaskDatePickerProps {
  task: Task;
  disabled?: boolean;
}

export const TaskDatePicker: React.FC<TaskDatePickerProps> = ({ task, disabled = false }) => {
  const queryClient = useQueryClient();
  const { isAdmin } = useOrganization();

  const updateDatesMutation = useMutation({
    mutationFn: async (newDate: string | null) => {
      const payload: any = { due_date: newDate };
      if (task.due_time) {
        payload.due_time = task.due_time;
      }
      const response = await api.patch(`/tasks/${task.id}/`, payload);
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

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <DatePicker
        multiSelect={false}
        value={task.due_date || ''}
        onChange={(val) => {
          updateDatesMutation.mutate(val || null);
        }}
        disabled={disabled || !isAdmin}
        variant="inline"
        placeholder="No due date"
      />
    </div>
  );
};
