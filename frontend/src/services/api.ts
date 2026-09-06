import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// BroadcastChannel for cross-tab auth state sharing and sync
export const authChannel = typeof window !== 'undefined' ? new BroadcastChannel('fluxiflow_auth_channel') : null;

// Helper to check if tokens exist
export const getAccessToken = () => {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
};

export const getRefreshToken = () => {
  return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
};

export const setTokens = (access: string, refresh: string, rememberMe?: boolean) => {
  const currentRememberMe = localStorage.getItem('rememberMe') === 'true';
  const finalRememberMe = rememberMe !== undefined ? rememberMe : currentRememberMe;
  
  if (finalRememberMe) {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('rememberMe', 'true');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  } else {
    sessionStorage.setItem('accessToken', access);
    sessionStorage.setItem('refreshToken', refresh);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('rememberMe');
  }

  // Broadcast login details to other tabs on fresh auth
  if (rememberMe !== undefined && authChannel) {
    const userRole = localStorage.getItem('userRole');
    authChannel.postMessage({
      type: 'SEND_TOKENS',
      payload: { access, refresh, rememberMe: finalRememberMe, userRole }
    });
  }
};

export const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
};

// Request Interceptor: Attach token, active organization ID, and client timezone
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeOrgId = localStorage.getItem('activeOrganizationId') || sessionStorage.getItem('activeOrganizationId');
    if (activeOrgId) {
      config.headers['X-Organization-Id'] = activeOrgId;
    }
    try {
      config.headers['X-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      // Fallback if Intl API unavailable
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-refresh tokens on 401 with cross-tab lock coordination
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Guard against infinite loop and non-401s
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If login or verification endpoints return 401, don't attempt refresh
    if (
      originalRequest.url.includes('/auth/verify-otp/') ||
      originalRequest.url.includes('/auth/request-otp/')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    // Notify other tabs to hold token refreshes
    if (authChannel) {
      authChannel.postMessage({ type: 'TOKEN_REFRESH_STARTED' });
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      isRefreshing = false;
      if (authChannel) {
        authChannel.postMessage({ type: 'TOKEN_REFRESH_FAILED' });
      }
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
        refresh: refreshToken,
      });

      const { access, refresh } = response.data;
      const newRefresh = refresh || refreshToken;
      setTokens(access, newRefresh);
      
      // Share refreshed tokens with other tabs
      if (authChannel) {
        authChannel.postMessage({
          type: 'TOKEN_REFRESHED',
          payload: { access, refresh: newRefresh }
        });
      }

      api.defaults.headers.common.Authorization = `Bearer ${access}`;
      originalRequest.headers.Authorization = `Bearer ${access}`;
      
      processQueue(null, access);
      isRefreshing = false;
      return api(originalRequest);
    } catch (refreshError) {
      if (authChannel) {
        authChannel.postMessage({ type: 'TOKEN_REFRESH_FAILED' });
      }
      processQueue(refreshError, null);
      isRefreshing = false;
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  }
);

// BroadcastChannel message handlers
if (authChannel) {
  authChannel.onmessage = (event) => {
    const { type, payload } = event.data;

    if (type === 'REQUEST_TOKENS') {
      const access = localStorage.getItem('accessToken');
      const refresh = localStorage.getItem('refreshToken');
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      const userRole = localStorage.getItem('userRole');

      if (access && refresh) {
        authChannel.postMessage({
          type: 'SEND_TOKENS',
          payload: { access, refresh, rememberMe, userRole }
        });
      }
    } else if (type === 'SEND_TOKENS') {
      if (!getAccessToken()) {
        const { access, refresh, rememberMe, userRole } = payload;
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);
        localStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
        if (userRole) {
          localStorage.setItem('userRole', userRole);
        }
        window.dispatchEvent(new Event('auth_sync'));
      }
    } else if (type === 'TOKEN_REFRESH_STARTED') {
      isRefreshing = true;
    } else if (type === 'TOKEN_REFRESHED') {
      const { access, refresh } = payload;
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      
      api.defaults.headers.common.Authorization = `Bearer ${access}`;
      processQueue(null, access);
      isRefreshing = false;
    } else if (type === 'TOKEN_REFRESH_FAILED') {
      processQueue(new Error('Refresh failed in another tab'), null);
      isRefreshing = false;
      clearTokens();
      window.dispatchEvent(new Event('auth_sync_logout'));
    } else if (type === 'LOGOUT') {
      clearTokens();
      window.dispatchEvent(new Event('auth_sync_logout'));
    }
  };

  // Request credentials handshake from existing tabs on startup
  setTimeout(() => {
    if (!getAccessToken()) {
      authChannel.postMessage({ type: 'REQUEST_TOKENS' });
    }
  }, 100);
}

