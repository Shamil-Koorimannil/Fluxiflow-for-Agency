import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircularProgress } from '@mui/material';
import { ChevronLeft, ChevronRight, Download, Search as SearchIcon, Briefcase, Folder } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { api } from '../../services/api';
import type { Project, Client } from '../../types';
import { formatDateOnly, formatTimeOnly } from '../../utils/time';
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
  status: 'COMPLETED' | 'PENDING';
  due_date: string;
  due_time: string | null;
  completed_at: string | null;
  priority: string;
  on_time: 'On Time' | 'Late' | null;
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
    on_time: number;
    late: number;
    on_time_rate: number;
  };
  tasks: TaskReportDetail[];
}

export const Reports: React.FC = () => {
  const { confirm, showAlert } = useConfirm();
  const { isAdmin } = useOrganization();

  // Top Level Tab: 'client' vs 'project'
  const [reportType, setReportType] = useState<'client' | 'project'>('client');

  // Date Range mode
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [dateStr, setDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

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

  // Fetch raw report tasks
  const { data: report, isLoading, refetch } = useQuery<ReportData>({
    queryKey: [
      'reports-data',
      mode,
      dateStr,
      startDateStr,
      endDateStr,
      selectedProjectId,
      statusFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode === 'single') {
        params.append('date', dateStr);
      } else {
        params.append('start_date', startDateStr);
        params.append('end_date', endDateStr);
      }
      if (selectedProjectId !== 'all') params.append('project', selectedProjectId);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const endpoint = mode === 'single' ? '/reports/daily/' : '/reports/range/';
      const res = await api.get(`${endpoint}?${params.toString()}`);
      return res.data;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (mode === 'single' && dateStr === todayStr) {
      const interval = setInterval(() => {
        refetch();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [mode, dateStr, refetch]);

  const handlePrevDay = () => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    setDateStr(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return;
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    setDateStr(d.toISOString().split('T')[0]);
  };

  const handleGoToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateStr(today);
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
    } else {
      params.append('start_date', startDateStr);
      params.append('end_date', endDateStr);
    }
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
      const filename = mode === 'single'
        ? `Fluxiflow_Report_${dateStr}.${ext}`
        : `Fluxiflow_Report_${startDateStr}_to_${endDateStr}.${ext}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      showAlert({ title: 'Export Failed', message: 'Failed to export report.', variant: 'warning' });
    }
  };

  // Filter tasks by client if selected
  const allTasks = report?.tasks || [];
  const filteredTasks = allTasks.filter((t) => {
    if (selectedClientId !== 'all') {
      const proj = projects?.find((p) => p.id === t.project_id);
      if (proj?.client !== selectedClientId) return false;
    }
    return true;
  });

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

        {/* REPORT TYPE & MODE TABS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Category Tabs: Client Reports vs Project Reports */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl no-scrollbar overflow-x-auto max-w-full">
            <button
              onClick={() => setReportType('client')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 w-auto ${
                reportType === 'client'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Briefcase size={14} />
              <span>Client Reports</span>
            </button>
            <button
              onClick={() => setReportType('project')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 w-auto ${
                reportType === 'project'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Folder size={14} />
              <span>Project Reports</span>
            </button>
          </div>

          {/* Single Day vs Date Range Selector */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl no-scrollbar overflow-x-auto max-w-full">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 w-auto ${
                mode === 'single'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Single Day
            </button>
            <button
              onClick={() => setMode('range')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 w-auto ${
                mode === 'range'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Date Range
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & DATE CONTROLS BAR */}
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* DATE CONTROLS */}
          {mode === 'single' ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handlePrevDay}
                className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={dateStr}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDateStr(e.target.value)}
                className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-transparent text-sm font-semibold focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
              />
              <button
                onClick={handleNextDay}
                disabled={dateStr === new Date().toISOString().split('T')[0]}
                className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={handleGoToToday}
                className="px-3 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap"
              >
                Today
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400">From</span>
                <input
                  type="date"
                  value={startDateStr}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-transparent text-sm font-semibold focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400">To</span>
                <input
                  type="date"
                  value={endDateStr}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-transparent text-sm font-semibold focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
              </div>
            </div>
          )}

          {/* EXPORT ACTION */}
          <div className="relative self-start lg:self-auto">
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

        {/* INPUT FILTERS ROW USING CUSTOM DROPDOWNS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-900">
          
          {/* CLIENT FILTER (For Client Reports) */}
          {reportType === 'client' && (
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
          )}

          {/* PROJECT FILTER */}
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

          {/* STATUS FILTER */}
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

          {/* SEARCH FIELD */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search deliverables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 h-10 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs font-bold text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
              />
              <SearchIcon size={14} className="absolute left-2.5 top-3 text-zinc-400" />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <CircularProgress size={32} sx={{ color: 'text.primary' }} />
        </div>
      ) : report ? (
        <div className="space-y-6">
          
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Total Deliverables</span>
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

          {/* DETAILED DELIVERABLES LOG TABLE */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-black dark:text-white tracking-tight">
              {reportType === 'client' ? 'Client Deliverables Log' : 'Project Progress Log'}
            </h3>
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
                        <tr key={t.task_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
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
