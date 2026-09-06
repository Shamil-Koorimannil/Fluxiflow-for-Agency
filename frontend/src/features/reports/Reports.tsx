import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircularProgress } from '@mui/material';
import { ChevronLeft, ChevronRight, Download, Search as SearchIcon } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { api } from '../../services/api';
import type { Project, Client } from '../../types';
import { formatDateOnly, formatTimeOnly, getLocalDateString } from '../../utils/time';
import { CustomDropdown } from '../../components/common/CustomDropdown';
import { useOrganization } from '../../context/OrganizationContext';

interface TaskReportDetail {
  date: string;
  task_id: string;
  task_name: string;
  project_id: string | null;
  project_name: string;
  client_id?: string | null;
  client_name?: string;
  member_id: string;
  member_name: string;
  status: 'COMPLETED' | 'PENDING' | 'OVERDUE';
  due_date: string;
  due_time: string | null;
  completed_at: string | null;
  priority: string;
  on_time: 'On Time' | 'Late' | 'Overdue' | 'Pending' | null;
  late_by?: string;
  task_type?: string | null;
  allocated_seconds?: number | null;
  actual_duration_seconds?: number | null;
}

interface ReportData {
  start_date: string;
  end_date: string;
  is_range: boolean;
  summary: {
    total_members: number;
    completed: number;
    pending: number;
    overdue: number;
    on_time: number;
    late: number;
    on_time_rate: number;
  };
  tasks: TaskReportDetail[];
}

export const Reports: React.FC = () => {
  const { confirm, showAlert } = useConfirm();
  const { isAdmin } = useOrganization();

  // Period mode: 'single' | 'month' | 'range'
  const [mode, setMode] = useState<'single' | 'month' | 'range'>('single');
  const [dateStr, setDateStr] = useState<string>(() => getLocalDateString(new Date()));
  const [monthStr, setMonthStr] = useState<string>(() => getLocalDateString(new Date()).substring(0, 7));
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getLocalDateString(d);
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => getLocalDateString(new Date()));

  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Helper to compute start & end dates for a month string "YYYY-MM"
  const getMonthDateRange = (mStr: string) => {
    const [year, month] = mStr.split('-').map(Number);
    if (!year || !month) {
      const today = getLocalDateString(new Date());
      return { startDate: today, endDate: today };
    }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  };

  // Fetch clients list
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients-reports'],
    queryFn: async () => {
      const res = await api.get('/clients/');
      return res.data;
    },
  });

  // Fetch projects list
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-reports'],
    queryFn: async () => {
      const res = await api.get('/projects/');
      return res.data;
    },
  });

  // Fetch raw report tasks using strict query key identity including all date and filter options
  const { data: report, isLoading, refetch } = useQuery<ReportData>({
    queryKey: [
      'reports-data',
      mode,
      dateStr,
      monthStr,
      startDateStr,
      endDateStr,
      selectedClientId,
      selectedProjectId,
      statusFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      let endpoint = '/reports/daily/';

      if (mode === 'single') {
        params.append('date', dateStr);
      } else if (mode === 'month') {
        const { startDate, endDate } = getMonthDateRange(monthStr);
        params.append('start_date', startDate);
        params.append('end_date', endDate);
        endpoint = '/reports/range/';
      } else {
        params.append('start_date', startDateStr);
        params.append('end_date', endDateStr);
        endpoint = '/reports/range/';
      }

      if (selectedClientId !== 'all') params.append('client', selectedClientId);
      if (selectedProjectId !== 'all') params.append('project', selectedProjectId);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`${endpoint}?${params.toString()}`);
      return res.data;
    },
    enabled: isAdmin,
  });

  // Background auto-refresh for Today's report
  useEffect(() => {
    const todayStr = getLocalDateString(new Date());
    if (mode === 'single' && dateStr === todayStr) {
      const interval = setInterval(() => {
        refetch();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [mode, dateStr, refetch]);

  // Date Navigation Handlers
  const handlePrevDay = () => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() - 1);
      setDateStr(getLocalDateString(d));
    }
  };

  const handleNextDay = () => {
    const today = getLocalDateString(new Date());
    if (dateStr === today) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + 1);
      setDateStr(getLocalDateString(d));
    }
  };

  const handleGoToToday = () => {
    setDateStr(getLocalDateString(new Date()));
  };

  const handlePrevMonth = () => {
    const [year, month] = monthStr.split('-').map(Number);
    if (year && month) {
      const d = new Date(year, month - 2, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      setMonthStr(`${y}-${m}`);
    }
  };

  const handleNextMonth = () => {
    const [year, month] = monthStr.split('-').map(Number);
    if (year && month) {
      const d = new Date(year, month, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      setMonthStr(`${y}-${m}`);
    }
  };

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    setIsExportDropdownOpen(false);

    const formatLabels: Record<string, string> = {
      excel: 'Excel',
      csv: 'CSV',
      pdf: 'PDF',
    };

    const isConfirmed = await confirm({
      title: 'Confirm Export',
      message: `Are you sure you want to export this report as ${formatLabels[format]}?`,
      confirmText: 'Export',
      cancelText: 'Cancel',
      variant: 'info' as const,
    });
    if (!isConfirmed) return;

    const params = new URLSearchParams();
    if (mode === 'single') {
      params.append('date', dateStr);
    } else if (mode === 'month') {
      const { startDate, endDate } = getMonthDateRange(monthStr);
      params.append('start_date', startDate);
      params.append('end_date', endDate);
    } else {
      params.append('start_date', startDateStr);
      params.append('end_date', endDateStr);
    }

    if (selectedClientId !== 'all') params.append('client', selectedClientId);
    if (selectedProjectId !== 'all') params.append('project', selectedProjectId);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (searchQuery) params.append('search', searchQuery);

    const formatPath = format === 'excel' ? 'excel' : format;
    const url = `/reports/export/${formatPath}/?${params.toString()}`;

    try {
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: (response.headers['content-type'] as string) || undefined });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const ext = format === 'excel' ? 'xlsx' : format;
      let filename = `Fluxiflow_Report_${dateStr}.${ext}`;
      if (mode === 'month') {
        filename = `Fluxiflow_Report_${monthStr}.${ext}`;
      } else if (mode === 'range') {
        filename = `Fluxiflow_Report_${startDateStr}_to_${endDateStr}.${ext}`;
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      showAlert({ title: 'Export Failed', message: 'Failed to export report.', variant: 'warning' });
    }
  };

  // Filter tasks by client if client_id not directly populated on backend response
  const allTasks = report?.tasks || [];
  const filteredTasks = allTasks.filter((t) => {
    if (selectedClientId !== 'all') {
      const proj = projects?.find((p) => p.id === t.project_id);
      if (t.client_id) {
        if (t.client_id !== selectedClientId) return false;
      } else if (proj?.client !== selectedClientId) {
        return false;
      }
    }
    return true;
  });

  // Calculate metrics strictly from the active filtered dataset
  const completedTasksCount = filteredTasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingTasksCount = filteredTasks.filter((t) => t.status !== 'COMPLETED').length;
  const totalTasksCount = filteredTasks.length;

  const formatSeconds = (secs?: number | null) => {
    if (!secs || secs === 0) return '—';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 w-full min-w-0">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black dark:text-white">Reports</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Deliverable completion and progress tracking for clients and projects.
          </p>
        </div>

        {/* MODE SELECTOR & EXPORT BUTTON */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl no-scrollbar overflow-x-auto max-w-full">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                mode === 'single'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Single Day
            </button>
            <button
              onClick={() => setMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                mode === 'month'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setMode('range')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                mode === 'range'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Date Range
            </button>
          </div>

          {/* EXPORT ACTION */}
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-xs font-extrabold px-4 py-2.5 rounded-xl hover:bg-zinc-900 dark:hover:bg-zinc-50 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Download size={14} />
              <span>Export Report</span>
            </button>

            {isExportDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsExportDropdownOpen(false)}
                />
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors"
                  >
                    Export Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors"
                  >
                    Export CSV (.csv)
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors"
                  >
                    Export PDF (.pdf)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & DATE CONTROLS BAR: CLIENT | PROJECT | STATUS | DATE/PERIOD */}
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. CLIENT FILTER */}
          <CustomDropdown
            label="Client"
            value={selectedClientId}
            onChange={(val) => setSelectedClientId(val)}
            options={[
              { value: 'all', label: 'All Clients' },
              ...(clients || []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            fullWidth
          />

          {/* 2. PROJECT FILTER */}
          <CustomDropdown
            label="Project"
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(val)}
            options={[
              { value: 'all', label: 'All Projects' },
              ...(projects || []).map((p) => ({ value: p.id, label: p.name })),
            ]}
            fullWidth
          />

          {/* 3. STATUS FILTER */}
          <CustomDropdown
            label="Status"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'completed', label: 'Completed' },
              { value: 'pending', label: 'Pending' },
            ]}
            fullWidth
          />

          {/* 4. DATE / PERIOD FILTER CONTROL */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Date / Period ({mode === 'single' ? 'Day' : mode === 'month' ? 'Month' : 'Range'})
            </label>
            {mode === 'single' ? (
              <div className="flex items-center gap-1.5 h-10">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
                  title="Previous Day"
                >
                  <ChevronLeft size={14} />
                </button>
                <input
                  type="date"
                  value={dateStr}
                  max={getLocalDateString(new Date())}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs font-bold focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleNextDay}
                  disabled={dateStr === getLocalDateString(new Date())}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Next Day"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="px-2 py-2 text-[10px] font-extrabold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0"
                >
                  Today
                </button>
              </div>
            ) : mode === 'month' ? (
              <div className="flex items-center gap-1.5 h-10">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
                  title="Previous Month"
                >
                  <ChevronLeft size={14} />
                </button>
                <input
                  type="month"
                  value={monthStr}
                  onChange={(e) => setMonthStr(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs font-bold focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
                  title="Next Month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 h-10">
                <input
                  type="date"
                  value={startDateStr}
                  max={getLocalDateString(new Date())}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="w-1/2 px-1.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-[11px] font-bold focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
                <span className="text-[10px] font-extrabold text-zinc-400 shrink-0">→</span>
                <input
                  type="date"
                  value={endDateStr}
                  max={getLocalDateString(new Date())}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  className="w-1/2 px-1.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-[11px] font-bold focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <CircularProgress size={32} sx={{ color: 'text.primary' }} />
        </div>
      ) : report ? (
        <div className="space-y-6">
          
          {/* STATS OVERVIEW CARDS (Calculated strictly from active filtered dataset) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Total Tasks</span>
              <span className="text-2xl font-black text-black dark:text-white mt-2">{totalTasksCount}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Completed Tasks</span>
              <span className="text-2xl font-black text-emerald-500 mt-2">{completedTasksCount}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Pending Tasks</span>
              <span className="text-2xl font-black text-amber-500 mt-2">{pendingTasksCount}</span>
            </div>
          </div>

          {/* DETAILED DELIVERABLES LOG TABLE SECTION WITH SEARCHBAR */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-black dark:text-white tracking-tight">
                Deliverables & Progress Log
              </h3>
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search deliverables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 h-9 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs font-bold text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white shadow-2xs"
                />
                <SearchIcon size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                      {report.is_range && <th className="px-5 py-3.5">Date</th>}
                      <th className="px-5 py-3.5">Project / Client</th>
                      <th className="px-5 py-3.5">Task Name</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5">Completed At</th>
                      <th className="px-5 py-3.5">Allocated</th>
                      <th className="px-5 py-3.5">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={report.is_range ? 8 : 7} className="px-6 py-8 text-center text-zinc-400 font-bold">
                          No deliverables found matching the selected reporting criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map((t) => (
                        <tr key={`${t.task_id}-${t.date}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                          {report.is_range && <td className="px-5 py-3.5 font-bold text-zinc-400">{t.date}</td>}
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-black dark:text-white block">{t.project_name}</span>
                            {t.client_name && (
                              <span className="text-[10px] text-zinc-400 font-normal block">{t.client_name}</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-extrabold text-black dark:text-white">{t.task_name}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase ${
                                t.status === 'COMPLETED'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                  : t.status === 'OVERDUE'
                                  ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span>{formatDateOnly(t.due_date)}</span>
                            {t.due_time && <span className="text-[10px] text-zinc-400 block">{formatTimeOnly(t.due_time)}</span>}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-emerald-500">{t.completed_at || '—'}</td>
                          <td className="px-5 py-3.5 font-mono text-[11px]">{formatSeconds(t.allocated_seconds)}</td>
                          <td className="px-5 py-3.5 font-mono text-[11px]">{formatSeconds(t.actual_duration_seconds)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};

