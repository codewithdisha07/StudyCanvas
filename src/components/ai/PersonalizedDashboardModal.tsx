import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  TrendingDown,
  BookOpen,
  ArrowRight,
  X,
  Target,
} from 'lucide-react';
import type { Page, QuizAttempt } from '../../types';
import { getQuizzesForProject } from '../../db';

interface PersonalizedDashboardModalProps {
  projectId: string;
  projectTitle: string;
  pages: Page[];
  onClose: () => void;
  onNavigateToPage: (pageNumber: number) => void;
  onStartAdaptiveQuiz: () => void;
}

export const PersonalizedDashboardModal: React.FC<PersonalizedDashboardModalProps> = ({
  projectId,
  projectTitle,
  pages,
  onClose,
  onNavigateToPage,
  onStartAdaptiveQuiz,
}) => {
  const [quizzes, setQuizzes] = useState<QuizAttempt[]>([]);
  const [weakTopics, setWeakTopics] = useState<{ topic: string; accuracy: number; count: number }[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [projectId]);

  const loadAnalytics = async () => {
    const past = await getQuizzesForProject(projectId);
    setQuizzes(past);

    // Aggregate topic performance
    const topicTotals: Record<string, { total: number; correct: number }> = {};
    past.forEach((q) => {
      if (q.topicStats) {
        Object.entries(q.topicStats).forEach(([t, s]) => {
          if (!topicTotals[t]) topicTotals[t] = { total: 0, correct: 0 };
          topicTotals[t].total += s.total;
          topicTotals[t].correct += s.correct;
        });
      }
    });

    const parsedWeak = Object.entries(topicTotals)
      .map(([topic, s]) => ({
        topic,
        accuracy: Math.round((s.correct / s.total) * 100),
        count: s.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    setWeakTopics(parsedWeak);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Personalized Learning Hub: {projectTitle}
              </h3>
              <p className="text-[11px] text-slate-500">
                Recommended revision areas based on your note structure and {quizzes.length} quiz attempts.
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Focus Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Adaptive Focus Score
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                {weakTopics.length > 0
                  ? `Focusing on ${weakTopics.length} core topics across ${pages.length} notebook pages.`
                  : 'Take a quiz to calculate your personalized mastery metrics!'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartAdaptiveQuiz();
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              Start Adaptive Quiz
            </button>
          </div>

          {/* Weak Topics to Revisit */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              Concepts Requiring Review
            </h4>

            {weakTopics.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                Complete at least one quiz to view pinpointed weakness analytics.
              </div>
            ) : (
              <div className="space-y-2">
                {weakTopics.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {item.topic}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Tested {item.count} times
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span
                          className={`text-xs font-bold ${
                            item.accuracy < 60
                              ? 'text-rose-600'
                              : item.accuracy < 80
                              ? 'text-amber-500'
                              : 'text-emerald-600'
                          }`}
                        >
                          {item.accuracy}% Accuracy
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* High-Yield Pages to Review */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              Recommended Pages to Revisit
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pages.map((p, idx) => {
                const sampleText = p.textBoxes[0]?.text.slice(0, 60) || 'Visual notes & diagrams';
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onNavigateToPage(idx + 1);
                      onClose();
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-white dark:bg-slate-800/50 cursor-pointer transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        Page {idx + 1}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-600 transition" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                      {p.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                      {sampleText}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
