import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Upload, X, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react';
import type { KeepItem } from '../../types';
import { api } from '../../services/api';

interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentFolderId?: string | null;
  onSuccess: (uploadedItem: KeepItem) => void;
}

export const UploadFileModal: React.FC<UploadFileModalProps> = ({
  isOpen,
  onClose,
  parentFolderId,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [convertSpreadsheet, setConvertSpreadsheet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedResult, setUploadedResult] = useState<KeepItem | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      if (!name) {
        setName(file.name);
      }
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
        setConvertSpreadsheet(true);
      } else {
        setConvertSpreadsheet(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', name.trim() || selectedFile.name);
    if (parentFolderId && parentFolderId !== 'root') {
      formData.append('parent_folder', parentFolderId);
    }

    try {
      let endpoint = '/keep/items/upload_file/';
      if (convertSpreadsheet) {
        endpoint = '/keep/items/upload_spreadsheet/';
      }

      const response = await api.post<KeepItem>(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadedResult(response.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to upload file. Please try again.';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleComplete = () => {
    if (uploadedResult) {
      onSuccess(uploadedResult);
    }
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setName('');
    setConvertSpreadsheet(false);
    setIsUploading(false);
    setError(null);
    setUploadedResult(null);
  };

  const isSpreadsheetFile = selectedFile && ['xlsx', 'xls', 'csv'].includes(selectedFile.name.split('.').pop()?.toLowerCase() || '');

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <Upload className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
              Upload File to Keep
            </h3>
          </div>
          <button
            onClick={() => { handleReset(); onClose(); }}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs">
          {!uploadedResult ? (
            <>
              {/* Dropzone / Selector */}
              <label className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-purple-500 bg-purple-50/30 dark:bg-purple-950/20'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-purple-400 bg-zinc-50 dark:bg-zinc-800/50'
              }`}>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <Upload className={`h-8 w-8 mb-2 ${selectedFile ? 'text-purple-500' : 'text-zinc-400'}`} />
                {selectedFile ? (
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{selectedFile.name}</p>
                    <p className="text-zinc-500 mt-0.5">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">
                      Click to choose or drag & drop any file
                    </p>
                    <p className="text-zinc-400 mt-1">
                      Supports PDF, Office, Images, Code, Audio, Video, Archives & more
                    </p>
                  </div>
                )}
              </label>

              {/* Title / Name Input */}
              {selectedFile && (
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Display Title / Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter file display name"
                    className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Spreadsheet Conversion Option */}
              {isSpreadsheetFile && (
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        Convert to Interactive Spreadsheet
                      </div>
                      <div className="text-zinc-500 text-[11px]">
                        Allows in-browser grid editing & multi-sheet formulas
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={convertSpreadsheet}
                    onChange={(e) => setConvertSpreadsheet(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 rounded cursor-pointer"
                  />
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            /* Success State */
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h4 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                  File Uploaded Successfully!
                </h4>
                <p className="text-zinc-500 mt-1">
                  '{uploadedResult.name}' has been added to Keep.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
          {!uploadedResult ? (
            <>
              <button
                type="button"
                onClick={() => { handleReset(); onClose(); }}
                disabled={isUploading}
                className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="px-5 py-2 font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>Upload File</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              className="w-full py-2.5 font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shadow-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
