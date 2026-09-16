import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, CheckCircle2, CornerDownRight, ListTodo, Loader2 } from 'lucide-react';
import type { ProjectTemplate } from '../../types';
import { api } from '../../services/api';

interface TemplatePreviewModalProps {
  template: ProjectTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onUse: (template: ProjectTemplate) => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  isOpen,
  onClose,
  onUse
}) => {
  const [detailTemplate, setDetailTemplate] = useState<ProjectTemplate | null>(template);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && template?.id) {
      if (template.tasks && template.tasks.length > 0) {
        setDetailTemplate(template);
      } else {
        setLoading(true);
        api.get<ProjectTemplate>(`/templates/${template.id}/`)
          .then(res => setDetailTemplate(res.data))
          .catch(() => setDetailTemplate(template))
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, template]);

  if (!isOpen || !template) return null;

  const currentTemplate = detailTemplate || template;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {currentTemplate.industry_name}
              </span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {currentTemplate.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {currentTemplate.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
              {currentTemplate.description}
            </p>
          )}

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/50 px-4 py-2.5 rounded-xl">
            <span className="flex items-center gap-1.5">
              <ListTodo className="h-4 w-4 text-zinc-400" />
              {currentTemplate.task_count} Predefined Tasks
            </span>
            <span>•</span>
            <span>{currentTemplate.subtask_count} Subtasks</span>
          </div>

          {/* Task Hierarchy Tree */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Workflow Tasks & Subtasks Hierarchy
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Loading template structure...</span>
              </div>
            ) : currentTemplate.tasks && currentTemplate.tasks.length > 0 ? (
              <div className="space-y-3">
                {currentTemplate.tasks.map((task, tIdx) => (
                  <div
                    key={task.id || tIdx}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                          {tIdx + 1}
                        </span>
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {task.name}
                        </span>
                      </div>
                      {task.priority && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {task.priority}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-7">
                        {task.description}
                      </p>
                    )}

                    {/* Subtasks List */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="ml-7 pt-2 space-y-1.5 border-t border-zinc-200/50 dark:border-zinc-800/50">
                        {task.subtasks.map((subtask, sIdx) => (
                          <div
                            key={subtask.id || sIdx}
                            className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300"
                          >
                            <CornerDownRight className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                            <span>{subtask.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-400">
                No predefined tasks found.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onUse(currentTemplate);
            }}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-black dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Use Template</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
