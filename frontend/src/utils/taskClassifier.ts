import { getLocalDateString } from './time';
import type { Task } from '../types';

export type TaskCategory =
  | 'today'
  | 'tomorrow'
  | 'upcoming'
  | 'overdue'
  | 'no_due_date'
  | 'completed';

export function classifyTask(task: Task): TaskCategory {
  if (task.status === 'COMPLETED') {
    return 'completed';
  }

  if (!task.due_date) {
    return 'no_due_date';
  }

  const today = getLocalDateString(new Date());

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  if (task.due_date < today) return 'overdue';
  if (task.due_date === today) return 'today';
  if (task.due_date === tomorrow) return 'tomorrow';

  return 'upcoming';
}
