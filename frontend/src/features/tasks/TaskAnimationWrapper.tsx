import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface TaskAnimationWrapperProps {
  children: React.ReactNode;
  isCompleting?: boolean;
  isRestoring?: boolean;
  onExitComplete?: () => void;
  className?: string;
}

export const TaskAnimationWrapper: React.FC<TaskAnimationWrapperProps> = ({
  children,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      layout="position"
      initial={
        shouldReduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 10 }
      }
      animate={
        shouldReduceMotion
          ? { opacity: 1 }
          : { opacity: 1, y: 0 }
      }
      exit={
        shouldReduceMotion
          ? { opacity: 0 }
          : { x: -80, opacity: 0 }
      }
      transition={{
        duration: 0.38,
        ease: [0.16, 1, 0.3, 1],
        opacity: { duration: 0.28 },
        layout: {
          duration: 0.35,
          ease: [0.16, 1, 0.3, 1],
        },
      }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

