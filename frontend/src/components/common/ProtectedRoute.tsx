import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

import { useOrganization } from '../../context/OrganizationContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'ADMIN' | 'ORG_ADMIN' | 'MEMBER';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const { isAdmin, isOrgAdmin } = useOrganization();
  const location = useLocation();

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

  if (!isAuthenticated || !user) {
    // Redirect to login page but save current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    if (requiredRole === 'ORG_ADMIN' && !isOrgAdmin) {
      return <Navigate to="/app/tasks" replace />;
    }
    if (requiredRole === 'ADMIN' && !isAdmin) {
      return <Navigate to="/app/tasks" replace />;
    }
  }

  return <>{children}</>;
};
