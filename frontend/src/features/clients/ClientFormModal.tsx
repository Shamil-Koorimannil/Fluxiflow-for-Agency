import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Briefcase, AlertCircle, RefreshCw } from 'lucide-react';
import type { Client, ClientStatus } from '../../types';
import { api } from '../../services/api';
import { CustomDropdown } from '../../components/common/CustomDropdown';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientSaved: (client: Client) => void;
  initialData?: Client | null;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  onClose,
  onClientSaved,
  initialData
}) => {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ClientStatus>('ACTIVE');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setCompanyName(initialData.company_name || '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setWebsite(initialData.website || '');
      setAddress(initialData.address || '');
      setCity(initialData.city || '');
      setState(initialData.state || '');
      setCountry(initialData.country || '');
      setDescription(initialData.description || '');
      setNotes(initialData.notes || '');
      setStatus(initialData.status || 'ACTIVE');
    } else {
      setName('');
      setCompanyName('');
      setEmail('');
      setPhone('');
      setWebsite('');
      setAddress('');
      setCity('');
      setState('');
      setCountry('');
      setDescription('');
      setNotes('');
      setStatus('ACTIVE');
    }
    setErrorMessage(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Client / Company Name is required.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      company_name: companyName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      country: country.trim() || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
      status: status
    };

    try {
      let savedClient: Client;
      if (initialData) {
        const res = await api.patch<Client>(`/clients/${initialData.id}/`, payload);
        savedClient = res.data;
      } else {
        const res = await api.post<Client>('/clients/', payload);
        savedClient = res.data;
      }

      onClientSaved(savedClient);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to save client. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {initialData ? 'Edit Client' : 'New Client'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Name */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Client / Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Technologies"
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {/* Row 1: Company Legal Name & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Company Legal Name (Optional)
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp Inc."
                className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
              />
            </div>
            <div>
              <CustomDropdown
                label="Status"
                fullWidth
                value={status}
                onChange={(val) => setStatus(val as ClientStatus)}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
            </div>
          </div>

          {/* Row 2: Email & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@acme.com"
                className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Website URL
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.acme.com"
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {/* Address & City/State/Country */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Tech Boulevard, Suite 400"
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="San Francisco"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">State/Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="CA"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="USA"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description / Overview
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enterprise enterprise client overview..."
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>{initialData ? 'Save Changes' : 'Create Client'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
