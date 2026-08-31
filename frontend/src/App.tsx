import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { ThemeProvider as AppThemeProvider, useAppTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './features/auth/Login';
import { Landing } from './pages/Landing';
import { Home } from './pages/Home';
import { Tasks } from './features/tasks/Tasks';
import { Projects } from './features/projects/Projects';
import { ProjectDetail } from './features/projects/ProjectDetail';
import { Team } from './features/team/Team';
import { TeamDetail } from './features/team/TeamDetail';
import { ActivityLog } from './features/activity/ActivityLog';
import { Search } from './features/search/Search';
import { Profile } from './features/profile/Profile';
import { Reports } from './features/reports/Reports';
import { Keep } from './features/keep/Keep';
import { Clients } from './features/clients/Clients';
import { ClientDetail } from './features/clients/ClientDetail';
import { Settings } from './features/settings/Settings';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ThemeContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useAppTheme();
  
  const muiTheme = React.useMemo(() => {
    return createTheme({
      palette: {
        mode: isDark ? 'dark' : 'light',
        primary: {
          main: isDark ? '#ffffff' : '#000000',
          contrastText: isDark ? '#000000' : '#ffffff',
        },
        background: {
          default: isDark ? '#000000' : '#ffffff',
          paper: isDark ? '#000000' : '#ffffff',
        },
        text: {
          primary: isDark ? '#ffffff' : '#000000',
          secondary: isDark ? '#a1a1aa' : '#71717a',
        },
        divider: isDark ? '#27272a' : '#e4e4e7',
      },
      typography: {
        fontFamily: 'Roboto, sans-serif',
      },
      shape: {
        borderRadius: 8,
      },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? '#000000' : '#ffffff',
              backgroundImage: 'none',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: '12px',
              border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7',
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: '8px',
              backgroundColor: isDark ? '#000000' : '#ffffff',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? '#27272a' : '#e4e4e7',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? '#3f3f46' : '#a1a1aa',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? '#ffffff' : '#000000',
              },
            },
          },
        },
      },
    });
  }, [isDark]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

const PublicLandingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth();
  
  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
          <p className="text-sm font-medium text-zinc-500">Loading Fluxiflow...</p>
        </div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/app/tasks" replace />;
  }
  
  return <>{children}</>;
};

const LoginRoute: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  
  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
          <p className="text-sm font-medium text-zinc-500">Loading Fluxiflow...</p>
        </div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/app/tasks" replace />;
  }
  
  return <Login />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppThemeProvider>
          <ThemeContainer>
            <BrowserRouter>
              <Routes>
                {/* Public Auth Route */}
                <Route path="/login" element={<LoginRoute />} />

                {/* Protected Application Routes */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Redirect /app to /app/tasks */}
                  <Route index element={<Navigate to="/app/tasks" replace />} />
                  
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="projects/:id" element={<ProjectDetail />} />
                  <Route path="search" element={<Search />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="keep/*" element={<Keep />} />

                  {/* Admin-Only Routes */}
                  <Route
                    path="clients"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <Clients />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="clients/:id"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <ClientDetail viewMode="full" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="clients/:id/projects"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <ClientDetail viewMode="projects-only" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="clients/:id/brand-assets"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <ClientDetail viewMode="brand-assets-only" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="team"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <Team />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="team/:id"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <TeamDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="activity"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <ActivityLog />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <Reports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* Public Marketing Landing Page */}
                <Route path="/" element={<PublicLandingRoute><Home /></PublicLandingRoute>} />
                <Route path="/landing" element={<PublicLandingRoute><Landing /></PublicLandingRoute>} />

                {/* Fallback Redirects */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ThemeContainer>
        </AppThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
