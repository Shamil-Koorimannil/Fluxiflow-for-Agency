import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { History, X, RotateCcw, Clock, User as UserIcon, Loader2 } from 'lucide-react';
import type { KeepItem, KeepVersionHistory } from '../../types';
import { api } from '../../services/api';

interface VersionHistoryModalProps {
  isOpen: boolean;
  item: KeepItem | null;
  onClose: () => void;
  onVersionRestored: (updatedItem: KeepItem) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  item,
  onClose,
  onVersionRestored
}) => {
  const [versions, setVersions] = useState<KeepVersionHistory[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<KeepVersionHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      loadVersionHistory();
    }
  }, [isOpen, item]);

  const loadVersionHistory = async () => {
    if (!item) return;
    setIsLoading(true);
    try {
      const response = await api.get<KeepVersionHistory[]>(`/keep/items/${item.id}/versions/`);
      setVersions(response.data);
      if (response.data.length > 0) {
        setSelectedVersion(response.data[0]);
      }
    } catch (err) {
      console.error('Failed to load version history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  const handleRestore = async (versionId: string) => {
    setIsRestoring(true);
    try {
      const response = await api.post<KeepItem>(`/keep/items/${item.id}/versions/`, {
        version_id: versionId
      });
      onVersionRestored(response.data);
      onClose();
    } catch (err: any) {
      console.error('Failed to restore version:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col h-[75vh] text-zinc-900 dark:text-zinc-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <h3 className="font-semibold text-base leading-tight">Version History for '{item.name}'</h3>
              <p className="text-xs text-zinc-400">Inspect past milestone snapshots & restore</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Version Snapshots List */}
          <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/50 p-3 space-y-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">Loading history...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-xs">
                No milestone snapshots saved yet.
              </div>
            ) : (
              versions.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersion(v)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs space-y-1 ${
                    selectedVersion?.id === v.id
                      ? 'border-purple-500 bg-white dark:bg-zinc-900 shadow-sm font-semibold'
                      : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-zinc-900 dark:text-zinc-100 font-bold">
                    <span>Version {v.version_number}</span>
                    <Clock className="h-3 w-3 text-zinc-400" />
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    <span>{v.author_name || 'System'}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right Panel: Snapshot Preview */}
          <div className="flex-1 flex flex-col overflow-hidden p-6 bg-white dark:bg-zinc-900">
            {selectedVersion ? (
              <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm">
                      Snapshot Version {selectedVersion.version_number}
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Saved on {new Date(selectedVersion.created_at).toLocaleString()} by {selectedVersion.author_name || 'System'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isRestoring}
                    onClick={() => handleRestore(selectedVersion.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-semibold text-xs rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isRestoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    <span>Restore This Version</span>
                  </button>
                </div>

                {/* Content Preview Box */}
                <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/50 text-xs font-mono">
                  {item.item_type === 'SPREADSHEET' ? (
                    <div>
                      <div className="font-bold mb-2 text-emerald-600">Spreadsheet Snapshot Data:</div>
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedVersion.spreadsheet_snapshot, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div
                      className="prose dark:prose-invert max-w-none text-xs"
                      dangerouslySetInnerHTML={{ __html: selectedVersion.content_snapshot || '<p className="text-zinc-400">Empty snapshot.</p>' }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                Select a version snapshot from the left to preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
