import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  HelpCircle,
  FileText,
  BrainCircuit,
  GraduationCap,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Copy,
  Plus,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Mic,
  MicOff,
  Network,
  BookOpen,
} from 'lucide-react';
import type { AIScope, Page, SelectionRect } from '../../types';
import {
  askAIChat,
  explainConcept,
  summarizeNotes,
  refineContent,
} from '../../ai/aiClient';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { ReadAloud } from '../../features/tts/ReadAloud';
import { useSpeechRecognition } from '../../features/voice/useSpeechRecognition';
import { STUDY_PERSONAS, getPersonaById, type StudyPersona } from '../../features/personas/personaConfig';
import { PersonaSelector } from '../../features/personas/PersonaSelector';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations: string[];
  scope: AIScope;
  isInsufficient?: boolean;
  timestamp: number;
}

interface AIChatPanelProps {
  pages: Page[];
  currentPageId: string;
  selectionRect: SelectionRect | null;
  onNavigateToPage: (pageNumber: number) => void;
  onInsertTextBoxToCanvas: (text: string) => void;
  onAddNewPageWithText: (title: string, text: string) => void;
  onOpenRefinementModal: (original: string, refined: string, notes?: string) => void;
  onOpenQuizModal: () => void;
  onOpenFlashcardsModal: () => void;
  onOpenRevisionSheetModal: () => void;
  onOpenPersonalizedDashboard: () => void;
  onOpenFeynmanModal?: () => void;
  onOpenMindMapModal?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // External prompt triggers
  externalPrompt?: { prompt: string; action: 'explain' | 'summarize' | 'refine' } | null;
  onClearExternalPrompt?: () => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  pages,
  currentPageId,
  selectionRect,
  onNavigateToPage,
  onInsertTextBoxToCanvas,
  onAddNewPageWithText,
  onOpenRefinementModal,
  onOpenQuizModal,
  onOpenFlashcardsModal,
  onOpenRevisionSheetModal,
  onOpenPersonalizedDashboard,
  onOpenFeynmanModal,
  onOpenMindMapModal,
  isCollapsed,
  onToggleCollapse,
  externalPrompt,
  onClearExternalPrompt,
}) => {
  const [scope, setScope] = useState<AIScope>(selectionRect ? 'selection' : 'current');
  const [persona, setPersona] = useState<StudyPersona>(() => {
    const saved = localStorage.getItem('studycanvas_persona');
    return saved ? getPersonaById(saved) : STUDY_PERSONAS[0];
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "👋 Hi! I'm your StudyCanvas AI assistant, strictly grounded in your notes and diagrams. Ask me questions, test your knowledge, or generate summaries!",
      citations: [],
      scope: 'current',
      timestamp: Date.now(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active quick action submenus
  const [showExplainMenu, setShowExplainMenu] = useState(false);
  const [showSummarizeMenu, setShowSummarizeMenu] = useState(false);

  // Voice Question & Auto-send countdown state
  const {
    isSupported: isVoiceSupported,
    isListening: isVoiceListening,
    transcript: voiceTranscript,
    interimTranscript: voiceInterim,
    startListening: startVoice,
    stopListening: stopVoice,
    resetTranscript: resetVoice,
  } = useSpeechRecognition();

  const [autoSendCountdown, setAutoSendCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleSelectPersona = (newPersona: StudyPersona) => {
    setPersona(newPersona);
    localStorage.setItem('studycanvas_persona', newPersona.id);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Sync scope if selectionRect changes
  useEffect(() => {
    if (selectionRect) {
      setScope('selection');
    }
  }, [selectionRect]);

  // Voice recognition effect: fill input and trigger 2s auto-send countdown
  useEffect(() => {
    if (voiceTranscript.trim()) {
      setInputPrompt(voiceTranscript.trim());
      // Trigger 2s countdown before auto-sending
      setAutoSendCountdown(2);
    }
  }, [voiceTranscript]);

  useEffect(() => {
    if (autoSendCountdown === null) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    if (autoSendCountdown === 0) {
      // Auto-send now
      handleSendPrompt(inputPrompt);
      setAutoSendCountdown(null);
      resetVoice();
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setAutoSendCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [autoSendCountdown, inputPrompt]);

  const cancelVoiceAutoSend = () => {
    setAutoSendCountdown(null);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  };

  // Handle external trigger from selection menu
  useEffect(() => {
    if (externalPrompt) {
      if (externalPrompt.action === 'explain') {
        handleExplainConcept('simple');
      } else if (externalPrompt.action === 'summarize') {
        handleSummarizeNotes('short', 'bullets');
      } else if (externalPrompt.action === 'refine') {
        handleRefineSelection();
      }
      onClearExternalPrompt?.();
    }
  }, [externalPrompt]);

  const handleSendPrompt = async (textToSend?: string) => {
    cancelVoiceAutoSend();
    const query = (textToSend || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      citations: [],
      scope,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope,
        selectionRect: scope === 'selection' ? selectionRect : null,
      });

      const response = await askAIChat(query, context, persona.promptLayer);

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        citations: response.citations || [],
        scope,
        isInsufficient: response.isInsufficient,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: '⚠️ Unable to process note request. Please ensure the study notes are not empty.',
          citations: [],
          scope,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplainConcept = async (
    level: 'simple' | 'detailed' | 'eli5' | 'analogy' = 'simple',
    customConcept?: string
  ) => {
    setShowExplainMenu(false);
    setShowSummarizeMenu(false);
    setIsLoading(true);

    const currentPage = pages.find((p) => p.id === currentPageId) || pages[0];
    const defaultTopic = currentPage ? currentPage.title : 'Key Study Concepts';
    const conceptToExplain = (customConcept || inputPrompt || defaultTopic).trim();

    // Show User Request in Chat Immediately
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: `💡 Explain: "${conceptToExplain}" (${level.toUpperCase()})`,
      citations: [],
      scope,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');

    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope,
        selectionRect: scope === 'selection' ? selectionRect : null,
      });

      const res = await explainConcept(conceptToExplain, level, context);

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: res.text,
        citations: res.citations || [],
        scope,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Explain error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Unable to explain concept. Please make sure the notes on this canvas are not empty.`,
          citations: [],
          scope,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeNotes = async (
    length: 'short' | 'medium' | 'detailed' = 'medium',
    style: 'bullets' | 'paragraph' = 'bullets'
  ) => {
    setShowSummarizeMenu(false);
    setShowExplainMenu(false);
    setIsLoading(true);

    // Show User Request in Chat Immediately
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: `📄 Summarize Notes (${scope === 'current' ? 'Current Page' : scope === 'selection' ? 'Selection' : 'Entire Project'})`,
      citations: [],
      scope,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope,
        selectionRect: scope === 'selection' ? selectionRect : null,
      });

      const res = await summarizeNotes(length, style, context);

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: res.text,
        citations: res.citations || [],
        scope,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Summarize error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Unable to summarize notes. Please ensure notes are added to this notebook.`,
          citations: [],
          scope,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefineSelection = async () => {
    setIsLoading(true);
    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope,
        selectionRect: scope === 'selection' ? selectionRect : null,
      });

      const currentPage = pages.find((p) => p.id === currentPageId);
      const originalText = currentPage?.textBoxes.map((t) => t.text).join('\n\n') || 'Study canvas concepts';

      const res = await refineContent(originalText, 'structured', context);
      onOpenRefinementModal(originalText, res.refined, res.explanationOfChanges);
    } catch (err) {
      console.error('Refine error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Clickable citation parser: turns [Page N] into interactive buttons
  const renderFormattedMessageText = (text: string) => {
    const parts = text.split(/(\[Page \d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[Page (\d+)\]/);
      if (match) {
        const pageNum = parseInt(match[1], 10);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onNavigateToPage(pageNum)}
            title={`Jump to Page ${pageNum}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded hover:bg-indigo-200 transition active:scale-95 cursor-pointer"
          >
            <Bookmark className="w-2.5 h-2.5" />
            Page {pageNum}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (isCollapsed) {
    return (
      <div className="h-full z-20 flex flex-col items-center py-3 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-12 transition-all">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand AI Assistant Panel"
          className="p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-400 rotate-90 mt-6 tracking-wide uppercase">
            AI Study Assistant
          </span>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-84 md:w-96 h-full z-20 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all select-none shadow-xl">
      {/* Header with Scope Selector and Persona Selector */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                StudyCanvas AI
                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold rounded-full">
                  Grounded
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <PersonaSelector currentPersona={persona} onSelectPersona={handleSelectPersona} />
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse Assistant"
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scope Selector: "Current page" | "Entire project" | "Selected area" */}
        <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setScope('current')}
            className={`flex-1 py-1 text-[11px] font-medium rounded-lg transition ${
              scope === 'current'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Current Page
          </button>
          <button
            type="button"
            onClick={() => setScope('project')}
            className={`flex-1 py-1 text-[11px] font-medium rounded-lg transition ${
              scope === 'project'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Entire Project
          </button>
          <button
            type="button"
            onClick={() => setScope('selection')}
            disabled={!selectionRect}
            title={selectionRect ? 'Analyze selected rectangle' : 'Draw a selection rectangle first'}
            className={`flex-1 py-1 text-[11px] font-medium rounded-lg transition disabled:opacity-40 ${
              scope === 'selection'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Selection
          </button>
        </div>
      </div>

      {/* Quick Study Action Strip */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap items-center gap-1.5 text-[11px] relative z-30">
        {/* Explain Split Button */}
        <div className="relative inline-flex rounded-lg shadow-2xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            type="button"
            onClick={() => handleExplainConcept('simple')}
            className="flex items-center gap-1 px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium rounded-l-lg transition"
            title="Explain current notes (Simple)"
          >
            <HelpCircle className="w-3 h-3 text-indigo-500" />
            Explain
          </button>
          <button
            type="button"
            onClick={() => {
              setShowExplainMenu(!showExplainMenu);
              setShowSummarizeMenu(false);
            }}
            className="px-1 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-l border-slate-200 dark:border-slate-700 rounded-r-lg transition"
            title="Choose explanation level"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          {showExplainMenu && (
            <div className="absolute top-8 left-0 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 p-1 flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleExplainConcept('simple')}
                className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => handleExplainConcept('detailed')}
                className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
              >
                Detailed
              </button>
              <button
                type="button"
                onClick={() => handleExplainConcept('eli5')}
                className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
              >
                ELI5 (5 Year Old)
              </button>
              <button
                type="button"
                onClick={() => handleExplainConcept('analogy')}
                className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
              >
                Analogy
              </button>
            </div>
          )}
        </div>

        {/* Summarize Split Button */}
        <div className="relative inline-flex rounded-lg shadow-2xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            type="button"
            onClick={() => handleSummarizeNotes('medium', 'bullets')}
            className="flex items-center gap-1 px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium rounded-l-lg transition"
            title="Summarize current notes"
          >
            <FileText className="w-3 h-3 text-indigo-500" />
            Summarize
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSummarizeMenu(!showSummarizeMenu);
              setShowExplainMenu(false);
            }}
            className="px-1 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-l border-slate-200 dark:border-slate-700 rounded-r-lg transition"
            title="Choose summary style"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSummarizeMenu && (
            <div className="absolute top-8 left-0 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 p-1 flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleSummarizeNotes('short', 'bullets')}
                className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
              >
                Short Bullets
              </button>
              <button
                type="button"
                onClick={() => handleSummarizeNotes('medium', 'bullets')}
                className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
              >
                Medium Bullets
              </button>
              <button
                type="button"
                onClick={() => handleSummarizeNotes('detailed', 'paragraph')}
                className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
              >
                Detailed Paragraph
              </button>
            </div>
          )}
        </div>

        {/* Quiz Button */}
        <button
          type="button"
          onClick={onOpenQuizModal}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition shrink-0"
        >
          <GraduationCap className="w-3 h-3 text-amber-500" />
          Quiz
        </button>

        {/* Flashcards */}
        <button
          type="button"
          onClick={onOpenFlashcardsModal}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition shrink-0"
        >
          <Layers className="w-3 h-3 text-violet-500" />
          Flashcards
        </button>

        {/* Smart Revision Sheet */}
        <button
          type="button"
          onClick={onOpenRevisionSheetModal}
          title="Smart One-Page Revision Sheet"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition shrink-0"
        >
          <FileSpreadsheet className="w-3 h-3 text-emerald-500" />
          Revision Sheet
        </button>

        {/* Recommended for You */}
        <button
          type="button"
          onClick={onOpenPersonalizedDashboard}
          title="Personalized Learning Analytics"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition shrink-0"
        >
          <BrainCircuit className="w-3 h-3 text-rose-500" />
          Personalized
        </button>

        {/* Teach it Back (Feynman Mode) */}
        {onOpenFeynmanModal && (
          <button
            type="button"
            onClick={onOpenFeynmanModal}
            title="Teach it back (Feynman Mode)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition shrink-0 font-medium"
          >
            <BookOpen className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            Teach it back
          </button>
        )}

        {/* Mind Map */}
        {onOpenMindMapModal && (
          <button
            type="button"
            onClick={onOpenMindMapModal}
            title="Generate Interactive Mind Map"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition shrink-0"
          >
            <Network className="w-3 h-3 text-cyan-500" />
            Mind Map
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : msg.isInsufficient
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-bl-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                {/* Insufficient notes indicator */}
                {msg.isInsufficient && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-1">
                    <AlertCircle className="w-3 h-3" />
                    Strict Grounding Notice
                  </div>
                )}

                <div className="whitespace-pre-wrap select-text">
                  {isUser ? msg.text : renderFormattedMessageText(msg.text)}
                </div>

                {/* Assistant actions on message */}
                {!isUser && msg.id !== 'welcome' && (
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 dark:text-slate-500 font-mono">
                        Scope: {msg.scope}
                      </span>
                      <ReadAloud text={msg.text} />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(msg.text, msg.id)}
                        title="Copy message"
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                      >
                        {copiedId === msg.id ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onInsertTextBoxToCanvas(msg.text)}
                        title="Insert into canvas as Text Box"
                        className="flex items-center gap-0.5 px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded font-medium"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Canvas
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddNewPageWithText('AI Study Summary', msg.text)}
                        title="Add as New Project Page"
                        className="flex items-center gap-0.5 px-1.5 py-0.5 text-slate-500 hover:text-indigo-600 rounded"
                      >
                        +Page
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-500">Reading canvas notes & verifying facts...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2">
        {/* Voice Auto-send Countdown Notice */}
        {autoSendCountdown !== null && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 animate-fade-in">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              Asking by voice in {autoSendCountdown}s...
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelVoiceAutoSend}
                className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSendPrompt(inputPrompt)}
                className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px] font-medium hover:bg-indigo-700"
              >
                Send Now
              </button>
            </div>
          </div>
        )}

        {/* Live Listening Indicator */}
        {isVoiceListening && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-semibold">Listening:</span>
            <span className="italic truncate flex-1">{voiceInterim || 'Speak your question...'}</span>
            <button
              type="button"
              onClick={stopVoice}
              className="text-[11px] font-medium bg-rose-200 dark:bg-rose-900 px-2 py-0.5 rounded text-rose-900 dark:text-rose-100"
            >
              Done
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask anything about your notes..."
            value={inputPrompt}
            onChange={(e) => {
              cancelVoiceAutoSend();
              setInputPrompt(e.target.value);
            }}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Voice Input Mic Button */}
          <button
            type="button"
            onClick={() => {
              if (isVoiceListening) {
                stopVoice();
              } else {
                startVoice();
              }
            }}
            disabled={isLoading || !isVoiceSupported}
            title={
              !isVoiceSupported
                ? 'Speech recognition not supported in this browser (use Chrome or Edge)'
                : isVoiceListening
                ? 'Stop listening'
                : 'Ask by Voice'
            }
            aria-label={isVoiceListening ? 'Stop listening' : 'Ask by Voice'}
            className={`p-2 rounded-xl border transition ${
              isVoiceListening
                ? 'bg-rose-600 border-rose-600 text-white animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 disabled:opacity-40'
            }`}
          >
            {isVoiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white shadow-xs transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
};
