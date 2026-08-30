import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { KeepItem } from '../../types';
import { api } from '../../services/api';

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentFolderId?: string | null;
  onSuccess: (importedItem: KeepItem) => void;
}

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  parentFolderId,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [importedResult, setImportedResult] = useState<KeepItem | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
        setError('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.');
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError('File exceeds maximum upload limit of 10 MB.');
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setProgressStep('Uploading file...');

    const formData = new FormData();
    formData.append('file', file);
    if (parentFolderId) {
      formData.append('parent_folder', parentFolderId);
    }

    try {
      setProgressStep('Parsing workbook structure & converting sheets...');
      const response = await api.post<KeepItem>('/keep/items/upload_spreadsheet/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setProgressStep('Import complete!');
      setImportedResult(response.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to import spreadsheet. Please check the file format.';
      setError(msg);
      setIsUploading(false);
    }
  };

  const handleComplete = () => {
    if (importedResult) {
      onSuccess(importedResult);
    }
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setIsUploading(false);
    setProgressStep('');
    setError(null);
    setImportedResult(null);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
              Upload & Convert Spreadsheet
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
        <div className="p-6 space-y-5">
          {!importedResult ? (
            <>
              {/* Dropzone */}
              <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                file
                  ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50'
              }`}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <Upload className={`h-10 w-10 mb-3 ${file ? 'text-emerald-500' : 'text-zinc-400'}`} />
                {file ? (
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{file.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Click to browse or drop an Excel / CSV file
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Supports .xlsx, .xls, and .csv (Max 10 MB)
                    </p>
                  </div>
                )}
              </label>

              {/* Upload Progress */}
              {isUploading && (
                <div className="flex items-center gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-700 dark:text-blue-300 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  <span>{progressStep}</span>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            /* Success Summary View */
            <div className="space-y-4 text-center py-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h4 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                  Spreadsheet Converted Successfully!
                </h4>
                <p className="text-sm text-zinc-500 mt-1">
                  '{importedResult.name}' is now an editable Keep Spreadsheet.
                </p>
              </div>

              {/* Warnings Summary */}
              {importedResult.import_warnings && importedResult.import_warnings.length > 0 && (
                <div className="text-left bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Import Warnings:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    {importedResult.import_warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
          {!importedResult ? (
            <>
              <button
                type="button"
                onClick={() => { handleReset(); onClose(); }}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!file || isUploading}
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>Import Spreadsheet</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              className="w-full py-2.5 text-sm font-semibold bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm"
            >
              Open Spreadsheet
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
