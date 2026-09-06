import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Edit, Plus, Folder, FileText, Download, Trash2, Mail, Phone, Globe, MapPin,
  RefreshCw, AlertCircle, Upload, Link2, ExternalLink, Unlink, ArrowUpDown, Calendar,
  Filter, MoreVertical, ChevronRight, FolderPlus, Edit2, MoveRight, Eye
} from 'lucide-react';
import { Menu, MenuItem } from '@mui/material';
import { useConfirm } from '../../context/ConfirmDialogContext';
import type { Client, Project, ClientBrandAsset, ClientBrandAssetFolder } from '../../types';
import { api } from '../../services/api';
import { formatDateOnly } from '../../utils/time';
import { ClientFormModal } from './ClientFormModal';
import { BrandAssetUploadModal } from './BrandAssetUploadModal';
import { ProjectFormModal } from '../projects/ProjectFormModal';
import { AddExistingProjectModal } from './AddExistingProjectModal';
import { ProjectMonthPickerModal } from '../projects/ProjectMonthPickerModal';
import { CreateFolderModal } from './CreateFolderModal';
import { RenameModal } from './RenameModal';
import { MoveAssetModal } from './MoveAssetModal';
import { CustomDropdown } from '../../components/common/CustomDropdown';

interface ClientDetailProps {
  viewMode?: 'full' | 'projects-only' | 'brand-assets-only';
}

export const ClientDetail: React.FC<ClientDetailProps> = ({ viewMode: propViewMode }) => {
  const { confirm, showAlert } = useConfirm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine effective view mode
  let viewMode = propViewMode;
  if (!viewMode) {
    if (location.pathname.endsWith('/projects')) {
      viewMode = 'projects-only';
    } else if (location.pathname.endsWith('/brand-assets')) {
      viewMode = 'brand-assets-only';
    } else {
      viewMode = 'full';
    }
  }

  const activeTab = searchParams.get('tab') === 'assets' ? 'assets' : 'projects';

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [brandAssets, setBrandAssets] = useState<ClientBrandAsset[]>([]);
  const [folders, setFolders] = useState<ClientBrandAssetFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client Projects Filtering & Sorting State
  const [projectStatusTab, setProjectStatusTab] = useState<'ongoing' | 'completed'>('ongoing');
  const [projectSortBy, setProjectSortBy] = useState<'newest' | 'oldest' | 'project_date_desc' | 'project_date_asc'>('newest');
  const [projectDateFilter, setProjectDateFilter] = useState<'all' | 'custom'>('all');
  const [projectCustomYear, setProjectCustomYear] = useState<number>(new Date().getFullYear());
  const [projectCustomMonth, setProjectCustomMonth] = useState<number | null>(new Date().getMonth());
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssetUploadModalOpen, setIsAssetUploadModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAddExistingModalOpen, setIsAddExistingModalOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);

  const [renameTarget, setRenameTarget] = useState<
    { type: 'folder'; item: ClientBrandAssetFolder } | { type: 'asset'; item: ClientBrandAsset } | null
  >(null);
  const [moveAssetTarget, setMoveAssetTarget] = useState<ClientBrandAsset | null>(null);

  // Context Menus
  const [folderMenuState, setFolderMenuState] = useState<{ anchorEl: HTMLElement | null; folder: ClientBrandAssetFolder | null }>({ anchorEl: null, folder: null });
  const [assetMenuState, setAssetMenuState] = useState<{ anchorEl: HTMLElement | null; asset: ClientBrandAsset | null }>({ anchorEl: null, asset: null });

  const fetchClientDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      // Fetch Client info
      const clientRes = await api.get<Client>(`/clients/${id}/`);
      setClient(clientRes.data);

      // Fetch Client projects
      const projectsRes = await api.get<Project[]>(`/clients/${id}/projects/`);
      setProjects(projectsRes.data);

      // Fetch Brand assets & folders
      const assetsRes = await api.get<ClientBrandAsset[]>(`/clients/${id}/brand_assets/?folder=all`);
      setBrandAssets(assetsRes.data);

      const foldersRes = await api.get<ClientBrandAssetFolder[]>(`/clients/${id}/brand_asset_folders/?parent=all`);
      setFolders(foldersRes.data);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setErrorMessage('Access denied. Client details are restricted to Admin users.');
      } else if (err?.response?.status === 404) {
        setErrorMessage('Client not found or belongs to another organization.');
      } else {
        setErrorMessage('Failed to load client details.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClientDetails();
  }, [fetchClientDetails]);

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

  // Filter projects by completion status
  // Ongoing: progress === null || progress < 100
  // Completed: progress !== null && progress >= 100
  const ongoingProjects = projects.filter((p) => p.progress === null || p.progress < 100);
  const completedProjects = projects.filter((p) => p.progress !== null && p.progress >= 100);

  const displayedByStatus = projectStatusTab === 'ongoing' ? ongoingProjects : completedProjects;

  // Filter projects by date
  const dateFilteredProjects = displayedByStatus.filter((project) => {
    if (projectDateFilter === 'all') return true;
    const parsed = parseProjectDate(project.project_date);
    if (!parsed) return false;

    if (projectCustomYear !== null && projectCustomMonth !== null) {
      return parsed.year === projectCustomYear && parsed.month === projectCustomMonth;
    }
    if (projectCustomYear !== null && projectCustomMonth === null) {
      return parsed.year === projectCustomYear;
    }
    return true;
  });

  // Sort projects
  const sortedProjects = [...dateFilteredProjects].sort((a, b) => {
    switch (projectSortBy) {
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
        return new Date(a.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  const getDateFilterLabel = () => {
    if (projectDateFilter === 'all') return 'All Dates';
    if (projectCustomMonth !== null) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[projectCustomMonth]} ${projectCustomYear}`;
    }
    return `${projectCustomYear}`;
  };

  // Folder Breadcrumbs path calculation
  const getBreadcrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Brand Assets' }];
    if (!currentFolderId) return crumbs;

    const path: ClientBrandAssetFolder[] = [];
    let currId: string | null = currentFolderId;
    while (currId) {
      const folder = folders.find((f) => f.id === currId);
      if (folder) {
        path.unshift(folder);
        currId = folder.parent || null;
      } else {
        break;
      }
    }

    path.forEach((f) => crumbs.push({ id: f.id, name: f.name }));
    return crumbs;
  };

  // Current folder level items
  const visibleFolders = folders.filter((f) => currentFolderId ? f.parent === currentFolderId : !f.parent);
  const visibleAssets = brandAssets.filter((a) => currentFolderId ? a.folder === currentFolderId : !a.folder);

  const handleStatusToggle = async () => {
    if (!client) return;
    const newStatus = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.patch<Client>(`/clients/${client.id}/`, { status: newStatus });
      setClient(res.data);
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to update client status.', variant: 'warning' });
    }
  };


  const handleRemoveProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    const ok = await confirm({
      title: 'Remove Project?',
      message: `Remove this project from ${client.name}? The project will not be deleted.`,
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/clients/${client.id}/projects/${project.id}/`);
      fetchClientDetails();
    } catch (err: any) {
      showAlert({ title: 'Error', message: err?.response?.data?.detail || 'Failed to remove project from client.', variant: 'warning' });
    }
  };

  const handleDeleteFolder = async (folder: ClientBrandAssetFolder) => {
    setFolderMenuState({ anchorEl: null, folder: null });
    // Check if folder contains files or subfolders
    const hasAssets = brandAssets.some((a) => a.folder === folder.id);
    const hasSubfolders = folders.some((f) => f.parent === folder.id);

    if (hasAssets || hasSubfolders) {
      showAlert({
        title: 'Cannot Delete Folder',
        message: `Cannot delete folder "${folder.name}": Folder is not empty. Please move or remove all files and subfolders first.`,
        variant: 'warning',
      });
      return;
    }

    const ok = await confirm({
      title: 'Delete Folder?',
      message: `Are you sure you want to delete folder "${folder.name}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/client-brand-asset-folders/${folder.id}/`);
      if (currentFolderId === folder.id) {
        setCurrentFolderId(folder.parent || null);
      }
      fetchClientDetails();
    } catch (err: any) {
      showAlert({ title: 'Error', message: err?.response?.data?.detail || 'Failed to delete folder.', variant: 'warning' });
    }
  };

  const handleDeleteAsset = async (assetId: string, assetName: string) => {
    setAssetMenuState({ anchorEl: null, asset: null });
    const ok = await confirm({
      title: 'Delete Brand Asset?',
      message: `Are you sure you want to delete brand asset "${assetName}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/client-brand-assets/${assetId}/`);
      fetchClientDetails();
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to delete brand asset.', variant: 'warning' });
    }
  };

  const handleDownloadAsset = async (asset: ClientBrandAsset) => {
    setAssetMenuState({ anchorEl: null, asset: null });
    try {
      const res = await api.get(`/client-brand-assets/${asset.id}/download/`, {
        responseType: 'blob'
      });
      let filename = '';
      const disposition = res.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      if (!filename) {
        filename = asset.name || 'asset';
      }

      const headerMime = res.headers['content-type'] ? String(res.headers['content-type']) : '';
      const mimeType = asset.file_type || headerMime || 'application/octet-stream';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showAlert({ title: 'Download Failed', message: 'Failed to download asset.', variant: 'warning' });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-zinc-400 gap-2 text-xs">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span>Loading client details...</span>
      </div>
    );
  }

  if (errorMessage || !client) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/app/clients')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </button>
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-medium">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{errorMessage || 'Client not found'}</span>
        </div>
      </div>
    );
  }

  // Render Client Projects Section
  const renderProjectsGrid = () => (
    <div className="space-y-4">
      {/* Status Tabs, Date Filter & Sorting Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-900">
        {/* Status Tabs (Ongoing vs Completed) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
          <button
            onClick={() => setProjectStatusTab('ongoing')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all border whitespace-nowrap shrink-0 w-auto ${
              projectStatusTab === 'ongoing'
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                : 'bg-transparent text-zinc-550 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white'
            }`}
          >
            Ongoing ({ongoingProjects.length})
          </button>
          <button
            onClick={() => setProjectStatusTab('completed')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all border whitespace-nowrap shrink-0 w-auto ${
              projectStatusTab === 'completed'
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                : 'bg-transparent text-zinc-550 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white'
            }`}
          >
            Completed ({completedProjects.length})
          </button>
        </div>

        {/* Date Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter Trigger */}
          <CustomDropdown
            value={projectDateFilter}
            buttonText={`Date: ${getDateFilterLabel()}`}
            icon={<Filter size={14} />}
            onChange={(val) => {
              if (val === 'custom') {
                setIsMonthPickerOpen(true);
              } else {
                setProjectDateFilter(val as any);
              }
            }}
            options={[
              { value: 'all', label: 'All Dates' },
              { value: 'custom', label: 'Select Month / Year...', icon: <Calendar size={14} /> },
            ]}
          />

          <CustomDropdown
            value={projectSortBy}
            onChange={(val) => setProjectSortBy(val as any)}
            icon={<ArrowUpDown size={15} />}
            valuePrefix="Sort: "
            options={[
              { value: 'newest', label: 'Newest Created' },
              { value: 'oldest', label: 'Oldest Created' },
              { value: 'project_date_desc', label: 'Project Date — Newest First' },
              { value: 'project_date_asc', label: 'Project Date — Oldest First' },
            ]}
          />
        </div>
      </div>

      {/* Projects Grid / Context Empty States */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6">
          <Folder className="h-8 w-8 text-zinc-400 mb-2" />
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">No projects associated with this client</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Create a new project or add an existing project from your organization.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-semibold rounded-xl"
            >
              + Add New Project
            </button>
            <button
              onClick={() => setIsAddExistingModalOpen(true)}
              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl whitespace-nowrap"
            >
              Link Project
            </button>
          </div>
        </div>
      ) : displayedByStatus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6 text-zinc-500">
          <Folder className="h-6 w-6 text-zinc-400 mb-2" />
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {projectStatusTab === 'ongoing' ? 'No ongoing projects.' : 'No completed projects.'}
          </p>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6 text-zinc-500">
          <Folder className="h-6 w-6 text-zinc-400 mb-2" />
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No projects match the selected filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedProjects.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/app/projects/${p.id}`)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:shadow-lg hover:border-blue-500/40 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-500 transition-colors">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {p.project_date && (
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                        {formatDateOnly(p.project_date)}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/projects/${p.id}`);
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      title="Open Project"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleRemoveProject(p, e)}
                      className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Remove from Client"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {p.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">
                    {p.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 font-medium">
                <span>{p.task_count || 0} Tasks</span>
                <span>{p.progress !== null ? `${p.progress}% Progress` : 'No tasks yet'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Brand Assets Section (Folder management & Asset list)
  const renderBrandAssetsSection = () => {
    const breadcrumbs = getBreadcrumbs();

    return (
      <div className="space-y-4">
        {/* Breadcrumb Bar & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          {/* Breadcrumb Path */}
          <nav className="flex items-center gap-1 text-xs font-semibold overflow-x-auto">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id || 'root'}>
                  {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                      isLast
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {idx === 0 && <Folder className="h-3.5 w-3.5 text-purple-500" />}
                    <span>{crumb.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsCreateFolderModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5 text-purple-500" />
              <span>New Folder</span>
            </button>
            <button
              onClick={() => setIsAssetUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Asset</span>
            </button>
          </div>
        </div>

        {/* Content: Folders & Files Grid/Table */}
        {visibleFolders.length === 0 && visibleAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6">
            <FileText className="h-8 w-8 text-zinc-400 mb-2" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              {currentFolderId ? 'This folder is empty' : 'No brand assets uploaded yet'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Create subfolders or upload logos, brand books, typography specs, and PDF guidelines.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreateFolderModalOpen(true)}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl"
              >
                + New Folder
              </button>
              <button
                onClick={() => setIsAssetUploadModalOpen(true)}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-xl"
              >
                + Upload Asset
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Folders Grid */}
            {visibleFolders.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  Folders ({visibleFolders.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {visibleFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 rounded-2xl p-3.5 transition-all cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Folder className="h-5 w-5 text-purple-500 shrink-0 group-hover:scale-105 transition-transform" />
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {folder.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderMenuState({ anchorEl: e.currentTarget, folder });
                        }}
                        className="p-1 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assets Table */}
            {visibleAssets.length > 0 && (
              <div>
                {visibleFolders.length > 0 && (
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 mt-4">
                    Assets ({visibleAssets.length})
                  </h3>
                )}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-3 px-4">Asset Name</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">File Size</th>
                          <th className="py-3 px-4">Uploaded By</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
                        {visibleAssets.map((asset) => (
                          <tr key={asset.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                            <td className="py-3 px-4 font-semibold">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-black dark:text-white flex-shrink-0" />
                                <span className="truncate max-w-xs">{asset.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-semibold border border-purple-200 dark:border-purple-800">
                                {asset.asset_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-500">
                              {formatFileSize(asset.file_size)}
                            </td>
                            <td className="py-3 px-4 text-zinc-500">
                              {asset.uploaded_by_name || 'Admin'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssetMenuState({ anchorEl: e.currentTarget, asset });
                                }}
                                className="p-1 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Folder Context Menu */}
        <Menu
          anchorEl={folderMenuState.anchorEl}
          open={Boolean(folderMenuState.anchorEl)}
          onClose={() => setFolderMenuState({ anchorEl: null, folder: null })}
          onClick={(e) => e.stopPropagation()}
          slotProps={{
            paper: {
              elevation: 3,
              sx: {
                borderRadius: '12px',
                border: '1px solid #e4e4e7',
                minWidth: 150,
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
          <MenuItem
            onClick={() => {
              if (folderMenuState.folder) {
                setCurrentFolderId(folderMenuState.folder.id);
                setFolderMenuState({ anchorEl: null, folder: null });
              }
            }}
          >
            <Folder className="h-4 w-4 text-purple-500" />
            <span>Open</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (folderMenuState.folder) {
                const folderToRename = folderMenuState.folder;
                setFolderMenuState({ anchorEl: null, folder: null });
                setRenameTarget({ type: 'folder', item: folderToRename });
              }
            }}
          >
            <Edit2 className="h-4 w-4 text-blue-500" />
            <span>Rename</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (folderMenuState.folder) {
                handleDeleteFolder(folderMenuState.folder);
              }
            }}
            sx={{ color: 'error.main' }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
            <span>Delete</span>
          </MenuItem>
        </Menu>

        {/* Asset Context Menu */}
        <Menu
          anchorEl={assetMenuState.anchorEl}
          open={Boolean(assetMenuState.anchorEl)}
          onClose={() => setAssetMenuState({ anchorEl: null, asset: null })}
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
          <MenuItem
            onClick={() => {
              if (assetMenuState.asset) {
                const url = assetMenuState.asset.file_url || assetMenuState.asset.file;
                setAssetMenuState({ anchorEl: null, asset: null });
                window.open(url, '_blank');
              }
            }}
          >
            <Eye className="h-4 w-4 text-zinc-500" />
            <span>Open / View</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (assetMenuState.asset) {
                handleDownloadAsset(assetMenuState.asset);
              }
            }}
          >
            <Download className="h-4 w-4 text-emerald-500" />
            <span>Download</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (assetMenuState.asset) {
                const assetToRename = assetMenuState.asset;
                setAssetMenuState({ anchorEl: null, asset: null });
                setRenameTarget({ type: 'asset', item: assetToRename });
              }
            }}
          >
            <Edit2 className="h-4 w-4 text-blue-500" />
            <span>Rename</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (assetMenuState.asset) {
                const assetToMove = assetMenuState.asset;
                setAssetMenuState({ anchorEl: null, asset: null });
                setMoveAssetTarget(assetToMove);
              }
            }}
          >
            <MoveRight className="h-4 w-4 text-purple-500" />
            <span>Move</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (assetMenuState.asset) {
                handleDeleteAsset(assetMenuState.asset.id, assetMenuState.asset.name);
              }
            }}
            sx={{ color: 'error.main' }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
            <span>Delete</span>
          </MenuItem>
        </Menu>
      </div>
    );
  };

  // FOCUSED MODE 1: Projects Only View (/app/clients/:id/projects)
  if (viewMode === 'projects-only') {
    return (
      <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="mb-6">
          <button
            onClick={() => navigate('/app/clients')}
            className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Clients
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {client.name} — Projects
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage projects associated with {client.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex-1 sm:flex-none"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Project</span>
            </button>
            <button
              onClick={() => setIsAddExistingModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold rounded-xl transition-colors shadow-sm flex-1 sm:flex-none whitespace-nowrap"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Link Project</span>
            </button>
          </div>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800 mb-6" />

        {renderProjectsGrid()}

        {/* Modals */}
        <ProjectFormModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          preselectedClientId={client.id}
          onProjectCreated={() => fetchClientDetails()}
        />

        <AddExistingProjectModal
          isOpen={isAddExistingModalOpen}
          onClose={() => setIsAddExistingModalOpen(false)}
          clientId={client.id}
          clientName={client.name}
          onProjectsAdded={() => fetchClientDetails()}
        />

        <ProjectMonthPickerModal
          isOpen={isMonthPickerOpen}
          onClose={() => setIsMonthPickerOpen(false)}
          selectedYear={projectCustomYear}
          selectedMonth={projectCustomMonth}
          onSelect={(year, month) => {
            setProjectCustomYear(year);
            setProjectCustomMonth(month);
            setProjectDateFilter('custom');
          }}
        />
      </div>
    );
  }

  // FOCUSED MODE 2: Brand Assets Only View (/app/clients/:id/brand-assets)
  if (viewMode === 'brand-assets-only') {
    return (
      <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="mb-6">
          <button
            onClick={() => navigate('/app/clients')}
            className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Clients
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {client.name} — Brand Assets
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage brand guidelines, logos, and materials for {client.name}
            </p>
          </div>

          <button
            onClick={() => setIsAssetUploadModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm w-full sm:w-auto"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Brand Asset</span>
          </button>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800 mb-6" />

        {renderBrandAssetsSection()}

        {/* Modals */}
        <BrandAssetUploadModal
          isOpen={isAssetUploadModalOpen}
          clientId={client.id}
          folderId={currentFolderId}
          onClose={() => setIsAssetUploadModalOpen(false)}
          onAssetUploaded={() => fetchClientDetails()}
        />

        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          clientId={client.id}
          parentId={currentFolderId}
          onClose={() => setIsCreateFolderModalOpen(false)}
          onFolderCreated={() => fetchClientDetails()}
        />

        <RenameModal
          isOpen={Boolean(renameTarget)}
          target={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSaved={() => fetchClientDetails()}
        />

        <MoveAssetModal
          isOpen={Boolean(moveAssetTarget)}
          asset={moveAssetTarget}
          folders={folders}
          onClose={() => setMoveAssetTarget(null)}
          onMoved={() => fetchClientDetails()}
        />
      </div>
    );
  }

  // FULL OVERVIEW MODE (/app/clients/:id)
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-4 sm:p-6 md:p-10">
      {/* Back Button & Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          onClick={() => navigate('/app/clients')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Edit Client</span>
          </button>

          <button
            onClick={handleStatusToggle}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
              client.status === 'ACTIVE'
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            }`}
          >
            {client.status === 'ACTIVE' ? 'Archive Client' : 'Activate Client'}
          </button>
        </div>
      </div>

      {/* Main Client Profile Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {client.name}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${
                  client.status === 'ACTIVE'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {client.status}
              </span>
            </div>
            {client.company_name && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-3">
                {client.company_name}
              </p>
            )}
            {client.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-2xl">
                {client.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-center p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl min-w-[200px]">
            <div>
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">{projects.length}</span>
              <span className="text-[11px] text-zinc-400 font-medium">Projects</span>
            </div>
            <div>
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">{brandAssets.length}</span>
              <span className="text-[11px] text-zinc-400 font-medium">Brand Assets</span>
            </div>
          </div>
        </div>

        {/* Contact & Address Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
          {client.email && (
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate">
                {client.website}
              </a>
            </div>
          )}
          {(client.address || client.city || client.country) && (
            <div className="flex items-center gap-2.5 md:col-span-3">
              <MapPin className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              <span>
                {[client.address, client.city, client.state, client.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="w-full min-w-0 flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto no-scrollbar max-w-full p-1">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'projects' })}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 flex-none min-h-[38px] cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Folder className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Projects ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'assets' })}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 flex-none min-h-[38px] cursor-pointer ${
            activeTab === 'assets'
              ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Brand Assets ({brandAssets.length})</span>
        </button>
      </div>

      {/* Tab 1: Projects Section */}
      {activeTab === 'projects' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Client Projects
            </h2>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex-1 sm:flex-none whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Project</span>
              </button>
              <button
                onClick={() => setIsAddExistingModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold rounded-xl transition-colors shadow-sm flex-1 sm:flex-none whitespace-nowrap"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Link Project</span>
              </button>
            </div>
          </div>

          {renderProjectsGrid()}
        </div>
      )}

      {/* Tab 2: Brand Assets Section */}
      {activeTab === 'assets' && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Brand Guidelines & Materials
            </h2>
          </div>

          {renderBrandAssetsSection()}
        </div>
      )}

      {/* Edit Client Form Modal */}
      <ClientFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onClientSaved={(updated) => {
          setClient(updated);
          fetchClientDetails();
        }}
        initialData={client}
      />

      {/* Brand Asset Upload Modal */}
      <BrandAssetUploadModal
        isOpen={isAssetUploadModalOpen}
        clientId={client.id}
        folderId={currentFolderId}
        onClose={() => setIsAssetUploadModalOpen(false)}
        onAssetUploaded={() => fetchClientDetails()}
      />

      {/* Add New Project Modal */}
      <ProjectFormModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        preselectedClientId={client.id}
        onProjectCreated={() => fetchClientDetails()}
      />

      {/* Add Existing Project Modal */}
      <AddExistingProjectModal
        isOpen={isAddExistingModalOpen}
        onClose={() => setIsAddExistingModalOpen(false)}
        clientId={client.id}
        clientName={client.name}
        onProjectsAdded={() => fetchClientDetails()}
      />

      {/* Month/Year Selection Modal */}
      <ProjectMonthPickerModal
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        selectedYear={projectCustomYear}
        selectedMonth={projectCustomMonth}
        onSelect={(year, month) => {
          setProjectCustomYear(year);
          setProjectCustomMonth(month);
          setProjectDateFilter('custom');
        }}
      />

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        clientId={client.id}
        parentId={currentFolderId}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onFolderCreated={() => fetchClientDetails()}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={Boolean(renameTarget)}
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSaved={() => fetchClientDetails()}
      />

      {/* Move Asset Modal */}
      <MoveAssetModal
        isOpen={Boolean(moveAssetTarget)}
        asset={moveAssetTarget}
        folders={folders}
        onClose={() => setMoveAssetTarget(null)}
        onMoved={() => fetchClientDetails()}
      />
    </div>
  );
};
