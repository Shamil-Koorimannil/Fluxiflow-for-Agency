import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FileText, Mail, Phone, Globe } from 'lucide-react';
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
      className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Header Name & Status Badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
              {client.name}
            </h3>
            {client.company_name && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {client.company_name}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${
              client.status === 'ACTIVE'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700'
            }`}
          >
            {client.status}
          </span>
        </div>

        {/* Contact Info */}
        <div className="space-y-1.5 mb-6 text-xs text-zinc-600 dark:text-zinc-400">
          {client.email && (
            <div className="flex items-center gap-2 truncate">
              <Mail className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 truncate">
              <Phone className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-2 truncate">
              <Globe className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate">{client.website}</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics & Direct Shortcuts */}
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-3">
          <span>{client.projects_count} {client.projects_count === 1 ? 'Project' : 'Projects'}</span>
          <span>•</span>
          <span>{client.brand_assets_count} {client.brand_assets_count === 1 ? 'Brand Asset' : 'Brand Assets'}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/clients/${client.id}?tab=projects`);
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Folder className="h-3.5 w-3.5 text-blue-500" />
            <span>Projects</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/clients/${client.id}?tab=assets`);
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-purple-500" />
            <span>Brand Assets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
