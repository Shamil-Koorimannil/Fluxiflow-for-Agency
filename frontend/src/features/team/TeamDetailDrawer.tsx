import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Task, TeamWorkload } from '../../types';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { classifyTask } from '../../utils/taskClassifier';
import { TaskDatePicker } from '../tasks/TaskDatePicker';
import { PasteTasksModal } from '../tasks/PasteTasksModal';
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
  CheckCircle2,
  Circle,
  HelpCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface TeamDetailDrawerProps {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
  onCreateTask?: (memberId: string) => void;
  startDate?: string;
  endDate?: string;
}

export const TeamDetailDrawer: React.FC<TeamDetailDrawerProps> = ({
  memberId,
  open,
  onClose,
  onCreateTask,
  startDate,
  endDate,
}) => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Filter state: 'all' | 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'no_due_date' | 'completed'
  type FilterType = 'all' | 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'no_due_date' | 'completed';
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Selected task to view detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Selected task for editing
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [copiedTasksCount, setCopiedTasksCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const stored = localStorage.getItem('fluxiflow_copied_tasks');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCopiedTasksCount(Array.isArray(parsed) ? parsed.length : 0);
        } catch {
          setCopiedTasksCount(0);
        }
      } else {
        setCopiedTasksCount(0);
      }
    };
    updateCount();
    window.addEventListener('fluxiflow_copied_tasks_changed', updateCount);
    return () => window.removeEventListener('fluxiflow_copied_tasks_changed', updateCount);
  }, []);

  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTaskIds([]);
    setLastSelectedTaskId(null);
  }, [activeFilter]);

  // Fetch workload summary
  const { data: workloadData, isLoading: isWorkloadLoading } = useQuery<TeamWorkload>({
    queryKey: ['teamWorkload', memberId, startDate, endDate],
    queryFn: async () => {
      const response = await api.get(`/team/${memberId}/workload/`, {
        params: startDate && endDate ? { start_date: startDate, end_date: endDate } : {}
      });
      return response.data;
    },
    enabled: !!memberId && open,
  });

  // Fetch raw tasks list (single source of truth query)
  const { data: allTasksRaw, isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['teamTasks', memberId, startDate, endDate],
    queryFn: async () => {
      const response = await api.get(`/team/${memberId}/tasks/`, {
        params: startDate && endDate ? { start_date: startDate, end_date: endDate } : {}
      });
      return response.data;
    },
    enabled: !!memberId && open,
  });


  const processedTasks = React.useMemo(() => {
    if (!allTasksRaw) return [];
    
    // 1. Deduplicate by unique task ID
    const deduplicated = Array.from(new Map(allTasksRaw.map(t => [t.id, t])).values());
    
    // 2. Filter based on activeFilter tab using local calendar date classifier
    if (activeFilter === 'all') {
      return deduplicated;
    }
    return deduplicated.filter((task) => classifyTask(task) === activeFilter);
  }, [allTasksRaw, activeFilter]);

  const tasks = processedTasks;

  const handleToggleSelect = (taskId: string, isShiftPressed?: boolean) => {
    if (isShiftPressed && lastSelectedTaskId) {
      const startIdx = processedTasks.findIndex(t => t.id === lastSelectedTaskId);
      const endIdx = processedTasks.findIndex(t => t.id === taskId);
      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const rangeIds = processedTasks.slice(minIdx, maxIdx + 1).map(t => t.id);
        setSelectedTaskIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(id => next.add(id));
          return Array.from(next);
        });
        setLastSelectedTaskId(taskId);
        return;
      }
    }
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
    setLastSelectedTaskId(taskId);
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleBulkCopy = () => {
    const tasksToCopy = processedTasks.filter(t => selectedTaskIds.includes(t.id));
    const serialized = tasksToCopy.map(t => ({
      name: t.name,
      description: t.description,
      priority: t.priority,
      due_date: t.due_date,
      due_time: t.due_time,
      subtasks: t.subtasks?.map(s => ({
        name: s.name,
        due_date: s.due_date,
        due_time: s.due_time
      })) || []
    }));
    localStorage.setItem('fluxiflow_copied_tasks', JSON.stringify(serialized));
    setSelectedTaskIds([]);
    window.dispatchEvent(new Event('fluxiflow_copied_tasks_changed'));
  };

  const areAllVisibleSelected = processedTasks.length > 0 && processedTasks.every(t => selectedTaskIds.includes(t.id));

  const handleSelectAllToggle = () => {
    if (areAllVisibleSelected) {
      const visibleIds = processedTasks.map(t => t.id);
      setSelectedTaskIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        processedTasks.forEach(t => next.add(t.id));
        return Array.from(next);
      });
    }
  };

  // Task Completion Mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/tasks/${id}/complete/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['employee-workload'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });

  // Task Reopen Mutation
  const reopenTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/tasks/${id}/reopen/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['employee-workload'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
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

  const getHealthColor = (score: number | null | undefined, status?: string) => {
    if (score === null || score === undefined || status === 'no_data') {
      return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400';
    }
    if (score >= 90) return 'text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400';
    if (score >= 80) return 'text-green-500 bg-green-50/50 dark:bg-green-950/10 dark:text-green-400';
    if (score >= 60) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400';
    if (score >= 40) return 'text-orange-500 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400';
    return 'text-red-650 bg-red-50 dark:bg-red-950/20 dark:text-red-400';
  };

  const getHealthBarColor = (score: number | null | undefined, status?: string) => {
    if (score === null || score === undefined || status === 'no_data') return 'inherit';
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
                    <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full uppercase tracking-wide ${getHealthColor(summary.health_score, summary.health_status)}`}>
                      {summary.health_status === 'no_data' ? 'no data' : summary.health_status?.replace('_', ' ')}
                    </span>
                  </Box>

                  <Box className="flex items-center justify-between gap-4">
                    <Box className="flex-1">
                      <LinearProgress
                        variant="determinate"
                        value={summary.health_score !== null && summary.health_score !== undefined ? summary.health_score : 0}
                        color={getHealthBarColor(summary.health_score, summary.health_status)}
                        sx={{ 
                          height: 6, 
                          borderRadius: 3,
                          ...(summary.health_score === null || summary.health_score === undefined ? {
                            bgcolor: 'action.disabledBackground',
                            '& .MuiLinearProgress-bar': { bgcolor: 'text.disabled' }
                          } : {})
                        }}
                      />
                    </Box>
                    <span className="text-sm font-bold tracking-tight">
                      {summary.health_score !== null && summary.health_score !== undefined ? `${summary.health_score}%` : '—'}
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
                <div className="flex gap-2">
                  {copiedTasksCount > 0 && (
                    <button
                      onClick={() => setIsPasteModalOpen(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
                    >
                      Paste ({copiedTasksCount})
                    </button>
                  )}
                  <button
                    onClick={() => onCreateTask(memberId!)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-lg text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Task
                  </button>
                </div>
              )}

              {/* Tasks List Section */}
              <Box className="space-y-4 pt-2">
                <Box className="flex justify-between items-center">
                  <Typography variant="body2" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
                    Assigned Tasks
                  </Typography>
                  {processedTasks.length > 0 && (
                    <button
                      onClick={handleSelectAllToggle}
                      className="text-xs font-bold text-zinc-555 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
                    >
                      {areAllVisibleSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </Box>                {/* Filter Pills */}
                <Box className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {(['all', 'today', 'tomorrow', 'upcoming', 'overdue', 'no_due_date', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${
                        activeFilter === filter
                          ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-white/10'
                      }`}
                    >
                      {filter === 'no_due_date' ? 'No Due Date' : 
                       filter === 'overdue' ? 'Overdue' : 
                       filter === 'all' ? 'All' :
                       filter === 'today' ? 'Today' :
                       filter === 'tomorrow' ? 'Tomorrow' :
                       filter === 'upcoming' ? 'Upcoming' :
                       filter === 'completed' ? 'Completed' :
                       filter}
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
                      const isSelected = selectedTaskIds.includes(task.id);
                      return (
                        <Box
                          key={task.id}
                          className={`bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-black dark:hover:border-zinc-100 transition-all cursor-pointer ${getPriorityBorder(
                            task.priority
                          )}`}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <Box className="flex items-center gap-2.5 min-w-0 flex-1">
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
                                <CheckCircle2 className="h-4.5 w-4.5 text-green-550 dark:text-green-400 shrink-0" />
                              ) : (
                                <Circle className="h-4.5 w-4.5 shrink-0" />
                              )}
                            </button>
 
                            {/* Details */}
                            <Box className="min-w-0 flex-1">
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
                                <TaskDatePicker task={task} />
                                {task.project_detail && (
                                  <span className="font-semibold text-zinc-555 dark:text-zinc-450 uppercase tracking-wide">
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

                          {/* Selection Checkbox (Moved to right) */}
                          <div className="flex items-center shrink-0 px-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelect(task.id, e.shiftKey);
                              }}
                              onChange={() => {}}
                              className="rounded border-zinc-300 dark:border-zinc-700 text-black focus:ring-black focus:ring-0 cursor-pointer w-4 h-4"
                            />
                          </div>
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

      {/* Floating Bulk Action Toolbar */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-lg z-[9999] flex items-center gap-4 animate-in fade-in slide-in-from-bottom duration-200 text-xs text-black dark:text-white">
          <span className="font-bold">{selectedTaskIds.length} Task{selectedTaskIds.length > 1 ? 's' : ''} Selected</span>
          <div className="h-4 w-px bg-zinc-250 dark:bg-zinc-800" />
          <button
            onClick={handleBulkCopy}
            className="font-bold text-zinc-650 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            Copy
          </button>
          <button
            onClick={handleClearSelection}
            className="font-bold text-zinc-400 hover:text-zinc-655 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Paste Tasks Modal */}
      <PasteTasksModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        defaultAssigneeId={memberId || undefined}
      />

      {/* Embedded Task Detail Overlay Panel */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onEdit={(task) => {
            setSelectedTaskId(null);
            setTaskToEdit(task);
            setIsEditModalOpen(true);
          }}
        />
      )}

      {/* Task Edit Form Modal */}
      <TaskFormModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
      />
    </Drawer>
  );
};
