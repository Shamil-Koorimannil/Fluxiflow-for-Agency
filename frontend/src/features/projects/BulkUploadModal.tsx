import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { X, Download, Upload, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface ValidationResponse {
  success: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
  total_rows: number;
  tasks_count: number;
  subtasks_count: number;
  duplicate_count?: number;
  tasks: any[];
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Download template mutation
  const downloadTemplate = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/tasks/bulk-template/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fluxiflow_template_${projectName.replace(/\s+/g, '_').toLowerCase()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to download template. Please try again.');
    }
  };

  // Upload and Validate mutation
  const validateMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`/projects/${projectId}/tasks/bulk-import/validate/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data as ValidationResponse;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setStep(2);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Validation failed. Please check your file format.');
    },
  });

  // Confirm Import mutation
  const confirmMutation = useMutation({
    mutationFn: async (tasks: any[]) => {
      const response = await api.post(`/projects/${projectId}/tasks/bulk-import/confirm/`, { tasks });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', { project: projectId }] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['teamTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamWorkload'] });
      queryClient.invalidateQueries({ queryKey: ['employee-workload'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setStep(4);
    },
    onError: (err: any) => {
      const responseData = err.response?.data;
      const finalMsg = responseData?.message || responseData?.detail || 'Unable to import tasks. Please try again. If the problem continues, contact your administrator.';
      setErrorMsg(finalMsg);
      if (responseData && Array.isArray(responseData.errors)) {
        setValidationResult(prev => prev ? { ...prev, errors: responseData.errors } : null);
      }
      setStep(2);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMsg(null);
      validateMutation.mutate(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const filenameLower = file.name.toLowerCase();
      if (filenameLower.endsWith('.xlsx') || filenameLower.endsWith('.csv')) {
        setErrorMsg(null);
        validateMutation.mutate(file);
      } else {
        setErrorMsg('Only .xlsx Excel and .csv files are supported.');
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const resetModal = () => {
    setStep(1);
    setValidationResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (validationResult && validationResult.success) {
      setErrorMsg(null);
      setStep(3);
      confirmMutation.mutate(validationResult.tasks);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-2xl w-full p-6 shadow-lg relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 text-black dark:text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-900 mb-4">
          <div>
            <h3 className="font-bold text-base text-black dark:text-white">
              Bulk Task Import
            </h3>
            <p className="text-xs text-zinc-555 dark:text-zinc-400">
              Import multiple tasks and subtasks into <span className="font-semibold">{projectName}</span>.
            </p>
          </div>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            disabled={validateMutation.isPending || confirmMutation.isPending}
            className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/50 p-3 text-xs font-semibold text-red-650 dark:text-red-400 flex items-start gap-2 animate-slide-up">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* STEP 1: Download & Upload */}
        {step === 1 && (
          <div className="space-y-6 flex-1">
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
                  Step 1: Download Official Template
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Generate a fresh template formatted with active project team members, priorities, and statuses.
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-150 dark:text-black font-semibold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download Template
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455 dark:text-zinc-500">
                Step 2: Upload Excel Spreadsheet
              </h4>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white rounded-xl p-8 text-center cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col items-center justify-center gap-3 ${
                  validateMutation.isPending ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.csv"
                  className="hidden"
                />
                {validateMutation.isPending ? (
                  <>
                    <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
                    <p className="text-xs font-medium text-zinc-650 dark:text-zinc-350">
                      Reading file and running validation tests...
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-zinc-400" />
                    <div>
                      <p className="text-xs font-bold">
                        Drag and drop your spreadsheet here, or <span className="underline text-black dark:text-white">browse</span>
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Only official Fluxiflow .xlsx or .csv template files are supported. Max 5MB file size.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Validation Results & Preview */}
        {step === 2 && validationResult && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl select-none">
              <div className="text-center">
                <div className="text-lg font-bold text-black dark:text-white">
                  {validationResult.total_rows}
                </div>
                <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">
                  Total Rows
                </div>
              </div>
              <div className="text-center border-l border-zinc-200 dark:border-zinc-800">
                <div className="text-lg font-bold text-black dark:text-white">
                  {validationResult.tasks_count}
                </div>
                <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">
                  Tasks
                </div>
              </div>
              <div className="text-center border-l border-zinc-200 dark:border-zinc-800">
                <div className={`text-lg font-bold ${validationResult.errors.length > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                  {validationResult.errors.length}
                </div>
                <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">
                  Errors
                </div>
              </div>
              <div className="text-center border-l border-zinc-200 dark:border-zinc-800">
                <div className={`text-lg font-bold ${(validationResult.warnings?.length || 0) > 0 ? 'text-amber-500' : 'text-zinc-400'}`}>
                  {validationResult.warnings?.length || 0}
                </div>
                <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">
                  Warnings
                </div>
              </div>
            </div>

            {/* Warning banner for internal file duplicate rows */}
            {validationResult.duplicate_count !== undefined && validationResult.duplicate_count > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/50 p-3 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-start gap-2 animate-slide-up">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  This file contains {validationResult.duplicate_count} duplicate task row(s). Do you want to continue?
                </div>
              </div>
            )}

            {/* Error view */}
            {validationResult.errors.length > 0 && (
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Please resolve errors before importing
                </h4>
                <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-y-auto max-h-[30vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800">
                        <th className="p-2 border-r border-zinc-200 dark:border-zinc-800 w-16 text-center">Row</th>
                        <th className="p-2 border-r border-zinc-200 dark:border-zinc-800 w-28">Field</th>
                        <th className="p-2 border-r border-zinc-200 dark:border-zinc-800 w-28">Invalid Value</th>
                        <th className="p-2">Description & Correction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.errors.map((err, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-zinc-150 dark:border-zinc-850 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20"
                        >
                          <td className="p-2 border-r border-zinc-200 dark:border-zinc-800 text-center font-semibold">{err.row}</td>
                          <td className="p-2 border-r border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300">{err.field}</td>
                          <td className="p-2 border-r border-zinc-200 dark:border-zinc-800 text-red-500 truncate max-w-27.5" title={err.value}>
                            {err.value === null || err.value === "" ? <span className="italic text-zinc-400">(empty)</span> : err.value}
                          </td>
                          <td className="p-2 text-zinc-650 dark:text-zinc-400 font-medium">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={resetModal}
                  className="w-full text-center px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg text-xs font-semibold transition-colors"
                >
                  Upload a corrected Excel sheet
                </button>
              </div>
            )}

            {validationResult.errors.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-green-50/20 dark:bg-green-950/10 border border-dashed border-green-200 dark:border-green-900/50 rounded-xl space-y-2">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <h4 className="font-bold text-sm text-green-600 dark:text-green-400">
                  Validation Successful!
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm">
                  Spreadsheet contains 0 errors. You are ready to import {validationResult.tasks_count} tasks into {projectName}.
                </p>
              </div>
            )}

            {/* Warnings list */}
            {validationResult.warnings && validationResult.warnings.length > 0 && (
              <div className="flex flex-col space-y-2 mt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-550 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Warnings (Informational only)
                </h4>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-y-auto max-h-[20vh] bg-white dark:bg-black">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800">
                        <th className="p-2 border-r border-zinc-200 dark:border-zinc-800 w-16 text-center">Row</th>
                        <th className="p-2 border-r border-zinc-200 dark:border-zinc-800 w-28">Field</th>
                        <th className="p-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.warnings.map((warn, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-zinc-150 dark:border-zinc-850 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 text-black dark:text-white"
                        >
                          <td className="p-2 border-r border-zinc-200 dark:border-zinc-800 text-center font-semibold">{warn.row}</td>
                          <td className="p-2 border-r border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300">{warn.field}</td>
                          <td className="p-2 text-zinc-650 dark:text-zinc-400 font-medium">{warn.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-150 dark:border-zinc-900">
              <button
                type="button"
                onClick={resetModal}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs font-semibold rounded-lg transition-colors"
              >
                Start Over
              </button>
              {validationResult.errors.length === 0 && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-150 dark:text-black font-semibold rounded-lg text-xs tracking-wider transition-colors flex items-center gap-1.5"
                >
                  Confirm and Import Tasks
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Progress State */}
        {step === 3 && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 flex-1">
            <Loader2 className="h-10 w-10 text-black dark:text-white animate-spin" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm">Importing Tasks...</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Running database transaction and saving tasks. This will take a moment.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Success Screen */}
        {step === 4 && (
          <div className="py-6 space-y-6 flex-1 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-base font-bold text-black dark:text-white">
                Import Complete
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tasks were successfully generated and are now live in the project.
              </p>
            </div>

            <div className="flex items-center gap-6 justify-center bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl w-full max-w-xs">
              <div className="text-center flex-1">
                <div className="text-lg font-bold text-black dark:text-white">
                  {validationResult?.tasks_count || 0}
                </div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                  Tasks Created
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                resetModal();
                onClose();
              }}
              className="w-full max-w-sm px-4 py-2.5 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-150 dark:text-black font-semibold rounded-lg text-xs tracking-wider transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
