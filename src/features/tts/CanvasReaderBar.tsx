import React, { useEffect } from 'react';
import { Volume2, Pause, Play, SkipForward, SkipBack, X } from 'lucide-react';
import type { TextBox } from '../../types';
import { useSpeech } from './useSpeech';

interface CanvasReaderBarProps {
  textBoxes: TextBox[];
  onActiveTextBoxChange: (id: string | null) => void;
  onClose: () => void;
}

export const CanvasReaderBar: React.FC<CanvasReaderBarProps> = ({
  textBoxes,
  onActiveTextBoxChange,
  onClose,
}) => {
  // Sort text boxes in natural reading order: top-to-bottom, left-to-right
  const sortedBoxes = [...textBoxes].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 20) return yDiff;
    return a.x - b.x;
  });

  const fullText = sortedBoxes.map((b) => b.text).join('\n\n');

  const {
    isPaused,
    currentSentenceIndex,
    sentences,
    play,
    pause,
    resume,
    stop,
    next,
    prev,
  } = useSpeech({
    onSentenceChange: (_idx, sentence) => {
      // Find which text box contains this sentence
      const targetBox = sortedBoxes.find((b) => b.text.includes(sentence.slice(0, 20)));
      if (targetBox) {
        onActiveTextBoxChange(targetBox.id);
      }
    },
    onFinish: () => {
      onActiveTextBoxChange(null);
    },
  });

  useEffect(() => {
    if (fullText.trim().length > 0) {
      play(fullText);
    }
    return () => {
      stop();
      onActiveTextBoxChange(null);
    };
  }, []);

  return (
    <aside
      aria-label="Floating Canvas Audio Reader Bar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-indigo-200 dark:border-indigo-900 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 max-w-lg w-full transition-all animate-in fade-in slide-in-from-bottom-3"
    >
      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
        <Volume2 className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            Reading Page Notes
          </span>
          <span className="font-mono">
            {currentSentenceIndex >= 0 ? currentSentenceIndex + 1 : 0}/{sentences.length}
          </span>
        </div>
        <p className="text-xs text-slate-800 dark:text-slate-100 font-medium truncate">
          {sentences[currentSentenceIndex] || 'Reading notes...'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={prev}
          disabled={currentSentenceIndex <= 0}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg transition"
          title="Previous Sentence"
          aria-label="Previous Sentence"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => (isPaused ? resume() : pause())}
          className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs hover:bg-indigo-700 transition"
          title={isPaused ? 'Resume' : 'Pause'}
          aria-label={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={next}
          disabled={currentSentenceIndex >= sentences.length - 1}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg transition"
          title="Next Sentence"
          aria-label="Next Sentence"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition"
          title="Close Reader"
          aria-label="Close Reader"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
