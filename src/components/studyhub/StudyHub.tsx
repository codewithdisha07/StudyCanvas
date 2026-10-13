import React, { useState, useEffect } from 'react';
import {
  Brain,
  Flame,
  Calendar,
  Network,
  Swords,
  Layers,
  GraduationCap,
  Clock,
  ArrowRight,
  BookOpen,
  ArrowLeft,
  CalendarCheck,
} from 'lucide-react';
import type { Page, Project, UserStats } from '../../types';
import {
  getUserStats,
  getXpEventsForHeatmap,
  getStudySessions,
  getFeynmanAttempts,
  getExamPlans,
  type FeynmanAttempt,
  type StudySession,
  type ExamPlanRecord,
} from '../../db';
import { LevelBar } from '../../features/gamification/LevelBar';
import { Heatmap } from '../../features/gamification/Heatmap';
import { BadgeGrid } from '../../features/gamification/BadgeGrid';

interface StudyHubProps {
  project: Project | null;
  pages: Page[];
  onBackToCanvas: () => void;
  onOpenMindMap: () => void;
  onOpenExamPlanner: () => void;
  onOpenFeynman: () => void;
  onOpenBattle: () => void;
  onOpenQuiz: () => void;
  onOpenFlashcards: () => void;
}

export const StudyHub: React.FC<StudyHubProps> = ({
  project,
  pages,
  onBackToCanvas,
  onOpenMindMap,
  onOpenExamPlanner,
  onOpenFeynman,
  onOpenBattle,
  onOpenQuiz,
  onOpenFlashcards,
}) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [xpMap, setXpMap] = useState<Record<string, number>>({});
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [feynmanAttempts, setFeynmanAttempts] = useState<FeynmanAttempt[]>([]);
  const [examPlan, setExamPlan] = useState<ExamPlanRecord | null>(null);

  useEffect(() => {
    loadHubData();
  }, [project?.id]);

  const loadHubData = async () => {
    try {
      const [userStats, xpData, studySess, fAttempts, plans] = await Promise.all([
        getUserStats(),
        getXpEventsForHeatmap(365),
        getStudySessions(project?.id),
        getFeynmanAttempts(project?.id),
        getExamPlans(project?.id),
      ]);

      setStats(userStats);
      setXpMap(xpData);
      setSessions(studySess);
      setFeynmanAttempts(fAttempts);
      if (plans.length > 0) setExamPlan(plans[0]);
    } catch (e) {
      console.warn('Failed loading study hub data:', e);
    }
  };

  // Calculate Pomodoro stats
  const totalFocusMinutes = Math.round(
    sessions.reduce((acc, s) => acc + (s.focusSeconds || 0), 0) / 60
  );
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayFocusMinutes = Math.round(
    sessions
      .filter((s) => s.startedAt >= todayStart)
      .reduce((acc, s) => acc + (s.focusSeconds || 0), 0) / 60
  );

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 flex flex-col gap-6">
      {/* Navigation Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Canvas
          </button>

          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Study Hub
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-semibold">
                Analytics & Gamification
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              {project ? project.title : 'Overview'} • {pages.length} Pages active
            </p>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuiz}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Adaptive Quiz
          </button>

          <button
            type="button"
            onClick={onOpenFlashcards}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition"
          >
            <Layers className="w-3.5 h-3.5" />
            Flashcards
          </button>

          <button
            type="button"
            onClick={onOpenBattle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition"
          >
            <Swords className="w-3.5 h-3.5" />
            Quiz Battle
          </button>

          <button
            type="button"
            onClick={onOpenMindMap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-900 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 transition"
          >
            <Network className="w-3.5 h-3.5" />
            Mind Map
          </button>

          <button
            type="button"
            onClick={onOpenExamPlanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition shadow-sm"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Exam Planner
          </button>
        </div>
      </div>

      {/* 1. Level & XP Progress Banner */}
      {stats && <LevelBar stats={stats} />}

      {/* 2. Pomodoro Focus Time Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Today's Focus
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {todayFocusMinutes} mins
            </div>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Focused Time
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {totalFocusMinutes} mins
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Completed Pomodoros
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {sessions.filter((s) => s.completed).length} Blocks
            </div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-2xl text-amber-600 dark:text-amber-400">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. 52-Week Activity Heatmap */}
      {stats && <Heatmap xpMap={xpMap} stats={stats} />}

      {/* 4. Exam Countdown Planner Card & Feynman History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exam Planner Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4" />
                Exam Countdown
              </span>
              <button
                type="button"
                onClick={onOpenExamPlanner}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                View Full Plan <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {examPlan ? (
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {examPlan.examName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled for {examPlan.examDate}
                </p>

                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
                  <span>Tasks Completed</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {examPlan.tasks.filter((t) => t.status === 'completed').length} / {examPlan.tasks.length}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium">No active exam countdown plan.</p>
                <button
                  type="button"
                  onClick={onOpenExamPlanner}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Create Exam Plan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Feynman History Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                <Brain className="w-4 h-4" />
                Feynman Teach-it-Back History
              </span>
              <button
                type="button"
                onClick={onOpenFeynman}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                New Attempt <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {feynmanAttempts.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
                {feynmanAttempts.slice(0, 4).map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                        {att.topic}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">
                        "{att.verdict}"
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 font-bold text-indigo-600 dark:text-indigo-400 text-xs font-mono">
                      {Math.round((att.scores.accuracy + att.scores.completeness + att.scores.clarity + att.scores.ownWords) / 4)}/10
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium">No Feynman teach-it-back attempts yet.</p>
                <button
                  type="button"
                  onClick={onOpenFeynman}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Practice Teaching a Topic
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Badges Grid */}
      {stats && <BadgeGrid stats={stats} />}
    </div>
  );
};
