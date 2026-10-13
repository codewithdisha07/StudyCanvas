import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  FileDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Check,
  X,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import type { Page, Project } from '../../types';
import { exportProjectToPDF } from '../../export/pdfExporter';

interface PageSidebarProps {
  project: Project;
  pages: Page[];
  currentPageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onRenamePage: (pageId: string, newTitle: string) => void;
  onDeletePage: (pageId: string) => void;
  onReorderPages: (newOrder: string[]) => void;
  onBackToProjects: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const PageSidebar: React.FC<PageSidebarProps> = ({
  project,
  pages,
  currentPageId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onReorderPages,
  onBackToProjects,
  isCollapsed,
  onToggleCollapse,
}) => {
  // Editing page title state
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Delete confirmation modal state
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);

  // Drag and drop state
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  const startRename = (page: Page) => {
    setEditingPageId(page.id);
    setEditingTitle(page.title);
  };

  const saveRename = (pageId: string) => {
    if (editingTitle.trim()) {
      onRenamePage(pageId, editingTitle.trim());
    }
    setEditingPageId(null);
  };

  const handleDragStart = (e: React.DragEvent, pageId: string) => {
    setDraggedPageId(pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPageId: string) => {
    e.preventDefault();
    if (!draggedPageId || draggedPageId === targetPageId) return;

    const currentOrder = pages.map((p) => p.id);
    const fromIndex = currentOrder.indexOf(draggedPageId);
    const toIndex = currentOrder.indexOf(targetPageId);
    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    onReorderPages(newOrder);
    setDraggedPageId(null);
  };

  const handleExportPDF = async (onlyCurrent: boolean) => {
    try {
      setIsExporting(true);
      const currentIndex = pages.findIndex((p) => p.id === currentPageId);
      await exportProjectToPDF({
        projectTitle: project.title,
        pages,
        exportOnlyCurrentPage: onlyCurrent,
        currentPageIndex: Math.max(0, currentIndex),
        onProgress: (current, total) => setExportProgress({ current, total }),
      });
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  if (isCollapsed) {
    return (
      <div className="h-full z-20 flex flex-col items-center py-3 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 transition-all">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Pages Sidebar"
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onBackToProjects}
            title="Back to Projects"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 rotate-90 mt-6 tracking-wide uppercase">
            Pages ({pages.length})
          </span>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-72 h-full z-20 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            type="button"
            onClick={onBackToProjects}
            title="Projects Home"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="truncate">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={project.title}>
              {project.title}
            </h2>
            <p className="text-[10px] text-slate-400">{pages.length} Pages</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse Sidebar"
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {pages.map((p, idx) => {
          const isActive = p.id === currentPageId;
          const isRenaming = editingPageId === p.id;

          return (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => handleDragStart(e, p.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, p.id)}
              onClick={() => onSelectPage(p.id)}
              className={`group relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Drag Handle */}
              <div
                title="Drag to reorder"
                className="opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-400 -ml-0.5"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              {/* Page Number & Thumbnail Preview */}
              <div className="w-12 h-16 rounded-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <Layers className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                )}
                <span className="absolute bottom-0 right-0 bg-slate-800/70 text-white text-[9px] px-1 rounded-tl font-mono">
                  {idx + 1}
                </span>
              </div>

              {/* Title & Actions */}
              <div className="flex-1 min-w-0 pr-1">
                {isRenaming ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(p.id);
                        if (e.key === 'Escape') setEditingPageId(null);
                      }}
                      className="w-full text-xs px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-indigo-400 rounded outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => saveRename(p.id)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPageId(null)}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {p.title}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                      <button
                        type="button"
                        title="Rename page"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(p);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {pages.length > 1 && (
                        <button
                          type="button"
                          title="Delete page"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingPageId(p.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  <span>{p.strokes.length} strokes</span>
                  <span>•</span>
                  <span>{p.textBoxes.length} text</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer: Add Page & PDF Export */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={onAddPage}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          Add Page
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExportPDF(false)}
            title="Export All Pages in Order to PDF"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-500" />
            Full PDF
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExportPDF(true)}
            title="Export Current Page Only"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-400" />
            Page PDF
          </button>
        </div>

        {isExporting && exportProgress && (
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-center">
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
              Generating High-Res PDF ({exportProgress.current}/{exportProgress.total})...
            </span>
            <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-200"
                style={{
                  width: `${(exportProgress.current / exportProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Page?</h3>
            <p className="text-xs text-slate-500 mt-1.5">
              This will remove the selected page, all vector strokes, and notes. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeletingPageId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePage(deletingPageId);
                  setDeletingPageId(null);
                }}
                className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
              >
                Delete Page
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
