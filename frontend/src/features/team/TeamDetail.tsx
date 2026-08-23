import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { TeamWorkload, Task } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { classifyTask } from '../../utils/taskClassifier';
import { TaskDatePicker } from '../tasks/TaskDatePicker';
import { PasteTasksModal } from '../tasks/PasteTasksModal';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Typography
} from '@mui/material';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertCircle,
  Calendar,
  Check,
  Grid as GridIcon,
  History,
  CircleDot,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

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



  // Task mutations
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post(`/tasks/${taskId}/complete/`);
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

  const reopenTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post(`/tasks/${taskId}/reopen/`);
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

  // Period filter states
  const [periodOption, setPeriodOption] = useState<'current_month' | 'select_month' | 'last_3_months' | 'custom_range' | 'current_year'>('current_month');
  
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  // Custom range states (start and end months/years)
  const [customStartMonth, setCustomStartMonth] = useState<number>(currentMonthIdx);
  const [customStartYear, setCustomStartYear] = useState<number>(currentYear);
  const [customEndMonth, setCustomEndMonth] = useState<number>(currentMonthIdx);
  const [customEndYear, setCustomEndYear] = useState<number>(currentYear);

  const [dropdownAnchorEl, setDropdownAnchorEl] = useState<null | HTMLElement>(null);
  const [pickerAnchorEl, setPickerAnchorEl] = useState<null | HTMLElement>(null);
  const [pickerType, setPickerType] = useState<'month' | 'range' | null>(null);
  const [viewYear, setViewYear] = useState<number>(currentYear);
  const mainButtonRef = useRef<HTMLButtonElement | null>(null);

  const [rangeStep, setRangeStep] = useState<'start' | 'end'>('start');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const isCustomRangeValid = () => {
    if (periodOption !== 'custom_range') return true;
    if (customStartYear < customEndYear) return true;
    if (customStartYear === customEndYear && customStartMonth <= customEndMonth) return true;
    return false;
  };

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (periodOption) {
      case 'current_month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = now;
        break;
      }
      case 'select_month': {
        start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
        end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'last_3_months': {
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        end = now;
        break;
      }
      case 'custom_range': {
        start = new Date(customStartYear, customStartMonth, 1, 0, 0, 0, 0);
        end = new Date(customEndYear, customEndMonth + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'current_year': {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = now;
        break;
      }
      default: {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = now;
      }
    }

    return {
      start_date: start.toISOString(),
      end_date: end.toISOString()
    };
  };

  const { start_date, end_date } = getDateRange();
  const isPeriodValid = isCustomRangeValid();

  // Fetch Member Workload (contains summary and workload)
  const { data: workloadData, isLoading, error } = useQuery<TeamWorkload>({
    queryKey: ['employee-workload', id, periodOption, selectedMonth, selectedYear, customStartMonth, customStartYear, customEndMonth, customEndYear],
    queryFn: async () => {
      if (!isPeriodValid) return null;
      const response = await api.get(`/team/${id}/workload/`, {
        params: { start_date, end_date }
      });
      return response.data;
    },
    enabled: !!id,
  });

  const visibleTasks = React.useMemo(() => {
    if (!workloadData) return [];
    const { workload } = workloadData;
    const allTasks = [
      ...(workload.today || []),
      ...(workload.tomorrow || []),
      ...(workload.yesterday || []),
      ...(workload.pending || []),
      ...(workload.upcoming || []),
      ...(workload.completed || [])
    ];
    
    // Deduplicate by ID
    const unique = Array.from(new Map(allTasks.map(t => [t.id, t])).values());
    
    // Split and rebuild visible order: Today, Tomorrow, Overdue, Upcoming, No Due Date, Completed
    const todayList: Task[] = [];
    const tomorrowList: Task[] = [];
    const upcomingList: Task[] = [];
    const overdueList: Task[] = [];
    const noDueDateList: Task[] = [];
    const completedList: Task[] = [];

    unique.forEach((task) => {
      const category = classifyTask(task);
      if (category === 'completed') {
        completedList.push(task);
      } else if (category === 'today') {
        todayList.push(task);
      } else if (category === 'tomorrow') {
        tomorrowList.push(task);
      } else if (category === 'upcoming') {
        upcomingList.push(task);
      } else if (category === 'overdue') {
        overdueList.push(task);
      } else if (category === 'no_due_date') {
        noDueDateList.push(task);
      }
    });

    return [
      ...todayList,
      ...tomorrowList,
      ...overdueList,
      ...upcomingList,
      ...noDueDateList,
      ...completedList
    ];
  }, [workloadData]);

  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string | null>(null);

  const handleToggleSelect = (taskId: string, isShiftPressed?: boolean) => {
    if (isShiftPressed && lastSelectedTaskId) {
      const startIdx = visibleTasks.findIndex(t => t.id === lastSelectedTaskId);
      const endIdx = visibleTasks.findIndex(t => t.id === taskId);
      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const rangeIds = visibleTasks.slice(minIdx, maxIdx + 1).map(t => t.id);
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
    setLastSelectedTaskId(null);
  };

  const handleBulkCopy = () => {
    const tasksToCopy = visibleTasks.filter(t => selectedTaskIds.includes(t.id));
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

  const areAllVisibleSelected = visibleTasks.length > 0 && visibleTasks.every(t => selectedTaskIds.includes(t.id));

  const handleSelectAllToggle = () => {
    if (areAllVisibleSelected) {
      const visibleIds = visibleTasks.map(t => t.id);
      setSelectedTaskIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        visibleTasks.forEach(t => next.add(t.id));
        return Array.from(next);
      });
    }
  };

  const getPeriodLabel = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    switch (periodOption) {
      case 'current_month':
        return 'Current Month';
      case 'select_month':
        return `${fullMonths[selectedMonth]} ${selectedYear}`;
      case 'last_3_months':
        return 'Last 3 Months';
      case 'custom_range': {
        if (customStartYear === customEndYear) {
          if (customStartMonth === customEndMonth) {
            return `${fullMonths[customStartMonth]} ${customStartYear}`;
          }
          return `${months[customStartMonth]} – ${months[customEndMonth]}, ${customStartYear}`;
        }
        return `${months[customStartMonth]} ${customStartYear} – ${months[customEndMonth]} ${customEndYear}`;
      }
      case 'current_year':
        return 'Current Year';
      default:
        return 'Current Month';
    }
  };


  const getPriorityColor = (priority: string | null) => {
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

  const deduplicateTasks = (taskList: Task[]): Task[] => {
    const seen = new Set<string>();
    return taskList.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-850 rounded"></div>
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-855 rounded"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !workloadData) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Link to="/app/team" className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black dark:hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Team
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-4 text-sm font-medium text-red-655 dark:text-red-400">
          Failed to load team member profile.
        </div>
      </div>
    );
  }

  const { summary, workload } = workloadData;

  const renderTaskSection = (title: string, tasks: Task[], showOverdueAlert: boolean = false) => {
    if (tasks.length === 0) return null;
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          {title} ({tasks.length})
          {showOverdueAlert && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full normal-case">
              <AlertCircle className="h-3 w-3" /> overdue
            </span>
          )}
        </h3>
        
        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden text-black dark:text-white">
          {tasks.map((task) => {
            const isAssigned = task.assignees.some((a) => a.id === user?.id);
            const canComplete = isAdmin || isAssigned;
            return (
              <div
                key={task.id}
                className={`flex items-start md:items-center justify-between p-4 gap-3 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${getPriorityColor(
                  task.priority
                )}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="flex items-start md:items-center gap-3">
                  <button
                    type="button"
                    disabled={!canComplete || completeTaskMutation.isPending || reopenTaskMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (task.status === 'COMPLETED') {
                        reopenTaskMutation.mutate(task.id);
                      } else {
                        completeTaskMutation.mutate(task.id);
                      }
                    }}
                    className="text-zinc-400 hover:text-black dark:hover:text-white shrink-0 disabled:opacity-50 transition-all duration-200 mt-0.5 md:mt-0"
                  >
                    {task.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-550 dark:text-green-400 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                  
                  <div>
                    <h4 className={`text-sm font-semibold ${task.status === 'COMPLETED' ? 'line-through text-zinc-400 dark:text-zinc-550' : 'text-black dark:text-white'}`}>
                      {task.name}
                    </h4>
                    {task.project_detail && (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-555 font-medium mt-0.5 block">
                        {task.project_detail.name}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right shrink-0 flex items-center gap-1.5">
                  <TaskDatePicker task={task} />
                  
                  {/* Selection Checkbox (Moved to right) */}
                  <div className="flex items-center shrink-0 px-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(task.id, e.shiftKey);
                      }}
                      onChange={() => {}}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-black focus:ring-black focus:ring-0 cursor-pointer w-4 h-4"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };



  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 text-black dark:text-white">
      {/* Back button */}
      <div>
        <Link
          to="/app/team"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Team
        </Link>
      </div>

      {/* Header Profile Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">{summary.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Workload overview and assigned task backlog for {summary.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}.
          </p>
        </div>
        
        {/* Period Selector dropdown */}
        <div className="flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-2 justify-end">
            {copiedTasksCount > 0 && isAdmin && (
              <button
                onClick={() => setIsPasteModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white font-bold"
              >
                Paste ({copiedTasksCount})
              </button>
            )}
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">Period:</span>
            
            {/* Polished Period Selector Trigger */}
            <Button
              ref={mainButtonRef}
              onClick={(e) => setDropdownAnchorEl(e.currentTarget)}
              variant="outlined"
              startIcon={<Calendar size={15} />}
              endIcon={<span>▾</span>}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                borderColor: 'divider',
                color: 'text.primary',
                height: '36px',
                px: 1.5,
                '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }
              }}
            >
              {getPeriodLabel()}
            </Button>

            {/* Dropdown Menu for options */}
            <Menu
              anchorEl={dropdownAnchorEl}
              open={Boolean(dropdownAnchorEl)}
              onClose={() => setDropdownAnchorEl(null)}
              slotProps={{
                paper: {
                  elevation: 1,
                  sx: {
                    border: '1px solid #e4e4e7',
                    borderRadius: '8px',
                    minWidth: 180,
                    '& .MuiMenuItem-root': {
                      fontSize: '13px',
                      fontWeight: 500,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      '&:hover': { bgcolor: '#f4f4f5' },
                    },
                  },
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  setPeriodOption('current_month');
                  setDropdownAnchorEl(null);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Calendar size={14} className="text-zinc-550" />
                  <span>Current Month</span>
                </Box>
                {periodOption === 'current_month' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setDropdownAnchorEl(null);
                  setPickerType('month');
                  setViewYear(selectedYear);
                  setPickerAnchorEl(mainButtonRef.current);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GridIcon size={14} className="text-zinc-550" />
                  <span>Select Month</span>
                </Box>
                {periodOption === 'select_month' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setPeriodOption('last_3_months');
                  setDropdownAnchorEl(null);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History size={14} className="text-zinc-550" />
                  <span>Last 3 Months</span>
                </Box>
                {periodOption === 'last_3_months' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setDropdownAnchorEl(null);
                  setPickerType('range');
                  setPickerAnchorEl(mainButtonRef.current);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ArrowLeftRight size={14} className="text-zinc-550" />
                  <span>Custom Range</span>
                </Box>
                {periodOption === 'custom_range' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setPeriodOption('current_year');
                  setDropdownAnchorEl(null);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircleDot size={14} className="text-zinc-550" />
                  <span>Current Year</span>
                </Box>
                {periodOption === 'current_year' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
            </Menu>

            {/* Dynamic Month/Range Picker Popover */}
            <Popover
              open={Boolean(pickerAnchorEl)}
              anchorEl={pickerAnchorEl}
              onClose={() => {
                setPickerAnchorEl(null);
                setPickerType(null);
              }}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              slotProps={{
                paper: {
                  sx: {
                    p: 2,
                    border: '1px solid #e4e4e7',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)',
                    mt: 1,
                    maxWidth: 'calc(100vw - 32px)',
                  }
                }
              }}
            >
              {pickerType === 'month' && (
                <Box sx={{ width: 260 }}>
                  {/* Header with year pagination */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <IconButton size="small" onClick={() => setViewYear(prev => prev - 1)}>
                      <ChevronLeft size={16} />
                    </IconButton>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {viewYear}
                    </Typography>
                    <IconButton size="small" onClick={() => setViewYear(prev => prev + 1)}>
                      <ChevronRight size={16} />
                    </IconButton>
                  </Box>

                  {/* Grid of months */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {monthsList.map((m, idx) => {
                      const isSelected = selectedMonth === idx && selectedYear === viewYear;
                      return (
                        <Button
                          key={idx}
                          fullWidth
                          size="small"
                          variant={isSelected ? 'contained' : 'text'}
                          onClick={() => {
                            setSelectedMonth(idx);
                            setSelectedYear(viewYear);
                            setPeriodOption('select_month');
                            setPickerAnchorEl(null);
                            setPickerType(null);
                          }}
                          sx={{
                            textTransform: 'none',
                            fontWeight: isSelected ? 800 : 500,
                            borderRadius: '6px',
                            py: 1,
                            fontSize: '12px',
                            bgcolor: isSelected ? 'text.primary' : 'transparent',
                            color: isSelected ? 'background.paper' : 'text.primary',
                            '&:hover': {
                              bgcolor: isSelected ? 'text.secondary' : 'action.hover',
                            }
                          }}
                        >
                          {m.substring(0, 3)}
                        </Button>
                      );
                    })}
                  </div>
                </Box>
              )}

              {pickerType === 'range' && (
                isMobile ? (
                  /* Mobile View: Single Panel with tabs */
                  <Box sx={{ width: 240 }}>
                    {/* Step Toggle Tabs */}
                    <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
                      <Button
                        fullWidth
                        size="small"
                        onClick={() => setRangeStep('start')}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '11px',
                          borderRadius: 0,
                          borderBottom: rangeStep === 'start' ? '2px solid' : '2px solid transparent',
                          borderColor: rangeStep === 'start' ? 'text.primary' : 'transparent',
                          color: rangeStep === 'start' ? 'text.primary' : 'text.secondary',
                          py: 1,
                          minWidth: 0
                        }}
                      >
                        Start: {monthsList[customStartMonth].substring(0, 3)} {customStartYear}
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        onClick={() => setRangeStep('end')}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '11px',
                          borderRadius: 0,
                          borderBottom: rangeStep === 'end' ? '2px solid' : '2px solid transparent',
                          borderColor: rangeStep === 'end' ? 'text.primary' : 'transparent',
                          color: rangeStep === 'end' ? 'text.primary' : 'text.secondary',
                          py: 1,
                          minWidth: 0
                        }}
                      >
                        End: {monthsList[customEndMonth].substring(0, 3)} {customEndYear}
                      </Button>
                    </Box>

                    {rangeStep === 'start' ? (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customStartYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customStartMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => {
                                  setCustomStartMonth(idx);
                                  setRangeStep('end');
                                }}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>
                    ) : (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customEndYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customEndMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => setCustomEndMonth(idx)}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>
                    )}

                    {/* Validation and Apply Button */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      {!isCustomRangeValid() && (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 650, textAlign: 'center' }}>
                          Start month cannot be after End month.
                        </Typography>
                      )}
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        disabled={!isCustomRangeValid()}
                        onClick={() => {
                          setPeriodOption('custom_range');
                          setPickerAnchorEl(null);
                          setPickerType(null);
                        }}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: '6px',
                          bgcolor: 'text.primary',
                          color: 'background.paper',
                          '&:hover': { bgcolor: 'text.secondary' }
                        }}
                      >
                        Apply Range
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  /* Desktop View: Side-by-side Panels */
                  <Box sx={{ width: 440 }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      {/* Left Side: Start Month Picker */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '9px', tracking: '0.05em' }}>
                          Start Month
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customStartYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customStartMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => setCustomStartMonth(idx)}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>

                      {/* Right Side: End Month Picker */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '9px', tracking: '0.05em' }}>
                          End Month
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customEndYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customEndMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => setCustomEndMonth(idx)}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>
                    </Box>

                    {/* Validation and Apply Button */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      {!isCustomRangeValid() ? (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 650 }}>
                          Start month cannot be after End month.
                        </Typography>
                      ) : (
                        <div />
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!isCustomRangeValid()}
                        onClick={() => {
                          setPeriodOption('custom_range');
                          setPickerAnchorEl(null);
                          setPickerType(null);
                        }}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: '6px',
                          bgcolor: 'text.primary',
                          color: 'background.paper',
                          '&:hover': { bgcolor: 'text.secondary' }
                        }}
                      >
                        Apply Range
                      </Button>
                    </Box>
                  </Box>
                )
              )}
            </Popover>
          </div>
        </div>
      </div>

      {!isPeriodValid && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 p-4 text-sm font-medium text-amber-655 dark:text-amber-400">
          Start period must be before or equal to End period.
        </div>
      )}


      {/* Workload Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Pending Tasks
          </span>
          <span className="block text-2xl font-bold text-black dark:text-white mt-1">
            {summary.total_pending}
          </span>
        </div>
        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Due Today
          </span>
          <span className="block text-2xl font-bold text-black dark:text-white mt-1">
            {summary.due_today}
          </span>
        </div>
        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Completed (Week)
          </span>
          <span className="block text-2xl font-bold text-black dark:text-white mt-1">
            {summary.completed_this_week}
          </span>
        </div>
        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            Completed (Month)
          </span>
          <span className="block text-2xl font-bold text-black dark:text-white mt-1">
            {summary.completed_this_month}
          </span>
        </div>
      </div>

      {/* Grouped Workload Backlog */}
      {(() => {
        if (!isPeriodValid) return null;
        
        const totalTasksInPeriod = (summary.total_pending ?? 0) + (summary.completed_this_month ?? 0);
        const hasTaskData = totalTasksInPeriod > 0;
        
        if (!hasTaskData) {
          return (
            <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black p-12 text-center text-black dark:text-white">
              <h3 className="font-semibold text-sm">No task data available for this period</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                There are no assigned or completed tasks in this selected timeframe.
              </p>
            </div>
          );
        }

        const allTasks = [
          ...(workload.today || []),
          ...(workload.tomorrow || []),
          ...(workload.yesterday || []),
          ...(workload.pending || []),
          ...(workload.upcoming || []),
          ...(workload.completed || [])
        ];
        const deduplicated = deduplicateTasks(allTasks);

        const todayList: Task[] = [];
        const tomorrowList: Task[] = [];
        const upcomingList: Task[] = [];
        const overdueList: Task[] = [];
        const noDueDateList: Task[] = [];
        const completedList: Task[] = [];

        deduplicated.forEach((task) => {
          const category = classifyTask(task);
          if (category === 'completed') {
            completedList.push(task);
          } else if (category === 'today') {
            todayList.push(task);
          } else if (category === 'tomorrow') {
            tomorrowList.push(task);
          } else if (category === 'upcoming') {
            upcomingList.push(task);
          } else if (category === 'overdue') {
            overdueList.push(task);
          } else if (category === 'no_due_date') {
            noDueDateList.push(task);
          }
        });
        
        return (
          <div className="space-y-6 pt-4">
            <div className="flex justify-end pr-1">
              {visibleTasks.length > 0 && (
                <button
                  onClick={handleSelectAllToggle}
                  className="text-xs font-bold text-zinc-555 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
                >
                  {areAllVisibleSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            {renderTaskSection('Today', todayList)}
            {renderTaskSection('Tomorrow', tomorrowList)}
            {renderTaskSection('Overdue', overdueList, true)}
            {renderTaskSection('Upcoming', upcomingList)}
            {renderTaskSection('No Due Date', noDueDateList)}
            {renderTaskSection('Completed', completedList)}
          </div>
        );
      })()}

      {/* Floating Bulk Action Toolbar */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-lg z-50 flex items-center gap-4 animate-in fade-in slide-in-from-bottom duration-200 text-xs text-black dark:text-white">
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
            className="font-bold text-zinc-400 hover:text-zinc-650 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Paste Tasks Modal */}
      <PasteTasksModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        defaultAssigneeId={id}
      />

      {/* DETAIL SIDE PANEL DRAWER */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onEdit={(task) => {
            setSelectedTaskId(null); // close detail
            setTaskToEdit(task);
            setIsFormModalOpen(true); // open edit form
          }}
        />
      )}

      {/* CREATE / EDIT TASK MODAL */}
      <TaskFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
      />
    </div>
  );
};
