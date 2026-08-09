import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { GlobalSearchResults } from '../../types';
import { Search as SearchIcon, Folder, CheckSquare, CornerDownRight } from 'lucide-react';

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
      // Check if target is not input/textarea
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
        return 'text-red-600 bg-red-50';
      case 'MEDIUM':
        return 'text-amber-600 bg-amber-50';
      case 'LOW':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-zinc-600 bg-zinc-50';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Global Search</h1>
        <p className="text-sm text-zinc-500">
          Search across company tasks, descriptions, assignees, and projects.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type search terms... (Press '/' to focus)"
          className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
        />
      </div>

      {/* Search Results Display */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-6 w-24 bg-zinc-200 animate-pulse rounded"></div>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-zinc-100 animate-pulse rounded-lg border border-zinc-200/50"></div>
            ))}
          </div>
        </div>
      ) : debouncedQuery.trim() === '' ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-zinc-400 mb-4">
            <SearchIcon className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">Start searching</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Enter a task name, assignee name, project title, or keyword to find items.
          </p>
        </div>
      ) : (!results || (results.tasks.length === 0 && results.projects.length === 0)) ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
          <h3 className="font-semibold text-sm">No results found</h3>
          <p className="text-xs text-zinc-400 mt-1">
            We couldn't find anything matching "{debouncedQuery}".
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Projects Results Section */}
          {results.projects.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Folder className="h-3.5 w-3.5" />
                Projects ({results.projects.length})
              </h2>
              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {results.projects.map((proj) => (
                  <Link
                    key={proj.id}
                    to={`/app/projects/${proj.id}`}
                    className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-black">{proj.name}</h4>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                        {proj.description || 'No description provided.'}
                      </p>
                    </div>
                    {proj.progress !== null ? (
                      <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-100 rounded-full">
                        {proj.progress}%
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-zinc-400 italic">No tasks</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Results Section */}
          {results.tasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5" />
                Tasks ({results.tasks.length})
              </h2>
              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {results.tasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/app/tasks?task=${task.id}`}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-2 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm text-black">
                          {task.status === 'COMPLETED' ? (
                            <span className="line-through text-zinc-400">{task.name}</span>
                          ) : (
                            task.name
                          )}
                        </h4>
                        {task.priority && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>
                      
                      {task.project_detail && (
                        <div className="flex items-center gap-1 text-xs text-zinc-400 font-medium">
                          <Folder className="h-3 w-3 shrink-0" />
                          <span>{task.project_detail.name}</span>
                          {task.sub_project_detail && (
                            <>
                              <CornerDownRight className="h-2.5 w-2.5 shrink-0" />
                              <span>{task.sub_project_detail.name}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-auto">
                      {/* Assignee list */}
                      <div className="flex -space-x-1 overflow-hidden">
                        {task.assignees.map((user) => (
                          <div
                            key={user.id}
                            title={user.name}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 border border-white text-[9px] font-semibold text-zinc-600 shrink-0"
                          >
                            {user.name[0].toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500 font-medium">
                        Due: {new Date(task.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
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
