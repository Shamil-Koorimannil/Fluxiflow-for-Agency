import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
            </Route>

            {/* Fallback Redirects */}
            <Route path="/" element={<Navigate to="/app/tasks" replace />} />
            <Route path="*" element={<Navigate to="/app/tasks" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
