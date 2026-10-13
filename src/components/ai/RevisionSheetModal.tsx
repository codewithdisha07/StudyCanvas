import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Download,
  Plus,
  X,
  BookOpen,
  HelpCircle,
  FileText,
} from 'lucide-react';
import type { Page } from '../../types';
import { generateRevisionSheet, type RevisionSheetResponse } from '../../ai/aiClient';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { jsPDF } from 'jspdf';

interface RevisionSheetModalProps {
  projectTitle: string;
  pages: Page[];
  currentPageId: string;
  onClose: () => void;
  onAddAsNewPage: (title: string, text: string) => void;
}

export const RevisionSheetModal: React.FC<RevisionSheetModalProps> = ({
  projectTitle,
  pages,
  currentPageId,
  onClose,
  onAddAsNewPage,
}) => {
  const [sheet, setSheet] = useState<RevisionSheetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope: 'project',
      });

      const res = await generateRevisionSheet(context);
      setSheet(res);
    } catch (err) {
      console.error('Revision sheet error:', err);
      alert('Failed to generate revision sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!sheet) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    // Title & Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(sheet.title || 'Smart Revision Sheet', 40, 50);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Project: ${projectTitle} • Synthesized by StudyCanvas AI`, 40, 70);

    let curY = 100;

    // Key Concepts
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text('KEY CONCEPTS & DEFINITIONS', 40, curY);
    curY += 18;

    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    sheet.keyConcepts.forEach((kc) => {
      const lines = doc.splitTextToSize(kc, pw - 80);
      doc.text(lines, 40, curY);
      curY += lines.length * 13 + 4;
    });

    curY += 10;
    // Formulas
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text('FORMULAS & RELATIONS', 40, curY);
    curY += 18;

    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    sheet.formulas.forEach((f) => {
      const lines = doc.splitTextToSize(f, pw - 80);
      doc.text(lines, 40, curY);
      curY += lines.length * 13 + 4;
    });

    curY += 10;
    // Exam Questions
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text('HIGH-YIELD EXAM QUESTIONS', 40, curY);
    curY += 18;

    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    sheet.examQuestions.forEach((q) => {
      const lines = doc.splitTextToSize(q, pw - 80);
      doc.text(lines, 40, curY);
      curY += lines.length * 13 + 4;
    });

    doc.save(`${projectTitle.replace(/\s+/g, '_')}_Revision_Sheet.pdf`);
  };

  const handleAppendToCanvas = () => {
    if (!sheet) return;
    const compiled = `### ${sheet.title}
${sheet.summary}

**Key Concepts**:
${sheet.keyConcepts.join('\n')}

**Formulas & Relations**:
${sheet.formulas.join('\n')}

**High-Yield Exam Questions**:
${sheet.examQuestions.join('\n')}`;

    onAddAsNewPage('One-Page Revision Sheet', compiled);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Smart One-Page Revision Sheet
              </h3>
              <p className="text-[11px] text-slate-500">
                Synthesizes the entire notebook into an exam-ready cheat sheet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!sheet ? (
            <div className="text-center py-10 space-y-3">
              <BookOpen className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Generate Instant Revision Summary
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Consolidates formulas, definitions, and high-yield test items from all {pages.length} pages into a 1-page document.
              </p>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGenerate}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md transition"
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Synthesizing Notes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate 1-Page Sheet
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60">
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  {sheet.title}
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  {sheet.summary}
                </p>
              </div>

              {/* Key Concepts */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 bg-slate-50/40 dark:bg-slate-800/20">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Key Concepts & Definitions
                </span>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pl-2">
                  {sheet.keyConcepts.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Formulas */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 bg-slate-50/40 dark:bg-slate-800/20">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Formulas & Relations
                </span>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pl-2 font-mono">
                  {sheet.formulas.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Exam Questions */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 bg-slate-50/40 dark:bg-slate-800/20">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  High-Yield Exam Questions
                </span>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pl-2">
                  {sheet.examQuestions.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {sheet && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <button
              type="button"
              onClick={handleGenerate}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
            >
              Regenerate
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAppendToCanvas}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add as New Page
              </button>

              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export Revision PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
