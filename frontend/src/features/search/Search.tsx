import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { GlobalSearchResults } from '../../types';
import { Search as SearchIcon, Folder, CheckSquare } from 'lucide-react';
import { formatLateDuration, formatDateTime } from '../../utils/time';

export const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debouncing logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // Keyboard shortcut '/' to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: results, isLoading } = useQuery<GlobalSearchResults>({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { tasks: [], projects: [] };
      const response = await api.get(`/search/?q=${encodeURIComponent(debouncedQuery)}`);
      return response.data;
    },
    enabled: !!debouncedQuery.trim(),
  });

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-655 bg-red-50 dark:text-red-400 dark:bg-red-950/20';
      case 'MEDIUM':
        return 'text-amber-655 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20';
      case 'LOW':
        return 'text-blue-655 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20';
      default:
        return 'text-zinc-500 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-900';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const renderAssigneesList = (assignees: any[]) => {
    if (assignees.length === 0) {
      return (
        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-850 select-none uppercase tracking-wider">
          👤 Unassigned
        </span>
      );
    }
    
    // Single assignee
    if (assignees.length === 1) {
      const single = assignees[0];
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-650 dark:text-zinc-400">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-bold text-zinc-600 dark:text-zinc-400">
            {getInitials(single.name)}
          </div>
          <span>{single.name}</span>
        </div>
      );
    }

    // Multiple assignees
    const firstTwo = assignees.slice(0, 2);
    const overflowCount = assignees.length - 2;
    const tooltipText = assignees.map(a => a.name).join('\n');
    
    return (
      <div 
        className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-650 dark:text-zinc-400 cursor-help"
        title={tooltipText}
      >
        <div className="flex -space-x-1.5 overflow-hidden">
          {firstTwo.map((a) => (
            <div
              key={a.id}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-white dark:border-zinc-950 text-[9px] font-bold text-zinc-600 dark:text-zinc-455 shrink-0"
            >
              {getInitials(a.name)}
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-250 dark:bg-zinc-700 border border-white dark:border-zinc-950 text-[8px] font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
              +{overflowCount}
            </div>
          )}
        </div>
        <span>
          {firstTwo.map(a => a.name).join(' · ')}
          {overflowCount > 0 ? ` +${overflowCount}` : ''}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Global Search</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Search across company tasks, descriptions, assignees, and projects.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-zinc-400 dark:text-zinc-550" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Type search terms here... (Press '/' to focus)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
        />
      </div>

      {/* Search Results */}
      {debouncedQuery.trim() && !isLoading && results && (
        <div className="space-y-8 animate-fade-in">
          {/* Projects Results Section */}
          {results.projects.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Folder className="h-3.5 w-3.5" />
                Projects ({results.projects.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.projects.map((proj) => (
                  <Link
                    key={proj.id}
                    to={`/app/projects/${proj.id}`}
                    className="block bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white rounded-xl p-4 transition-all shadow-sm"
                  >
                    <h3 className="font-semibold text-sm text-black dark:text-white truncate">{proj.name}</h3>
                    <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-1 line-clamp-2">{proj.description}</p>
                    {proj.progress !== null ? (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                        <div className="w-12 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-black dark:bg-white rounded-full"
                            style={{ width: `${proj.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-bold text-black dark:text-white">{proj.progress}% completed</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-zinc-450 dark:text-zinc-500 italic mt-3 block">No tasks</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Results Section */}
          {results.tasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5" />
                Tasks ({results.tasks.length})
              </h2>
              <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden shadow-sm">
                {results.tasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/app/tasks?task=${task.id}`}
                    className="flex items-center p-4 gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-black dark:text-white"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h4 className="font-semibold text-sm">
                        {task.status === 'COMPLETED' ? (
                          <span className="line-through text-zinc-400 dark:text-zinc-550">{task.name}</span>
                        ) : (
                          task.name
                        )}
                      </h4>

                      {task.project_detail && (
                        <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-widest leading-none">
                          {task.project_detail.name}
                        </div>
                      )}

                      {/* Assignees block */}
                      <div className="flex items-center gap-1.5">
                        {renderAssigneesList(task.assignees)}
                      </div>

                      {/* Date display & Priority indicator */}
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-450 mt-1">
                        <span className="font-medium dark:text-zinc-400">
                          Due: {formatDateTime(task.due_date, task.due_time)}
                        </span>

                        {task.priority && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                            {task.priority} Priority
                          </span>
                        )}
                      </div>

                      {task.status === 'COMPLETED' && task.submission_status === 'LATE' && (
                        <div className="flex flex-col gap-0.5 mt-2 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-2 rounded-lg text-red-650 dark:text-red-400">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="shrink-0 text-red-500">🔴</span>
                            <span>Late Submission</span>
                          </div>
                          {task.late_by_minutes && (
                            <div className="text-[10px] font-bold text-red-500/80 ml-5">
                              Late by: {formatLateDuration(task.late_by_minutes)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
