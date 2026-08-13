import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

export const useWebSockets = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Close connection if user logs out
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    const connectWebSocket = () => {
      if (socketRef.current || isConnectingRef.current) return;

      const token = getAccessToken();
      if (!token) return;

      isConnectingRef.current = true;

      // Construct dynamic URL based on current protocol & host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let host = window.location.host;
      
      // Local dev server fallback
      if (host.includes('localhost:5173') || host.includes('127.0.0.1:5173')) {
        host = host.replace('5173', '8000');
      }
      
      const wsUrl = `${protocol}//${host}/ws/tasks/?token=${encodeURIComponent(token)}`;

      console.log('[WebSocket Diagnostic] Connecting to:', wsUrl.split('?')[0]);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket Diagnostic] Connected successfully.');
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket Diagnostic] Message received:', data);

          const { type, task_id } = data;

          if (type) {
            console.log(`[WebSocket Diagnostic] Event type detected: "${type}". Performing React Query invalidations...`);
            
            // 1. General Tasks lists
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            
            // 2. Individual Task detail query
            if (task_id) {
              queryClient.invalidateQueries({ queryKey: ['task', task_id] });
            }

            // 3. Projects lists (since project progress/metrics might update)
            queryClient.invalidateQueries({ queryKey: ['projects'] });

            // 4. Project detail queries
            queryClient.invalidateQueries({ queryKey: ['project'] });

            // 5. Team workloads
            queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
            queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
            queryClient.invalidateQueries({ queryKey: ['team'] });

            console.log('[WebSocket Diagnostic] React Query invalidations completed successfully.');
          }
        } catch (err) {
          console.error('[WebSocket Diagnostic] Error handling message:', err);
        }
      };

      ws.onclose = (event) => {
        let reason = 'Unknown';
        if (event.code === 4001) {
          reason = 'Authentication Rejected: Missing token';
        } else if (event.code === 4002) {
          reason = 'Authentication Rejected: Invalid or expired token';
        } else {
          reason = `Close Code ${event.code}`;
        }
        console.log(`[WebSocket Diagnostic] Disconnected. Reason: ${reason}`);
        
        socketRef.current = null;
        isConnectingRef.current = false;

        // Try to reconnect with a 5 second delay if user is still authenticated
        if (isAuthenticated) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          console.log('[WebSocket Diagnostic] Reconnecting in 5 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket Diagnostic] Connection error encountered:', error);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, queryClient]);
};
