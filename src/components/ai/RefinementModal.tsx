import React from 'react';
import { Wand2, Check, Plus, CopyPlus, X } from 'lucide-react';

interface RefinementModalProps {
  originalText: string;
  refinedText: string;
  explanationOfChanges?: string;
  onReplaceOriginal: () => void;
  onInsertAsNewTextBox: () => void;
  onAddAsNewPage: () => void;
  onDiscard: () => void;
}

export const RefinementModal: React.FC<RefinementModalProps> = ({
  originalText,
  refinedText,
  explanationOfChanges,
  onReplaceOriginal,
  onInsertAsNewTextBox,
  onAddAsNewPage,
  onDiscard,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Review AI Note Refinement
              </h3>
              <p className="text-[11px] text-slate-500">
                Side-by-side comparison. Original notes are never modified without confirmation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comparison Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original */}
            <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Original Notes
              </span>
              <div className="flex-1 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {originalText || '(No previous text)'}
              </div>
            </div>

            {/* AI Suggestion */}
            <div className="flex flex-col border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 bg-indigo-50/30 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  AI Suggestion (Grounded)
                </span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                  Ready
                </span>
              </div>
              <div className="flex-1 text-xs text-slate-900 dark:text-slate-100 whitespace-pre-wrap font-sans leading-relaxed">
                {refinedText}
              </div>
            </div>
          </div>

          {explanationOfChanges && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Changes Summary: </span>
              {explanationOfChanges}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition font-medium"
          >
            Discard
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onInsertAsNewTextBox}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Insert as New Text Box
            </button>

            <button
              type="button"
              onClick={onAddAsNewPage}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition"
            >
              <CopyPlus className="w-3.5 h-3.5" />
              Add as New Page
            </button>

            <button
              type="button"
              onClick={onReplaceOriginal}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
            >
              <Check className="w-3.5 h-3.5" />
              Replace Original (Undoable)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
