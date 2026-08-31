import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Organization, UserRole } from '../types';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

interface OrganizationContextType {
  organizations: Organization[];
  activeOrganization: Organization | null;
  activeRole: UserRole | null;
  isOrgAdmin: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
  errorState: string | null;
  switchOrganization: (orgId: string) => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { isAuthenticated, isInitializing } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorState(null);
    try {
      const response = await api.get<{
        organizations: Organization[];
        active_organization: Organization | null;
      }>('/organizations/');
      
      const orgList = response.data.organizations || [];
      setOrganizations(orgList);
      const active = response.data.active_organization || (orgList[0] ?? null);
      setActiveOrganization(active);
      setActiveRole(active?.role || null);
    } catch (err: any) {
      console.error('Failed to load organizations:', err);
      setErrorState(err.response?.data?.detail || 'Unable to load your workspace.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isInitializing) {
      fetchOrganizations();
    }
  }, [isAuthenticated, isInitializing, fetchOrganizations]);

  const switchOrganization = async (orgId: string) => {
    if (activeOrganization?.id === orgId) return;

    setIsLoading(true);
    try {
      const response = await api.post<{
        active_organization: Organization;
        role: UserRole;
      }>('/organizations/switch/', { organization_id: orgId });

      // Clear React Query cache to purge stale organization data
      queryClient.clear();

      setActiveOrganization(response.data.active_organization);
      setActiveRole(response.data.role);
      await fetchOrganizations();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to switch workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  const createOrganization = async (name: string): Promise<Organization> => {
    setIsLoading(true);
    try {
      const response = await api.post<Organization>('/organizations/', { name });
      
      // Clear React Query cache for fresh workspace
      queryClient.clear();

      setActiveOrganization(response.data);
      setActiveRole('ORG_ADMIN');
      await fetchOrganizations();
      return response.data;
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create organization.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const isOrgAdmin = activeRole === 'ORG_ADMIN';
  const isAdmin = activeRole === 'ORG_ADMIN' || activeRole === 'ADMIN';
  const isMember = activeRole === 'MEMBER';

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganization,
        activeRole,
        isOrgAdmin,
        isAdmin,
        isMember,
        isLoading,
        errorState,
        switchOrganization,
        createOrganization,
        refreshOrganizations: fetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
