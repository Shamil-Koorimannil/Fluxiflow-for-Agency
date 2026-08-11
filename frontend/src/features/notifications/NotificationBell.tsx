import React, { useState } from 'react';
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Popover, Badge, IconButton } from '@mui/material';
import { Bell, Check, X } from 'lucide-react';
import { api } from '../../services/api';

interface NotificationItem {
  id: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  related_task: string | null;
  related_task_name: string | null;
  related_project: string | null;
  related_project_id: string | null;
  related_project_name: string | null;
  related_user: string | null;
  related_user_name: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export const NotificationBell: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Popover state
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  // 1. Fetch unread count, polling every 30s
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count/');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const unreadCount = countData?.count || 0;

  // 2. Fetch paginated notifications list via Infinite Query
  const {
    data: listData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get(`/notifications/?page=${pageParam}`);
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      const url = new URL(lastPage.next);
      const page = url.searchParams.get('page');
      return page ? parseInt(page) : undefined;
    },
    enabled: open, // Only run list query when popover is open
  });

  // Flat array of all loaded notifications
  const notifications: NotificationItem[] =
    listData?.pages.flatMap((page) => page.results) || [];

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const res = await api.post(`/notifications/${notifId}/read/`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/notifications/mark-all-read/');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notifId: string) => {
      await api.delete(`/notifications/${notifId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Click handler for notification items
  const handleItemClick = (item: NotificationItem) => {
    // 1. Mark as read on backend
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }
    handleClose();

    // 2. Deep-link routing based on notification contents
    if (item.related_task) {
      navigate(`/app/tasks?task=${item.related_task}`);
    } else if (item.related_project) {
      navigate(`/app/projects/${item.related_project}`);
    } else if (item.related_user) {
      navigate(`/app/team?member=${item.related_user}`);
    }
  };

  const getPriorityColor = (type: string) => {
    switch (type) {
      case 'TASK_OVERDUE':
      case 'MEMBER_DEACTIVATED':
        return '#ef4444'; // Red
      case 'TASK_DUE_TODAY':
        return '#f59e0b'; // Amber
      case 'TASK_DUE_SOON':
      case 'TASK_COMPLETED':
      case 'MEMBER_REACTIVATED':
        return '#10b981'; // Green
      default:
        return '#71717a'; // Zinc / Neutral
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <IconButton
        aria-describedby={id}
        onClick={handleClick}
        sx={{
          color: 'text.primary',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '10px',
          p: 1,
        }}
      >
        <Badge
          badgeContent={unreadCount}
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: 'text.primary',
              color: 'background.paper',
              fontWeight: 800,
              fontSize: '10px',
              height: '18px',
              minWidth: '18px',
              borderRadius: '9px',
            },
          }}
        >
          <Bell size={18} />
        </Badge>
      </IconButton>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '320px', sm: '380px' },
              maxHeight: '480px',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: 'divider',
              mt: 1.5,
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        {/* Header Section */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-150 dark:border-zinc-800 shrink-0">
          <h3 className="font-extrabold text-sm text-black dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="flex items-center gap-1 text-[11px] font-extrabold text-zinc-550 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <Check size={12} />
              Mark all read
            </button>
          )}
        </div>

        {/* Scrollable Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900 scrollbar-none">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
              <Bell size={24} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
              <p className="text-xs font-semibold">You're all caught up.</p>
              <p className="text-[10px] mt-0.5">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-4 flex gap-3 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors relative group ${
                  !item.is_read ? 'bg-zinc-50/30 dark:bg-zinc-900/10' : ''
                }`}
              >
                {/* Visual indicator category dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: getPriorityColor(item.type) }}
                />

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex justify-between items-start gap-1">
                    <h4
                      className={`text-xs truncate ${
                        !item.is_read ? 'font-extrabold text-black dark:text-white' : 'font-semibold text-zinc-650 dark:text-zinc-400'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <span className="text-[9px] text-zinc-400 shrink-0 font-medium mt-0.5">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-550 dark:text-zinc-450 mt-1 leading-normal wrap-break-word">
                    {item.message}
                  </p>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotificationMutation.mutate(item.id);
                  }}
                  className="absolute right-2 top-2 p-1 text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}

          {/* Load More Button */}
          {hasNextPage && (
            <div className="p-3 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-[11px] font-bold py-1.5 px-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-black dark:hover:border-white transition-colors"
              >
                {isFetchingNextPage ? 'Loading...' : 'Load older notifications'}
              </button>
            </div>
          )}
        </div>
      </Popover>
    </>
  );
};
