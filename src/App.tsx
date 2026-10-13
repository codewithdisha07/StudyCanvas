import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Project,
  Page,
  ToolType,
  SelectionRect,
  TextBox,
} from './types';
import {
  getAllProjects,
  getProjectById,
  saveProject,
  deleteProject,
  getPagesForProject,
  savePage,
  deletePage,
  updatePageOrder,
  seedSampleDataIfEmpty,
} from './db';
import { renderPageOffscreen } from './canvas/CanvasEngine';
import { ProjectDashboard } from './components/projects/ProjectDashboard';
import { PageSidebar } from './components/pages/PageSidebar';
import { Toolbar } from './components/canvas/Toolbar';
import { CanvasView } from './components/canvas/CanvasView';
import { AIChatPanel } from './components/ai/AIChatPanel';
import { RefinementModal } from './components/ai/RefinementModal';
import { QuizModal } from './components/ai/QuizModal';
import { FlashcardsModal } from './components/ai/FlashcardsModal';
import { RevisionSheetModal } from './components/ai/RevisionSheetModal';
import { PersonalizedDashboardModal } from './components/ai/PersonalizedDashboardModal';
import { useTheme } from './context/ThemeContext';
import { PomodoroWidget } from './features/pomodoro/PomodoroWidget';
import { HandwritingReviewModal } from './features/handwriting/HandwritingReviewModal';
import { VoiceDictationModal } from './features/voice/VoiceDictationModal';
import { QuizBattleModal } from './features/battle/QuizBattleModal';
import { FeynmanModal } from './features/feynman/FeynmanModal';
import { MindMapModal } from './features/mindmap/MindMapModal';
import { ExamPlannerModal } from './features/planner/ExamPlannerModal';
import { CanvasReaderBar } from './features/tts/CanvasReaderBar';
import { StudyHub } from './components/studyhub/StudyHub';
import {
  Keyboard,
  CheckCircle2,
  CloudUpload,
  Moon,
  Sun,
  X,
  LayoutDashboard,
} from 'lucide-react';

export function App() {
  // Theme context
  const { isDark, toggleTheme } = useTheme();

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectThumbnails, setProjectThumbnails] = useState<Record<string, string>>({});
  const [projectPageCounts, setProjectPageCounts] = useState<Record<string, number>>({});
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Active Project & Pages state
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string>('');

  // Canvas tool & styling state
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#0f172a');
  const [size, setSize] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [transform, setTransform] = useState({ scale: 1, panX: 0, panY: 0 });

  // Selection & External AI trigger
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [externalPrompt, setExternalPrompt] = useState<{
    prompt: string;
    action: 'explain' | 'summarize' | 'refine';
  } | null>(null);

  // Undo / Redo history stacks per page
  const historyStackRef = useRef<Record<string, Page[]>>({});
  const redoStackRef = useRef<Record<string, Page[]>>({});
  const [, setHistoryVersion] = useState(0);

  // Autosave status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI Panels state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAIPanelCollapsed, setIsAIPanelCollapsed] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Modal Dialogs state
  const [refinementData, setRefinementData] = useState<{
    original: string;
    refined: string;
    notes?: string;
  } | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showFlashcardsModal, setShowFlashcardsModal] = useState(false);
  const [showRevisionSheetModal, setShowRevisionSheetModal] = useState(false);
  const [showPersonalizedDashboard, setShowPersonalizedDashboard] = useState(false);

  // Phase 5, 6, 7 New Feature & Screen States
  const [showStudyHub, setShowStudyHub] = useState(false);
  const [showHandwritingModal, setShowHandwritingModal] = useState(false);
  const [showVoiceDictationModal, setShowVoiceDictationModal] = useState(false);
  const [showFeynmanModal, setShowFeynmanModal] = useState(false);
  const [feynmanInitialTopic, setFeynmanInitialTopic] = useState('');
  const [showMindMapModal, setShowMindMapModal] = useState(false);
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [showExamPlannerModal, setShowExamPlannerModal] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showCanvasReaderBar, setShowCanvasReaderBar] = useState(false);

  // Initial Load & Seeding
  useEffect(() => {
    async function init() {
      await seedSampleDataIfEmpty();
      await loadProjectList();
    }
    init();
  }, []);

  const loadProjectList = async () => {
    const list = await getAllProjects();
    setProjects(list);

    // Load first page thumbnails and page counts
    const thumbs: Record<string, string> = {};
    const counts: Record<string, number> = {};
    for (const p of list) {
      counts[p.id] = p.pageOrder?.length || 1;
      const pPages = await getPagesForProject(p.id);
      if (pPages.length > 0) {
        if (pPages[0].thumbnail) {
          thumbs[p.id] = pPages[0].thumbnail;
        } else {
          // Generate quick thumbnail
          const thumbCanvas = renderPageOffscreen(pPages[0], 400, 533, 0.5, false);
          thumbs[p.id] = thumbCanvas.toDataURL('image/jpeg', 0.8);
        }
      }
    }
    setProjectThumbnails(thumbs);
    setProjectPageCounts(counts);
  };

  // Open a project
  const handleSelectProject = async (projId: string) => {
    const proj = await getProjectById(projId);
    if (!proj) return;

    setActiveProject(proj);
    setActiveProjectId(projId);

    const projPages = await getPagesForProject(projId);
    setPages(projPages);

    if (projPages.length > 0) {
      setCurrentPageId(projPages[0].id);
    }
    setTransform({ scale: 1, panX: 0, panY: 0 });
    setSelectionRect(null);
  };

  const currentPage = pages.find((p) => p.id === currentPageId) || pages[0];

  // History helpers
  const pushHistory = useCallback(
    (pageToSave: Page) => {
      const pageId = pageToSave.id;
      if (!historyStackRef.current[pageId]) {
        historyStackRef.current[pageId] = [];
      }
      historyStackRef.current[pageId].push(JSON.parse(JSON.stringify(pageToSave)));
      redoStackRef.current[pageId] = []; // Clear redo stack on new action
      setHistoryVersion((v) => v + 1);
    },
    []
  );

  const handleUndo = () => {
    if (!currentPage) return;
    const pageId = currentPage.id;
    const stack = historyStackRef.current[pageId];
    if (!stack || stack.length === 0) return;

    const previousState = stack.pop()!;
    if (!redoStackRef.current[pageId]) {
      redoStackRef.current[pageId] = [];
    }
    redoStackRef.current[pageId].push(JSON.parse(JSON.stringify(currentPage)));

    setPages((prev) => prev.map((p) => (p.id === pageId ? previousState : p)));
    setHistoryVersion((v) => v + 1);
    scheduleAutosave(previousState);
  };

  const handleRedo = () => {
    if (!currentPage) return;
    const pageId = currentPage.id;
    const stack = redoStackRef.current[pageId];
    if (!stack || stack.length === 0) return;

    const nextState = stack.pop()!;
    if (!historyStackRef.current[pageId]) {
      historyStackRef.current[pageId] = [];
    }
    historyStackRef.current[pageId].push(JSON.parse(JSON.stringify(currentPage)));

    setPages((prev) => prev.map((p) => (p.id === pageId ? nextState : p)));
    setHistoryVersion((v) => v + 1);
    scheduleAutosave(nextState);
  };

  const canUndo = Boolean(historyStackRef.current[currentPage?.id]?.length);
  const canRedo = Boolean(redoStackRef.current[currentPage?.id]?.length);

  // Debounced Autosave (800ms) with thumbnail generation
  const scheduleAutosave = useCallback(
    (pageToSave: Page) => {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // Generate thumbnail
          const thumbCanvas = renderPageOffscreen(pageToSave, 400, 533, 0.5, false);
          const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);

          const updatedPage = {
            ...pageToSave,
            thumbnail: thumbUrl,
            updatedAt: Date.now(),
          };

          await savePage(updatedPage);
          setSaveStatus('saved');

          // Update in-memory thumbnail
          setPages((prev) =>
            prev.map((p) => (p.id === pageToSave.id ? { ...p, thumbnail: thumbUrl } : p))
          );
        } catch (err) {
          console.error('Autosave error:', err);
          setSaveStatus('saved');
        }
      }, 800);
    },
    []
  );

  const handleUpdatePage = (newPage: Page) => {
    setPages((prev) => prev.map((p) => (p.id === newPage.id ? newPage : p)));
    scheduleAutosave(newPage);
  };

  // Keyboard Shortcuts (P, H, E, T, S, Ctrl+Z, Ctrl+Shift+Z, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        setCurrentTool('pen');
      } else if (e.key === 'h' || e.key === 'H') {
        setCurrentTool('highlighter');
      } else if (e.key === 'e' || e.key === 'E') {
        setCurrentTool('eraser');
      } else if (e.key === 't' || e.key === 'T') {
        setCurrentTool('text');
      } else if (e.key === 's' || e.key === 'S') {
        setCurrentTool('select');
      } else if (e.key === ' ') {
        setCurrentTool('pan');
      } else if (e.key === 'Escape') {
        setSelectionRect(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Project Management operations
  const handleCreateProject = async (title: string) => {
    const newId = `proj-${Date.now()}`;
    const pageId = `page-${Date.now()}`;

    const newProject: Project = {
      id: newId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageOrder: [pageId],
    };

    const initialPage: Page = {
      id: pageId,
      projectId: newId,
      title: 'Page 1',
      strokes: [],
      textBoxes: [],
      background: 'grid',
      updatedAt: Date.now(),
    };

    await saveProject(newProject);
    await savePage(initialPage);
    await loadProjectList();
    handleSelectProject(newId);
  };

  const handleRenameProject = async (projId: string, newTitle: string) => {
    const proj = await getProjectById(projId);
    if (!proj) return;
    const updated = { ...proj, title: newTitle, updatedAt: Date.now() };
    await saveProject(updated);
    if (activeProject?.id === projId) {
      setActiveProject(updated);
    }
    loadProjectList();
  };

  const handleDuplicateProject = async (projId: string) => {
    const orig = await getProjectById(projId);
    if (!orig) return;
    const origPages = await getPagesForProject(projId);

    const dupId = `proj-${Date.now()}`;
    const newOrder: string[] = [];

    const dupProject: Project = {
      id: dupId,
      title: `${orig.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageOrder: [],
    };

    for (const p of origPages) {
      const newPageId = `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      newOrder.push(newPageId);
      await savePage({
        ...p,
        id: newPageId,
        projectId: dupId,
        updatedAt: Date.now(),
      });
    }

    dupProject.pageOrder = newOrder;
    await saveProject(dupProject);
    loadProjectList();
  };

  const handleDeleteProject = async (projId: string) => {
    await deleteProject(projId);
    if (activeProjectId === projId) {
      setActiveProjectId(null);
      setActiveProject(null);
    }
    loadProjectList();
  };

  // Page Operations
  const handleAddPage = async () => {
    if (!activeProject) return;
    const newPageId = `page-${Date.now()}`;
    const newPageNum = pages.length + 1;

    const newPage: Page = {
      id: newPageId,
      projectId: activeProject.id,
      title: `Page ${newPageNum}`,
      strokes: [],
      textBoxes: [],
      background: currentPage ? currentPage.background : 'grid',
      updatedAt: Date.now(),
    };

    await savePage(newPage);
    const newOrder = [...activeProject.pageOrder, newPageId];
    await updatePageOrder(activeProject.id, newOrder);

    setActiveProject({ ...activeProject, pageOrder: newOrder });
    setPages((prev) => [...prev, newPage]);
    setCurrentPageId(newPageId);
    setTransform({ scale: 1, panX: 0, panY: 0 });
  };

  const handleRenamePage = async (pageId: string, newTitle: string) => {
    const p = pages.find((item) => item.id === pageId);
    if (!p) return;
    const updated = { ...p, title: newTitle, updatedAt: Date.now() };
    await savePage(updated);
    setPages((prev) => prev.map((item) => (item.id === pageId ? updated : item)));
  };

  const handleDeletePage = async (pageId: string) => {
    if (!activeProject || pages.length <= 1) return;
    await deletePage(activeProject.id, pageId);

    const remaining = pages.filter((p) => p.id !== pageId);
    const newOrder = activeProject.pageOrder.filter((id) => id !== pageId);

    setActiveProject({ ...activeProject, pageOrder: newOrder });
    setPages(remaining);

    if (currentPageId === pageId) {
      setCurrentPageId(remaining[0].id);
    }
  };

  const handleReorderPages = async (newOrder: string[]) => {
    if (!activeProject) return;
    await updatePageOrder(activeProject.id, newOrder);
    setActiveProject({ ...activeProject, pageOrder: newOrder });

    // Reorder pages in state
    const pageMap = new Map(pages.map((p) => [p.id, p]));
    const ordered = newOrder.map((id) => pageMap.get(id)!).filter(Boolean);
    setPages(ordered);
  };

  // AI Insert Helpers
  const handleInsertTextBoxToCanvas = (text: string) => {
    if (!currentPage) return;
    pushHistory(currentPage);
    const newBox: TextBox = {
      id: `tb-${Date.now()}`,
      x: 100,
      y: 100,
      width: 320,
      text,
      fontSize: 16,
      color: isDark ? '#f1f5f9' : '#1e293b',
    };
    handleUpdatePage({
      ...currentPage,
      textBoxes: [...currentPage.textBoxes, newBox],
    });
  };

  const handleAddNewPageWithText = async (title: string, text: string) => {
    if (!activeProject) return;
    const newPageId = `page-${Date.now()}`;
    const newPage: Page = {
      id: newPageId,
      projectId: activeProject.id,
      title,
      strokes: [],
      textBoxes: [
        {
          id: `tb-${Date.now()}`,
          x: 80,
          y: 80,
          width: 500,
          text,
          fontSize: 16,
          color: isDark ? '#f1f5f9' : '#1e293b',
        },
      ],
      background: 'ruled',
      updatedAt: Date.now(),
    };

    await savePage(newPage);
    const newOrder = [...activeProject.pageOrder, newPageId];
    await updatePageOrder(activeProject.id, newOrder);

    setActiveProject({ ...activeProject, pageOrder: newOrder });
    setPages((prev) => [...prev, newPage]);
    setCurrentPageId(newPageId);
  };

  // Refinement Confirmation Flow (mandatory non-destructive preview)
  const handleConfirmRefineReplace = () => {
    if (!currentPage || !refinementData) return;
    pushHistory(currentPage);

    // Replace first text box or create new
    let updatedBoxes = [...currentPage.textBoxes];
    if (updatedBoxes.length > 0) {
      updatedBoxes[0] = { ...updatedBoxes[0], text: refinementData.refined };
    } else {
      updatedBoxes.push({
        id: `tb-${Date.now()}`,
        x: 80,
        y: 80,
        width: 480,
        text: refinementData.refined,
        fontSize: 16,
        color: isDark ? '#f1f5f9' : '#1e293b',
      });
    }

    handleUpdatePage({ ...currentPage, textBoxes: updatedBoxes });
    setRefinementData(null);
  };

  const handleConfirmRefineInsert = () => {
    if (!refinementData) return;
    handleInsertTextBoxToCanvas(refinementData.refined);
    setRefinementData(null);
  };

  const handleConfirmRefineAddPage = () => {
    if (!refinementData) return;
    handleAddNewPageWithText('Refined Study Notes', refinementData.refined);
    setRefinementData(null);
  };

  // Handwriting transcription actions
  const handleInsertTranscriptionBlocks = (blocks: Array<{ text: string; type: string }>) => {
    if (!currentPage) return;
    pushHistory(currentPage);
    let curY = 80;
    const newBoxes: TextBox[] = blocks.map((b, idx) => {
      const box: TextBox = {
        id: `tb-trans-${Date.now()}-${idx}`,
        x: 80,
        y: curY,
        width: 480,
        text: b.text,
        fontSize: b.type === 'heading' ? 22 : 16,
        color: isDark ? '#f1f5f9' : '#0f172a',
      };
      curY += Math.max(60, b.text.length * 0.7 + 35);
      return box;
    });
    handleUpdatePage({
      ...currentPage,
      textBoxes: [...currentPage.textBoxes, ...newBoxes],
    });
  };

  const handleReplaceStrokesWithText = (blocks: Array<{ text: string; type: string }>) => {
    if (!currentPage) return;
    pushHistory(currentPage);
    let curY = 80;
    const newBoxes: TextBox[] = blocks.map((b, idx) => {
      const box: TextBox = {
        id: `tb-rep-${Date.now()}-${idx}`,
        x: 80,
        y: curY,
        width: 480,
        text: b.text,
        fontSize: b.type === 'heading' ? 22 : 16,
        color: isDark ? '#f1f5f9' : '#0f172a',
      };
      curY += Math.max(60, b.text.length * 0.7 + 35);
      return box;
    });
    handleUpdatePage({
      ...currentPage,
      strokes: [],
      textBoxes: newBoxes,
    });
  };

  const handleInsertMindMapPage = async (title: string, _svg: string, mmNodes: Array<{ label: string; summary: string; level: number }>) => {
    const formattedText = mmNodes
      .map((n) => `${'  '.repeat(n.level)}• ${n.label}: ${n.summary}`)
      .join('\n');
    await handleAddNewPageWithText(title, formattedText);
  };

  // If Study Hub route is open
  if (showStudyHub) {
    return (
      <StudyHub
        project={activeProject}
        pages={pages}
        onBackToCanvas={() => setShowStudyHub(false)}
        onOpenMindMap={() => setShowMindMapModal(true)}
        onOpenExamPlanner={() => setShowExamPlannerModal(true)}
        onOpenFeynman={() => {
          setFeynmanInitialTopic('');
          setShowFeynmanModal(true);
        }}
        onOpenBattle={() => setShowBattleModal(true)}
        onOpenQuiz={() => setShowQuizModal(true)}
        onOpenFlashcards={() => setShowFlashcardsModal(true)}
      />
    );
  }

  // If on Project Dashboard
  if (!activeProjectId || !activeProject) {
    return (
      <ProjectDashboard
        projects={projects}
        projectThumbnails={projectThumbnails}
        projectPageCounts={projectPageCounts}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDuplicateProject={handleDuplicateProject}
        onDeleteProject={handleDeleteProject}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenStudyHub={() => setShowStudyHub(true)}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans select-none">
      {/* Left Sidebar: Pages & Thumbnails (Hidden in Focus Mode) */}
      {!isFocusMode && (
        <PageSidebar
          project={activeProject}
          pages={pages}
          currentPageId={currentPageId}
          onSelectPage={(id) => {
            setCurrentPageId(id);
            setSelectionRect(null);
          }}
          onAddPage={handleAddPage}
          onRenamePage={handleRenamePage}
          onDeletePage={handleDeletePage}
          onReorderPages={handleReorderPages}
          onBackToProjects={() => {
            setActiveProjectId(null);
            loadProjectList();
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      )}

      {/* Main Workspace */}
      <div className="flex-1 relative flex flex-col h-full overflow-hidden">
        {/* Floating Top Canvas Toolbar */}
        <Toolbar
          currentTool={currentTool}
          onSelectTool={(tool) => {
            setCurrentTool(tool);
            if (tool !== 'select') setSelectionRect(null);
          }}
          color={color}
          onChangeColor={setColor}
          size={size}
          onChangeSize={setSize}
          opacity={opacity}
          onChangeOpacity={setOpacity}
          background={currentPage ? currentPage.background : 'grid'}
          onChangeBackground={(bg) => {
            if (currentPage) {
              pushHistory(currentPage);
              handleUpdatePage({ ...currentPage, background: bg });
            }
          }}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          scale={transform.scale}
          onZoomIn={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(4, prev.scale * 1.15),
            }))
          }
          onZoomOut={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.max(0.25, prev.scale * 0.85),
            }))
          }
          onResetZoom={() => setTransform({ scale: 1, panX: 0, panY: 0 })}
          onOpenVoiceDictation={() => setShowVoiceDictationModal(true)}
          onOpenHandwritingConversion={() => setShowHandwritingModal(true)}
          onReadThisPage={() => setShowCanvasReaderBar(!showCanvasReaderBar)}
        />

        {/* Top Floating Utility Bar (Pomodoro + Study Hub) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <PomodoroWidget
            projectId={activeProject.id}
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
          />

          <button
            type="button"
            onClick={() => setShowStudyHub(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-md transition"
            title="Open Study Hub Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Study Hub</span>
          </button>
        </div>

        {/* Bottom Status & Info Bar */}
        <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2 text-xs font-medium bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
          <span className="text-slate-500 font-mono">
            Page {pages.findIndex((p) => p.id === currentPageId) + 1} of {pages.length}
          </span>
          <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-1.5">
            {saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                  Saved (IndexedDB)
                </span>
              </>
            ) : (
              <>
                <CloudUpload className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="text-amber-500 font-mono text-[11px]">Saving...</span>
              </>
            )}
          </div>
        </div>

        {/* Bottom Right Shortcuts Button & Theme Toggle */}
        <div className="absolute bottom-3 right-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>

        {/* Interactive Canvas View */}
        {currentPage && (
          <CanvasView
            page={currentPage}
            onChangePage={handleUpdatePage}
            tool={currentTool}
            color={color}
            size={size}
            opacity={opacity}
            scale={transform.scale}
            panX={transform.panX}
            panY={transform.panY}
            onChangeTransform={setTransform}
            isDark={isDark}
            selectionRect={selectionRect}
            setSelectionRect={setSelectionRect}
            pushHistory={pushHistory}
            onOpenAIWithSelection={(_rect, action) => {
              setIsAIPanelCollapsed(false);
              setExternalPrompt({
                prompt: `Analysis of selected area on Page ${
                  pages.findIndex((p) => p.id === currentPageId) + 1
                }`,
                action,
              });
            }}
            onConvertHandwriting={() => setShowHandwritingModal(true)}
          />
        )}

        {/* Floating Canvas Audio Reader Bar */}
        {showCanvasReaderBar && currentPage && (
          <CanvasReaderBar
            textBoxes={currentPage.textBoxes || []}
            onActiveTextBoxChange={(_id) => {}}
            onClose={() => setShowCanvasReaderBar(false)}
          />
        )}
      </div>

      {/* Right Sidebar: AI Study Assistant Panel (Hidden in Focus Mode) */}
      {!isFocusMode && (
        <AIChatPanel
          pages={pages}
          currentPageId={currentPageId}
          selectionRect={selectionRect}
          onNavigateToPage={(pageNum) => {
            if (pageNum >= 1 && pageNum <= pages.length) {
              setCurrentPageId(pages[pageNum - 1].id);
            }
          }}
          onInsertTextBoxToCanvas={handleInsertTextBoxToCanvas}
          onAddNewPageWithText={handleAddNewPageWithText}
          onOpenRefinementModal={(orig, ref, notes) =>
            setRefinementData({ original: orig, refined: ref, notes })
          }
          onOpenQuizModal={() => setShowQuizModal(true)}
          onOpenFlashcardsModal={() => setShowFlashcardsModal(true)}
          onOpenRevisionSheetModal={() => setShowRevisionSheetModal(true)}
          onOpenPersonalizedDashboard={() => setShowPersonalizedDashboard(true)}
          onOpenFeynmanModal={() => {
            setFeynmanInitialTopic('');
            setShowFeynmanModal(true);
          }}
          onOpenMindMapModal={() => setShowMindMapModal(true)}
          isCollapsed={isAIPanelCollapsed}
          onToggleCollapse={() => setIsAIPanelCollapsed(!isAIPanelCollapsed)}
          externalPrompt={externalPrompt}
          onClearExternalPrompt={() => setExternalPrompt(null)}
        />
      )}

      {/* Side-by-Side Content Refinement Modal */}
      {refinementData && (
        <RefinementModal
          originalText={refinementData.original}
          refinedText={refinementData.refined}
          explanationOfChanges={refinementData.notes}
          onReplaceOriginal={handleConfirmRefineReplace}
          onInsertAsNewTextBox={handleConfirmRefineInsert}
          onAddAsNewPage={handleConfirmRefineAddPage}
          onDiscard={() => setRefinementData(null)}
        />
      )}

      {/* Adaptive Quiz Modal */}
      {showQuizModal && (
        <QuizModal
          projectId={activeProject.id}
          pages={pages}
          currentPageId={currentPageId}
          onClose={() => setShowQuizModal(false)}
          onNavigateToPage={(pageNum) => {
            if (pageNum >= 1 && pageNum <= pages.length) {
              setCurrentPageId(pages[pageNum - 1].id);
            }
          }}
        />
      )}

      {/* Spaced Repetition Flashcards Modal */}
      {showFlashcardsModal && (
        <FlashcardsModal
          projectId={activeProject.id}
          pages={pages}
          currentPageId={currentPageId}
          onClose={() => setShowFlashcardsModal(false)}
          onNavigateToPage={(pageNum) => {
            if (pageNum >= 1 && pageNum <= pages.length) {
              setCurrentPageId(pages[pageNum - 1].id);
            }
          }}
        />
      )}

      {/* Smart 1-Page Revision Sheet Modal */}
      {showRevisionSheetModal && (
        <RevisionSheetModal
          projectTitle={activeProject.title}
          pages={pages}
          currentPageId={currentPageId}
          onClose={() => setShowRevisionSheetModal(false)}
          onAddAsNewPage={handleAddNewPageWithText}
        />
      )}

      {/* Personalized Learning Hub */}
      {showPersonalizedDashboard && (
        <PersonalizedDashboardModal
          projectId={activeProject.id}
          projectTitle={activeProject.title}
          pages={pages}
          onClose={() => setShowPersonalizedDashboard(false)}
          onNavigateToPage={(pageNum) => {
            if (pageNum >= 1 && pageNum <= pages.length) {
              setCurrentPageId(pages[pageNum - 1].id);
            }
          }}
          onStartAdaptiveQuiz={() => setShowQuizModal(true)}
        />
      )}

      {/* Handwriting to Typed Text Modal */}
      {showHandwritingModal && currentPage && (
        <HandwritingReviewModal
          isOpen={showHandwritingModal}
          onClose={() => setShowHandwritingModal(false)}
          page={currentPage}
          selectionRect={selectionRect}
          onInsertTextBoxes={handleInsertTranscriptionBlocks}
          onAddNewPage={handleAddNewPageWithText}
          onReplaceStrokesWithText={handleReplaceStrokesWithText}
        />
      )}

      {/* Voice Dictation Modal */}
      {showVoiceDictationModal && (
        <VoiceDictationModal
          onClose={() => setShowVoiceDictationModal(false)}
          onInsertTextBox={(text: string) => handleInsertTextBoxToCanvas(text)}
          onAddNewPage={async (_title: string, text: string) => {
            await handleAddNewPageWithText('Dictated Notes', text);
          }}
        />
      )}

      {/* Quiz Battle Multiplayer Modal */}
      {showBattleModal && (
        <QuizBattleModal
          isOpen={showBattleModal}
          onClose={() => setShowBattleModal(false)}
          pages={pages}
          currentPageId={currentPageId || ''}
        />
      )}

      {/* Feynman Teach-it-Back Modal */}
      {showFeynmanModal && (
        <FeynmanModal
          isOpen={showFeynmanModal}
          onClose={() => setShowFeynmanModal(false)}
          pages={pages}
          currentPageId={currentPageId}
          initialTopic={feynmanInitialTopic}
          onAddNotesToCanvas={(points) => {
            handleInsertTextBoxToCanvas(`### Key Insights\n${points.map((p) => `- ${p}`).join('\n')}`);
          }}
          onCreateFlashcardsFromGaps={() => setShowFlashcardsModal(true)}
        />
      )}

      {/* Interactive Mind Map Modal */}
      {showMindMapModal && (
        <MindMapModal
          isOpen={showMindMapModal}
          onClose={() => setShowMindMapModal(false)}
          pages={pages}
          currentPageId={currentPageId}
          onNavigateToPage={(pNum) => {
            if (pNum >= 1 && pNum <= pages.length) {
              setCurrentPageId(pages[pNum - 1].id);
            }
          }}
          onExplainConcept={(concept) => {
            setIsAIPanelCollapsed(false);
            setExternalPrompt({ prompt: concept, action: 'explain' });
          }}
          onInsertAsCanvasPage={handleInsertMindMapPage}
        />
      )}

      {/* Exam Countdown Planner Modal */}
      {showExamPlannerModal && (
        <ExamPlannerModal
          isOpen={showExamPlannerModal}
          onClose={() => setShowExamPlannerModal(false)}
          pages={pages}
          currentPageId={currentPageId}
          onOpenFlashcards={() => setShowFlashcardsModal(true)}
          onOpenQuiz={() => setShowQuizModal(true)}
          onOpenFeynman={(t) => {
            setFeynmanInitialTopic(t);
            setShowFeynmanModal(true);
          }}
          onOpenRevisionSheet={() => setShowRevisionSheetModal(true)}
        />
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-500">Pen Tool</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">P</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-500">Highlighter</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">H</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-500">Eraser</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">E</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-500">Text Box</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">T</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-500">Selection Lasso</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">S</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-500">Pan Canvas</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">Space</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-500">Undo</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">Ctrl + Z</kbd>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Redo</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">Ctrl + Shift + Z</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
