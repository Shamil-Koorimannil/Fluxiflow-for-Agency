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

export function isTaskUserCompleted(task: Task, currentUserId?: string): boolean {
  if (typeof task.user_completed === 'boolean') {
    return task.user_completed;
  }
  if (currentUserId && Array.isArray(task.assignees)) {
    const myAssignee = task.assignees.find((a) => String(a.id) === String(currentUserId));
    if (myAssignee && typeof myAssignee.completed === 'boolean') {
      return myAssignee.completed;
    }
  }
  return task.status === 'COMPLETED';
}

export function isTaskPending(task: Task, now: Date = new Date(), currentUserId?: string): boolean {
  if (isTaskUserCompleted(task, currentUserId)) return false;
  const dueDt = getTaskDueDateTime(task);
  if (!dueDt) return false;
  return dueDt < now;
}

export function classifyTask(task: Task, now: Date = new Date(), currentUserId?: string): TaskCategory {
  if (isTaskUserCompleted(task, currentUserId)) {
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
