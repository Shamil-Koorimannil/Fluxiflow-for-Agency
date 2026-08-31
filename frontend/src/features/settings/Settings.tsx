import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { TaskTypeSettings } from './TaskTypeSettings';

export const Settings: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl shadow-sm">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Agency Settings
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Configure organization settings, task types, duration allocations, and capacity.
          </p>
        </div>
      </div>

      {/* Task Types & Workload Settings */}
      <div className="max-w-5xl">
        <TaskTypeSettings />
      </div>
    </div>
  );
};
