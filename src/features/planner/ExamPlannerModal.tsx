import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  Download,
  RefreshCw,
  ArrowRight,
  X,
  Sparkles,
} from 'lucide-react';
import type { Page, ExamPlanRecord, ExamTopic } from '../../types';
import { generateDeterministicPlan, exportToIcs } from './scheduler';
import { getExamPlans, saveExamPlan, awardXpEvent } from '../../db';

interface ExamPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  currentPageId: string;
  onOpenFlashcards: () => void;
  onOpenQuiz: () => void;
  onOpenFeynman: (topic: string) => void;
  onOpenRevisionSheet: () => void;
}

export const ExamPlannerModal: React.FC<ExamPlannerModalProps> = ({
  isOpen,
  onClose,
  pages,
  currentPageId: _currentPageId,
  onOpenFlashcards,
  onOpenQuiz,
  onOpenFeynman,
  onOpenRevisionSheet,
}) => {
  const projectId = pages[0]?.projectId || 'default';

  const [activePlan, setActivePlan] = useState<ExamPlanRecord | null>(null);
  const [viewState, setViewState] = useState<'plan' | 'setup'>('plan');

  // Setup Form State
  const [examName, setExamName] = useState('Final Exam');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [daysOff] = useState<number[]>([0]); // Sunday off by default
  const [extractedTopics, setExtractedTopics] = useState<ExamTopic[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadPlan();
    }
  }, [isOpen, projectId]);

  const loadPlan = async () => {
    const plans = await getExamPlans(projectId);
    if (plans && plans.length > 0) {
      setActivePlan(plans[0]);
      setViewState('plan');
    } else {
      initExtractedTopics();
      setViewState('setup');
    }
  };

  const initExtractedTopics = () => {
    const topics: ExamTopic[] = pages.map((p, idx) => ({
      id: `top-${idx + 1}`,
      name: p.title || `Topic ${idx + 1}`,
      weight: 4,
      difficulty: 3,
      pageRefs: [p.pageNumber || (idx + 1)],
    }));

    if (topics.length === 0) {
      topics.push({
        id: 'top-1',
        name: 'General Syllabus Concepts',
        weight: 3,
        difficulty: 3,
        pageRefs: [1],
      });
    }

    setExtractedTopics(topics);
  };

  const handleGeneratePlan = async () => {
    const plan = generateDeterministicPlan({
      projectId,
      examName,
      examDate,
      availability: {
        hoursPerDay,
        daysOff,
      },
      topics: extractedTopics,
    });

    await saveExamPlan(plan);
    setActivePlan(plan);
    setViewState('plan');

    await awardXpEvent({
      type: 'planner_task',
      amount: 40,
      description: `Generated Exam Study Plan for "${examName}"`,
      referenceId: projectId,
    });
  };

  const handleToggleTaskStatus = async (taskId: string) => {
    if (!activePlan) return;

    const updatedTasks = activePlan.tasks.map((t) => {
      if (t.id === taskId) {
        const nextStatus = t.status === 'completed' ? 'pending' : 'completed';
        if (nextStatus === 'completed') {
          awardXpEvent({
            type: 'planner_task',
            amount: 25,
            description: `Checked off exam task: ${t.title}`,
            referenceId: t.id,
          });
        }
        return { ...t, status: nextStatus as 'completed' | 'pending' };
      }
      return t;
    });

    const updatedPlan: ExamPlanRecord = {
      ...activePlan,
      tasks: updatedTasks,
      updatedAt: Date.now(),
    };

    await saveExamPlan(updatedPlan);
    setActivePlan(updatedPlan);
  };

  const handleExportCalendar = () => {
    if (!activePlan) return;
    const icsContent = exportToIcs(activePlan);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyPlan-${activePlan.examName.replace(/\s+/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const daysLeft = activePlan
    ? Math.max(0, Math.ceil((new Date(activePlan.examDate).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)))
    : 0;

  const completedCount = activePlan?.tasks.filter((t) => t.status === 'completed').length || 0;
  const totalCount = activePlan?.tasks.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const todayStr = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/80 rounded-xl text-indigo-600 dark:text-indigo-400">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Exam Countdown Planner
              </h2>
              <p className="text-xs text-slate-500">
                Spaced-repetition study schedule powered by deterministic priority scheduling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewState === 'setup' || !activePlan ? (
            /* Setup Form */
            <div className="flex flex-col gap-5 max-w-xl mx-auto py-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Create Your Exam Study Plan
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Exam / Test Name
                  </label>
                  <input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. Midterm Physics"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Exam Date
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Study Hours Budget: {hoursPerDay}h / day
                </label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Topics Extraction list */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Topics to Cover (Extracted from your notes)
                </label>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {extractedTopics.map((top) => (
                    <div
                      key={top.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {top.name}
                      </span>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>Weight: {top.weight}/5</span>
                        <span>Diff: {top.difficulty}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePlan}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 mt-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate Deterministic Study Schedule
              </button>
            </div>
          ) : (
            /* Active Plan View */
            <div className="flex flex-col gap-5">
              {/* Countdown Banner */}
              <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl text-white shadow-md flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-200">
                    Countdown to {activePlan.examName}
                  </span>
                  <div className="text-3xl font-black mt-0.5 flex items-center gap-2">
                    {daysLeft} Days Left
                  </div>
                  <p className="text-xs text-indigo-100 mt-1">
                    Exam Date: {activePlan.examDate} • {completedCount} of {totalCount} tasks completed ({progressPercent}%)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCalendar}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-xs font-semibold text-white border border-white/20 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export .ics
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewState('setup')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-Plan
                  </button>
                </div>
              </div>

              {/* Today's Tasks & Timeline */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Scheduled Tasks
                </h3>

                <div className="flex flex-col gap-2.5">
                  {activePlan.tasks.map((task) => {
                    const isCompleted = task.status === 'completed';
                    const isToday = task.date === todayStr;

                    return (
                      <div
                        key={task.id}
                        className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isCompleted
                            ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60'
                            : isToday
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-2xs'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(task.id)}
                            className="text-slate-400 hover:text-indigo-600 transition"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs font-semibold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                {task.title}
                              </h4>
                              {isToday && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold">
                                  Today
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {task.date} • {task.durationMinutes} mins • {task.type.replace('_', ' ')}
                            </p>
                          </div>
                        </div>

                        {/* Deep link tool launcher */}
                        <div>
                          {task.type === 'flashcards' && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenFlashcards();
                                onClose();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded-lg"
                            >
                              Launch Flashcards <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {task.type === 'quiz' && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenQuiz();
                                onClose();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg"
                            >
                              Practice Quiz <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {task.type === 'feynman' && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenFeynman(task.topicName);
                                onClose();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/50 rounded-lg"
                            >
                              Feynman Session <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {task.type === 'revision_sheet' && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenRevisionSheet();
                                onClose();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg"
                            >
                              Open Revision Sheet <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
