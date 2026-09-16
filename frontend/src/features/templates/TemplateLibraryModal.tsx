import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Search, Sparkles, FolderSearch, Loader2 } from 'lucide-react';
import type { Industry, ProjectTemplate, Project } from '../../types';
import { api } from '../../services/api';
import { TemplateCard } from './TemplateCard';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { TemplateCustomizeModal } from './TemplateCustomizeModal';

interface TemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
  preselectedClientId?: string;
}

export const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  preselectedClientId
}) => {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal states for Preview & Customize
  const [previewTemplate, setPreviewTemplate] = useState<ProjectTemplate | null>(null);
  const [customizeTemplate, setCustomizeTemplate] = useState<ProjectTemplate | null>(null);

  // Fetch industries on mount/open
  useEffect(() => {
    if (isOpen) {
      api.get<Industry[]>('/templates/industries/')
        .then(res => {
          setIndustries(res.data);
          if (res.data.length > 0 && !selectedIndustryId) {
            setSelectedIndustryId(res.data[0].id);
          }
        })
        .catch(() => setIndustries([]));
    }
  }, [isOpen]);

  // Fetch templates based on industry & search
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedIndustryId) {
        params.append('industry', selectedIndustryId);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      api.get<ProjectTemplate[]>(`/templates/?${params.toString()}`)
        .then(res => setTemplates(res.data))
        .catch(() => setTemplates([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, selectedIndustryId, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      {ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[88vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Template Library
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Choose a predefined workflow blueprint to initialize your project.
                  </p>
                </div>
              </div>

              {/* Search Control */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Industry Selector Tabs */}
            {industries.length > 0 && (
              <div className="px-6 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mr-2 flex-shrink-0">
                  Industries:
                </span>
                {industries.map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => setSelectedIndustryId(ind.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedIndustryId === ind.id
                        ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                        : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {ind.name}
                  </button>
                ))}
              </div>
            )}

            {/* Template Grid / List Container */}
            <div className="p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                  <Loader2 className="h-7 w-7 animate-spin mb-3 text-blue-500" />
                  <p className="text-xs font-semibold">Loading templates...</p>
                </div>
              ) : templates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(tpl => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      onPreview={(t) => setPreviewTemplate(t)}
                      onUse={(t) => setCustomizeTemplate(t)}
                    />
                  ))}
                </div>
              ) : (
                /* Empty Search State */
                <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
                  <div className="p-4 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl mb-4 text-zinc-400">
                    <FolderSearch className="h-8 w-8" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    No templates found
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                    Try a different search query or browse another industry category.
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors text-zinc-800 dark:text-zinc-200"
                    >
                      Clear search filter
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      <TemplatePreviewModal
        isOpen={Boolean(previewTemplate)}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUse={(t) => {
          setPreviewTemplate(null);
          setCustomizeTemplate(t);
        }}
      />

      {/* Customize & Project Creation Modal */}
      <TemplateCustomizeModal
        isOpen={Boolean(customizeTemplate)}
        template={customizeTemplate}
        preselectedClientId={preselectedClientId}
        onClose={() => setCustomizeTemplate(null)}
        onProjectCreated={(project) => {
          setCustomizeTemplate(null);
          onClose();
          if (onProjectCreated) {
            onProjectCreated(project);
          }
        }}
      />
    </>
  );
};
