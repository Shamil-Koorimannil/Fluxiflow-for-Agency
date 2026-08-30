import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import type { ClientBrandAsset, AssetType } from '../../types';
import { api } from '../../services/api';

interface BrandAssetUploadModalProps {
  isOpen: boolean;
  clientId: string;
  onClose: () => void;
  onAssetUploaded: (asset: ClientBrandAsset) => void;
}

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'BRAND_GUIDELINES', label: 'Brand Guidelines' },
  { value: 'LOGO', label: 'Logo' },
  { value: 'LOGO_VARIATION', label: 'Logo Variation' },
  { value: 'TYPOGRAPHY', label: 'Typography' },
  { value: 'COLOR_GUIDELINES', label: 'Color Guidelines' },
  { value: 'BRAND_BOOK', label: 'Brand Book' },
  { value: 'OTHER', label: 'Other Asset' }
];

export const BrandAssetUploadModal: React.FC<BrandAssetUploadModalProps> = ({
  isOpen,
  clientId,
  onClose,
  onAssetUploaded
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('BRAND_GUIDELINES');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!name) {
        // Auto-fill asset name from file basename
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', name.trim() || selectedFile.name);
    formData.append('asset_type', assetType);
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    try {
      const res = await api.post<ClientBrandAsset>(`/clients/${clientId}/brand_assets/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onAssetUploaded(res.data);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to upload brand asset.');
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Upload Brand Asset
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* File Selector */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Select Asset File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              required
              className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
            />
          </div>

          {/* Asset Name */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Asset Title / Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary Logo Dark (SVG)"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white"
            />
          </div>

          {/* Asset Category / Type */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Asset Category
            </label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white"
            >
              {ASSET_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Primary vector logo for print and digital media..."
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white resize-none"
            />
          </div>

          {/* Footer */}
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
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>Upload Asset</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
