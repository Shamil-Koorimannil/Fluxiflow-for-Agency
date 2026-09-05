import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, LayoutGrid, List,
  BookOpen, Users, Clock, Pin, Trash2, Loader2, Download, X, File, Share2
} from 'lucide-react';
import type { KeepItem, KeepItemType } from '../../types';
import { api } from '../../services/api';
import { KeepBreadcrumbs } from './KeepBreadcrumbs';
import { NewKeepItemMenu } from './NewKeepItemMenu';
import { ImportSpreadsheetModal } from './ImportSpreadsheetModal';
import { UploadFileModal } from './UploadFileModal';
import { KeepContextMenu } from './KeepContextMenu';
import { KeepItemCard } from './KeepItemCard';
import { DocumentEditor } from './DocumentEditor';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import { ShareModal } from './ShareModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { CreateFolderModal } from './CreateFolderModal';
import { RenameKeepItemModal } from './RenameKeepItemModal';

export const Keep: React.FC = () => {
  const [section, setSection] = useState<'all' | 'shared' | 'recent' | 'pinned' | 'trash'>('all');
  const [currentFolder, setCurrentFolder] = useState<KeepItem | null>(null);
  const [folderPath, setFolderPath] = useState<KeepItem[]>([]);
  const [items, setItems] = useState<KeepItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KeepItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Currently opened item for editing
  const [activeEditingItem, setActiveEditingItem] = useState<KeepItem | null>(null);

  // File Preview Modal state for binary files / images / PDFs
  const [previewFileItem, setPreviewFileItem] = useState<KeepItem | null>(null);

  // Modals state
  const [isUploadFileModalOpen, setIsUploadFileModalOpen] = useState(false);
  const [isSpreadsheetImportModalOpen, setIsSpreadsheetImportModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [renameModalItem, setRenameModalItem] = useState<KeepItem | null>(null);
  const [shareModalItem, setShareModalItem] = useState<KeepItem | null>(null);
  const [versionHistoryItem, setVersionHistoryItem] = useState<KeepItem | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ item: KeepItem; x: number; y: number } | null>(null);

  // Load Keep items from API
  const fetchKeepItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { section };
      if (currentFolder) {
        params.parent_folder = currentFolder.id;
      } else if (section === 'all') {
        params.parent_folder = 'root';
      }

      const response = await api.get<KeepItem[]>('/keep/items/', { params });
      setItems(response.data);
    } catch (err) {
      console.error('Failed to load Keep items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [section, currentFolder]);

  useEffect(() => {
    fetchKeepItems();
  }, [fetchKeepItems]);

  // Handle Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await api.get<KeepItem[]>(`/keep/search/?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Navigation handlers
  const handleFolderClick = (folder: KeepItem) => {
    setCurrentFolder(folder);
    setFolderPath(prev => [...prev, folder]);
  };

  const handleNavigateBreadcrumb = (targetFolder: KeepItem | null) => {
    if (!targetFolder) {
      setCurrentFolder(null);
      setFolderPath([]);
    } else {
      const idx = folderPath.findIndex(f => f.id === targetFolder.id);
      if (idx !== -1) {
        setCurrentFolder(targetFolder);
        setFolderPath(folderPath.slice(0, idx + 1));
      }
    }
  };

  const handleSectionChange = (newSection: 'all' | 'shared' | 'recent' | 'pinned' | 'trash') => {
    setSection(newSection);
    setCurrentFolder(null);
    setFolderPath([]);
    setSearchQuery('');
  };

  // Item Creation Handler
  const handleCreateItem = async (type: KeepItemType) => {
    if (type === 'FOLDER') {
      setIsCreateFolderModalOpen(true);
      return;
    }
    const defaultName = type === 'SPREADSHEET' ? 'New Spreadsheet' : type === 'NOTE' ? 'New Note' : 'Untitled Document';
    try {
      const payload: Partial<KeepItem> = {
        item_type: type,
        name: defaultName,
        parent_folder: currentFolder ? currentFolder.id : null,
        document_content: type === 'DOCUMENT' || type === 'NOTE' ? '<p>Start typing...</p>' : '',
        spreadsheet_data: type === 'SPREADSHEET' ? { sheets: [{ id: 'sheet_1', name: 'Sheet1', cells: {} }] } : undefined
      };

      const response = await api.post<KeepItem>('/keep/items/', payload);
      setItems(prev => [response.data, ...prev]);
      setActiveEditingItem(response.data);
    } catch (err) {
      console.error('Failed to create Keep item:', err);
    }
  };

  const handleCreateFolderSubmit = async (folderName: string) => {
    const payload: Partial<KeepItem> = {
      item_type: 'FOLDER',
      name: folderName,
      parent_folder: currentFolder ? currentFolder.id : null,
    };
    const response = await api.post<KeepItem>('/keep/items/', payload);
    setItems(prev => [response.data, ...prev]);
  };

  const handleRenameSubmit = async (itemId: string, newName: string) => {
    const response = await api.patch<KeepItem>(`/keep/items/${itemId}/`, { name: newName });
    setItems(prev => prev.map(item => item.id === itemId ? response.data : item));
    if (activeEditingItem && activeEditingItem.id === itemId) {
      setActiveEditingItem(response.data);
    }
  };

  // Item Open Handler
  const handleOpenItem = (item: KeepItem) => {
    if (item.item_type === 'FOLDER') {
      handleFolderClick(item);
      return;
    }

    if (item.item_type === 'FILE') {
      const filename = item.original_filename || item.name;
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const mime = item.file_type || '';
      const textExts = ['txt', 'md', 'rtf', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'sh', 'yml', 'yaml'];

      // If text/code format, open in editor
      if (textExts.includes(ext) || mime.startsWith('text/')) {
        setActiveEditingItem(item);
      } else {
        // PDF, image, binary, office, archive file -> open preview modal
        setPreviewFileItem(item);
      }
      return;
    }

    setActiveEditingItem(item);
  };

  // Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent, item: KeepItem) => {
    e.preventDefault();
    setContextMenu({ item, x: e.clientX, y: e.clientY });
  };

  // Action handlers
  const handleTogglePin = async (item: KeepItem) => {
    try {
      if (item.is_pinned) {
        await api.post(`/keep/items/${item.id}/unpin/`);
      } else {
        await api.post(`/keep/items/${item.id}/pin/`);
      }
      fetchKeepItems();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleDuplicate = async (item: KeepItem) => {
    try {
      const response = await api.post<KeepItem>(`/keep/items/${item.id}/duplicate/`);
      setItems(prev => [response.data, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate item:', err);
    }
  };

  const handleDownloadFile = async (item: KeepItem) => {
    try {
      const res = await api.get(`/keep/items/${item.id}/download/`, {
        responseType: 'blob'
      });
      let filename = item.original_filename || item.name;
      const disposition = res.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      const headerMime = res.headers['content-type'] ? String(res.headers['content-type']) : '';
      const mimeType = item.file_type || headerMime || 'application/octet-stream';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download file.');
    }
  };

  const handleSoftDelete = async (item: KeepItem) => {
    try {
      await api.delete(`/keep/items/${item.id}/`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Failed to soft delete item:', err);
    }
  };

  const handleRestore = async (item: KeepItem) => {
    try {
      await api.post(`/keep/items/${item.id}/restore/`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Failed to restore item:', err);
    }
  };

  const handlePermanentDelete = async (item: KeepItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${item.name}'? This action cannot be undone.`)) return;
    try {
      await api.delete(`/keep/items/${item.id}/permanent_delete/`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Failed to permanently delete item:', err);
    }
  };

  const handleExport = (item: KeepItem, format: 'xlsx' | 'csv') => {
    const exportUrl = `${api.defaults.baseURL}/keep/items/${item.id}/export/?export_format=${format}`;
    window.open(exportUrl, '_blank');
  };

  // If editing an item, render full-screen editor view
  if (activeEditingItem) {
    if (activeEditingItem.item_type === 'SPREADSHEET') {
      return (
        <SpreadsheetEditor
          item={activeEditingItem}
          onBack={() => { setActiveEditingItem(null); fetchKeepItems(); }}
          onShare={(itemToShare) => setShareModalItem(itemToShare)}
          onOpenVersionHistory={(itemToHistory) => setVersionHistoryItem(itemToHistory)}
          onItemUpdated={(updated) => setActiveEditingItem(updated)}
        />
      );
    } else {
      return (
        <DocumentEditor
          item={activeEditingItem}
          onBack={() => { setActiveEditingItem(null); fetchKeepItems(); }}
          onShare={(itemToShare) => setShareModalItem(itemToShare)}
          onOpenVersionHistory={(itemToHistory) => setVersionHistoryItem(itemToHistory)}
          onItemUpdated={(updated) => setActiveEditingItem(updated)}
        />
      );
    }
  }

  const displayList = searchResults || items;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* ── TOP HORIZONTAL NAVIGATION BAR INSIDE KEEP ── */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur sticky top-0 z-20 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Brand Badge & Section Tabs */}
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-none py-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <BookOpen className="h-6 w-6 text-black dark:text-white" />
              <h1 className="font-bold text-xl tracking-tight hidden sm:block">Keep</h1>
            </div>

            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block flex-shrink-0" />

            <div className="flex items-center gap-1 text-xs font-semibold">
              <button
                onClick={() => handleSectionChange('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  section === 'all'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-bold shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>Workspace</span>
              </button>

              <button
                onClick={() => handleSectionChange('shared')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  section === 'shared'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-bold shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Shared</span>
              </button>

              <button
                onClick={() => handleSectionChange('recent')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  section === 'recent'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-bold shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Recent</span>
              </button>

              <button
                onClick={() => handleSectionChange('pinned')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  section === 'pinned'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-bold shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Pin className="h-3.5 w-3.5" />
                <span>Pinned</span>
              </button>

              <button
                onClick={() => handleSectionChange('trash')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  section === 'trash'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-bold shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Trash</span>
              </button>
            </div>
          </div>

          {/* Right: Search, View Mode Toggle & New Button */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search Keep..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 text-xs rounded-xl outline-none w-44 sm:w-60 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
            </div>

            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <NewKeepItemMenu
              onCreateItem={handleCreateItem}
              onOpenUploadModal={() => setIsUploadFileModalOpen(true)}
              disabled={section === 'trash'}
            />
          </div>
        </div>
      </div>

      {/* Sub-header Breadcrumbs */}
      <div className="px-6 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between">
        <KeepBreadcrumbs
          currentFolder={currentFolder}
          folderPath={folderPath}
          onNavigateFolder={handleNavigateBreadcrumb}
          section={section}
        />
      </div>

      {/* Items Workspace Grid/List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-black dark:text-white" />
            <span className="text-sm font-medium">Loading Keep workspace...</span>
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                {section === 'trash' ? 'Trash is empty' : 'No items in this location'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                {section === 'trash'
                  ? 'Deleted documents, notes, spreadsheets, and files will appear here.'
                  : 'Create a new document, note, spreadsheet, folder, or upload a file to get started.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
              : 'space-y-2'
          }>
            {displayList.map(item => (
              <KeepItemCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                onOpen={handleOpenItem}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Context Menu */}
      {contextMenu && (
        <KeepContextMenu
          item={contextMenu.item}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={handleOpenItem}
          onRename={(itemToRename) => setRenameModalItem(itemToRename)}
          onTogglePin={handleTogglePin}
          onShare={(itemToShare) => setShareModalItem(itemToShare)}
          onMove={(itemToMove) => {
            const targetParent = prompt('Enter destination Folder ID (leave empty for root):');
            if (targetParent !== null) {
              api.post(`/keep/items/${itemToMove.id}/move/`, { parent_folder: targetParent || null })
                .then(fetchKeepItems);
            }
          }}
          onDuplicate={handleDuplicate}
          onDownload={handleDownloadFile}
          onExport={handleExport}
          onSoftDelete={handleSoftDelete}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
          isTrashSection={section === 'trash'}
        />
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onCreateFolder={handleCreateFolderSubmit}
      />

      {/* Rename Item Modal */}
      <RenameKeepItemModal
        isOpen={Boolean(renameModalItem)}
        item={renameModalItem}
        onClose={() => setRenameModalItem(null)}
        onSave={handleRenameSubmit}
      />

      {/* Upload General File Modal */}
      <UploadFileModal
        isOpen={isUploadFileModalOpen}
        onClose={() => setIsUploadFileModalOpen(false)}
        parentFolderId={currentFolder ? currentFolder.id : null}
        onSuccess={() => {
          fetchKeepItems();
        }}
      />

      {/* Import Spreadsheet Modal */}
      <ImportSpreadsheetModal
        isOpen={isSpreadsheetImportModalOpen}
        onClose={() => setIsSpreadsheetImportModalOpen(false)}
        parentFolderId={currentFolder ? currentFolder.id : null}
        onSuccess={(importedItem) => {
          fetchKeepItems();
          setActiveEditingItem(importedItem);
        }}
      />

      {/* File Preview Modal */}
      {previewFileItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 truncate">
                <File className="h-5 w-5 text-purple-500 flex-shrink-0" />
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {previewFileItem.original_filename || previewFileItem.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewFileItem)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareModalItem(previewFileItem)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFileItem(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 p-6 overflow-auto flex items-center justify-center min-h-[300px] bg-zinc-50 dark:bg-zinc-950">
              {previewFileItem.file_url && (previewFileItem.file_type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes((previewFileItem.original_filename || previewFileItem.name).split('.').pop()?.toLowerCase() || '')) ? (
                <img
                  src={previewFileItem.file_url}
                  alt={previewFileItem.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md"
                />
              ) : previewFileItem.file_url && (previewFileItem.file_type === 'application/pdf' || (previewFileItem.original_filename || previewFileItem.name).toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={previewFileItem.file_url}
                  title={previewFileItem.name}
                  className="w-full h-[65vh] rounded-xl border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <div className="text-center space-y-3 p-8">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400">
                    <File className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {previewFileItem.original_filename || previewFileItem.name}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      {previewFileItem.file_type || 'Binary File'} • {previewFileItem.file_size ? `${(previewFileItem.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadFile(previewFileItem)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Original File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={Boolean(shareModalItem)}
        item={shareModalItem}
        onClose={() => setShareModalItem(null)}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={Boolean(versionHistoryItem)}
        item={versionHistoryItem}
        onClose={() => setVersionHistoryItem(null)}
        onVersionRestored={() => {
          fetchKeepItems();
        }}
      />
    </div>
  );
};
