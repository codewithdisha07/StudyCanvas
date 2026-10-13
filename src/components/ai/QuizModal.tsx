import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  XCircle,
  BarChart2,
  X,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import type { Page, QuizQuestion, QuizAttempt } from '../../types';
import { generateQuiz, gradeShortAnswer } from '../../ai/aiClient';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { saveQuizAttempt, getQuizzesForProject } from '../../db';

interface QuizModalProps {
  projectId: string;
  pages: Page[];
  currentPageId: string;
  onClose: () => void;
  onNavigateToPage: (pageNumber: number) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  projectId,
  pages,
  currentPageId,
  onClose,
  onNavigateToPage,
}) => {
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // State during quiz taking
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isGradingShortAnswer, setIsGradingShortAnswer] = useState(false);
  const [shortAnswerFeedback, setShortAnswerFeedback] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Past quiz history for adaptive tracking
  const [pastAttempts, setPastAttempts] = useState<QuizAttempt[]>([]);
  const [viewHistoryTab, setViewHistoryTab] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const loadHistory = async () => {
    const attempts = await getQuizzesForProject(projectId);
    setPastAttempts(attempts);

    // Adaptive difficulty recommendation
    if (attempts.length > 0) {
      const last = attempts[0];
      const accuracy = last.score / last.questions.length;
      if (accuracy >= 0.8) {
        setDifficulty('hard');
      } else if (accuracy < 0.5) {
        setDifficulty('easy');
      } else {
        setDifficulty('medium');
      }
    }
  };

  const handleStartQuiz = async () => {
    setIsLoading(true);
    setUserAnswers({});
    setShortAnswerFeedback({});
    setIsCompleted(false);
    setCurrentQuestionIndex(0);

    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope: 'project',
      });

      const res = await generateQuiz(questionCount, difficulty, context);
      setQuestions(res.questions);
    } catch (err) {
      console.error('Quiz generation error:', err);
      alert('Failed to generate quiz. Make sure project has sufficient notes.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentQ = questions[currentQuestionIndex];

  const handleSelectOption = (opt: string) => {
    if (!currentQ || isCompleted) return;
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: opt }));
  };

  const handleNextOrFinish = async () => {
    if (!currentQ) return;

    // If short answer, ask AI to grade it against notes if not already graded
    if (currentQ.type === 'short-answer' && !shortAnswerFeedback[currentQ.id]) {
      const studentAns = userAnswers[currentQ.id] || '';
      setIsGradingShortAnswer(true);
      try {
        const context = await buildGroundedContext({
          pages,
          currentPageId,
          scope: 'project',
        });
        const graded = await gradeShortAnswer(currentQ.question, studentAns, currentQ.correctAnswer, context);
        setShortAnswerFeedback((prev) => ({ ...prev, [currentQ.id]: graded.feedback }));
      } catch (e) {
        console.warn('Grade error:', e);
      } finally {
        setIsGradingShortAnswer(false);
      }
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Calculate Score and Topic Stats
      let correctCount = 0;
      const topicStats: Record<string, { total: number; correct: number }> = {};

      questions.forEach((q) => {
        const userAns = (userAnswers[q.id] || '').trim().toLowerCase();
        const expected = q.correctAnswer.trim().toLowerCase();
        const isCorrect = userAns.length > 0 && (userAns === expected || expected.includes(userAns));

        if (isCorrect) correctCount++;

        const topic = q.topic || 'General';
        if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
        topicStats[topic].total += 1;
        if (isCorrect) topicStats[topic].correct += 1;
      });

      setFinalScore(correctCount);
      setIsCompleted(true);

      // Trigger Confetti if good score!
      if (correctCount / questions.length >= 0.7) {
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        } catch (_) {}
      }

      // Save Attempt
      const attempt: QuizAttempt = {
        id: `qa-${Date.now()}`,
        projectId,
        difficulty,
        questions,
        answers: userAnswers,
        score: correctCount,
        topicStats,
        createdAt: Date.now(),
      };
      await saveQuizAttempt(attempt);
      loadHistory();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Adaptive Study Quiz
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  Grounded in Notes
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Tests your recall on key definitions, equations, and diagrams.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewHistoryTab(!viewHistoryTab)}
              className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 transition"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              {viewHistoryTab ? 'Quiz' : 'Progress'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewHistoryTab ? (
            /* Historical Progress Tab */
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Adaptive Quiz History ({pastAttempts.length} attempts)
              </h4>
              {pastAttempts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No quiz attempts yet. Complete your first quiz to see your progress chart!
                </p>
              ) : (
                <div className="space-y-3">
                  {pastAttempts.map((attempt) => {
                    const pct = Math.round((attempt.score / attempt.questions.length) * 100);
                    return (
                      <div
                        key={attempt.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                              {attempt.difficulty} Difficulty
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(attempt.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Topics:{' '}
                            {Object.entries(attempt.topicStats || {})
                              .map(([k, v]) => `${k} (${v.correct}/${v.total})`)
                              .join(', ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              pct >= 70
                                ? 'text-emerald-600'
                                : pct >= 50
                                ? 'text-amber-500'
                                : 'text-rose-500'
                            }`}
                          >
                            {pct}%
                          </span>
                          <span className="text-xs text-slate-400">
                            ({attempt.score}/{attempt.questions.length})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : questions.length === 0 ? (
            /* Setup State */
            <div className="space-y-5">
              <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Adaptive Quiz Engine
                  </p>
                  <p>
                    Questions are crafted directly from your handwriting and typed notes. After each attempt, StudyCanvas AI over-samples topics where you struggled to solidify mastery.
                  </p>
                </div>
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Target Difficulty
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`py-2 px-3 text-xs font-medium rounded-xl capitalize border transition ${
                        difficulty === diff
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Count */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Number of Questions: {questionCount}
                </label>
                <input
                  type="range"
                  min={3}
                  max={8}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleStartQuiz}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Synthesizing Quiz from Notes...
                    </>
                  ) : (
                    <>
                      <GraduationCap className="w-4 h-4" />
                      Start Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : isCompleted ? (
            /* Results State */
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-2xl font-bold">
                {Math.round((finalScore / questions.length) * 100)}%
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Quiz Completed!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  You answered {finalScore} out of {questions.length} questions correctly.
                </p>
              </div>

              {/* Review Questions Breakdown */}
              <div className="text-left space-y-3 pt-3 max-h-64 overflow-y-auto">
                {questions.map((q, idx) => {
                  const userAns = userAnswers[q.id];
                  const isCorrect = userAns?.toLowerCase() === q.correctAnswer.toLowerCase();

                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        isCorrect
                          ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {idx + 1}. {q.question}
                        </span>
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">Correct Answer:</span> {q.correctAnswer}
                      </div>

                      <div className="text-[11px] text-slate-500 italic">
                        {q.explanation}
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToPage(q.sourcePageNumber);
                            onClose();
                          }}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                        >
                          Review on [Page {q.sourcePageNumber}] →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartQuiz}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retake Adaptive Quiz
                </button>
              </div>
            </div>
          ) : (
            /* Active Question Taking State */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-[10px]">
                  {currentQ?.type.replace('-', ' ')}
                </span>
              </div>

              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {currentQ?.question}
              </div>

              {/* Options */}
              {currentQ?.type === 'short-answer' ? (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Type your answer based on your notes..."
                    value={userAnswers[currentQ.id] || ''}
                    onChange={(e) => handleSelectOption(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {shortAnswerFeedback[currentQ.id] && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                      {shortAnswerFeedback[currentQ.id]}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {currentQ?.options?.map((opt, i) => {
                    const isSelected = userAnswers[currentQ.id] === opt;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        className={`w-full text-left p-3 text-xs rounded-xl border transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-medium ring-1 ring-indigo-600'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {questions.length > 0 && !isCompleted && !viewHistoryTab && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {userAnswers[currentQ?.id] ? 'Answer selected' : 'Select an answer'}
            </span>

            <button
              type="button"
              disabled={isGradingShortAnswer}
              onClick={handleNextOrFinish}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition"
            >
              {isGradingShortAnswer
                ? 'Evaluating Answer...'
                : currentQuestionIndex < questions.length - 1
                ? 'Next Question'
                : 'Finish & View Score'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
