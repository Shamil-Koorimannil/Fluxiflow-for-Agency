import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task } from '../../types';
import { DatePicker } from '../../components/common/DatePicker';
import { useOrganization } from '../../context/OrganizationContext';
import { getTaskDates } from '../../utils/taskClassifier';

interface TaskDatePickerProps {
  task: Task;
  disabled?: boolean;
}

export const TaskDatePicker: React.FC<TaskDatePickerProps> = ({ task, disabled = false }) => {
  const queryClient = useQueryClient();
  const { isAdmin } = useOrganization();

  const updateDatesMutation = useMutation({
    mutationFn: async (newDates: string[]) => {
      const payload: any = { dates: newDates, due_date: newDates[0] || null };
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

  const dates = getTaskDates(task);

  return (
    <TaskDatePickerInternal
      task={task}
      disabled={disabled || !isAdmin}
      values={dates}
      onChange={(newDates) => {
        updateDatesMutation.mutate(newDates);
      }}
    />
  );
};

interface TaskDatePickerInternalProps {
  task: Task;
  disabled: boolean;
  values: string[];
  onChange: (vals: string[]) => void;
}

const TaskDatePickerInternal: React.FC<TaskDatePickerInternalProps> = ({ disabled, values, onChange }) => {
  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <DatePicker
        multiSelect={true}
        values={values}
        onMultiChange={onChange}
        disabled={disabled}
        variant="inline"
        placeholder="No due date"
      />
    </div>
  );
};
