import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, AlertCircle, Upload, Save, RefreshCw } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { api } from '../../services/api';

export const OrganizationProfileSettings: React.FC = () => {
  const { activeOrganization, isOrgAdmin, refreshOrganizations } = useOrganization();
  
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState(40);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrganization) {
      setName(activeOrganization.name || '');
      setDisplayName(activeOrganization.display_name || '');
      setDescription(activeOrganization.description || '');
      setWeeklyCapacityHours(activeOrganization.weekly_capacity_hours || 40);
      setLogoPreview(activeOrganization.logo_url || null);
    }
  }, [activeOrganization]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('display_name', displayName.trim());
      formData.append('description', description.trim());
      formData.append('weekly_capacity_hours', String(weeklyCapacityHours));
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      await api.patch('/organizations/profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccessMsg('Organization profile updated successfully.');
      await refreshOrganizations();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update organization profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOrgAdmin) {
    return (
      <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        Organization settings are restricted to Organization Administrators.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm max-w-3xl">
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-500" /> Organization Profile & Settings
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        Manage the primary identity, branding, description, and default workload parameters for {activeOrganization?.name || 'this organization'}.
      </p>

      {successMsg && (
        <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo Upload */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Organization Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 overflow-hidden shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Organization Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8" />
              )}
            </div>
            <div>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors">
                <Upload className="h-4 w-4" /> Upload Logo
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
              <p className="text-[11px] text-zinc-400 mt-1">PNG, JPG or WEBP up to 5MB.</p>
            </div>
          </div>
        </div>

        {/* Organization Name */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Organization Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Zywo Labs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Display Name (White-Label Branding) */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Display Name (White-Label Branding)
          </label>
          <input
            type="text"
            placeholder="e.g. Zywo Agency (Leave empty to use Organization Name)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-zinc-400 mt-1">This display name will be reflected across workspace headers and organization switchers.</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Brief description of your organization or agency..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Weekly Capacity Hours */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Default Member Weekly Capacity (Hours)
          </label>
          <input
            type="number"
            min={1}
            max={168}
            value={weeklyCapacityHours}
            onChange={(e) => setWeeklyCapacityHours(Number(e.target.value))}
            className="w-full sm:w-48 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Saving Changes...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};
