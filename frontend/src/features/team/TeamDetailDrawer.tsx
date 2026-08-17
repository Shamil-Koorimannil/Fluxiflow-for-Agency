import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task, TeamWorkload } from '../../types';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Avatar,
  LinearProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import {
  X,
  Clock,
  CheckCircle2,
  Circle,
  HelpCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatTimeOnly } from '../../utils/time';

interface TeamDetailDrawerProps {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
  onCreateTask?: (memberId: string) => void;
}

export const TeamDetailDrawer: React.FC<TeamDetailDrawerProps> = ({
  memberId,
  open,
  onClose,
  onCreateTask,
}) => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Filter state: 'all' | 'today' | 'pending' | 'upcoming' | 'completed'
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'pending' | 'upcoming' | 'completed'>('all');

  // Selected task to view detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch workload summary
  const { data: workloadData, isLoading: isWorkloadLoading } = useQuery<TeamWorkload>({
    queryKey: ['teamWorkload', memberId],
    queryFn: async () => {
      const response = await api.get(`/team/${memberId}/workload/`);
      return response.data;
    },
    enabled: !!memberId && open,
  });

  // Fetch filtered tasks list
  const { data: tasks, isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['teamTasks', memberId, activeFilter],
    queryFn: async () => {
      const statusParam = activeFilter === 'all' ? '' : activeFilter;
      const response = await api.get(`/team/${memberId}/tasks/`, {
        params: statusParam ? { status: statusParam } : {},
      });
      return response.data;
    },
    enabled: !!memberId && open,
  });

  // Task Completion Mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/tasks/${id}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Task Reopen Mutation
  const reopenTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/tasks/${id}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const getInitials = (nameStr: string) => {
    return nameStr
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400';
    if (score >= 80) return 'text-green-500 bg-green-50/50 dark:bg-green-950/10 dark:text-green-400';
    if (score >= 60) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400';
    if (score >= 40) return 'text-orange-500 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400';
    return 'text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400';
  };

  const getHealthBarColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
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

  if (!memberId) return null;

  const summary = workloadData?.summary;

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: isMobile ? '100%' : '520px',
            height: isMobile ? '90vh' : '100%',
            borderRadius: isMobile ? '16px 16px 0 0' : '0',
            bgcolor: 'background.paper',
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Drawer Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {summary ? (
              <Avatar
                src={summary.avatar_url || undefined}
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: 'action.selected',
                  color: 'text.secondary',
                  fontSize: '15px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {getInitials(summary.name)}
              </Avatar>
            ) : (
              <Box className="w-11 h-11 bg-zinc-100 animate-pulse rounded-full" />
            )}
            <Box>
              {summary ? (
                <>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                    {summary.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {summary.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
                    </Typography>
                    {summary.status === 'INACTIVE' && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded uppercase tracking-wider">
                        Deactivated
                      </span>
                    )}
                  </Box>
                </>
              ) : (
                <>
                  <Box className="w-24 h-4 bg-zinc-100 animate-pulse rounded mb-1" />
                  <Box className="w-16 h-3 bg-zinc-100 animate-pulse rounded" />
                </>
              )}
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        </Box>

        {/* Scrollable Drawer Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, spaceY: 4 }} className="space-y-6">
          {isWorkloadLoading || !summary ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={24} color="inherit" />
            </Box>
          ) : (
            <>
              {summary.status === 'INACTIVE' ? (
                <Box className="bg-red-50/10 dark:bg-red-950/10 border border-red-200/30 dark:border-red-900/30 rounded-xl p-4 space-y-3">
                  <Box className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-red-650 dark:text-red-400 uppercase tracking-widest">
                      Deactivated Profile
                    </span>
                  </Box>
                  <div className="text-xs space-y-2 text-zinc-650 dark:text-zinc-400">
                    <div>
                      <span className="font-semibold block uppercase tracking-wider text-[9px] text-zinc-450 dark:text-zinc-500">Email Address</span>
                      <span className="font-medium text-black dark:text-white text-sm">{summary.email || 'N/A'}</span>
                    </div>
                    {summary.deactivated_at && (
                      <div>
                        <span className="font-semibold block uppercase tracking-wider text-[9px] text-zinc-450 dark:text-zinc-500">Deactivated On</span>
                        <span className="font-medium text-black dark:text-white text-sm">
                          {new Date(summary.deactivated_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                    {summary.health_score !== undefined && (
                      <div>
                        <span className="font-semibold block uppercase tracking-wider text-[9px] text-zinc-450 dark:text-zinc-500">Previous Workload Health</span>
                        <span className="font-medium text-black dark:text-white text-sm">{summary.health_score}%</span>
                      </div>
                    )}
                  </div>
                </Box>
              ) : (
                /* Health Summary Card */
                <Box className="bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                  <Box className="flex justify-between items-center">
                    <Box className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Workload Health
                      </span>
                      <Tooltip title="Health is based on on-time task completion (70%) and current overdue/today pending penalties (30%) calculated over the last 30 days.">
                        <HelpCircle size={13} className="text-zinc-400 cursor-help" />
                      </Tooltip>
                    </Box>
                    <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full uppercase tracking-wide ${getHealthColor(summary.health_score || 0)}`}>
                      {summary.health_status?.replace('_', ' ')}
                    </span>
                  </Box>

                  <Box className="flex items-center justify-between gap-4">
                    <Box className="flex-1">
                      <LinearProgress
                        variant="determinate"
                        value={summary.health_score || 0}
                        color={getHealthBarColor(summary.health_score || 0)}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                    <span className="text-sm font-bold tracking-tight">
                      {summary.health_score}%
                    </span>
                  </Box>
                </Box>
              )}

              {/* Workload Stats Grid */}
              <Box className="grid grid-cols-3 gap-3">
                <Box className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
                  <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Pending
                  </span>
                  <span className="block text-xl font-bold tracking-tight mt-0.5">
                    {summary.total_pending}
                  </span>
                </Box>
                <Box className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
                  <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Due Today
                  </span>
                  <span className="block text-xl font-bold tracking-tight mt-0.5">
                    {summary.due_today}
                  </span>
                </Box>
                <Box className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
                  <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Overdue
                  </span>
                  <span className={`block text-xl font-bold tracking-tight mt-0.5 ${summary.overdue_tasks && summary.overdue_tasks > 0 ? 'text-red-650 dark:text-red-400' : ''}`}>
                    {summary.overdue_tasks || 0}
                  </span>
                </Box>
                 <Box className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
                  <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Completed (Wk)
                  </span>
                  <span className="block text-xl font-bold tracking-tight mt-0.5">
                    {summary.completed_this_week}
                  </span>
                </Box>
                <Box className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
                  <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Completed (Mo)
                  </span>
                  <span className="block text-xl font-bold tracking-tight mt-0.5">
                    {summary.completed_this_month}
                  </span>
                </Box>
                <Box className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
                  <Tooltip title="Late submissions are tasks completed after their submission deadline.">
                    <div className="cursor-help">
                      <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                        Late Completed
                      </span>
                      <span className={`block text-xl font-bold tracking-tight mt-0.5 ${summary.late_completions && summary.late_completions > 0 ? 'text-red-500' : ''}`}>
                        {summary.late_completions || 0}
                      </span>
                    </div>
                  </Tooltip>
                </Box>
                <Box className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center col-span-3">
                  <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    On-Time Completion Rate
                  </span>
                  <span className="block text-2xl font-black tracking-tight mt-0.5 text-black dark:text-white">
                    {Math.round((summary.on_time_completion_rate || 0) * 100)}%
                  </span>
                </Box>
              </Box>

              {/* [+ Create Task] button for Admin */}
              {isAdmin && onCreateTask && summary.status !== 'INACTIVE' && (
                <button
                  onClick={() => onCreateTask(memberId!)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-lg text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Task
                </button>
              )}

              {/* Tasks List Section */}
              <Box className="space-y-4 pt-2">
                <Box className="flex justify-between items-center">
                  <Typography variant="body2" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
                    Assigned Tasks
                  </Typography>
                </Box>

                {/* Filter Pills */}
                <Box className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {(['all', 'today', 'pending', 'upcoming', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all capitalize whitespace-nowrap ${
                        activeFilter === filter
                          ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                          : 'bg-white dark:bg-black text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-white/10'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </Box>

                {/* Tasks Content */}
                {isTasksLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={18} color="inherit" />
                  </Box>
                ) : !tasks || tasks.length === 0 ? (
                  <Box className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center bg-zinc-50/20 dark:bg-black/10">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      No tasks found
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      There are no assigned tasks in this category.
                    </Typography>
                  </Box>
                ) : (
                  <Box className="space-y-2">
                    {tasks.map((task) => {
                      return (
                        <Box
                          key={task.id}
                          className={`bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-black dark:hover:border-zinc-100 transition-all cursor-pointer ${getPriorityBorder(
                            task.priority
                          )}`}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <Box className="flex items-center gap-2.5 min-w-0">
                            {/* Checkbox */}
                            <button
                              type="button"
                              disabled={
                                completeTaskMutation.isPending ||
                                reopenTaskMutation.isPending
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (task.status === 'COMPLETED') {
                                  reopenTaskMutation.mutate(task.id);
                                } else {
                                  completeTaskMutation.mutate(task.id);
                                }
                              }}
                              className="text-zinc-450 hover:text-black dark:hover:text-white shrink-0 transition-all duration-200 active:scale-90"
                            >
                              {task.status === 'COMPLETED' ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                              ) : (
                                <Circle className="h-4.5 w-4.5" />
                              )}
                            </button>

                            {/* Details */}
                            <Box className="min-w-0">
                              <h4
                                className={`text-xs font-semibold truncate ${
                                  task.status === 'COMPLETED'
                                    ? 'line-through text-zinc-450 dark:text-zinc-550'
                                    : 'text-black dark:text-zinc-200'
                                }`}
                              >
                                {task.name}
                              </h4>
                              <Box className="flex items-center gap-2 flex-wrap text-[10px] text-zinc-400 mt-0.5">
                                {task.due_time && (
                                  <Box className="flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>{formatTimeOnly(task.due_time)}</span>
                                  </Box>
                                )}
                                {task.project_detail && (
                                  <span className="font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wide">
                                    {task.project_detail.name}
                                  </span>
                                )}
                              </Box>
                            </Box>
                          </Box>

                          {/* Priority Badge */}
                          {task.priority && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                                task.priority === 'HIGH'
                                  ? 'text-red-650 bg-red-50 dark:bg-red-950/20 dark:text-red-400'
                                  : task.priority === 'MEDIUM'
                                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400'
                                  : 'text-blue-650 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400'
                              }`}
                            >
                              {task.priority}
                            </span>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Embedded Task Detail Overlay Panel */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onEdit={() => {}}
        />
      )}
    </Drawer>
  );
};
