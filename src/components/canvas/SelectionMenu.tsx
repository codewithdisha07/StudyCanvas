import React from 'react';
import { Sparkles, HelpCircle, FileText, Wand2, Trash2, X } from 'lucide-react';
import type { SelectionRect } from '../../types';

interface SelectionMenuProps {
  rect: SelectionRect;
  scale: number;
  panX: number;
  panY: number;
  onExplain: () => void;
  onSummarize: () => void;
  onRefine: () => void;
  onConvertHandwriting?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const SelectionMenu: React.FC<SelectionMenuProps> = ({
  rect,
  scale,
  panX,
  panY,
  onExplain,
  onSummarize,
  onRefine,
  onConvertHandwriting,
  onDelete,
  onClose,
}) => {
  // Convert canvas world coordinates to screen pixel coordinates
  const screenX = rect.x * scale + panX;
  const screenY = (rect.y + rect.height) * scale + panY + 12;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${Math.max(16, screenX)}px`,
        top: `${Math.max(60, screenY)}px`,
      }}
      className="z-30 flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-800">
        <Sparkles className="w-3 h-3" />
        Selection AI
      </div>

      <button
        type="button"
        onClick={onExplain}
        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 rounded-lg transition"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Explain
      </button>

      <button
        type="button"
        onClick={onSummarize}
        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 rounded-lg transition"
      >
        <FileText className="w-3.5 h-3.5" />
        Summarize
      </button>

      <button
        type="button"
        onClick={onRefine}
        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 rounded-lg transition"
      >
        <Wand2 className="w-3.5 h-3.5" />
        Improve
      </button>

      {onConvertHandwriting && (
        <button
          type="button"
          onClick={onConvertHandwriting}
          title="Convert selection handwriting to typed text"
          className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Handwriting
        </button>
      )}

      <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5" />

      <button
        type="button"
        title="Delete selection"
        onClick={onDelete}
        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        title="Dismiss"
        onClick={onClose}
        className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
