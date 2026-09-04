import React from 'react';
import type { Task, User } from '../../types';
import { CheckCircle2, Circle, Check, Pencil } from 'lucide-react';
import { TaskDatePicker } from './TaskDatePicker';
import { TaskTypeBadge } from './TaskTypeBadge';
import { getLocalDateString } from '../../utils/time';

export interface TaskCardProps {
  task: Task;
  currentUser: User | null;
  isAdmin: boolean;
  onOpenDetail: (taskId: string) => void;
  onToggleComplete: (task: Task) => void;
  onEdit?: (task: Task) => void;
  isMutating?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string, isShiftKey: boolean) => void;
  onPointerDown?: (e: React.PointerEvent, taskId: string) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
  onCardClick?: (e: React.MouseEvent, taskId: string, defaultOpenId?: string) => void;
  isSelectionActive?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  currentUser,
  isAdmin,
  onOpenDetail,
  onToggleComplete,
  onEdit,
  isMutating = false,
  isSelected = false,
  onToggleSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onCardClick,
  isSelectionActive = false,
}) => {
  const isAssigned = task.assignees?.some((a) => a.id === currentUser?.id);
  const canComplete = isAdmin || isAssigned;
  const isCompleted = task.status === 'COMPLETED';

  const formatLateDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;
    return `${days}d ${hrs}h`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-650 bg-red-50 dark:text-red-400 dark:bg-red-950/20';
      case 'MEDIUM':
        return 'text-amber-650 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20';
      case 'LOW':
        return 'text-blue-650 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20';
      default:
        return 'text-zinc-500 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-900';
    }
  };

  const getPriorityBorder = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'border-l-4 border-red-500';
      case 'MEDIUM':
        return 'border-l-4 border-amber-500';
      case 'LOW':
        return 'border-l-4 border-blue-500';
      default:
        return 'border-l-4 border-zinc-200 dark:border-zinc-800';
    }
  };

  const renderAssigneesList = (assignees: Task['assignees']) => {
    if (!assignees || assignees.length === 0) {
      return (
        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-850 select-none uppercase tracking-wider">
          👤 Unassigned
        </span>
      );
    }

    const completedCount = assignees.filter((a) => a.completed).length;

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex -space-x-1.5 overflow-hidden py-0.5">
          {assignees.map((a) => (
            <div
              key={a.id}
              title={`${a.name} (${a.completed ? 'Completed' : 'Pending'})`}
              className={`relative flex h-5 w-5 items-center justify-center rounded-full border text-[8px] font-bold shrink-0 ${
                a.completed
                  ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {getInitials(a.name)}
              {a.completed && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 items-center justify-center rounded-full bg-green-500 text-[6px] text-white font-extrabold shadow-sm border border-white dark:border-zinc-950">
                  ✓
                </span>
              )}
            </div>
          ))}
        </div>

        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          {assignees.length > 1 ? (
            <span>
              {completedCount}/{assignees.length} completed
            </span>
          ) : (
            <span>{assignees[0].name}</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <div
      data-task-id={task.id}
      onPointerDown={(e) => onPointerDown?.(e, task.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(e) =>
        onCardClick
          ? onCardClick(e, task.id, task.is_subtask ? task.parent_task_id! : task.id)
          : onOpenDetail(task.is_subtask ? task.parent_task_id! : task.id)
      }
      className={`bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-black dark:hover:border-white transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-sm animate-slide-up ${
        task.is_subtask ? 'ml-6 md:ml-8 border-dashed' : ''
      } ${getPriorityBorder(task.priority)} ${
        isCompleted ? 'bg-zinc-50/50 dark:bg-zinc-950/40' : ''
      } ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/30 dark:bg-blue-950/30 shadow-md'
          : ''
      }`}
    >
      <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
        {/* Completion Checkbox Button with smooth 300ms transition */}
        <button
          type="button"
          disabled={!canComplete || isMutating}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task);
          }}
          className={`shrink-0 disabled:opacity-50 transition-all duration-300 ease-in-out transform active:scale-90 hover:scale-110 mt-0.5 md:mt-0 ${
            isCompleted ? 'text-green-550 dark:text-green-400' : 'text-zinc-400 hover:text-black dark:hover:text-white'
          }`}
          title={isCompleted ? 'Reopen task' : 'Complete task'}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4.5 w-4.5 text-green-550 dark:text-green-400 animate-in zoom-in-75 duration-300" />
          ) : (
            <Circle className="h-4.5 w-4.5 transition-transform duration-200" />
          )}
        </button>

        {/* Task Hierarchy & Details */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Primary Task / Subtask Name */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h4
              className={`text-sm font-semibold truncate transition-all duration-300 ${
                isCompleted ? 'line-through text-zinc-400 dark:text-zinc-555' : 'text-black dark:text-white'
              }`}
            >
              {task.name}
            </h4>

            {/* Completed Badge */}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50 uppercase tracking-wider animate-in fade-in zoom-in-90 duration-300">
                <Check className="h-3 w-3 stroke-3" /> Completed
              </span>
            )}
          </div>

          {/* Secondary: Parent Task Name (for subtasks) */}
          {(task.is_subtask || task.parent_task_name) && (
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <span className="font-semibold text-zinc-400">Parent:</span>
              <span>{task.parent_task_name || 'Parent Task'}</span>
            </div>
          )}

          {/* Tertiary: Project Name */}
          {task.project_detail && (
            <div className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500 tracking-wide">
              {task.project_detail.name}
            </div>
          )}

          {/* Assignees block */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {renderAssigneesList(task.assignees)}
          </div>

          {/* Date display, Task Type Badge, & Priority indicator */}
          <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-zinc-450 mt-1">
            {task.due_date && (
              <div className="flex items-center gap-1.5 font-medium">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  task.date_color === 'red' ? 'bg-red-500' :
                  task.date_color === 'amber' ? 'bg-amber-500' :
                  task.date_color === 'green' ? 'bg-green-500' :
                  'bg-zinc-400'
                }`} />
                <TaskDatePicker task={task} />
              </div>
            )}

            {/* Prominent Past Due Warning Badge */}
            {!isCompleted && task.due_date && task.due_date < getLocalDateString(new Date()) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-[10px] font-bold uppercase tracking-wider">
                ⚠ Past Due
              </span>
            )}

            {/* Task Type Badge */}
            <TaskTypeBadge
              taskType={task.task_type_detail}
              allocatedSeconds={task.allocated_seconds}
            />

            {task.priority && (
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                {task.priority} Priority
              </span>
            )}
            {task.is_subtask && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-250 dark:border-zinc-750">
                Subtask
              </span>
            )}
            {task.overall_status && (
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                task.overall_status === 'COMPLETED'
                  ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                  : task.overall_status === 'IN_PROGRESS'
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-550'
              }`}>
                {task.overall_status === 'IN_PROGRESS' ? 'In Progress' : task.overall_status}
              </span>
            )}
          </div>

          {isCompleted && task.submission_status === 'LATE' && (
            <div className="flex flex-col gap-0.5 mt-2 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-2 rounded-lg text-red-650 dark:text-red-400">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <span className="shrink-0 text-red-500">🔴</span>
                <span>Late Submission</span>
              </div>
              {task.late_by_minutes && (
                <div className="text-[10px] font-bold text-red-500/80 ml-5">
                  Late by: {formatLateDuration(task.late_by_minutes)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side Actions: Admin Edit Button & Selection Checkbox */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {isAdmin && onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs hover:shadow-xs"
            title="Edit task"
          >
            <Pencil className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Edit</span>
          </button>
        )}

        {(onToggleSelect || isSelectionActive) && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(task.id, e.shiftKey);
            }}
            className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
              isSelected
                ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-xs'
                : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:border-blue-400'
            }`}
            title={isSelected ? 'Deselect task' : 'Select task'}
          >
            {isSelected && <span className="text-xs">✓</span>}
          </div>
        )}
      </div>
    </div>
  );
};
