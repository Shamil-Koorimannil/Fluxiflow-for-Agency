import React, { useState } from 'react';
import { Settings as SettingsIcon, Users, Clock, Building2 } from 'lucide-react';
import { TaskTypeSettings } from './TaskTypeSettings';
import { OrganizationMembersSettings } from './OrganizationMembersSettings';
import { OrganizationProfileSettings } from './OrganizationProfileSettings';
import { useOrganization } from '../../context/OrganizationContext';

export const Settings: React.FC = () => {
  const { isOrgAdmin } = useOrganization();
  const [activeTab, setActiveTab] = useState<'profile' | 'task_types' | 'members'>(isOrgAdmin ? 'profile' : 'task_types');

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-4 sm:p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl shadow-sm shrink-0">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Organization Settings
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Manage workspace identity, organization members, roles, task types, and workload defaults.
          </p>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="w-full max-w-5xl mb-8 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none min-h-[48px]">
          {isOrgAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-sm font-bold'
                  : 'text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span>General & Profile</span>
            </button>
          )}

          {isOrgAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-sm font-bold'
                  : 'text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Members & Roles</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('task_types')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              activeTab === 'task_types'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-sm font-bold'
                : 'text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span>Task Types & Allocations</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl">
        {activeTab === 'profile' && isOrgAdmin && <OrganizationProfileSettings />}
        {activeTab === 'members' && isOrgAdmin && <OrganizationMembersSettings />}
        {activeTab === 'task_types' && <TaskTypeSettings />}
      </div>
    </div>
  );
};
