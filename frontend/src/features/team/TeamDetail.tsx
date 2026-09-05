import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Shield, CheckCircle2,
  AlertCircle, RefreshCw, Heart
} from 'lucide-react';
import type { Task, MemberWorkload } from '../../types';
import { api } from '../../services/api';
import { WorkloadMonitor } from './WorkloadMonitor';
import { TaskCard } from '../tasks/TaskCard';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { useTaskDragSelect } from '../../hooks/useTaskDragSelect';
import { getLocalDateString, formatDateOnly } from '../../utils/time';
import { useAuth } from '../auth/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { getRoleDisplayLabel } from '../../utils/roleUtils';
import { useConfirm } from '../../context/ConfirmDialogContext';

interface TeamMemberDetailResponse {
  summary: {
    id: string;
    name: string;
    role: 'ORG_ADMIN' | 'ADMIN' | 'MEMBER';
    email: string;
    status: 'INVITED' | 'ACTIVE' | 'INACTIVE';
    is_active: boolean;
    deactivated_at: string | null;
    avatar_url: string | null;
    total_pending: number;
    due_today: number;
    completed_this_week: number;
    completed_this_month: number;
    health_score: number;
    health_status: string;
    overdue_tasks: number;
    on_time_completion_rate: number;
    late_completions: number;
  };
  workload_stats: MemberWorkload;
  workload: {
    today: Task[];
    tomorrow: Task[];
    overdue: Task[];
    upcoming: Task[];
    no_due_date: Task[];
    completed: Task[];
  };
  tasks: Task[];
}

export interface TaskDateGroup {
  dateKey: string | null;
  formattedDate: string;
  isPassed: boolean;
  isToday: boolean;
  tasks: Task[];
}

export const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert } = useConfirm();
  const { user: currentUser } = useAuth();
  const { isAdmin } = useOrganization();

  // Task Filter state
  const [filter, setFilter] = useState<'ALL' | 'INCOMPLETED' | 'COMPLETED' | 'TODAY' | 'UPCOMING' | 'NO_DUE_DATE'>('ALL');
  const [mainView, setMainView] = useState<'work' | 'performance'>('work');

  // Selected task modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Period filter state
  const MONTH_NAMES = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);
  const currentYearVal = new Date().getFullYear();
  const currentMonthVal = new Date().getMonth() + 1;

  const YEARS = useMemo(() => Array.from({ length: 10 }, (_, i) => currentYearVal - 5 + i), [currentYearVal]);

  type PeriodType = 'CURRENT_MONTH' | 'SELECT_MONTH' | 'MONTH_RANGE' | 'LAST_3_MONTHS' | 'CUSTOM_RANGE' | 'CURRENT_YEAR' | 'ALL';

  const [periodType, setPeriodType] = useState<PeriodType>('CURRENT_MONTH');
  const [selectMonth, setSelectMonth] = useState<number>(currentMonthVal);
  const [selectYear, setSelectYear] = useState<number>(currentYearVal);

  const [startMonth, setStartMonth] = useState<number>(currentMonthVal);
  const [startYear, setStartYear] = useState<number>(currentYearVal);
  const [endMonth, setEndMonth] = useState<number>(currentMonthVal);
  const [endYear, setEndYear] = useState<number>(currentYearVal);

  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const { periodQueryParams, periodLabel, validationError } = useMemo(() => {
    let params: Record<string, any> = {};
    let label = 'Current Month';
    let err: string | null = null;

    const now = new Date();

    if (periodType === 'CURRENT_MONTH') {
      const yr = now.getFullYear();
      const mo = now.getMonth() + 1;
      params = { start_month: mo, start_year: yr, end_month: mo, end_year: yr };
      label = `${MONTH_NAMES[mo - 1]} ${yr}`;
    } else if (periodType === 'SELECT_MONTH') {
      params = { start_month: selectMonth, start_year: selectYear, end_month: selectMonth, end_year: selectYear };
      label = `${MONTH_NAMES[selectMonth - 1]} ${selectYear}`;
    } else if (periodType === 'MONTH_RANGE') {
      if ((startYear > endYear) || (startYear === endYear && startMonth > endMonth)) {
        err = 'Invalid month range: Start period cannot be after End period.';
      } else {
        params = { start_month: startMonth, start_year: startYear, end_month: endMonth, end_year: endYear };
        if (startMonth === endMonth && startYear === endYear) {
          label = `${MONTH_NAMES[startMonth - 1]} ${startYear}`;
        } else {
          label = `${MONTH_NAMES[startMonth - 1]} ${startYear} – ${MONTH_NAMES[endMonth - 1]} ${endYear}`;
        }
      }
    } else if (periodType === 'LAST_3_MONTHS') {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      params = {
        start_month: start.getMonth() + 1,
        start_year: start.getFullYear(),
        end_month: end.getMonth() + 1,
        end_year: end.getFullYear(),
      };
      label = `Last 3 Months (${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()})`;
    } else if (periodType === 'CUSTOM_RANGE') {
      if (customStartDate && customEndDate && customStartDate > customEndDate) {
        err = 'Invalid date range: Start date cannot be after End date.';
      } else if (customStartDate || customEndDate) {
        params = { start_date: customStartDate, end_date: customEndDate };
        label = `Custom (${customStartDate || 'Start'} to ${customEndDate || 'End'})`;
      } else {
        label = 'Custom Range';
      }
    } else if (periodType === 'CURRENT_YEAR') {
      const yr = now.getFullYear();
      params = { start_month: 1, start_year: yr, end_month: 12, end_year: yr };
      label = `Current Year (${yr})`;
    } else if (periodType === 'ALL') {
      params = {};
      label = 'All Time';
    }

    return { periodQueryParams: params, periodLabel: label, validationError: err };
  }, [periodType, selectMonth, selectYear, startMonth, startYear, endMonth, endYear, customStartDate, customEndDate, MONTH_NAMES]);

  // Fetch Member details and workload from backend endpoint
  const { data, isLoading, isError, error, refetch } = useQuery<TeamMemberDetailResponse>({
    queryKey: ['team-member', id, periodQueryParams],
    queryFn: async () => {
      if (!id) throw new Error('Member ID is required.');
      const response = await api.get(`/team/${id}/workload/`, { params: periodQueryParams });
      return response.data;
    },
    enabled: Boolean(id) && !validationError,
  });

  const memberSummary = data?.summary;
  const workloadStats = data?.workload_stats;
  const tasks = data?.tasks || [];

  const dragSelect = useTaskDragSelect({
    visibleTasks: tasks,
    onOpenDetail: (taskId) => {
      const targetTask = tasks.find((t) => t.id === taskId);
      if (targetTask) {
        setSelectedTask(targetTask);
        setIsTaskModalOpen(true);
      }
    },
  });

  const invalidateMemberQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['team-member', id] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['team'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    refetch();
  };

  const handleToggleComplete = async (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (task.status === 'COMPLETED') {
        await api.post(`/tasks/${task.id}/reopen/`);
      } else {
        await api.post(`/tasks/${task.id}/complete/`);
      }
      invalidateMemberQueries();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err.response?.data?.detail || 'Failed to update task completion status.',
        variant: 'warning',
      });
    }
  };

  const todayStr = getLocalDateString(new Date());

  const incompleteTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'COMPLETED');
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'COMPLETED');
  }, [tasks]);

  const sortTasksByDueDate = (taskList: Task[]) => {
    return [...taskList].sort((a, b) => {
      const dateA = a.due_date ? a.due_date.split('T')[0] : null;
      const dateB = b.due_date ? b.due_date.split('T')[0] : null;

      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return dateA.localeCompare(dateB);
    });
  };

  // Filtered Incomplete Tasks sorted by due_date ascending (earliest first, no due date last)
  const filteredIncompleteTasks = useMemo(() => {
    let list = incompleteTasks;
    if (filter === 'TODAY') {
      list = list.filter((t) => t.due_date && t.due_date.split('T')[0] === todayStr);
    } else if (filter === 'UPCOMING') {
      list = list.filter((t) => t.due_date && t.due_date.split('T')[0] > todayStr);
    } else if (filter === 'NO_DUE_DATE') {
      list = list.filter((t) => !t.due_date);
    }
    return sortTasksByDueDate(list);
  }, [incompleteTasks, filter, todayStr]);

  const sortedCompletedTasks = useMemo(() => {
    return sortTasksByDueDate(completedTasks);
  }, [completedTasks]);

  const getHealthColor = (score?: number, status?: string) => {
    if (score === undefined || score === null || status === 'no_data') {
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700';
    }
    if (score >= 90) return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    if (score >= 80) return 'bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    if (score >= 40) return 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    return 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
  };

  const getHealthBarColor = (score?: number) => {
    if (score === undefined || score === null) return 'bg-zinc-400';
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-zinc-400 gap-2 text-xs">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span>Loading team member details...</span>
      </div>
    );
  }

  if (isError || !memberSummary) {
    let errorMessage = 'Unable to load team member details right now. Please try again.';
    if (error) {
      const httpStatus = (error as any).response?.status;
      if (httpStatus === 404) {
        errorMessage = 'Team member could not be found.';
      } else if (httpStatus === 403) {
        errorMessage = 'You do not have permission to view this team member.';
      } else if (httpStatus === 401) {
        errorMessage = 'Your session has expired. Please sign in again.';
      } else if (httpStatus >= 500) {
        errorMessage = 'Server error occurred while loading team member details.';
      }
    }

    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/app/team')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Team
        </button>
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-medium">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-50/50 dark:bg-zinc-950 p-4 sm:p-6 md:p-10">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/team')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Team
        </button>
      </div>

      {/* Member Header Card with Workload Health Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm mb-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0 flex-shrink-0 min-w-[64px] min-h-[64px]">
              {memberSummary.avatar_url ? (
                <img src={memberSummary.avatar_url} alt={memberSummary.name} className="h-full w-full rounded-2xl object-cover shrink-0" />
              ) : (
                memberSummary.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {memberSummary.name}
                </h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase shrink-0 ${
                  memberSummary.role === 'ADMIN'
                    ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                }`}>
                  <Shield className="h-3 w-3" />
                  <span>{getRoleDisplayLabel(memberSummary.role)}</span>
                </span>
                {memberSummary.status === 'INACTIVE' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700 shrink-0">
                    Deactivated
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium min-w-0">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{memberSummary.email}</span>
              </div>
            </div>
          </div>

          {/* Member Stats Box */}
          <div className="flex items-center gap-4 text-center p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl w-full sm:w-auto">
            <div className="flex-1">
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">{tasks.length}</span>
              <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">Total Tasks</span>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-800">
              <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {completedTasks.length}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">Completed</span>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-800">
              <span className="block text-xl font-bold text-blue-600 dark:text-blue-400">
                {incompleteTasks.length}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">Incomplete</span>
            </div>
          </div>
        </div>

        {/* Member Health Progress Bar */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500 fill-red-500/20" />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                Health
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border tracking-wide whitespace-nowrap ${getHealthColor(memberSummary.health_score, memberSummary.health_status)}`}>
                {memberSummary.health_status === 'no_data' ? 'no data' : (memberSummary.health_status?.replace('_', ' ') || 'healthy')}
              </span>
            </div>
            <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
              {memberSummary.health_score !== null && memberSummary.health_score !== undefined ? `${memberSummary.health_score}%` : '—'}
            </span>
          </div>

          <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getHealthBarColor(memberSummary.health_score)}`}
              style={{ width: `${Math.min(100, Math.max(0, memberSummary.health_score ?? 0))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Prominent Workload Monitor */}
      {workloadStats && (
        <div className="mb-8">
          <WorkloadMonitor workload={workloadStats} />
        </div>
      )}

      {/* View Switcher: Assigned Work vs Performance Report */}
      <div className="w-full mb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 no-scrollbar select-none min-h-[48px] max-w-full">
          <button
            type="button"
            onClick={() => setMainView('work')}
            aria-label="Assigned Work Tab"
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 w-auto cursor-pointer ${
              mainView === 'work'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Assigned Work
          </button>
          <button
            type="button"
            onClick={() => setMainView('performance')}
            aria-label="Performance Report Tab"
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 w-auto cursor-pointer ${
              mainView === 'performance'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Performance Report
          </button>
        </div>
      </div>

      {mainView === 'performance' ? (
        /* MEMBER PERFORMANCE REPORT VIEW */
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
            {/* Header + Period Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  Performance Report — {memberSummary.name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Reporting Period: <span className="font-bold text-purple-600 dark:text-purple-400">{periodLabel}</span>
                </p>
              </div>

              {/* Period Selector Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap">Period:</span>
                
                {/* Main Period Selector */}
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                  className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="CURRENT_MONTH">Current Month</option>
                  <option value="SELECT_MONTH">Select Month</option>
                  <option value="MONTH_RANGE">Month Range</option>
                  <option value="LAST_3_MONTHS">Last 3 Months</option>
                  <option value="CUSTOM_RANGE">Custom Range</option>
                  <option value="CURRENT_YEAR">Current Year</option>
                  <option value="ALL">All Time</option>
                </select>

                {/* Sub-controls for SELECT_MONTH */}
                {periodType === 'SELECT_MONTH' && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectMonth}
                      onChange={(e) => setSelectMonth(Number(e.target.value))}
                      className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={selectYear}
                      onChange={(e) => setSelectYear(Number(e.target.value))}
                      className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sub-controls for MONTH_RANGE */}
                {periodType === 'MONTH_RANGE' && (
                  <div className="flex flex-wrap items-center gap-2 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-zinc-400">From:</span>
                      <select
                        value={startMonth}
                        onChange={(e) => setStartMonth(Number(e.target.value))}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={startYear}
                        onChange={(e) => setStartYear(Number(e.target.value))}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-zinc-400">To:</span>
                      <select
                        value={endMonth}
                        onChange={(e) => setEndMonth(Number(e.target.value))}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={endYear}
                        onChange={(e) => setEndYear(Number(e.target.value))}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Sub-controls for CUSTOM_RANGE */}
                {periodType === 'CUSTOM_RANGE' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400 font-bold">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Inline Validation Alert */}
            {validationError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Assigned Tasks</span>
                <span className="block text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{tasks.length}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Completed</span>
                <span className="block text-xl font-black text-emerald-500 mt-1">{memberSummary.completed_this_month ?? 0}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Pending</span>
                <span className="block text-xl font-black text-amber-500 mt-1">{memberSummary.total_pending ?? 0}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">On-Time Rate</span>
                <span className="block text-xl font-black text-green-500 mt-1">
                  {memberSummary.on_time_completion_rate <= 1 ? Math.round((memberSummary.on_time_completion_rate ?? 1) * 100) : memberSummary.on_time_completion_rate}%
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Late Completions</span>
                <span className="block text-xl font-black text-red-500 mt-1">{memberSummary.late_completions ?? 0}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Health Score</span>
                <span className="block text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{memberSummary.health_score ?? 100}%</span>
              </div>
            </div>

            {/* Member Task History Log */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                Member Activity & Work Log
              </h4>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                {tasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-400 font-medium">No activity logged for this member.</div>
                ) : (
                  tasks.slice(0, 15).map((t) => (
                    <div key={t.id} className="p-3.5 bg-white dark:bg-zinc-950 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{t.name}</span>
                        {t.project_detail && (
                          <span className="text-[10px] text-zinc-400 font-medium">{t.project_detail.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                        }`}>
                          {t.status}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {t.due_date ? formatDateOnly(t.due_date) : 'No due date'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ASSIGNED WORK VIEW */
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            {/* Filter Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar w-full">
              {[
                { key: 'ALL', label: `All Tasks (${tasks.length})` },
                { key: 'INCOMPLETED', label: `Incomplete (${incompleteTasks.length})` },
                { key: 'COMPLETED', label: `Completed (${completedTasks.length})` },
                { key: 'TODAY', label: 'Today' },
                { key: 'UPCOMING', label: 'Upcoming' },
                { key: 'NO_DUE_DATE', label: 'No Due Date' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    filter === tab.key
                      ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

        {/* INCOMPLETE TASKS SECTION (Single Continuous Grid sorted by Due Date) */}
        {filter !== 'COMPLETED' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                INCOMPLETE TASKS ({filteredIncompleteTasks.length})
              </h3>
            </div>

            {filteredIncompleteTasks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6">
                <CheckCircle2 className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No incomplete tasks match this filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredIncompleteTasks.map((task) => (
                  <TaskCard
                    key={`incomplete-${task.id}`}
                    task={task}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    onOpenDetail={(taskId) => {
                      const targetTask = tasks.find((t) => t.id === taskId);
                      if (targetTask) {
                        setSelectedTask(targetTask);
                        setIsTaskModalOpen(true);
                      }
                    }}
                    onToggleComplete={(t) => handleToggleComplete(t)}
                    onEdit={(t) => {
                      setSelectedTask(t);
                      setIsTaskModalOpen(true);
                    }}
                    isSelected={dragSelect.isSelected(task.id)}
                    onToggleSelect={(taskId, shiftKey) => dragSelect.toggleSelect(taskId, shiftKey)}
                    onPointerDown={(e, taskId) => dragSelect.handlePointerDown(e, taskId)}
                    onPointerMove={dragSelect.handlePointerMove}
                    onPointerUp={dragSelect.handlePointerUpOrCancel}
                    onPointerCancel={dragSelect.handlePointerUpOrCancel}
                    onCardClick={(e, taskId) => dragSelect.handleCardClick(e, taskId)}
                    isSelectionActive={dragSelect.isSelectionActive}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPLETED TASKS SECTION */}
        {(filter === 'ALL' || filter === 'COMPLETED') && sortedCompletedTasks.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              COMPLETED TASKS ({sortedCompletedTasks.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedCompletedTasks.map((task) => (
                <TaskCard
                  key={`completed-${task.id}`}
                  task={task}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                  onOpenDetail={(taskId) => {
                    const targetTask = tasks.find((t) => t.id === taskId);
                    if (targetTask) {
                      setSelectedTask(targetTask);
                      setIsTaskModalOpen(true);
                    }
                  }}
                  onToggleComplete={(t) => handleToggleComplete(t)}
                  onEdit={(t) => {
                    setSelectedTask(t);
                    setIsTaskModalOpen(true);
                  }}
                  isSelected={dragSelect.isSelected(task.id)}
                  onToggleSelect={(taskId, shiftKey) => dragSelect.toggleSelect(taskId, shiftKey)}
                  onPointerDown={(e, taskId) => dragSelect.handlePointerDown(e, taskId)}
                  onPointerMove={dragSelect.handlePointerMove}
                  onPointerUp={dragSelect.handlePointerUpOrCancel}
                  onPointerCancel={dragSelect.handlePointerUpOrCancel}
                  onCardClick={(e, taskId) => dragSelect.handleCardClick(e, taskId)}
                  isSelectionActive={dragSelect.isSelectionActive}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Task Edit/Detail Modal */}
      {selectedTask && (
        <TaskFormModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          taskToEdit={selectedTask}
          onTaskSaved={() => invalidateMemberQueries()}
        />
      )}

    </div>
  );
};

