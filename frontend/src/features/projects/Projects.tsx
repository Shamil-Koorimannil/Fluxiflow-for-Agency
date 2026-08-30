import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { Project } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { Folder, Plus, X, ArrowUpDown, Check, Calendar, Filter } from 'lucide-react';
import { Button, Menu, MenuItem } from '@mui/material';
import { formatDateOnly } from '../../utils/time';
import { ProjectMonthPickerModal } from './ProjectMonthPickerModal';

export const Projects: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectDate, setProjectDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Search, sort, and date filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);

  // Project Date Filtering State
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'this_year' | 'custom'>('all');
  const [customYear, setCustomYear] = useState<number>(new Date().getFullYear());
  const [customMonth, setCustomMonth] = useState<number | null>(new Date().getMonth());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [dateFilterAnchorEl, setDateFilterAnchorEl] = useState<null | HTMLElement>(null);

  const isAdmin = user?.role === 'ADMIN';

  // Fetch projects list
  const { data: projects, isLoading, error: fetchError } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects/');
      return response.data;
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      project_date?: string | null;
    }) => {
      const response = await api.post('/projects/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setProjectDate('');
      setError(null);
    },
    onError: (err: any) => {
      if (err.response?.data?.name) {
        setError(err.response.data.name[0]);
      } else {
        setError('Failed to create project. Please try again.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    createProjectMutation.mutate({
      name,
      description,
      project_date: projectDate || null,
    });
  };

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

  const getSortLabel = () => {
    switch (sortBy) {
      case 'project_date_desc': return 'Project Date — Newest First';
      case 'project_date_asc': return 'Project Date — Oldest First';
      case 'newest': return 'Newest created';
      case 'oldest': return 'Oldest created';
      case 'name_asc': return 'Name A-Z';
      case 'name_desc': return 'Name Z-A';
      case 'progress_desc': return 'Progress: High to Low';
      case 'progress_asc': return 'Progress: Low to High';
      case 'recently_updated': return 'Recently updated';
      default: return 'Newest created';
    }
  };

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
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border ${
              activeTab === 'active'
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                : 'bg-transparent text-zinc-550 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white'
            }`}
          >
            Active Projects ({activeProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border ${
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

          {/* Date Filter Trigger */}
          <Button
            onClick={(e) => setDateFilterAnchorEl(e.currentTarget)}
            variant="outlined"
            startIcon={<Filter size={14} />}
            endIcon={<span>▾</span>}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              borderColor: 'divider',
              color: 'text.primary',
              height: '36px',
              fontSize: '12px',
              px: 1.5,
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }
            }}
          >
            Date: {getDateFilterLabel()}
          </Button>

          {/* Date Filter Menu */}
          <Menu
            anchorEl={dateFilterAnchorEl}
            open={Boolean(dateFilterAnchorEl)}
            onClose={() => setDateFilterAnchorEl(null)}
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
                setDateFilter('all');
                setDateFilterAnchorEl(null);
              }}
            >
              <span>All Dates</span>
              {dateFilter === 'all' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setDateFilter('this_month');
                setDateFilterAnchorEl(null);
              }}
            >
              <span>This Month</span>
              {dateFilter === 'this_month' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setDateFilter('this_year');
                setDateFilterAnchorEl(null);
              }}
            >
              <span>This Year</span>
              {dateFilter === 'this_year' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setDateFilterAnchorEl(null);
                setIsMonthPickerOpen(true);
              }}
            >
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-zinc-500" /> Select Month / Year...
              </span>
              {dateFilter === 'custom' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
          </Menu>
          
          {/* Polished Sort Trigger */}
          <Button
            onClick={(e) => setSortAnchorEl(e.currentTarget)}
            variant="outlined"
            startIcon={<ArrowUpDown size={15} />}
            endIcon={<span>▾</span>}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              borderColor: 'divider',
              color: 'text.primary',
              height: '36px',
              fontSize: '12px',
              px: 1.5,
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }
            }}
          >
            Sort: {getSortLabel()}
          </Button>

          {/* Dropdown Menu for options */}
          <Menu
            anchorEl={sortAnchorEl}
            open={Boolean(sortAnchorEl)}
            onClose={() => setSortAnchorEl(null)}
            slotProps={{
              paper: {
                elevation: 1,
                sx: {
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  minWidth: 190,
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
                setSortBy('project_date_desc');
                setSortAnchorEl(null);
              }}
            >
              <span>Project Date — Newest First</span>
              {sortBy === 'project_date_desc' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('project_date_asc');
                setSortAnchorEl(null);
              }}
            >
              <span>Project Date — Oldest First</span>
              {sortBy === 'project_date_asc' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('newest');
                setSortAnchorEl(null);
              }}
            >
              <span>Newest created</span>
              {sortBy === 'newest' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('oldest');
                setSortAnchorEl(null);
              }}
            >
              <span>Oldest first</span>
              {sortBy === 'oldest' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('name_asc');
                setSortAnchorEl(null);
              }}
            >
              <span>Name A-Z</span>
              {sortBy === 'name_asc' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('name_desc');
                setSortAnchorEl(null);
              }}
            >
              <span>Name Z-A</span>
              {sortBy === 'name_desc' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('progress_desc');
                setSortAnchorEl(null);
              }}
            >
              <span>Progress: High to Low</span>
              {sortBy === 'progress_desc' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('progress_asc');
                setSortAnchorEl(null);
              }}
            >
              <span>Progress: Low to High</span>
              {sortBy === 'progress_asc' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSortBy('recently_updated');
                setSortAnchorEl(null);
              }}
            >
              <span>Recently updated</span>
              {sortBy === 'recently_updated' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
          </Menu>
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
              className="group border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white bg-white dark:bg-black rounded-xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-200 text-black dark:text-white"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder className="h-4 w-4 text-zinc-400 group-hover:text-black dark:group-hover:text-white shrink-0" />
                    <h3 className="font-semibold text-sm text-black dark:text-white truncate">{project.name}</h3>
                  </div>
                  {project.project_date && (
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                      {formatDateOnly(project.project_date)}
                    </span>
                  )}
                </div>
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

      {/* CREATE PROJECT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-none z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-6 shadow-lg relative animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-bold text-base text-black dark:text-white mb-1">Create Project</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Add a new primary company scope to organize assignments.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 text-xs font-medium text-red-650 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website Development"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={createProjectMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  placeholder="Provide details about the scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={createProjectMutation.isPending}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Project Date
                </label>
                <input
                  type="date"
                  value={projectDate}
                  onChange={(e) => setProjectDate(e.target.value)}
                  disabled={createProjectMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={createProjectMutation.isPending}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors text-black dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="px-3 py-1.5 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-semibold rounded-lg text-xs tracking-wide transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white dark:border-black border-t-transparent"></div>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
