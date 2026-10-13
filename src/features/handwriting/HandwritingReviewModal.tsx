import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Plus,
  RefreshCw,
  X,
  Sparkles,
  Layers,
  Pencil,
} from 'lucide-react';
import type { Page, SelectionRect } from '../../types';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { transcribeHandwriting, type HandwritingResponse, type TranscriptionBlock } from '../../ai/aiClient';
import { awardXpEvent } from '../../db';

interface HandwritingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: Page;
  selectionRect: SelectionRect | null;
  onInsertTextBoxes: (blocks: TranscriptionBlock[]) => void;
  onAddNewPage: (title: string, text: string) => void;
  onReplaceStrokesWithText: (blocks: TranscriptionBlock[]) => void;
}

export const HandwritingReviewModal: React.FC<HandwritingReviewModalProps> = ({
  isOpen,
  onClose,
  page,
  selectionRect,
  onInsertTextBoxes,
  onAddNewPage,
  onReplaceStrokesWithText,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [result, setResult] = useState<HandwritingResponse | null>(null);
  const [blocks, setBlocks] = useState<TranscriptionBlock[]>([]);
  const [copied, setCopied] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && page) {
      handlePerformTranscription();
    }
  }, [isOpen, page?.id]);

  const handlePerformTranscription = async () => {
    setIsLoading(true);
    setShowReplaceConfirm(false);

    try {
      const context = await buildGroundedContext({
        pages: [page],
        currentPageId: page.id,
        scope: selectionRect ? 'selection' : 'current',
        selectionRect,
      });

      if (context.images && context.images[0]?.dataUrl) {
        setSnapshotUrl(context.images[0].dataUrl);
      }

      const res = await transcribeHandwriting(context);
      setResult(res);
      setBlocks(res.blocks || []);

      // Award XP for using handwriting tool
      awardXpEvent({
        type: 'voice_or_handwriting',
        amount: 25,
        description: 'Transcribed handwritten canvas strokes with AI',
        referenceId: page.id,
      });
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlockTextChange = (index: number, newText: string) => {
    setBlocks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text: newText };
      return updated;
    });
  };

  const fullTranscribedText = blocks.map((b) => b.text).join('\n\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullTranscribedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/80 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Convert Handwriting to Typed Text
              </h2>
              <p className="text-xs text-slate-500">
                AI Vision transcription with confidence verification • {selectionRect ? 'Selected Area' : `Page ${page.pageNumber}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Side-by-side view */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Original Image Snapshot */}
          <div className="w-full md:w-1/2 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-950/50">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <span>Original Canvas Handwriting</span>
            </span>

            <div className="flex-1 min-h-[250px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center p-2 relative shadow-inner">
              {snapshotUrl ? (
                <img
                  src={snapshotUrl}
                  alt="Original Canvas Stroke Snapshot"
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-center p-4 text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse" />
                  <p className="text-xs">Preparing vector canvas snapshot...</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Editable Transcription */}
          <div className="w-full md:w-1/2 p-4 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Editable Transcription Review
              </span>
              <button
                type="button"
                onClick={handlePerformTranscription}
                disabled={isLoading}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Re-analyze
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <Sparkles className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Transcribing handwriting...
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Running multimodal recognition on your handwritten strokes and diagrams.
                </p>
              </div>
            ) : result && !result.isLegible ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2 font-medium text-sm mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Handwriting is ambiguous or illegible
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {result.legibilityNote || "The AI could not clearly resolve the strokes on this page. Strict Grounding prevents guessing."}
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3">
                {blocks.map((block, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-1.5 text-[10px]">
                      <span className="font-semibold uppercase tracking-wider text-slate-400">
                        {block.type}
                      </span>
                      <div className="flex items-center gap-2">
                        {block.confidence < 0.85 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-medium">
                            Check confidence ({Math.round(block.confidence * 100)}%)
                          </span>
                        )}
                        {block.uncertainWords.length > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            Uncertain: {block.uncertainWords.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={block.text}
                      onChange={(e) => handleBlockTextChange(idx, e.target.value)}
                      rows={block.text.length > 80 ? 3 : 2}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Banner for Destructive 'Replace' Action */}
        {showReplaceConfirm && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border-t border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>
                Replace will remove handwritten strokes on this page and replace them with formatted typed text boxes. You can undo this using Ctrl+Z.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReplaceConfirm(false)}
                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onReplaceStrokesWithText(blocks);
                  onClose();
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-xs transition"
              >
                Confirm Replace
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy All'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onInsertTextBoxes(blocks);
                onClose();
              }}
              disabled={blocks.length === 0}
              className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              Insert as Text Boxes
            </button>

            <button
              type="button"
              onClick={() => {
                onAddNewPage(`Transcribed: ${page.title}`, fullTranscribedText);
                onClose();
              }}
              disabled={blocks.length === 0}
              className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-40"
            >
              <Layers className="w-3.5 h-3.5" />
              Add as New Page
            </button>

            <button
              type="button"
              onClick={() => setShowReplaceConfirm(true)}
              disabled={blocks.length === 0}
              className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-xl transition disabled:opacity-40"
            >
              Replace Handwriting (Undoable)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
