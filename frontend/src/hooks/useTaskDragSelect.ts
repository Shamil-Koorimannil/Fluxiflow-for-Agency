import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseTaskDragSelectOptions {
  visibleTasks?: { id: string }[];
  onOpenDetail?: (taskId: string) => void;
  longPressThresholdMs?: number;
  scrollTolerancePx?: number;
}

export function useTaskDragSelect({
  visibleTasks = [],
  onOpenDetail,
  longPressThresholdMs = 600,
  scrollTolerancePx = 10,
}: UseTaskDragSelectOptions = {}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const suppressClickTaskIdRef = useRef<string | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const toggleSelect = useCallback(
    (taskId: string, isShiftKey = false) => {
      setSelectedTaskIds((prev) => {
        if (isShiftKey && lastSelectedId && visibleTasks.length > 0) {
          const visibleIds = visibleTasks.map((t) => t.id);
          const lastIdx = visibleIds.indexOf(lastSelectedId);
          const currIdx = visibleIds.indexOf(taskId);
          if (lastIdx !== -1 && currIdx !== -1) {
            const start = Math.min(lastIdx, currIdx);
            const end = Math.max(lastIdx, currIdx);
            const rangeIds = visibleIds.slice(start, end + 1);
            const nextSet = new Set(prev);
            rangeIds.forEach((id) => nextSet.add(id));
            return Array.from(nextSet);
          }
        }

        const next = new Set(prev);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return Array.from(next);
      });

      if (!isShiftKey) {
        setLastSelectedId(taskId);
      }
    },
    [lastSelectedId, visibleTasks]
  );

  const selectTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
    setLastSelectedId(taskId);
  }, []);

  const selectAll = useCallback(
    (taskIds?: string[]) => {
      const idsToSelect = taskIds || visibleTasks.map((t) => t.id);
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        idsToSelect.forEach((id) => next.add(id));
        return Array.from(next);
      });
    },
    [visibleTasks]
  );

  const clearSelection = useCallback(() => {
    setSelectedTaskIds([]);
    setLastSelectedId(null);
  }, []);

  const isSelected = useCallback(
    (taskId: string) => selectedTaskIds.includes(taskId),
    [selectedTaskIds]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, taskId: string) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      isPointerDownRef.current = true;
      startPosRef.current = { x: e.clientX, y: e.clientY };

      const isSelectionActive = selectedTaskIds.length > 0;

      if (isSelectionActive) {
        isDraggingRef.current = true;
        document.body.style.userSelect = 'none';
        (document.body.style as any).webkitUserSelect = 'none';
        selectTask(taskId);
      } else {
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          selectTask(taskId);
          suppressClickTaskIdRef.current = taskId;
          isDraggingRef.current = true;
          document.body.style.userSelect = 'none';
          (document.body.style as any).webkitUserSelect = 'none';

          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(40);
            } catch {
              // ignore
            }
          }
        }, longPressThresholdMs);
      }
    },
    [selectedTaskIds.length, selectTask, clearLongPressTimer, longPressThresholdMs]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPointerDownRef.current && !isDraggingRef.current) return;

      if (startPosRef.current && longPressTimerRef.current) {
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > scrollTolerancePx) {
          clearLongPressTimer();
        }
      }

      if (isDraggingRef.current || selectedTaskIds.length > 0) {
        if (e.buttons === 1 || e.pointerType === 'touch' || e.pointerType === 'pen') {
          document.body.style.userSelect = 'none';
          (document.body.style as any).webkitUserSelect = 'none';
          const targetEl = document.elementFromPoint(e.clientX, e.clientY);
          if (targetEl) {
            const taskTile = targetEl.closest('[data-task-id]');
            if (taskTile) {
              const hoverTaskId = taskTile.getAttribute('data-task-id');
              if (hoverTaskId) {
                selectTask(hoverTaskId);
              }
            }
          }
        }
      }
    },
    [selectedTaskIds.length, selectTask, clearLongPressTimer, scrollTolerancePx]
  );

  const handlePointerUpOrCancel = useCallback(() => {
    isPointerDownRef.current = false;
    isDraggingRef.current = false;
    document.body.style.userSelect = '';
    (document.body.style as any).webkitUserSelect = '';
    clearLongPressTimer();
    startPosRef.current = null;

    if (suppressClickTaskIdRef.current) {
      setTimeout(() => {
        suppressClickTaskIdRef.current = null;
      }, 300);
    }
  }, [clearLongPressTimer]);

  const handleCardClick = useCallback(
    (e: React.MouseEvent, taskId: string, defaultOpenId?: string) => {
      if (suppressClickTaskIdRef.current === taskId) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleSelect(taskId, true);
      } else {
        setLastSelectedId(taskId);
        if (selectedTaskIds.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          toggleSelect(taskId, false);
        } else if (onOpenDetail) {
          onOpenDetail(defaultOpenId || taskId);
        }
      }
    },
    [selectedTaskIds.length, toggleSelect, onOpenDetail]
  );

  useEffect(() => {
    const globalUp = () => handlePointerUpOrCancel();
    window.addEventListener('pointerup', globalUp);
    window.addEventListener('pointercancel', globalUp);
    return () => {
      window.removeEventListener('pointerup', globalUp);
      window.removeEventListener('pointercancel', globalUp);
    };
  }, [handlePointerUpOrCancel]);

  // Click outside to clear task selection
  useEffect(() => {
    if (selectedTaskIds.length === 0) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInsideTaskUI = target.closest(
        '[data-task-id], [data-selection-control], [data-no-deselect], .MuiPopover-root, .MuiDialog-root, .MuiMenu-root'
      );
      if (!isInsideTaskUI) {
        clearSelection();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [selectedTaskIds.length, clearSelection]);

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    toggleSelect,
    selectTask,
    selectAll,
    clearSelection,
    isSelected,
    handlePointerDown,
    handlePointerMove,
    handlePointerUpOrCancel,
    handleCardClick,
    isSelectionActive: selectedTaskIds.length > 0,
  };
}
