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
          <div className="h-7 w-32 bg-zinc-200 animate-pulse rounded-md"></div>
          <div className="h-4 w-64 bg-zinc-200 animate-pulse rounded-md"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 p-4 border border-zinc-100 rounded-xl bg-white animate-pulse">
              <div className="h-10 w-10 rounded-full bg-zinc-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-zinc-200 rounded"></div>
                <div className="h-3 w-1/4 bg-zinc-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm font-medium text-red-600">
        Failed to load activity logs. Please verify authorization and connection.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-zinc-500">
          Chronological record of company projects and task assignments.
        </p>
      </div>

      {!activities || activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-xl bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 mb-4">
            <List className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">No activity logs</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Events will be logged automatically as your team performs tasks.
          </p>
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-xl bg-white overflow-hidden divide-y divide-zinc-100">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-4 p-4 hover:bg-zinc-50/50 transition-colors"
            >
              {/* User Avatar / Initials */}
              {activity.user_detail?.avatar_url ? (
                <img
                  src={activity.user_detail.avatar_url}
                  alt={activity.user_detail.name}
                  className="h-10 w-10 rounded-full object-cover border border-zinc-100 shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-600 shrink-0">
                  {getInitials(activity.user_detail?.name || 'Unknown')}
                </div>
              )}

              {/* Log Details */}
              <div className="flex-1 space-y-0.5 min-w-0">
                <p className="text-sm text-zinc-800 break-words leading-relaxed">
                  <span className="font-semibold text-black">
                    {activity.user_detail?.name || 'System'}
                  </span>{' '}
                  {activity.description.replace(activity.user_detail?.name || '', '').trim() ||
                    activity.action.toLowerCase().replace('_', ' ')}
                </p>
                <span className="text-[11px] text-zinc-400 font-medium tracking-wide">
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
