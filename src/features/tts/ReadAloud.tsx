import React, { useState } from 'react';
import { Volume2, VolumeX, Pause, Play, SkipForward, SkipBack, Settings2 } from 'lucide-react';
import { useSpeech } from './useSpeech';

interface ReadAloudProps {
  text: string;
  lang?: string;
  className?: string;
  highlightInPlace?: boolean;
}

export const ReadAloud: React.FC<ReadAloudProps> = ({
  text,
  lang,
  className = '',
  highlightInPlace = false,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const {
    isPlaying,
    isPaused,
    currentSentenceIndex,
    sentences,
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
    play,
    pause,
    resume,
    stop,
    next,
    prev,
  } = useSpeech();

  const handleTogglePlay = () => {
    if (isPlaying) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      play(text, lang);
    }
  };

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2 py-1 shadow-2xs">
        <button
          type="button"
          onClick={handleTogglePlay}
          className="p-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
          title={isPlaying ? (isPaused ? 'Resume Read-Aloud' : 'Pause Read-Aloud') : 'Read Aloud'}
          aria-label={isPlaying ? (isPaused ? 'Resume Read-Aloud' : 'Pause Read-Aloud') : 'Read Aloud'}
        >
          {isPlaying ? (
            isPaused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>

        {isPlaying && (
          <>
            <button
              type="button"
              onClick={prev}
              disabled={currentSentenceIndex <= 0}
              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 transition"
              title="Previous Sentence"
              aria-label="Previous Sentence"
            >
              <SkipBack className="w-3 h-3" />
            </button>

            <span className="text-[10px] font-mono text-slate-500 px-1">
              {currentSentenceIndex + 1}/{sentences.length}
            </span>

            <button
              type="button"
              onClick={next}
              disabled={currentSentenceIndex >= sentences.length - 1}
              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 transition"
              title="Next Sentence"
              aria-label="Next Sentence"
            >
              <SkipForward className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={stop}
              className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title="Stop"
              aria-label="Stop Reading"
            >
              <VolumeX className="w-3 h-3" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
          title="Speech Settings"
          aria-label="Speech Settings"
        >
          <Settings2 className="w-3 h-3" />
        </button>
      </div>

      {/* Settings Popover */}
      {showSettings && (
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-2 z-40 text-xs w-56">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Speed: {rate}x</label>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 cursor-pointer"
            />
          </div>

          {voices.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Voice</label>
              <select
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const match = voices.find((v) => v.name === e.target.value);
                  if (match) setSelectedVoice(match);
                }}
                className="w-full mt-1 p-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                {voices.slice(0, 15).map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* In-place Sentence Highlight if reading */}
      {isPlaying && highlightInPlace && sentences[currentSentenceIndex] && (
        <div className="mt-1 p-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-medium text-indigo-900 dark:text-indigo-200 animate-pulse">
          🗣️ "{sentences[currentSentenceIndex]}"
        </div>
      )}
    </div>
  );
};
