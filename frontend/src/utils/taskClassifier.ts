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

export function getTaskDueDateTime(task: Task): Date | null {
  if (!task.due_date) return null;
  const datePart = task.due_date.split('T')[0];
  if (task.due_time) {
    const timePart = task.due_time.length === 5 ? `${task.due_time}:00` : task.due_time;
    return new Date(`${datePart}T${timePart}`);
  }
  // Date-only due date: end of local day (23:59:59)
  return new Date(`${datePart}T23:59:59`);
}

export function isTaskPending(task: Task, now: Date = new Date()): boolean {
  if (task.status === 'COMPLETED') return false;
  const dueDt = getTaskDueDateTime(task);
  if (!dueDt) return false;
  return dueDt < now;
}

export function classifyTask(task: Task, now: Date = new Date()): TaskCategory {
  if (task.status === 'COMPLETED') {
    return 'completed';
  }

  if (!task.due_date) {
    return 'no_due_date';
  }

  const dueDt = getTaskDueDateTime(task);
  if (dueDt && dueDt < now) {
    return 'pending';
  }

  const datePart = task.due_date.split('T')[0];
  const todayStr = getLocalDateString(now);
  const tomorrowObj = new Date(now);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrowObj);

  if (datePart === todayStr) return 'today';
  if (datePart === tomorrowStr) return 'tomorrow';
  if (datePart > todayStr) return 'upcoming';

  return 'pending';
}
