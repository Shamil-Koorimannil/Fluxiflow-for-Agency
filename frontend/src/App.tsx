import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { ThemeProvider as AppThemeProvider, useAppTheme } from './context/ThemeContext';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './features/auth/Login';
import { Tasks } from './features/tasks/Tasks';
import { Projects } from './features/projects/Projects';
import { ProjectDetail } from './features/projects/ProjectDetail';
import { Team } from './features/team/Team';
import { TeamDetail } from './features/team/TeamDetail';
import { ActivityLog } from './features/activity/ActivityLog';
import { Search } from './features/search/Search';
import { Profile } from './features/profile/Profile';
import { Reports } from './features/reports/Reports';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppThemeProvider>
          <ThemeContainer>
            <BrowserRouter>
              <Routes>
                {/* Public Auth Route */}
                <Route path="/login" element={<Login />} />

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

                  {/* Admin-Only Routes */}
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
                </Route>

                {/* Fallback Redirects */}
                <Route path="/" element={<Navigate to="/app/tasks" replace />} />
                <Route path="*" element={<Navigate to="/app/tasks" replace />} />
              </Routes>
            </BrowserRouter>
          </ThemeContainer>
        </AppThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
