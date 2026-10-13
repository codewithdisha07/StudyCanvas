import React, { useState, useEffect, useRef } from 'react';
import {
  Swords,
  Trophy,
  Copy,
  Clock,
  Play,
  ArrowRight,
  ShieldAlert,
  X,
  Check,
} from 'lucide-react';
import type { QuizQuestion, Page } from '../../types';
import {
  createBattleRoom,
  joinBattleRoom,
  submitBattleAnswer,
  getBattleState,
  generateQuiz,
} from '../../ai/aiClient';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { awardXpEvent } from '../../db';

interface QuizBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizQuestions?: QuizQuestion[];
  initialRoomCode?: string;
  pages?: Page[];
  currentPageId?: string;
}

export const QuizBattleModal: React.FC<QuizBattleModalProps> = ({
  isOpen,
  onClose,
  quizQuestions = [],
  initialRoomCode = '',
  pages = [],
  currentPageId = '',
}) => {
  // Mode: 'host' | 'join' | 'lobby' | 'playing' | 'results'
  const [viewMode, setViewMode] = useState<'menu' | 'host_setup' | 'join_setup' | 'lobby' | 'playing' | 'results'>('menu');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [nickname, setNickname] = useState(() => localStorage.getItem('studycanvas_nickname') || 'Student');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [battleMode, setBattleMode] = useState<'async' | 'live'>('async');

  // Room state from server
  const [roomState, setRoomState] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<{ isCorrect: boolean; pointsAwarded: number; correctOption?: string; explanation?: string } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const questionStartTimeRef = useRef<number>(Date.now());
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode.toUpperCase());
      setViewMode('join_setup');
    }
  }, [initialRoomCode]);

  // Connect to SSE stream whenever roomCode is established
  useEffect(() => {
    if ((viewMode === 'lobby' || viewMode === 'playing' || viewMode === 'results') && roomCode) {
      const sse = new EventSource(`/api/battle/${roomCode}/stream?playerId=${playerId || ''}`);
      sseRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setRoomState(data);

          if (data.status === 'active' && viewMode === 'lobby') {
            setViewMode('playing');
            questionStartTimeRef.current = Date.now();
          } else if (data.status === 'finished') {
            setViewMode('results');
          }
        } catch (e) {
          console.warn('SSE parse error:', e);
        }
      };

      sse.onerror = () => {
        sse.close();
      };

      return () => {
        sse.close();
      };
    }
  }, [viewMode, roomCode, playerId]);

  // Question Timer during gameplay
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (viewMode === 'playing' && !answerFeedback) {
      setTimeRemaining(15);
      questionStartTimeRef.current = Date.now();

      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [viewMode, currentQuestionIndex, answerFeedback]);

  const handleTimeOut = () => {
    if (!selectedOption && !answerFeedback) {
      handleSubmitAnswer('');
    }
  };

  const handleCreateBattle = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let questionsToUse: QuizQuestion[] = quizQuestions;

      // If no questions are passed, generate them from the project's notes
      if (questionsToUse.length === 0 && pages && pages.length > 0) {
        try {
          const context = await buildGroundedContext({
            pages,
            currentPageId: currentPageId || pages[0].id,
            scope: 'project',
          });
          const generated = await generateQuiz(5, 'medium', context);
          if (generated.questions && generated.questions.length > 0) {
            questionsToUse = generated.questions;
          }
        } catch (e) {
          console.warn('Failed auto-generating battle questions from notes, using fallback', e);
        }
      }

      // If still empty (e.g., completely blank notebook), provide high-yield learning questions
      if (questionsToUse.length === 0) {
        questionsToUse = [
          {
            id: 'qb-1',
            type: 'multiple-choice',
            question: 'What is the primary benefit of spaced repetition for long-term retention?',
            options: [
              'It strengthens neural connections right as memory decay begins',
              'It eliminates the need for conceptual understanding',
              'It forces continuous 24-hour study marathons',
              'It replaces active recall with passive re-reading',
            ],
            correctAnswer: 'It strengthens neural connections right as memory decay begins',
            explanation: 'Spaced repetition strategically reviews material at expanding intervals to maximize memory consolidation.',
            sourcePageId: 'default',
            sourcePageNumber: 1,
            topic: 'Study Skills',
          },
          {
            id: 'qb-2',
            type: 'multiple-choice',
            question: 'In the Feynman Technique, what is the core step for discovering gaps in your knowledge?',
            options: [
              'Explaining the concept simply as if teaching a child',
              'Copying the textbook definition word for word',
              'Taking multiple choice quizzes without reviewing errors',
              'Highlighting sentences with multiple colors',
            ],
            correctAnswer: 'Explaining the concept simply as if teaching a child',
            explanation: 'Simplifying explanations reveals where your understanding relies on jargon rather than intuition.',
            sourcePageId: 'default',
            sourcePageNumber: 1,
            topic: 'Active Learning',
          },
          {
            id: 'qb-3',
            type: 'multiple-choice',
            question: 'Why is active recall superior to passive re-reading?',
            options: [
              'Retrieving information forces the brain to reconstruct memory traces',
              'It consumes less brain glucose than reading',
              'It only works for mathematics and formulas',
              'It requires memorizing everything in alphabetical order',
            ],
            correctAnswer: 'Retrieving information forces the brain to reconstruct memory traces',
            explanation: 'Active recall trains the neural pathway used to retrieve that fact during exams.',
            sourcePageId: 'default',
            sourcePageNumber: 1,
            topic: 'Cognitive Science',
          },
        ];
      }

      const res = await createBattleRoom('StudyCanvas Battle', questionsToUse, battleMode);
      setRoomCode(res.code);
      setIsHost(true);

      // Also join as player
      const joinRes = await joinBattleRoom(res.code, nickname);
      setPlayerId(joinRes.playerId);
      localStorage.setItem('studycanvas_nickname', nickname);

      setViewMode('lobby');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create battle room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinBattle = async () => {
    if (!roomCode.trim()) {
      setErrorMsg('Please enter a 6-character room code');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const cleanCode = roomCode.trim().toUpperCase();
      const res = await joinBattleRoom(cleanCode, nickname);
      setPlayerId(res.playerId);
      setRoomCode(cleanCode);
      localStorage.setItem('studycanvas_nickname', nickname);

      const state = await getBattleState(cleanCode);
      setRoomState(state);

      setViewMode(state.status === 'active' ? 'playing' : 'lobby');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join battle room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async (option: string) => {
    if (!roomCode || !playerId || answerFeedback) return;

    setSelectedOption(option);
    const elapsedMs = Date.now() - questionStartTimeRef.current;

    try {
      const result = await submitBattleAnswer(roomCode, playerId, currentQuestionIndex, option, elapsedMs);
      setAnswerFeedback(result);

      if (result.isCorrect) {
        awardXpEvent({
          type: 'finish_quiz',
          amount: 20,
          description: `Scored in Quiz Battle round ${currentQuestionIndex + 1}`,
          referenceId: roomCode,
        });
      }
    } catch (err: any) {
      console.warn('Submit answer failed:', err);
    }
  };

  const handleNextQuestion = async () => {
    setSelectedOption(null);
    setAnswerFeedback(null);

    const totalQ = roomState?.totalQuestions || roomState?.questions?.length || 1;
    if (currentQuestionIndex + 1 >= totalQ) {
      setViewMode('results');
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
      questionStartTimeRef.current = Date.now();
    }
  };

  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}?battle=${roomCode}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setHasCopiedLink(true);
    setTimeout(() => setHasCopiedLink(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 dark:bg-rose-950/80 rounded-xl text-rose-600 dark:text-rose-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Quiz Battle
                {roomCode && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    CODE: {roomCode}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">Live multiplayer study challenges with classmates</p>
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
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Main Menu */}
          {viewMode === 'menu' && (
            <div className="flex flex-col gap-4 text-center py-4">
              <div className="max-w-md mx-auto">
                <Swords className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Challenge Your Classmates
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Host a quiz battle from your notes or join a room code. Compete on speed, accuracy, and climb the leaderboard!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setViewMode('host_setup')}
                  className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 hover:border-indigo-500 text-left transition flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Host a Battle
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      Share Quiz Room
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Generate a 6-character room code & QR link for this project's quiz.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-4 flex items-center gap-1">
                    Setup Room <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('join_setup')}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-400 text-left transition flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Join a Battle
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      Enter Room Code
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter a classmate's code and compete on the live leaderboard.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-4 flex items-center gap-1">
                    Enter Code <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Host Setup */}
          {viewMode === 'host_setup' && (
            <div className="flex flex-col gap-4 max-w-md mx-auto py-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Host Quiz Battle Setup
              </h3>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Privacy Notice:</span> Quiz questions will be shared with players who have the code. Your raw notes will NEVER be exposed.
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Aditya"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Battle Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBattleMode('async')}
                    className={`p-3 rounded-xl border text-xs font-medium text-left transition ${
                      battleMode === 'async'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold">Async Mode</div>
                    <span className="text-[10px] text-slate-400">Classmates play anytime over 24h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBattleMode('live')}
                    className={`p-3 rounded-xl border text-xs font-medium text-left transition ${
                      battleMode === 'live'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold">Live Mode</div>
                    <span className="text-[10px] text-slate-400">Host starts; synchronized countdown</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateBattle}
                disabled={isLoading || !nickname.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium rounded-xl text-xs transition shadow-xs mt-2"
              >
                {isLoading ? 'Creating Room...' : 'Create Battle Room & Code'}
              </button>
            </div>
          )}

          {/* 3. Join Setup */}
          {viewMode === 'join_setup' && (
            <div className="flex flex-col gap-4 max-w-md mx-auto py-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Join a Battle Room
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  6-Character Room Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 7K2M9X"
                  className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest font-bold uppercase rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Priya"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={handleJoinBattle}
                disabled={isLoading || !roomCode.trim() || !nickname.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium rounded-xl text-xs transition shadow-xs mt-2"
              >
                {isLoading ? 'Connecting...' : 'Join Room'}
              </button>
            </div>
          )}

          {/* 4. Lobby */}
          {viewMode === 'lobby' && (
            <div className="flex flex-col gap-4 text-center py-2">
              <div className="p-5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-3xl max-w-md mx-auto w-full">
                <span className="text-xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400">
                  Room Code
                </span>
                <div className="text-3xl font-mono font-black text-indigo-600 dark:text-indigo-400 my-1 tracking-widest">
                  {roomCode}
                </div>

                <div className="flex items-center justify-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
                  >
                    {hasCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {hasCopiedLink ? 'Copied' : 'Copy Share Link'}
                  </button>
                </div>
              </div>

              {/* Connected Players list */}
              <div className="max-w-md mx-auto w-full text-left">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold uppercase tracking-wider">
                    Players in Lobby ({roomState?.players?.length || 1})
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {(roomState?.players || [{ nickname, score: 0 }]).map((p: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        {p.nickname} {p.id === playerId ? '(You)' : ''}
                        {(isHost && p.id === playerId) && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                            Host
                          </span>
                        )}
                      </span>
                      <span className="text-slate-400 font-mono">{p.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="max-w-md mx-auto w-full mt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('playing')}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Playing Questions
                </button>
              </div>
            </div>
          )}

          {/* 5. Playing questions */}
          {viewMode === 'playing' && roomState && (
            <div className="flex flex-col gap-4">
              {/* Question progress & timer */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  Question {currentQuestionIndex + 1} of {roomState.questions?.length || 5}
                </span>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-200">
                  <Clock className={`w-3.5 h-3.5 ${timeRemaining <= 5 ? 'text-rose-500 animate-ping' : 'text-indigo-500'}`} />
                  <span>{timeRemaining}s</span>
                </div>
              </div>

              {/* Question text */}
              {roomState.questions && roomState.questions[currentQuestionIndex] && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                    {roomState.questions[currentQuestionIndex].question}
                  </h3>
                </div>
              )}

              {/* Options */}
              <div className="grid grid-cols-1 gap-2.5">
                {(roomState.questions?.[currentQuestionIndex]?.options || []).map((opt: string, idx: number) => {
                  const isSelected = selectedOption === opt;
                  let optStyle = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400';

                  if (answerFeedback) {
                    if (opt === answerFeedback.correctOption) {
                      optStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold';
                    } else if (isSelected && !answerFeedback.isCorrect) {
                      optStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200';
                    }
                  } else if (isSelected) {
                    optStyle = 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={Boolean(answerFeedback)}
                      onClick={() => handleSubmitAnswer(opt)}
                      className={`p-3.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${optStyle}`}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Answer Feedback Banner */}
              {answerFeedback && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={answerFeedback.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {answerFeedback.isCorrect ? `✓ Correct! (+${answerFeedback.pointsAwarded} pts)` : '✗ Incorrect'}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
                    >
                      Next <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  {answerFeedback.explanation && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {answerFeedback.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 6. Results & Podium */}
          {viewMode === 'results' && (
            <div className="flex flex-col gap-4 text-center py-2">
              <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Battle Results & Leaderboard
              </h3>

              {/* Podium Leaderboard */}
              <div className="flex flex-col gap-2 max-w-md mx-auto w-full mt-2">
                {(roomState?.players || []).map((p: any, idx: number) => {
                  const isTop = idx === 0;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border text-xs ${
                        isTop
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isTop ? 'bg-amber-400 text-slate-900 font-black' : 'bg-slate-200 dark:bg-slate-700'}`}>
                          {idx + 1}
                        </span>
                        <span>{p.nickname}</span>
                      </div>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {p.score} pts
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="max-w-md mx-auto w-full mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
