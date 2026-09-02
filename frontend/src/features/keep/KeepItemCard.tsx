import React from 'react';
import {
  Folder, FileText, StickyNote, Pin, MoreVertical, FileSpreadsheet,
  Image as ImageIcon, FileCode, Archive, File
} from 'lucide-react';
import type { KeepItem } from '../../types';

interface KeepItemCardProps {
  item: KeepItem;
  viewMode: 'grid' | 'list';
  onOpen: (item: KeepItem) => void;
  onContextMenu: (e: React.MouseEvent, item: KeepItem) => void;
}

export const KeepItemCard: React.FC<KeepItemCardProps> = ({
  item,
  viewMode,
  onOpen,
  onContextMenu
}) => {
  const getFileExtension = (): string => {
    const filename = item.original_filename || item.name;
    if (filename.includes('.')) {
      return filename.split('.').pop()?.toLowerCase() || '';
    }
    return '';
  };

  const getItemIcon = () => {
    if (item.item_type === 'FILE') {
      const ext = getFileExtension();
      const mime = item.file_type || '';
      if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico'].includes(ext)) {
        return <ImageIcon className="h-6 w-6 text-purple-500 flex-shrink-0" />;
      }
      if (ext === 'pdf' || mime === 'application/pdf') {
        return <FileText className="h-6 w-6 text-red-500 flex-shrink-0" />;
      }
      if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'sh', 'csv', 'yml', 'yaml'].includes(ext) || mime.startsWith('text/')) {
        return <FileCode className="h-6 w-6 text-blue-500 flex-shrink-0" />;
      }
      if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
        return <Archive className="h-6 w-6 text-amber-500 flex-shrink-0" />;
      }
      if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        return <FileSpreadsheet className="h-6 w-6 text-emerald-500 flex-shrink-0" />;
      }
      return <File className="h-6 w-6 text-zinc-400 flex-shrink-0" />;
    }

    switch (item.item_type) {
      case 'FOLDER':
        return <Folder className="h-6 w-6 text-amber-500 flex-shrink-0" />;
      case 'DOCUMENT':
        return <FileText className="h-6 w-6 text-blue-500 flex-shrink-0" />;
      case 'NOTE':
        return <StickyNote className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />;
      case 'SPREADSHEET':
        return <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />;
      default:
        return <File className="h-6 w-6 text-zinc-400 flex-shrink-0" />;
    }
  };

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getSubLabel = (): string => {
    if (item.item_type === 'FILE') {
      const ext = getFileExtension().toUpperCase() || 'FILE';
      const sizeStr = formatFileSize(item.file_size);
      return sizeStr ? `${ext} • ${sizeStr}` : ext;
    }
    return item.item_type.toLowerCase();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onOpen(item)}
        onContextMenu={(e) => onContextMenu(e, item)}
        className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {getItemIcon()}
          <div className="truncate">
            <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white">
              {item.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
              <span>{getSubLabel()}</span>
              <span>•</span>
              <span>Updated {formatDate(item.updated_at)}</span>
              {item.owner_name && (
                <>
                  <span>•</span>
                  <span>{item.owner_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.is_pinned && (
            <Pin className="h-4 w-4 text-amber-500 fill-amber-500/20" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, item);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onOpen(item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      className="flex flex-col justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all cursor-pointer group shadow-sm hover:shadow-md h-40 relative"
    >
      {/* Top Card Bar */}
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50">
          {getItemIcon()}
        </div>

        <div className="flex items-center gap-1">
          {item.is_pinned && (
            <Pin className="h-4 w-4 text-amber-500 fill-amber-500/20" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, item);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Card Info */}
      <div className="mt-2">
        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white">
          {item.name}
        </h4>
        <div className="flex items-center justify-between text-xs text-zinc-400 mt-1">
          <span>{getSubLabel()}</span>
          <span>{formatDate(item.updated_at)}</span>
        </div>
      </div>
    </div>
  );
};
