import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Plus, Shield, ShieldCheck, User } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';

export const OrganizationSwitcher: React.FC = () => {
  const {
    organizations,
    activeOrganization,
    activeRole,
    switchOrganization,
    createOrganization,
    isLoading
  } = useOrganization();

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOrg = async (orgId: string) => {
    setIsOpen(false);
    if (activeOrganization?.id !== orgId) {
      await switchOrganization(orgId);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    try {
      await createOrganization(newOrgName.trim());
      setNewOrgName('');
      setIsModalOpen(false);
    } catch (err) {
      // Error handled in context
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    if (role === 'ORG_ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <ShieldCheck className="h-2.5 w-2.5" /> Organisation admin
        </span>
      );
    }
    if (role === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Shield className="h-2.5 w-2.5" /> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
        <User className="h-2.5 w-2.5" /> Member
      </span>
    );
  };

  if (!activeOrganization && organizations.length === 0) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Create Organization
        </button>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                Create New Workspace
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
                Create a separate, isolated workspace for your team or agency.
              </p>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Agency"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newOrgName.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-900 dark:text-zinc-100 transition-colors shadow-sm text-xs font-semibold whitespace-nowrap shrink-0"
      >
        <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
          {activeOrganization?.logo_url ? (
            <img src={activeOrganization.logo_url} alt={activeOrganization?.effective_name || activeOrganization?.name || 'Workspace'} className="h-full w-full rounded-lg object-cover" />
          ) : (
            (activeOrganization?.effective_name || activeOrganization?.display_name || activeOrganization?.name || 'W').charAt(0).toUpperCase()
          )}
        </div>

        <span className="truncate whitespace-nowrap max-w-[100px] sm:max-w-[160px]">
          {activeOrganization?.effective_name || activeOrganization?.display_name || activeOrganization?.name || 'Select Workspace'}
        </span>

        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 p-2 space-y-1">
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Current Workspace</p>
            <div className="flex items-center justify-between mt-1">
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {activeOrganization?.effective_name || activeOrganization?.display_name || activeOrganization?.name}
              </span>
              {getRoleBadge(activeRole || undefined)}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 py-1">
            <p className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Workspaces ({organizations.length})</p>
            {organizations.map((org) => {
              const isSelected = org.id === activeOrganization?.id;
              const orgName = org.effective_name || org.display_name || org.name;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="h-5 w-5 rounded-md bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                      {orgName.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{orgName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {getRoleBadge(org.role)}
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <Plus className="h-4 w-4" /> Create Organization
            </button>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Create New Workspace
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Create a separate, isolated workspace for your team or agency.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Agency"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newOrgName.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
