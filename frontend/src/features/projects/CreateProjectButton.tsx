import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, FolderPlus, Sparkles } from 'lucide-react';

interface CreateProjectButtonProps {
  onSelectBlankProject: () => void;
  onSelectTemplates: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const CreateProjectButton: React.FC<CreateProjectButtonProps> = ({
  onSelectBlankProject,
  onSelectTemplates,
  className,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const buttonPadding = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 md:px-4 md:py-2 text-xs md:text-sm';

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={className || `flex items-center gap-1.5 ${buttonPadding} bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black font-medium rounded-xl transition-colors shadow-sm select-none`}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline">Create Project</span>
        <span className="inline md:hidden">Project</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Chooser Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onSelectBlankProject();
            }}
            className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-left transition-colors group"
          >
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
              <FolderPlus className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Blank Project
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Start with an empty project scope
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onSelectTemplates();
            }}
            className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-left transition-colors group"
          >
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Templates</span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  New
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Use a predefined workflow blueprint
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
