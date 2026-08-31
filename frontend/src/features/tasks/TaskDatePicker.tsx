import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { DatePicker } from '../../components/common/DatePicker';

interface TaskDatePickerProps {
  task: Task;
  disabled?: boolean;
}

import { useOrganization } from '../../context/OrganizationContext';

export const TaskDatePicker: React.FC<TaskDatePickerProps> = ({ task, disabled = false }) => {
  const queryClient = useQueryClient();
  const { isAdmin } = useOrganization();

  const updateDateMutation = useMutation({
    mutationFn: async (newDate: string) => {
      const payload: any = { due_date: newDate || null };
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
    <TaskDatePickerInternal
      task={task}
      disabled={disabled || !isAdmin}
      value={task.due_date || ''}
      onChange={(val) => {
        if (val !== task.due_date) {
          updateDateMutation.mutate(val);
        }
      }}
    />
  );
};

interface TaskDatePickerInternalProps {
  task: Task;
  disabled: boolean;
  value: string;
  onChange: (val: string) => void;
}

import { getLocalDateString } from '../../utils/time';

const TaskDatePickerInternal: React.FC<TaskDatePickerInternalProps> = ({ task, disabled, value, onChange }) => {
  // Translate formatted display values or standard date
  const getPlaceholder = () => {
    if (task.status === 'COMPLETED') {
      return 'Completed';
    }
    return 'No due date';
  };

  const isOverdue = task.status !== 'COMPLETED' && !!task.due_date && task.due_date < getLocalDateString(new Date());

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <DatePicker
        value={value}
        onChange={onChange}
        disabled={disabled}
        variant="inline"
        isOverdue={isOverdue}
        placeholder={getPlaceholder()}
      />
    </div>
  );
};
