import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, UserPlus, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmDialogContext';
import type { OrganizationMembership, UserRole } from '../../types';
import { api } from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { CustomDropdown } from '../../components/common/CustomDropdown';

export const OrganizationMembersSettings: React.FC = () => {
  const { confirm } = useConfirm();
  const { isOrgAdmin, activeOrganization, refreshOrganizations } = useOrganization();
  const queryClient = useQueryClient();
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('MEMBER');
  const [isInviting, setIsInviting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await api.get<OrganizationMembership[]>('/organizations/members/');
      setMemberships(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load organization members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeOrganization?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.post('/organizations/invite/', {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setSuccessMsg(`Invited ${inviteEmail} as ${inviteRole}.`);
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await api.patch(`/organizations/members/${userId}/role/`, { role: newRole });
      queryClient.invalidateQueries();
      await refreshOrganizations();
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update member role.');
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    const ok = await confirm({
      title: 'Remove Member?',
      message: `Are you sure you want to remove ${name} from this organization?`,
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/organizations/members/${userId}/`);
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove member.');
    }
  };

  if (!isOrgAdmin) {
    return (
      <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        Organization member management is restricted to Organisation admins.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Invite Member Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-blue-500" /> Invite Organization Member
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
          Add members to {activeOrganization?.name || 'this workspace'}. Existing accounts will join immediately.
        </p>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" /> {successMsg}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="member@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <CustomDropdown
            value={inviteRole}
            onChange={(val) => setInviteRole(val as UserRole)}
            options={[
              { value: 'MEMBER', label: 'Member' },
              { value: 'ADMIN', label: 'Admin' },
              { value: 'ORG_ADMIN', label: 'Organisation admin' },
            ]}
          />

          <button
            type="submit"
            disabled={isInviting || !inviteEmail.trim()}
            className="px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs hover:opacity-90 disabled:opacity-50 transition-colors shrink-0"
          >
            {isInviting ? 'Inviting...' : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Organization Members ({memberships.length})
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading members...
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {memberships.map((m: OrganizationMembership) => (
              <div key={m.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {m.user.avatar_url ? (
                      <img src={m.user.avatar_url} alt={m.user.name} className="h-full w-full rounded-xl object-cover" />
                    ) : (
                      m.user.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {m.user.name}
                      {m.role === 'ORG_ADMIN' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          Organisation admin
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" /> {m.user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <CustomDropdown
                    size="sm"
                    value={m.role}
                    onChange={(val) => handleRoleChange(m.user.id, val as UserRole)}
                    options={[
                      { value: 'MEMBER', label: 'Member' },
                      { value: 'ADMIN', label: 'Admin' },
                      { value: 'ORG_ADMIN', label: 'Organisation admin' },
                    ]}
                  />

                  <button
                    onClick={() => handleRemoveMember(m.user.id, m.user.name)}
                    title="Remove member from organization"
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
