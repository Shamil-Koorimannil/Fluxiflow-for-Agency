import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { ActivityLog as ActivityLogType } from '../../types';
import { List } from 'lucide-react';

export const ActivityLog: React.FC = () => {
  const { data: activities, isLoading, error } = useQuery<ActivityLogType[]>({
    queryKey: ['activities'],
    queryFn: async () => {
      const response = await api.get('/activity/');
      return response.data;
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <div className="h-7 w-32 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-md"></div>
          <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-md"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 p-4 border border-zinc-100 dark:border-zinc-850 rounded-xl bg-white dark:bg-black animate-pulse">
              <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                <div className="h-3 w-1/4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 text-sm font-medium text-red-600 dark:text-red-400">
        Failed to load activity logs. Please verify authorization and connection.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-black dark:text-white">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Activity Log</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Chronological record of company projects and task assignments.
        </p>
      </div>

      {!activities || activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black p-12 text-center text-black dark:text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-455 mb-4">
            <List className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">No activity logs</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Events will be logged automatically as your team performs tasks.
          </p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-black overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-850 text-black dark:text-white shadow-sm">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-white/10 transition-colors"
            >
              {/* User Avatar / Initials */}
              {activity.user_detail?.avatar_url ? (
                <img
                  src={activity.user_detail.avatar_url}
                  alt={activity.user_detail.name}
                  className="h-10 w-10 rounded-full object-cover border border-zinc-100 dark:border-zinc-800 shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">
                  {getInitials(activity.user_detail?.name || 'Unknown')}
                </div>
              )}

              {/* Log Details */}
              <div className="flex-1 space-y-0.5 min-w-0">
                <p className="text-sm text-zinc-800 dark:text-zinc-300 wrap-break-word leading-relaxed">
                  <span className="font-semibold text-black dark:text-white">
                    {activity.user_detail?.name || 'System'}
                  </span>{' '}
                  {activity.description.replace(activity.user_detail?.name || '', '').trim() ||
                    activity.action.toLowerCase().replace('_', ' ')}
                </p>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tracking-wide">
                  {formatDate(activity.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
