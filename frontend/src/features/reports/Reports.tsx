import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Drawer, Avatar, CircularProgress } from '@mui/material';
import { ChevronLeft, ChevronRight, Download, Search as SearchIcon, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import type { User, Project } from '../../types';

interface MemberSummary {
  member_id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  completed: number;
  pending: number;
  overdue: number;
  on_time: number;
  late: number;
  on_time_rate: number;
}

interface DailyBreakdown {
  date: string;
  completed: number;
  pending: number;
  overdue: number;
}

interface TaskReportDetail {
  date: string;
  task_id: string;
  task_name: string;
  project_id: string | null;
  project_name: string;
  member_id: string;
  member_name: string;
  status: 'COMPLETED' | 'PENDING' | 'OVERDUE';
  due_date: string;
  due_time: string | null;
  completed_at: string | null;
  priority: string;
  on_time: 'On Time' | 'Late' | null;
  late_by?: string;
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
  member_reports: MemberSummary[];
  daily_breakdown: DailyBreakdown[];
  tasks: TaskReportDetail[];
}

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // State parameters
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

  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeDeactivated, setIncludeDeactivated] = useState<boolean>(false);

  // Export dropdown state
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Drawer for individual report
  const [selectedMemberReport, setSelectedMemberReport] = useState<MemberSummary | null>(null);

  // Fetch active / deactivated members list
  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ['team-list-reports'],
    queryFn: async () => {
      const res = await api.get('/team/');
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

  // Fetch reports data
  const { data: report, isLoading, refetch } = useQuery<ReportData>({
    queryKey: [
      'reports-data',
      mode,
      dateStr,
      startDateStr,
      endDateStr,
      selectedMemberId,
      selectedProjectId,
      statusFilter,
      searchQuery,
      includeDeactivated,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode === 'single') {
        params.append('date', dateStr);
      } else {
        params.append('start_date', startDateStr);
        params.append('end_date', endDateStr);
      }
      if (selectedMemberId !== 'all') params.append('member', selectedMemberId);
      if (selectedProjectId !== 'all') params.append('project', selectedProjectId);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (includeDeactivated) params.append('include_deactivated', 'true');

      const endpoint = mode === 'single' ? '/reports/daily/' : '/reports/range/';
      const res = await api.get(`${endpoint}?${params.toString()}`);
      return res.data;
    },
    enabled: isAdmin,
  });

  // Trigger auto-refetch if today's report is live
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (mode === 'single' && dateStr === todayStr) {
      const interval = setInterval(() => {
        refetch();
      }, 30000); // refresh every 30s
      return () => clearInterval(interval);
    }
  }, [mode, dateStr, refetch]);

  // Navigate single date Previous / Next / Today
  const handlePrevDay = () => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    setDateStr(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return; // disable future date
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    setDateStr(d.toISOString().split('T')[0]);
  };

  const handleGoToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateStr(today);
  };

  const isFutureDate = (d: string) => {
    return new Date(d) > new Date();
  };

  // Secure download helper using Bearer tokens
  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    setIsExportDropdownOpen(false);
    const params = new URLSearchParams();
    if (mode === 'single') {
      params.append('date', dateStr);
    } else {
      params.append('start_date', startDateStr);
      params.append('end_date', endDateStr);
    }
    if (selectedMemberId !== 'all') params.append('member', selectedMemberId);
    if (selectedProjectId !== 'all') params.append('project', selectedProjectId);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (searchQuery) params.append('search', searchQuery);
    if (includeDeactivated) params.append('include_deactivated', 'true');

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
      console.error('Export download failed:', err);
      if (!err.response) {
        alert("Unable to connect to the server.");
        return;
      }
      const status = err.response.status;
      if (status === 401) {
        alert("Your session has expired. Please log in again.");
      } else if (status === 403) {
        alert("You don't have permission to download reports.");
      } else if (status === 404) {
        alert("Report export endpoint was not found.");
      } else if (status === 500) {
        alert("Report generation failed. Please try again.");
      } else {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const json = JSON.parse(text);
            if (json.detail) {
              alert(`Failed to generate report: ${json.detail}`);
              return;
            }
          } catch (_) {}
        } else if (err.response.data?.detail) {
          alert(`Failed to generate report: ${err.response.data.detail}`);
          return;
        }
        alert("Failed to generate report.");
      }
    }
  };

  // Filter members list based on includeDeactivated toggle
  const filteredTeamList = teamMembers?.filter(m => includeDeactivated ? true : (m.is_active && m.status === 'ACTIVE')) || [];

  // Individual Drawer member tasks helper
  const getSelectedMemberTasks = () => {
    if (!selectedMemberReport || !report) return [];
    return report.tasks.filter(t => t.member_id === selectedMemberReport.member_id);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black dark:text-white">Daily Reports</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            View team work completed and pending by day.
          </p>
        </div>

        {/* MODE SELECTOR */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl self-start">
          <button
            onClick={() => setMode('single')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'single'
                ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                : 'text-zinc-550 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Single Day
          </button>
          <button
            onClick={() => setMode('range')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'range'
                ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                : 'text-zinc-550 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Date Range
          </button>
        </div>
      </div>

      {/* FILTER & DATE CONTROLS BAR */}
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* DATE CONTROLS */}
          {mode === 'single' ? (
            <div className="flex items-center gap-3">
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
                className="px-3 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
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
              className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-xs font-extrabold px-4 py-2.5 rounded-xl hover:bg-zinc-900 dark:hover:bg-zinc-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              Export Report
            </button>

            {isExportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1.5 z-20">
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 text-black dark:text-white"
                >
                  Export Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 text-black dark:text-white"
                >
                  Export CSV (.csv)
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 text-black dark:text-white"
                >
                  Export PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* INPUT FILTERS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-900">
          
          {/* MEMBER FILTER */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Member</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-transparent text-xs font-bold text-black dark:text-white focus:outline-none"
            >
              <option value="all">All Members</option>
              {filteredTeamList.map((m) => (
                <option key={m.id} value={m.id}>{m.name} {!m.is_active && '(Deactivated)'}</option>
              ))}
            </select>
          </div>

          {/* PROJECT FILTER */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-transparent text-xs font-bold text-black dark:text-white focus:outline-none"
            >
              <option value="all">All Projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* STATUS FILTER */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-transparent text-xs font-bold text-black dark:text-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* SEARCH FIELD */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search report..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-transparent text-xs font-bold text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
              />
              <SearchIcon size={12} className="absolute left-2.5 top-3 text-zinc-400" />
            </div>
          </div>
        </div>

        {/* DEACTIVATED MEMBERS CHECKBOX */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="include-deactivated"
            checked={includeDeactivated}
            onChange={(e) => setIncludeDeactivated(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-800 text-black dark:text-white focus:ring-0"
          />
          <label htmlFor="include-deactivated" className="text-xs font-bold text-zinc-550 dark:text-zinc-400 cursor-pointer select-none">
            Include Deactivated Members
          </label>
        </div>
      </div>

      {/* ERROR / FUTURE DATE WARNING */}
      {mode === 'single' && isFutureDate(dateStr) && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-4 rounded-2xl flex items-center gap-3 text-red-650 dark:text-red-400 text-xs font-bold">
          <AlertTriangle size={16} />
          No report available for future date.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <CircularProgress size={30} sx={{ color: 'text.primary' }} />
        </div>
      ) : report ? (
        <div className="space-y-6">
          
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Total Members</span>
              <span className="text-xl font-black text-black dark:text-white mt-2">{report.summary.total_members}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Completed</span>
              <span className="text-xl font-black text-emerald-500 mt-2">{report.summary.completed}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">On Time</span>
              <span className="text-xl font-black text-green-500 mt-2">{report.summary.on_time || 0}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Late</span>
              <span className="text-xl font-black text-red-500 mt-2">{report.summary.late || 0}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Pending</span>
              <span className="text-xl font-black text-zinc-650 dark:text-zinc-300 mt-2">{report.summary.pending}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Overdue</span>
              <span className="text-xl font-black text-red-500 mt-2">{report.summary.overdue}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">On-Time Completion</span>
              <span className="text-xl font-black text-black dark:text-white mt-2">{report.summary.on_time_rate}%</span>
            </div>
          </div>

          {/* TEAM MEMBER REPORTS CARDS */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-black dark:text-white tracking-tight">Member Summaries</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.member_reports.map((m) => (
                <div
                  key={m.member_id}
                  className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={m.avatar_url || undefined} className="w-10 h-10 border border-zinc-100 dark:border-zinc-900">
                      {m.name[0]}
                    </Avatar>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-black dark:text-white truncate">{m.name}</h4>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">{m.role}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-center py-4 my-2 border-y border-zinc-100 dark:border-zinc-900">
                    <div>
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Done</span>
                      <p className="text-xs font-black text-emerald-500 mt-1">{m.completed}</p>
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">On Time</span>
                      <p className="text-xs font-black text-green-500 mt-1">{m.on_time || 0}</p>
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Late</span>
                      <p className="text-xs font-black text-red-500 mt-1">{m.late || 0}</p>
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Pending</span>
                      <p className="text-xs font-black text-zinc-650 dark:text-zinc-300 mt-1">{m.pending}</p>
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Overdue</span>
                      <p className="text-xs font-black text-red-500 mt-1">{m.overdue}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400">On-time: <span className="text-black dark:text-white font-extrabold">{m.on_time_rate}%</span></span>
                    <button
                      onClick={() => setSelectedMemberReport(m)}
                      className="text-[10px] font-extrabold py-1.5 px-3 border border-zinc-250 dark:border-zinc-800 rounded-lg hover:border-black dark:hover:border-white transition-colors"
                    >
                      View Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DETAILED TASK TABLE */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-black dark:text-white tracking-tight">Detailed Daily Task Log</h3>
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                      {report.is_range && <th className="px-6 py-4">Date</th>}
                      <th className="px-6 py-4">Member</th>
                      <th className="px-6 py-4">Project & Task</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Due Date</th>
                      <th className="px-6 py-4">Completed At</th>
                      <th className="px-6 py-4">Submission Status</th>
                      <th className="px-6 py-4">Late By</th>
                      <th className="px-6 py-4">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-xs font-semibold text-zinc-650 dark:text-zinc-400">
                    {report.tasks.length === 0 ? (
                      <tr>
                        <td colSpan={report.is_range ? 9 : 8} className="px-6 py-8 text-center text-zinc-400 font-bold">
                          No matching tasks found for the selected reporting criteria.
                        </td>
                      </tr>
                    ) : (
                      report.tasks.map((t) => (
                        <tr key={t.task_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                          {report.is_range && <td className="px-6 py-4 font-bold text-zinc-400">{t.date}</td>}
                          <td className="px-6 py-4 font-bold text-black dark:text-white">{t.member_name}</td>
                          <td className="px-6 py-4">
                            <span className="font-extrabold text-black dark:text-white block">{t.task_name}</span>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wide mt-0.5 block">{t.project_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide ${
                                t.status === 'COMPLETED'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500'
                                  : t.status === 'OVERDUE'
                                  ? 'bg-red-50 dark:bg-red-950/20 text-red-500'
                                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span>{t.due_date}</span>
                            {t.due_time && <span className="text-[10px] text-zinc-400 block mt-0.5">{t.due_time}</span>}
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-500">{t.completed_at || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-0.5 rounded font-extrabold text-[9px] tracking-wide ${
                              t.on_time === 'Late'
                                ? 'bg-red-50 dark:bg-red-950/20 text-red-500'
                                : t.on_time === 'On Time'
                                ? 'bg-green-50 dark:bg-green-950/20 text-green-500'
                                : 'text-zinc-400'
                            }`}>
                              {t.on_time}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-red-500">{t.late_by !== '-' ? t.late_by : '-'}</td>
                          <td className="px-6 py-4 uppercase text-[10px] font-extrabold tracking-wider">{t.priority}</td>
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

      {/* MEMBER INDIVIDUAL REPORT DETAIL DRAWER */}
      <Drawer
        anchor="right"
        open={Boolean(selectedMemberReport)}
        onClose={() => setSelectedMemberReport(null)}
        slotProps={{
          backdrop: {
            sx: { bgcolor: 'rgba(0,0,0,0.1)' }
          },
          paper: {
            sx: {
              width: { xs: '100%', sm: '420px' },
              bgcolor: 'background.paper',
              color: 'text.primary',
              borderLeft: '1px solid',
              borderColor: 'divider',
              p: 4,
              display: 'flex',
              flexDirection: 'column',
            }
          }
        }}
      >
        {selectedMemberReport && (
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div className="space-y-6">
              
              {/* Profile details */}
              <div className="flex items-center gap-3 pb-6 border-b border-zinc-150 dark:border-zinc-800">
                <Avatar src={selectedMemberReport.avatar_url || undefined} className="w-12 h-12 border border-zinc-100 dark:border-zinc-900">
                  {selectedMemberReport.name[0]}
                </Avatar>
                <div>
                  <h3 className="font-extrabold text-sm text-black dark:text-white">{selectedMemberReport.name}</h3>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{selectedMemberReport.role}</span>
                </div>
              </div>

              {/* Day stats summary */}
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Reporting Range Summary</span>
                <div className="grid grid-cols-5 gap-2 text-center p-4 mt-2 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <div>
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Done</span>
                    <p className="text-xs font-black text-emerald-500 mt-1">{selectedMemberReport.completed}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">On Time</span>
                    <p className="text-xs font-black text-green-500 mt-1">{selectedMemberReport.on_time || 0}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Late</span>
                    <p className="text-xs font-black text-red-500 mt-1">{selectedMemberReport.late || 0}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Pending</span>
                    <p className="text-xs font-black text-zinc-650 dark:text-zinc-300 mt-1">{selectedMemberReport.pending}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Overdue</span>
                    <p className="text-xs font-black text-red-500 mt-1">{selectedMemberReport.overdue}</p>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 font-bold mt-2 text-right">On-time Completion Rate: {selectedMemberReport.on_time_rate}%</p>
              </div>

              {/* Tasks details block */}
              <div className="space-y-4 flex-1 overflow-y-auto">
                
                {/* COMPLETED WORK LIST */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 dark:border-zinc-900 pb-1">
                    Completed Work
                  </span>
                  {getSelectedMemberTasks().filter(t => t.status === 'COMPLETED').length === 0 ? (
                    <p className="text-xs text-zinc-400 font-bold italic py-2">No completed tasks logged.</p>
                  ) : (
                    getSelectedMemberTasks().filter(t => t.status === 'COMPLETED').map(t => (
                      <div key={t.task_id} className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-black dark:text-white">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span className="truncate">{t.task_name}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide">Project: {t.project_name}</p>
                        {t.completed_at && (
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-bold">
                              <Clock size={10} />
                              Completed: {t.completed_at}
                            </div>
                            <div className={`text-[9px] font-extrabold ${t.on_time === 'Late' ? 'text-red-500' : 'text-green-500'}`}>
                              Submission: {t.on_time} {t.on_time === 'Late' && t.late_by !== '-' ? `(${t.late_by})` : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* PENDING / OVERDUE WORK LIST */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 dark:border-zinc-900 pb-1">
                    Pending / Overdue Work
                  </span>
                  {getSelectedMemberTasks().filter(t => t.status !== 'COMPLETED').length === 0 ? (
                    <p className="text-xs text-zinc-400 font-bold italic py-2">No pending tasks.</p>
                  ) : (
                    getSelectedMemberTasks().filter(t => t.status !== 'COMPLETED').map(t => (
                      <div key={t.task_id} className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-black dark:text-white">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'OVERDUE' ? 'bg-red-500' : 'bg-zinc-400'}`} />
                          <span className="truncate">{t.task_name}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide">Project: {t.project_name}</p>
                        <div className="flex items-center gap-1 text-[9px] text-zinc-400 font-bold">
                          <Clock size={10} />
                          Due: {t.due_date} {t.due_time ? `@ ${t.due_time}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

            <button
              onClick={() => setSelectedMemberReport(null)}
              className="w-full py-2.5 mt-6 border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white text-xs font-extrabold rounded-xl transition-colors shrink-0 text-black dark:text-white"
            >
              Close Panel
            </button>
          </div>
        )}
      </Drawer>
    </div>
  );
};
