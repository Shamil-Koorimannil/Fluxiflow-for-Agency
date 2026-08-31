import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Edit, Plus, Folder, FileText, Download, Trash2, Mail, Phone, Globe, MapPin,
  RefreshCw, AlertCircle, Upload, Link2, ExternalLink, Unlink
} from 'lucide-react';
import type { Client, Project, ClientBrandAsset } from '../../types';
import { api } from '../../services/api';
import { ClientFormModal } from './ClientFormModal';
import { BrandAssetUploadModal } from './BrandAssetUploadModal';
import { ProjectFormModal } from '../projects/ProjectFormModal';
import { AddExistingProjectModal } from './AddExistingProjectModal';

interface ClientDetailProps {
  viewMode?: 'full' | 'projects-only' | 'brand-assets-only';
}

export const ClientDetail: React.FC<ClientDetailProps> = ({ viewMode: propViewMode }) => {
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
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssetUploadModalOpen, setIsAssetUploadModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAddExistingModalOpen, setIsAddExistingModalOpen] = useState(false);

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

      // Fetch Brand assets
      const assetsRes = await api.get<ClientBrandAsset[]>(`/clients/${id}/brand_assets/`);
      setBrandAssets(assetsRes.data);
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

  const handleStatusToggle = async () => {
    if (!client) return;
    const newStatus = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.patch<Client>(`/clients/${client.id}/`, { status: newStatus });
      setClient(res.data);
    } catch (err) {
      alert('Failed to update client status.');
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    if (!confirm(`Are you sure you want to delete client "${client.name}"?`)) return;

    try {
      await api.delete(`/clients/${client.id}/`);
      navigate('/app/clients');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to delete client.');
    }
  };

  const handleRemoveProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    if (!confirm(`Remove this project from ${client.name}? The project will not be deleted.`)) return;

    try {
      await api.delete(`/clients/${client.id}/projects/${project.id}/`);
      fetchClientDetails();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to remove project from client.');
    }
  };

  const handleDeleteAsset = async (assetId: string, assetName: string) => {
    if (!confirm(`Are you sure you want to delete brand asset "${assetName}"?`)) return;
    try {
      await api.delete(`/client-brand-assets/${assetId}/`);
      fetchClientDetails();
    } catch (err) {
      alert('Failed to delete brand asset.');
    }
  };

  const handleDownloadAsset = async (asset: ClientBrandAsset) => {
    try {
      const res = await api.get(`/client-brand-assets/${asset.id}/download/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', asset.name || 'asset');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download asset.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
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

  // Render Projects Grid (Reusable component logic)
  const renderProjectsGrid = () => (
    <div>
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
              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl"
            >
              Add Existing Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
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

  // Render Brand Assets Table (Reusable component logic)
  const renderBrandAssetsTable = () => (
    <div>
      {brandAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20 p-6">
          <FileText className="h-8 w-8 text-zinc-400 mb-2" />
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">No brand assets uploaded yet</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Upload logos, brand books, typography specs, or guideline PDFs for team access.</p>
          <button
            onClick={() => setIsAssetUploadModalOpen(true)}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-xl"
          >
            + Upload First Asset
          </button>
        </div>
      ) : (
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
                {brandAssets.map(asset => (
                  <tr key={asset.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
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
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleDownloadAsset(asset)}
                        className="p-1.5 text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Download Asset"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Delete Asset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------
  // FOCUSED MODE 1: Projects Only View (/app/clients/:id/projects)
  // -------------------------------------------------------------
  if (viewMode === 'projects-only') {
    return (
      <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-6 md:p-10">
        {/* Back button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/app/clients')}
            className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Clients
          </button>
        </div>

        {/* Focused Title & Actions */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {client.name} — Projects
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage projects associated with {client.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Project</span>
            </button>
            <button
              onClick={() => setIsAddExistingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Add Existing Project</span>
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
      </div>
    );
  }

  // -----------------------------------------------------------------
  // FOCUSED MODE 2: Brand Assets Only View (/app/clients/:id/brand-assets)
  // -----------------------------------------------------------------
  if (viewMode === 'brand-assets-only') {
    return (
      <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-6 md:p-10">
        {/* Back button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/app/clients')}
            className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Clients
          </button>
        </div>

        {/* Focused Title & Actions */}
        <div className="flex items-center justify-between gap-4 mb-6">
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
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Brand Asset</span>
          </button>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800 mb-6" />

        {renderBrandAssetsTable()}

        {/* Modals */}
        <BrandAssetUploadModal
          isOpen={isAssetUploadModalOpen}
          clientId={client.id}
          onClose={() => setIsAssetUploadModalOpen(false)}
          onAssetUploaded={() => fetchClientDetails()}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL OVERVIEW MODE (/app/clients/:id)
  // -------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-6 md:p-10">
      {/* Back Button & Header Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={() => navigate('/app/clients')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </button>

        <div className="flex items-center gap-2">
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

          <button
            onClick={handleDeleteClient}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
            title="Delete Client"
          >
            <Trash2 className="h-4 w-4" />
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
      <div className="flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setSearchParams({ tab: 'projects' })}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'projects'
              ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Folder className="h-4 w-4" />
          <span>Projects ({projects.length})</span>
        </button>

        <button
          onClick={() => setSearchParams({ tab: 'assets' })}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'assets'
              ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Brand Assets ({brandAssets.length})</span>
        </button>
      </div>

      {/* Tab 1: Projects Section */}
      {activeTab === 'projects' && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Client Projects
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Project</span>
              </button>
              <button
                onClick={() => setIsAddExistingModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Add Existing Project</span>
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
            <button
              onClick={() => setIsAssetUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Brand Asset</span>
            </button>
          </div>

          {renderBrandAssetsTable()}
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
    </div>
  );
};
