import React, { useEffect, useState } from 'react';

export interface TaskAnimationWrapperProps {
  children: React.ReactNode;
  isCompleting?: boolean;
  isRestoring?: boolean;
  onExitComplete?: () => void;
  className?: string;
}

export const TaskAnimationWrapper: React.FC<TaskAnimationWrapperProps> = ({
  children,
  isCompleting = false,
  isRestoring = false,
  onExitComplete,
  className = '',
}) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isCompleting) {
      // Trigger collapse 20ms into left-slide animation so vertical reflow coincides smoothly
      const collapseTimer = setTimeout(() => {
        setCollapsed(true);
      }, 20);

      const exitTimer = setTimeout(() => {
        onExitComplete?.();
      }, 420);

      return () => {
        clearTimeout(collapseTimer);
        clearTimeout(exitTimer);
      };
    } else {
      setCollapsed(false);
    }
  }, [isCompleting, onExitComplete]);

  return (
    <div
      className={`grid ${
        isCompleting && collapsed ? 'grid-rows-[0fr] opacity-0 py-0' : 'grid-rows-[1fr]'
      } ${className}`}
      style={{
        transitionProperty: 'grid-template-rows, opacity, margin-bottom, padding',
        transitionDuration: '360ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        marginBottom: isCompleting && collapsed ? '-0.5rem' : '0px',
      }}
    >
      <div
        className={`w-full min-h-0 overflow-hidden ${
          isCompleting ? 'task-exit-slide-left' : isRestoring ? 'task-restore-slide' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};
