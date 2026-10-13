import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Layers,
  FilePlus,
  RefreshCw,
  X,
  Mic,
  MicOff,
  Star,
} from 'lucide-react';
import type { Page } from '../../types';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { evaluateFeynman, type FeynmanFeedback } from '../../ai/aiClient';
import { useSpeechRecognition } from '../voice/useSpeechRecognition';
import { saveFeynmanAttempt, awardXpEvent, type FeynmanAttempt } from '../../db';

interface FeynmanModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  currentPageId: string;
  initialTopic?: string;
  onAddNotesToCanvas?: (points: string[]) => void;
  onCreateFlashcardsFromGaps?: (gaps: string[]) => void;
}

export const FeynmanModal: React.FC<FeynmanModalProps> = ({
  isOpen,
  onClose,
  pages,
  currentPageId,
  initialTopic = '',
  onAddNotesToCanvas,
  onCreateFlashcardsFromGaps,
}) => {
  const [topic, setTopic] = useState(initialTopic);
  const [audience, setAudience] = useState<'Grade 6 student' | 'High schooler' | 'Peer'>('Grade 6 student');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeynmanFeedback | null>(null);
  const [rounds, setRounds] = useState<FeynmanFeedback[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'input' | 'evaluation'>('input');

  // Speech recognition for voice explanation
  const {
    isSupported: isVoiceSupported,
    isListening: isVoiceListening,
    transcript: voiceTranscript,
    startListening: startVoice,
    stopListening: stopVoice,
  } = useSpeechRecognition();

  useEffect(() => {
    if (voiceTranscript) {
      setExplanation((prev) => (prev ? `${prev} ${voiceTranscript}` : voiceTranscript));
    }
  }, [voiceTranscript]);

  // Extract suggested topics from active pages
  useEffect(() => {
    if (pages.length > 0) {
      const extracted: string[] = [];
      pages.forEach((p) => {
        if (p.title && !extracted.includes(p.title)) {
          extracted.push(p.title.replace(/^\d+[\.\-\s]*/, '').trim());
        }
        const lines = (p.text || '').split('\n').filter((l) => l.length > 5 && l.length < 50);
        lines.slice(0, 2).forEach((l) => {
          const clean = l.replace(/^[-•*]\s*/, '').trim();
          if (clean && !extracted.includes(clean)) extracted.push(clean);
        });
      });
      setSuggestedTopics(extracted.slice(0, 5));
      if (!topic && extracted.length > 0) {
        setTopic(extracted[0]);
      }
    }
  }, [pages]);

  const handleEvaluateExplanation = async () => {
    if (!topic.trim() || !explanation.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope: 'project',
      });

      const res = await evaluateFeynman(topic, explanation, audience, context);
      setFeedback(res);
      setRounds((prev) => [...prev, res]);
      setActiveTab('evaluation');

      // Save to IndexedDB
      const attempt: FeynmanAttempt = {
        id: `fey-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        projectId: pages[0]?.projectId || 'default',
        topic,
        audience: audience === 'Grade 6 student' ? 'grade6' : 'peer',
        studentExplanation: explanation,
        scores: res.scores,
        coveredPoints: res.coveredPoints,
        missingPoints: res.missingPoints,
        misconceptions: (res.misconceptions || []).map((m: any) => ({
          statement: m.studentClaim || m.statement || '',
          actualNote: m.actualNoteFact || m.actualNote || '',
          studentClaim: m.studentClaim || m.statement || '',
          actualNoteFact: m.actualNoteFact || m.actualNote || '',
          citation: m.citation || '',
        })),
        verdict: res.verdict,
        followUpQuestions: res.followUpQuestions,
        createdAt: Date.now(),
      };
      await saveFeynmanAttempt(attempt);

      // Award XP
      await awardXpEvent({
        type: 'feynman_attempt',
        amount: 60,
        description: `Taught concept "${topic}" in Feynman mode`,
        referenceId: pages[0]?.projectId,
      });
    } catch (err) {
      console.error('Feynman evaluation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryAgain = () => {
    setActiveTab('input');
    setExplanation('');
    setFeedback(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/80 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Teach It Back (Feynman Technique)
              </h2>
              <p className="text-xs text-slate-500">
                Explain a concept in your own words. The AI verifies your explanation strictly against your notes.
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
          {activeTab === 'input' ? (
            <div className="flex flex-col gap-4">
              {/* Topic Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Concept / Topic to Explain
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Backpropagation Algorithm"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {/* Suggested Topics Pills */}
                {suggestedTopics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400">From your notes:</span>
                    {suggestedTopics.map((st, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTopic(st)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border transition ${
                          topic === st
                            ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Audience Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Audience (Who are you teaching?)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Grade 6 student', 'High schooler', 'Peer'] as const).map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setAudience(aud)}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${
                        audience === aud
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>

              {/* Explanation Textarea with Voice Support */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Your Explanation (In Your Own Words)
                  </label>
                  {isVoiceSupported && (
                    <button
                      type="button"
                      onClick={() => (isVoiceListening ? stopVoice() : startVoice())}
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border transition ${
                        isVoiceListening
                          ? 'bg-rose-500 border-rose-500 text-white animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isVoiceListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      {isVoiceListening ? 'Listening...' : 'Dictate'}
                    </button>
                  )}
                </div>

                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={6}
                  placeholder={`"Imagine you have a machine that learns by making guesses. When it gets something wrong, it looks backwards to see which parts made the mistake..."`}
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed placeholder:text-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={handleEvaluateExplanation}
                disabled={isLoading || !topic.trim() || !explanation.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Checking against your notes & grading...
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-current" />
                    Evaluate My Explanation
                  </>
                )}
              </button>
            </div>
          ) : feedback ? (
            /* Evaluation Results */
            <div className="flex flex-col gap-5">
              {/* Scorecard Header */}
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                    Feynman Mastery Score
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-0.5">
                    {feedback.scores.overall} / 10
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-indigo-600 border border-indigo-200 dark:border-indigo-800">
                      {feedback.scores.overall >= 8 ? 'Exemplary' : feedback.scores.overall >= 6 ? 'Proficient' : 'Needs Review'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">
                    "{feedback.verdict}"
                  </p>
                </div>

                {/* Subscore Rubric Chips */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <div className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400 font-medium">Accuracy</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{feedback.scores.accuracy}/10</div>
                  </div>
                  <div className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400 font-medium">Completeness</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{feedback.scores.completeness}/10</div>
                  </div>
                  <div className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400 font-medium">Clarity</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{feedback.scores.clarity}/10</div>
                  </div>
                  <div className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400 font-medium">Own Words</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{feedback.scores.ownWords}/10</div>
                  </div>
                </div>
              </div>

              {/* Covered vs Missing Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Covered Points */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Covered Accurately
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {feedback.coveredPoints.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Missing Points & Gaps */}
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Gaps & Missing Nuances
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {feedback.missingPoints.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Misconceptions flagged (if any) */}
              {feedback.misconceptions.length > 0 && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl">
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Misconceptions Flagged Against Notes
                  </h4>
                  <div className="space-y-2">
                    {feedback.misconceptions.map((m, idx) => (
                      <div key={idx} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs space-y-1 border border-rose-100 dark:border-rose-900">
                        <div className="text-rose-700 dark:text-rose-300 font-medium">
                          You said: "{m.studentClaim}"
                        </div>
                        <div className="text-slate-600 dark:text-slate-400">
                          What your notes state: {m.actualNoteFact} <span className="font-semibold text-indigo-600">{m.citation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Questions from the Confused Student */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                  <HelpCircle className="w-4 h-4 text-indigo-500" />
                  Follow-up Questions from your {audience}:
                </h4>
                <div className="space-y-2">
                  {feedback.followUpQuestions.map((q, idx) => (
                    <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                      "{q}"
                    </div>
                  ))}
                </div>
              </div>

              {/* Gaps actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {onCreateFlashcardsFromGaps && (
                    <button
                      type="button"
                      onClick={() => onCreateFlashcardsFromGaps(feedback.missingPoints)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Turn Gaps into Flashcards
                    </button>
                  )}

                  {onAddNotesToCanvas && (
                    <button
                      type="button"
                      onClick={() => onAddNotesToCanvas(feedback.missingPoints)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                      Add Missing Points to Notes
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Explain Again (Round {rounds.length + 1})
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
