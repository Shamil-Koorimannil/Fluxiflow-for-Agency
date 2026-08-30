import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Briefcase, RefreshCw, AlertCircle } from 'lucide-react';
import type { Client } from '../../types';
import { api } from '../../services/api';
import { ClientCard } from './ClientCard';
import { ClientFormModal } from './ClientFormModal';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      const res = await api.get<Client[]>(`/clients/?${params.toString()}`);
      setClients(res.data);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setErrorMessage('Access denied. Client Management is available to Admin users only.');
      } else {
        setErrorMessage('Failed to load clients. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleClientSaved = () => {
    fetchClients();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto p-6 md:p-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Briefcase className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Clients</h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Manage agency client portfolios, associated projects, and brand assets.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedClientForEdit(null);
            setIsFormModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-semibold text-xs rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Client</span>
        </button>
      </div>

      {/* Search & Status Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients by name, company, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-zinc-400 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium outline-none focus:border-black dark:focus:border-white transition-colors"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2.5 p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-medium">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Client Cards Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16 text-zinc-400 gap-2 text-xs">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading clients...</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-white/40 dark:bg-zinc-900/20 p-8">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3 text-zinc-400">
            <Briefcase className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-200 mb-1">
            No Clients Found
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mb-5">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No clients match your filter criteria. Try adjusting your search query.'
              : 'Add your agency clients to associate projects and store dedicated brand guidelines and assets.'}
          </p>
          <button
            onClick={() => {
              setSelectedClientForEdit(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-semibold text-xs rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Client</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={(c) => {
                setSelectedClientForEdit(c);
                setIsFormModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      <ClientFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onClientSaved={handleClientSaved}
        initialData={selectedClientForEdit}
      />
    </div>
  );
};
