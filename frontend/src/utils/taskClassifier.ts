import { getLocalDateString } from './time';
import type { Task } from '../types';

export type TaskCategory =
  | 'today'
  | 'tomorrow'
  | 'upcoming'
  | 'pending'
  | 'no_due_date'
  | 'completed';

export function getTaskDates(task: Task): string[] {
  if (task.due_date) {
    return [task.due_date];
  }
  return [];
}

export function classifyTask(task: Task): TaskCategory {
  if (task.status === 'COMPLETED') {
    return 'completed';
  }

  const dates = getTaskDates(task);
  if (dates.length === 0) {
    return 'no_due_date';
  }

  const today = getLocalDateString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  if (dates.includes(today)) return 'today';
  if (dates.includes(tomorrow)) return 'tomorrow';

  // If any date is in the future, it is upcoming
  const hasFutureDate = dates.some((d) => d > today);
  if (hasFutureDate) return 'upcoming';

  // If assigned dates have passed and task is incomplete, it is pending
  return 'pending';
}
