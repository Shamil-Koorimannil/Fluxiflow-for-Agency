import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FileText } from 'lucide-react';
import type { Client } from '../../types';

interface ClientCardProps {
  client: Client;
  onEdit?: (client: Client) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({ client }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/app/clients/${client.id}`)}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm hover:shadow transition-shadow duration-150 cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Name & Active/Inactive Status Badge */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 truncate">
            {client.name}
          </h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase shrink-0 ${
              client.status === 'ACTIVE'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700'
            }`}
          >
            {client.status}
          </span>
        </div>

        {/* Company Name or Email (Compact) */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-3 min-h-[1.25rem]">
          {client.company_name || client.email || '\u00A0'}
        </p>

        {/* Metrics Count */}
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-3">
          <span>{client.projects_count ?? 0} {(client.projects_count ?? 0) === 1 ? 'Project' : 'Projects'}</span>
          <span>•</span>
          <span>{client.brand_assets_count ?? 0} {(client.brand_assets_count ?? 0) === 1 ? 'Brand Asset' : 'Brand Assets'}</span>
        </div>
      </div>

      {/* Quick Actions Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/app/clients/${client.id}/projects`);
          }}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-colors"
        >
          <Folder className="h-3.5 w-3.5 text-blue-500" />
          <span>Projects</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/app/clients/${client.id}/brand-assets`);
          }}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-colors"
        >
          <FileText className="h-3.5 w-3.5 text-purple-500" />
          <span>Brand Assets</span>
        </button>
      </div>
    </div>
  );
};
