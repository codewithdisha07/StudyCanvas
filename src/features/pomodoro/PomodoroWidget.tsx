import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Clock,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { recordStudySession, awardXpEvent } from '../../db';

interface PomodoroWidgetProps {
  projectId: string;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}

type SessionType = 'work' | 'short_break' | 'long_break';

interface StoredTimerState {
  projectId: string;
  sessionType: SessionType;
  startedAt: number; // Unix timestamp ms
  targetSeconds: number;
  completedCycles: number;
  isPaused: boolean;
  pausedSecondsRemaining: number;
}

const STORAGE_KEY = 'studycanvas_pomodoro_state';

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  projectId,
  isFocusMode,
  onToggleFocusMode,
}) => {
  const [sessionType, setSessionType] = useState<SessionType>('work');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [targetSeconds, setTargetSeconds] = useState(25 * 60);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const startTimestampRef = useRef<number | null>(null);

  // Sound chime synthesizer via Web Audio API (no external asset needed)
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio chime playback failed:', e);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.warn('Notification permission error:', e);
      }
    }
  };

  const sendBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }
  };

  // Restore timer state across browser reloads
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const stored: StoredTimerState = JSON.parse(raw);
        setSessionType(stored.sessionType);
        setTargetSeconds(stored.targetSeconds);
        setCompletedCycles(stored.completedCycles);

        if (stored.isPaused) {
          setIsRunning(true);
          setIsPaused(true);
          setSecondsRemaining(stored.pausedSecondsRemaining);
        } else {
          const now = Date.now();
          const elapsed = Math.floor((now - stored.startedAt) / 1000);
          const remaining = stored.targetSeconds - elapsed;

          if (remaining > 0) {
            setIsRunning(true);
            setIsPaused(false);
            setSecondsRemaining(remaining);
            startTimestampRef.current = stored.startedAt;
          } else {
            // Finished while offline/reloading
            handleSessionCompleted(stored.sessionType, stored.targetSeconds, stored.completedCycles);
          }
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Timer Tick Interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            handleSessionCompleted(sessionType, targetSeconds, completedCycles);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, sessionType, targetSeconds, completedCycles]);

  const persistState = (
    running: boolean,
    paused: boolean,
    type: SessionType,
    targetSecs: number,
    startMs: number | null,
    cycles: number,
    remainingSecs: number
  ) => {
    if (!running) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const state: StoredTimerState = {
      projectId,
      sessionType: type,
      startedAt: startMs || Date.now(),
      targetSeconds: targetSecs,
      completedCycles: cycles,
      isPaused: paused,
      pausedSecondsRemaining: remainingSecs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const handleStart = () => {
    requestNotificationPermission();
    const now = Date.now();
    startTimestampRef.current = now;
    setIsRunning(true);
    setIsPaused(false);
    persistState(true, false, sessionType, targetSeconds, now, completedCycles, secondsRemaining);
  };

  const handlePause = () => {
    setIsPaused(true);
    persistState(true, true, sessionType, targetSeconds, startTimestampRef.current, completedCycles, secondsRemaining);
  };

  const handleResume = () => {
    const now = Date.now();
    // Re-adjust startedAt to match remaining time
    const simulatedStart = now - (targetSeconds - secondsRemaining) * 1000;
    startTimestampRef.current = simulatedStart;
    setIsPaused(false);
    persistState(true, false, sessionType, targetSeconds, simulatedStart, completedCycles, secondsRemaining);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setSecondsRemaining(targetSeconds);
    startTimestampRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleSessionCompleted = async (
    completedType: SessionType,
    durationSecs: number,
    cyclesSoFar: number
  ) => {
    playChime();
    setIsRunning(false);
    setIsPaused(false);
    localStorage.removeItem(STORAGE_KEY);

    if (completedType === 'work') {
      const newCycles = cyclesSoFar + 1;
      setCompletedCycles(newCycles);

      // Record study session in Dexie IndexedDB
      await recordStudySession({
        projectId,
        focusSeconds: durationSecs,
        completed: true,
        type: 'pomodoro',
      });

      // Award XP
      await awardXpEvent({
        type: 'focus_session',
        amount: 50,
        description: `Completed 25m Focus Block (${newCycles}/4)`,
        referenceId: projectId,
      });

      sendBrowserNotification(
        '🎉 Focus Block Complete!',
        newCycles % 4 === 0
          ? 'Amazing work! Take a well-deserved 15-minute long break.'
          : 'Great focus! Take a 5-minute break to recharge.'
      );

      // Switch to break
      if (newCycles % 4 === 0) {
        setSessionType('long_break');
        setTargetSeconds(15 * 60);
        setSecondsRemaining(15 * 60);
      } else {
        setSessionType('short_break');
        setTargetSeconds(5 * 60);
        setSecondsRemaining(5 * 60);
      }
    } else {
      sendBrowserNotification('⏰ Break Over', 'Ready to dive back into your notes?');
      setSessionType('work');
      setTargetSeconds(25 * 60);
      setSecondsRemaining(25 * 60);
    }
  };

  const handleSelectPreset = (workMins: number, _breakMins: number) => {
    handleReset();
    setSessionType('work');
    setTargetSeconds(workMins * 60);
    setSecondsRemaining(workMins * 60);
    setShowPresetMenu(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-2.5 py-1 text-xs shadow-2xs">
      {/* Timer Display */}
      <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800 dark:text-slate-100">
        <Clock className={`w-3.5 h-3.5 ${isRunning && !isPaused ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
        <span>{formatTime(secondsRemaining)}</span>
      </div>

      {/* Mode Tag */}
      <span
        onClick={() => setShowPresetMenu(!showPresetMenu)}
        className="cursor-pointer text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition"
        title="Change Pomodoro Preset (25/5, 50/10)"
      >
        {sessionType === 'work' ? 'Focus' : sessionType === 'short_break' ? 'Short Break' : 'Long Break'}
      </span>

      {/* Preset Popup */}
      {showPresetMenu && (
        <div className="absolute top-12 left-24 z-50 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-1 w-36">
          <button
            type="button"
            onClick={() => handleSelectPreset(25, 5)}
            className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
          >
            25m / 5m (Standard)
          </button>
          <button
            type="button"
            onClick={() => handleSelectPreset(50, 10)}
            className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
          >
            50m / 10m (Deep Work)
          </button>
          <button
            type="button"
            onClick={() => handleSelectPreset(15, 3)}
            className="px-2 py-1 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
          >
            15m / 3m (Sprint)
          </button>
        </div>
      )}

      {/* Cycle Indicator (dots) */}
      <div className="hidden sm:flex items-center gap-0.5" title={`Cycles: ${completedCycles % 4}/4`}>
        {[0, 1, 2, 3].map((idx) => (
          <span
            key={idx}
            className={`w-1.5 h-1.5 rounded-full ${
              idx < completedCycles % 4 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-1.5">
        {!isRunning ? (
          <button
            type="button"
            onClick={handleStart}
            className="p-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
            title="Start Focus Timer"
            aria-label="Start Focus Timer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : isPaused ? (
          <button
            type="button"
            onClick={handleResume}
            className="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition"
            title="Resume Focus Timer"
            aria-label="Resume Focus Timer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="p-1 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition"
            title="Pause Focus Timer"
            aria-label="Pause Focus Timer"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          title="Reset Timer"
          aria-label="Reset Timer"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={() => handleSessionCompleted(sessionType, targetSeconds, completedCycles)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          title="Skip to next session"
          aria-label="Skip to next session"
        >
          <SkipForward className="w-3 h-3" />
        </button>

        {/* Focus Mode Toggle */}
        <button
          type="button"
          onClick={onToggleFocusMode}
          className={`p-1 rounded-lg transition ${
            isFocusMode
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
          title={isFocusMode ? 'Exit Distraction-Free Focus Mode' : 'Enter Distraction-Free Focus Mode'}
          aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        >
          {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
