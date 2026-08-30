import React from 'react';
import { ChevronRight, Folder, Home } from 'lucide-react';
import type { KeepItem } from '../../types';

interface KeepBreadcrumbsProps {
  currentFolder: KeepItem | null;
  folderPath: KeepItem[];
  onNavigateFolder: (folder: KeepItem | null) => void;
  section: string;
}

export const KeepBreadcrumbs: React.FC<KeepBreadcrumbsProps> = ({
  currentFolder,
  folderPath,
  onNavigateFolder,
  section
}) => {
  const getSectionTitle = () => {
    switch (section) {
      case 'shared': return 'Shared with Me';
      case 'recent': return 'Recent';
      case 'pinned': return 'Pinned';
      case 'trash': return 'Trash';
      default: return 'My Keep';
    }
  };

  return (
    <nav className="flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 overflow-x-auto py-1">
      <button
        onClick={() => onNavigateFolder(null)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
      >
        <Home className="h-4 w-4 text-zinc-500" />
        <span>{getSectionTitle()}</span>
      </button>

      {folderPath.map((folder) => (
        <React.Fragment key={folder.id}>
          <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
          <button
            onClick={() => onNavigateFolder(folder)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
              currentFolder?.id === folder.id
                ? 'font-semibold text-black dark:text-white bg-zinc-100 dark:bg-zinc-800'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="truncate max-w-[150px]">{folder.name}</span>
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
