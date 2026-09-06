import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckSquare, 
  Copy, 
  Clipboard, 
  Trash2, 
  Pencil, 
  CheckCircle2, 
  RotateCcw,
  X 
} from 'lucide-react';
import type { Task } from '../../types';

import { Clock } from 'lucide-react';

export interface TaskContextMenuProps {
  x: number;
  y: number;
  selectedTasks: Task[];
  hasCopiedTasks: boolean;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onEdit?: (task: Task) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onSetStatus?: (task: Task, status: 'IN_PROGRESS' | 'PENDING') => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
}

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  x,
  y,
  selectedTasks,
  hasCopiedTasks,
  onClose,
  onCopy,
  onPaste,
  onEdit,
  onDelete,
  onToggleComplete,
  onSetStatus,
  onSelectAll,
  onClearSelection,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const count = selectedTasks.length;
  const singleTask = count === 1 ? selectedTasks[0] : null;
  const isCompleted = count > 0 && selectedTasks.every((t) => t.status === 'COMPLETED');

  // Close on outside click or scroll/Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDownOutside);
    window.addEventListener('touchstart', handlePointerDownOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDownOutside);
      window.removeEventListener('touchstart', handlePointerDownOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  if (count === 0) return null;

  // Viewport bounds calculation
  const menuWidth = 220;
  const menuHeight = 260;
  const adjustedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const adjustedY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: adjustedY, left: adjustedX }}
      className="fixed z-50 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl py-1.5 text-zinc-900 dark:text-zinc-100 text-xs font-medium animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1.5 mb-1 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
        <span>
          {count} {count === 1 ? 'Task Selected' : 'Tasks Selected'}
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-0.5 px-1">
        {/* Toggle Complete */}
        <button
          type="button"
          onClick={() => {
            onToggleComplete();
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors text-zinc-700 dark:text-zinc-200 font-semibold"
        >
          {isCompleted ? (
            <>
              <RotateCcw className="h-4 w-4 text-blue-500 shrink-0" />
              <span>Mark Incomplete</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Mark Complete</span>
            </>
          )}
        </button>

        {/* Set In Progress / Clear Status for Non-Typed Tasks */}
        {singleTask && !singleTask.task_type && !singleTask.task_type_detail && onSetStatus && (
          <button
            type="button"
            onClick={() => {
              const targetStatus = singleTask.status === 'IN_PROGRESS' ? 'PENDING' : 'IN_PROGRESS';
              onSetStatus(singleTask, targetStatus);
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors text-zinc-700 dark:text-zinc-200 font-semibold"
          >
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <span>{singleTask.status === 'IN_PROGRESS' ? 'Mark To do' : 'Mark In Progress'}</span>
          </button>
        )}

        {/* Edit (only available when single task is selected) */}
        {singleTask && onEdit && (
          <button
            type="button"
            onClick={() => {
              onEdit(singleTask);
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors text-zinc-700 dark:text-zinc-200 font-semibold"
          >
            <Pencil className="h-4 w-4 text-zinc-500 shrink-0" />
            <span>Edit Task</span>
          </button>
        )}

        {/* Copy */}
        <button
          type="button"
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors text-zinc-700 dark:text-zinc-200 font-semibold"
        >
          <Copy className="h-4 w-4 text-blue-500 shrink-0" />
          <span>Copy {count > 1 ? `(${count})` : ''}</span>
        </button>

        {/* Paste (enabled if copied tasks exist in storage) */}
        <button
          type="button"
          disabled={!hasCopiedTasks}
          onClick={() => {
            onPaste();
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors text-zinc-700 dark:text-zinc-200 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Clipboard className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>Paste Tasks</span>
        </button>

        {onSelectAll && (
          <button
            type="button"
            onClick={() => {
              onSelectAll();
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors text-zinc-700 dark:text-zinc-200 font-semibold"
          >
            <CheckSquare className="h-4 w-4 text-zinc-500 shrink-0" />
            <span>Select All</span>
          </button>
        )}

        {onClearSelection && (
          <button
            type="button"
            onClick={() => {
              onClearSelection();
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors text-zinc-700 dark:text-zinc-200 font-semibold"
          >
            <X className="h-4 w-4 text-zinc-400 shrink-0" />
            <span>Deselect All</span>
          </button>
        )}

        <div className="my-1 border-t border-zinc-100 dark:border-zinc-800/80" />

        {/* Delete */}
        <button
          type="button"
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2.5 transition-colors font-bold"
        >
          <Trash2 className="h-4 w-4 text-red-500 shrink-0" />
          <span>Delete {count > 1 ? `(${count})` : ''}</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
