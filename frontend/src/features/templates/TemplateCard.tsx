import React from 'react';
import {
  Package,
  Layout,
  Video,
  Globe,
  ShoppingBag,
  Sparkles,
  Clapperboard,
  Compass,
  Target,
  Microscope,
  TrendingUp,
  Search,
  Share2,
  Folder,
  Eye,
  CheckCircle2,
  Code,
  Smartphone,
  Layers
} from 'lucide-react';
import type { ProjectTemplate } from '../../types';

interface TemplateCardProps {
  template: ProjectTemplate;
  onPreview: (template: ProjectTemplate) => void;
  onUse: (template: ProjectTemplate) => void;
}

const getTemplateIcon = (iconName?: string | null) => {
  switch (iconName) {
    case 'code':
      return <Code className="h-5 w-5 text-blue-500 dark:text-blue-400" />;
    case 'smartphone':
      return <Smartphone className="h-5 w-5 text-purple-500 dark:text-purple-400" />;
    case 'layers':
      return <Layers className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />;
    case 'package':
      return <Package className="h-5 w-5 text-blue-500 dark:text-blue-400" />;
    case 'layout':
      return <Layout className="h-5 w-5 text-purple-500 dark:text-purple-400" />;
    case 'video':
      return <Video className="h-5 w-5 text-rose-500 dark:text-rose-400" />;
    case 'globe':
      return <Globe className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />;
    case 'shopping-bag':
      return <ShoppingBag className="h-5 w-5 text-amber-500 dark:text-amber-400" />;
    case 'sparkles':
      return <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />;
    case 'clapperboard':
      return <Clapperboard className="h-5 w-5 text-red-500 dark:text-red-400" />;
    case 'compass':
      return <Compass className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />;
    case 'target':
      return <Target className="h-5 w-5 text-orange-500 dark:text-orange-400" />;
    case 'microscope':
      return <Microscope className="h-5 w-5 text-teal-500 dark:text-teal-400" />;
    case 'trending-up':
      return <TrendingUp className="h-5 w-5 text-green-500 dark:text-green-400" />;
    case 'search':
      return <Search className="h-5 w-5 text-sky-500 dark:text-sky-400" />;
    case 'share-2':
      return <Share2 className="h-5 w-5 text-pink-500 dark:text-pink-400" />;
    default:
      return <Folder className="h-5 w-5 text-blue-500 dark:text-blue-400" />;
  }
};

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onPreview,
  onUse
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 shadow-sm hover:shadow group">
      <div>
        {/* Header Badge & Icon */}
        <div className="flex items-center justify-between mb-3">
          <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl group-hover:scale-105 transition-transform duration-200">
            {getTemplateIcon(template.icon)}
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
            {template.industry_name}
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {template.name}
        </h3>
        {template.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
            {template.description}
          </p>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span>{template.task_count} Tasks</span>
          <span>•</span>
          <span>{template.subtask_count} Subtasks</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPreview(template)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 rounded-xl transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview</span>
          </button>
          <button
            type="button"
            onClick={() => onUse(template)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-black dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl transition-colors shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Use Template</span>
          </button>
        </div>
      </div>
    </div>
  );
};
