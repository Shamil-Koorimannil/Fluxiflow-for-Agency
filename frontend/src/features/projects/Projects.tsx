import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Project } from '../../types';
import { Folder, Plus, ArrowUpDown, Calendar, MoreVertical, ExternalLink, Copy, Download, Trash2 } from 'lucide-react';
import { Menu, MenuItem } from '@mui/material';
import { formatDateOnly } from '../../utils/time';
import { ProjectMonthPickerModal } from './ProjectMonthPickerModal';
import { ProjectFormModal } from './ProjectFormModal';
import { CustomDropdown } from '../../components/common/CustomDropdown';

import { useOrganization } from '../../context/OrganizationContext';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Three-dot menu state
  const [projectMenuState, setProjectMenuState] = useState<{
    anchorEl: HTMLElement | null;
    project: Project | null;
  }>({ anchorEl: null, project: null });

  // Search, sort, and date filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Project Date Filtering State
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'this_year' | 'custom'>('all');
  const [customYear, setCustomYear] = useState<number>(new Date().getFullYear());
  const [customMonth, setCustomMonth] = useState<number | null>(new Date().getMonth());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const { isAdmin } = useOrganization();

  // Fetch projects list
  const { data: projects, isLoading, error: fetchError } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects/');
      return response.data;
    },
  });

  // Filter and Search projects
  const searchedProjects = (projects || []).filter((project) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = project.name.toLowerCase().includes(term);
    const descMatch = project.description?.toLowerCase().includes(term) ?? false;
    return nameMatch || descMatch;
  });

  // Helper for timezone-safe date parsing
  const parseProjectDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length < 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { year, month, day };
  };

  // Date Filtering
  const dateFilteredProjects = searchedProjects.filter((project) => {
    if (dateFilter === 'all') return true;
    const parsed = parseProjectDate(project.project_date);
    if (!parsed) return false;

    const now = new Date();
    if (dateFilter === 'this_month') {
      return parsed.year === now.getFullYear() && parsed.month === now.getMonth();
    }
    if (dateFilter === 'this_year') {
      return parsed.year === now.getFullYear();
    }
    if (dateFilter === 'custom') {
      if (customYear !== null && customMonth !== null) {
        return parsed.year === customYear && parsed.month === customMonth;
      }
      if (customYear !== null && customMonth === null) {
        return parsed.year === customYear;
      }
    }
    return true;
  });

  // Split projects based on completeness rules:
  const activeProjects = dateFilteredProjects.filter((p) => p.progress === null || p.progress < 100);
  const completedProjects = dateFilteredProjects.filter((p) => p.progress !== null && p.progress >= 100);

  const displayedProjects = activeTab === 'active' ? activeProjects : completedProjects;

  // Sort projects
  const sortedProjects = [...displayedProjects].sort((a, b) => {
    switch (sortBy) {
      case 'project_date_desc': {
        if (!a.project_date && !b.project_date) return 0;
        if (!a.project_date) return 1;
        if (!b.project_date) return -1;
        return b.project_date.localeCompare(a.project_date);
      }
      case 'project_date_asc': {
        if (!a.project_date && !b.project_date) return 0;
        if (!a.project_date) return 1;
        if (!b.project_date) return -1;
        return a.project_date.localeCompare(b.project_date);
      }
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      case 'progress_desc':
        return (b.progress ?? 0) - (a.progress ?? 0);
      case 'progress_asc':
        return (a.progress ?? 0) - (b.progress ?? 0);
      case 'recently_updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      default:
        return 0;
    }
  });

  const getDateFilterLabel = () => {
    if (dateFilter === 'all') return 'All Dates';
    if (dateFilter === 'this_month') return 'This Month';
    if (dateFilter === 'this_year') return 'This Year';
    if (dateFilter === 'custom') {
      if (customMonth !== null) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${monthNames[customMonth]} ${customYear}`;
      }
      return `${customYear}`;
    }
    return 'All Dates';
  };

  const handleOpenProjectMenu = (e: React.MouseEvent<HTMLButtonElement>, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectMenuState({ anchorEl: e.currentTarget, project });
  };

  const handleCloseProjectMenu = () => {
    setProjectMenuState({ anchorEl: null, project: null });
  };

  const handleMenuOpenProject = () => {
    if (projectMenuState.project) {
      const projId = projectMenuState.project.id;
      handleCloseProjectMenu();
      navigate(`/app/projects/${projId}`);
    }
  };

  const handleMenuDuplicateProject = async () => {
    if (!projectMenuState.project) return;
    const projId = projectMenuState.project.id;
    handleCloseProjectMenu();
    try {
      await api.post(`/projects/${projId}/duplicate/`);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to duplicate project.');
    }
  };

  const handleMenuDownloadProject = async () => {
    if (!projectMenuState.project) return;
    const proj = projectMenuState.project;
    handleCloseProjectMenu();
    try {
      const res = await api.get(`/projects/${proj.id}/download/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeName = proj.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      link.setAttribute('download', `Project_${safeName}_Export.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to download project data.');
    }
  };

  const handleMenuDeleteProject = async () => {
    if (!projectMenuState.project) return;
    const proj = projectMenuState.project;
    handleCloseProjectMenu();
    if (!window.confirm(`Are you sure you want to delete project "${proj.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${proj.id}/`);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete project.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"></div>
          <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-zinc-150 dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50"></div>
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 text-sm font-medium text-red-650 dark:text-red-400">
        Failed to load projects. Please verify connection and auth state.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Projects</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage company client scopes and project hierarchies.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 md:gap-2 md:px-4 md:py-2 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-medium rounded-lg text-xs md:text-sm transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">Create Project</span>
            <span className="inline md:hidden">Project</span>
          </button>
        )}
      </div>

      {/* Search, Sort, and Tabs Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-100 dark:border-zinc-900">
        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border whitespace-nowrap shrink-0 w-auto ${
              activeTab === 'active'
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                : 'bg-transparent text-zinc-550 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white'
            }`}
          >
            Active Projects ({activeProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border whitespace-nowrap shrink-0 w-auto ${
              activeTab === 'completed'
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                : 'bg-transparent text-zinc-550 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white'
            }`}
          >
            Completed Projects ({completedProjects.length})
          </button>
        </div>

        {/* Search, Date Filter, & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:w-64 px-3 py-1.5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-colors"
          />

          <CustomDropdown
            value={dateFilter}
            buttonText={`Date: ${getDateFilterLabel()}`}
            icon={<Calendar size={15} />}
            onChange={(val) => {
              if (val === 'custom') {
                setIsMonthPickerOpen(true);
              } else {
                setDateFilter(val as any);
              }
            }}
            options={[
              { value: 'all', label: 'All Dates' },
              { value: 'this_month', label: 'This Month' },
              { value: 'this_year', label: 'This Year' },
              { value: 'custom', label: 'Select Month / Year...', icon: <Calendar size={14} /> },
            ]}
          />

          <CustomDropdown
            value={sortBy}
            onChange={(val) => setSortBy(val as any)}
            icon={<ArrowUpDown size={15} />}
            valuePrefix="Sort: "
            options={[
              { value: 'project_date_desc', label: 'Project Date — Newest First' },
              { value: 'project_date_asc', label: 'Project Date — Oldest First' },
              { value: 'newest', label: 'Newest created' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'name_asc', label: 'Name A-Z' },
              { value: 'name_desc', label: 'Name Z-A' },
              { value: 'progress_desc', label: 'Progress: High to Low' },
              { value: 'progress_asc', label: 'Progress: Low to High' },
              { value: 'recently_updated', label: 'Recently updated' },
            ]}
          />
        </div>
      </div>

      {/* Projects Grid */}
      {!projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black p-12 text-center text-black dark:text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-550 mb-4">
            <Folder className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">No projects yet</h3>
          {isAdmin ? (
            <>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                Create your first project to begin grouping sub-projects and tasks.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
              >
                Create Project
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              No projects have been created yet. Ask your manager to set up a project.
            </p>
          )}
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black p-12 text-center text-zinc-500 dark:text-zinc-400">
          <Folder className="h-5 w-5 text-zinc-450 mb-2" />
          <h3 className="font-semibold text-sm">No projects found</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {dateFilter !== 'all'
              ? `There are no projects for ${getDateFilterLabel()}.`
              : 'Try adjusting your search terms or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProjects.map((project) => (
            <Link
              key={project.id}
              to={`/app/projects/${project.id}`}
              className="group border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white bg-white dark:bg-black rounded-xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-200 text-black dark:text-white relative"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Folder className="h-4 w-4 text-zinc-400 group-hover:text-black dark:group-hover:text-white shrink-0 mt-0.5" />
                    <h3 className="font-semibold text-sm text-black dark:text-white truncate">{project.name}</h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {project.project_date && (
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                        {formatDateOnly(project.project_date)}
                      </span>
                    )}

                    {/* Three-Dot Menu Action Trigger */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenProjectMenu(e, project)}
                      className="p-1 text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Project options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {project.client_display_name && (
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 w-fit">
                    <span>Client: {project.client_display_name}</span>
                  </div>
                )}

                <p className="text-xs text-zinc-550 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>
              </div>

              {/* Progress and task count bar */}
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-semibold uppercase tracking-wider">
                  {project.task_count ?? 0} {project.task_count === 1 ? 'task' : 'tasks'}
                </span>
                
                {project.progress !== null ? (
                  <div className="flex items-center gap-2">
                    {/* Visual Bar */}
                    <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full"
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-black dark:text-white">{project.progress}%</span>
                  </div>
                ) : (
                  <span className="text-zinc-400 italic font-medium">No tasks yet</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* THREE-DOT PROJECT MENU */}
      <Menu
        anchorEl={projectMenuState.anchorEl}
        open={Boolean(projectMenuState.anchorEl)}
        onClose={handleCloseProjectMenu}
        onClick={(e) => e.stopPropagation()}
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              borderRadius: '12px',
              border: '1px solid #e4e4e7',
              minWidth: 160,
              p: 0.5,
              '& .MuiMenuItem-root': {
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                py: 1,
                px: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                '&:hover': { bgcolor: '#f4f4f5' },
              },
            },
          },
        }}
      >
        <MenuItem onClick={handleMenuOpenProject}>
          <ExternalLink className="h-4 w-4 text-zinc-500" />
          <span>Open</span>
        </MenuItem>
        <MenuItem onClick={handleMenuDuplicateProject}>
          <Copy className="h-4 w-4 text-blue-500" />
          <span>Duplicate</span>
        </MenuItem>
        <MenuItem onClick={handleMenuDownloadProject}>
          <Download className="h-4 w-4 text-emerald-500" />
          <span>Download</span>
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={handleMenuDeleteProject} sx={{ color: 'error.main' }}>
            <Trash2 className="h-4 w-4 text-red-500" />
            <span>Delete</span>
          </MenuItem>
        )}
      </Menu>

      {/* CREATE PROJECT MODAL */}
      <ProjectFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
      />

      {/* Month/Year Selection Modal */}
      <ProjectMonthPickerModal
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        selectedYear={customYear}
        selectedMonth={customMonth}
        onSelect={(year, month) => {
          setCustomYear(year);
          setCustomMonth(month);
          setDateFilter('custom');
        }}
      />
    </div>
  );
};
