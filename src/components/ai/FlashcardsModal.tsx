import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  RotateCw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import type { Page, Flashcard } from '../../types';
import { generateFlashcards } from '../../ai/aiClient';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { getFlashcardsForProject, saveFlashcard, saveMultipleFlashcards } from '../../db';

interface FlashcardsModalProps {
  projectId: string;
  pages: Page[];
  currentPageId: string;
  onClose: () => void;
  onNavigateToPage: (pageNumber: number) => void;
}

export const FlashcardsModal: React.FC<FlashcardsModalProps> = ({
  projectId,
  pages,
  currentPageId,
  onClose,
  onNavigateToPage,
}) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCards();
  }, [projectId]);

  const loadCards = async () => {
    const existing = await getFlashcardsForProject(projectId);
    setCards(existing);
  };

  const handleGenerateCards = async () => {
    setIsLoading(true);
    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope: 'project',
      });

      const res = await generateFlashcards(5, context);
      const newCards: Flashcard[] = res.flashcards.map((c, i) => ({
        id: `fc-${Date.now()}-${i}`,
        projectId,
        front: c.front,
        back: c.back,
        sourcePageNumber: c.sourcePageNumber || 1,
        confidence: 'unreviewed',
        box: 1,
        nextReviewAt: Date.now(),
      }));

      await saveMultipleFlashcards(newCards);
      setCards((prev) => [...prev, ...newCards]);
      setCurrentIndex(cards.length);
      setIsFlipped(false);
    } catch (err) {
      console.error('Flashcards error:', err);
      alert('Failed to generate flashcards. Make sure your notes are not empty.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkConfidence = async (confidence: 'know' | 'learning') => {
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    // Simple Leitner Box algorithm:
    // If 'know': advance box (max 5)
    // If 'learning': reset to box 1
    const newBox = confidence === 'know' ? Math.min(5, currentCard.box + 1) : 1;
    const intervalDays = Math.pow(2, newBox - 1); // 1, 2, 4, 8, 16 days
    const nextReviewAt = Date.now() + intervalDays * 24 * 60 * 60 * 1000;

    const updated: Flashcard = {
      ...currentCard,
      confidence,
      box: newBox,
      nextReviewAt,
    };

    await saveFlashcard(updated);

    const updatedList = cards.map((c, idx) => (idx === currentIndex ? updated : c));
    setCards(updatedList);

    // Advance to next card
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                AI Flashcards (Spaced Repetition)
              </h3>
              <p className="text-[11px] text-slate-500">
                Leitner box system grounded in your handwritten and typed notes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerateCards}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg flex items-center gap-1 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isLoading ? 'Generating...' : '+ Generate'}
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
        <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[360px]">
          {cards.length === 0 ? (
            <div className="text-center space-y-3 max-w-xs">
              <BookOpen className="w-10 h-10 text-indigo-400 mx-auto opacity-60" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No flashcards created yet
              </h4>
              <p className="text-xs text-slate-400">
                Click Generate to turn concepts and diagrams from your project notes into interactive flashcards.
              </p>
              <button
                type="button"
                onClick={handleGenerateCards}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Flashcards
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-4">
              {/* Progress counter & Leitner Box indicator */}
              <div className="w-full flex items-center justify-between text-xs text-slate-400">
                <span>
                  Card {currentIndex + 1} of {cards.length}
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                  Leitner Box: {currentCard?.box || 1} / 5
                </span>
              </div>

              {/* 3D Flip Card Container */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full h-64 cursor-pointer perspective-1000 group relative"
              >
                <div
                  className={`w-full h-full duration-500 transform-style-preserve-3d transition-transform ${
                    isFlipped ? 'rotate-y-180' : ''
                  }`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Front Side */}
                  <div
                    className={`absolute inset-0 w-full h-full backface-hidden rounded-2xl p-6 border flex flex-col justify-between shadow-lg transition-all ${
                      !isFlipped ? 'block' : 'hidden'
                    } bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                        Question / Concept
                      </span>
                      <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                    </div>

                    <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 text-center px-4 leading-relaxed">
                      {currentCard?.front}
                    </div>

                    <div className="text-center text-[11px] text-slate-400 italic">
                      Click to flip and reveal answer
                    </div>
                  </div>

                  {/* Back Side */}
                  <div
                    className={`absolute inset-0 w-full h-full backface-hidden rounded-2xl p-6 border flex flex-col justify-between shadow-lg transition-all ${
                      isFlipped ? 'block' : 'hidden'
                    } bg-gradient-to-br from-indigo-50/60 to-purple-50/60 dark:from-indigo-950/40 dark:to-slate-900 border-indigo-200 dark:border-indigo-800`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                        Answer (From Notes)
                      </span>
                      <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                    </div>

                    <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 text-center px-4 leading-relaxed whitespace-pre-wrap">
                      {currentCard?.back}
                    </div>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToPage(currentCard?.sourcePageNumber || 1);
                          onClose();
                        }}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        Source: [Page {currentCard?.sourcePageNumber || 1}] →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Know it vs Still Learning */}
              <div className="flex items-center gap-3 w-full max-w-sm mt-2">
                <button
                  type="button"
                  onClick={() => handleMarkConfidence('learning')}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  Still Learning
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkConfidence('know')}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Know It!
                </button>
              </div>

              {/* Carousel navigation */}
              <div className="flex items-center justify-between w-full pt-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => {
                    setCurrentIndex((prev) => prev - 1);
                    setIsFlipped(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded-lg transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-[11px] text-slate-400 font-mono">
                  {currentIndex + 1} / {cards.length}
                </span>

                <button
                  type="button"
                  disabled={currentIndex === cards.length - 1}
                  onClick={() => {
                    setCurrentIndex((prev) => prev + 1);
                    setIsFlipped(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded-lg transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
