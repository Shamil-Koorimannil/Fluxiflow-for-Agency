import React, { useState } from 'react';
import { Building2, Plus, Mail, AlertCircle } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { useOrganization } from '../../context/OrganizationContext';

export const OrganizationOnboarding: React.FC = () => {
  const { showAlert } = useConfirm();
  const { createOrganization, refreshOrganizations, errorState } = useOrganization();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await createOrganization(newOrgName.trim());
      setNewOrgName('');
      setIsModalOpen(false);
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Failed to create workspace.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-500/20">
          <Building2 className="h-8 w-8" />
        </div>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Welcome to Fluxiflow
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
          You don't belong to a workspace yet. Create a new organization for your team or agency, or accept an invitation to join an existing workspace.
        </p>

        {errorState && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs flex items-center justify-between gap-2 font-medium">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {errorState}
            </span>
            <button
              onClick={() => refreshOrganizations()}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold shrink-0 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs hover:opacity-90 transition-all shadow-md"
          >
            <Plus className="h-4 w-4" /> Create Organization
          </button>

          <button
            onClick={() => showAlert({ title: 'Invitation Info', message: 'Please check your email inbox for an invitation link, or contact your Organisation admin.', variant: 'info' })}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
          >
            <Mail className="h-4 w-4" /> Accept Invitation
          </button>
        </div>
      </div>

      {/* Create Organization Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Create New Workspace
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Set up an isolated workspace for your projects, tasks, clients, and team members.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Organization Name
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
