import React from 'react';
import { Zap, Flame, Shield } from 'lucide-react';
import type { UserStats } from '../../types';

interface LevelBarProps {
  stats: UserStats;
}

export const LevelBar: React.FC<LevelBarProps> = ({ stats }) => {
  const currentLevel = stats.level || 1;
  const currentXp = stats.xp || 0;

  // Level thresholds: level L requires (L - 1)^2 * 100 XP to enter, and L^2 * 100 XP to advance
  const prevLevelXp = Math.pow(currentLevel - 1, 2) * 100;
  const nextLevelXp = Math.pow(currentLevel, 2) * 100;
  const xpInCurrentLevel = Math.max(0, currentXp - prevLevelXp);
  const xpNeededForLevel = nextLevelXp - prevLevelXp;
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForLevel) * 100));

  return (
    <div className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 rounded-3xl p-5 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Level Info */}
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-2xl shadow-inner">
          <span>{currentLevel}</span>
          <span className="absolute -bottom-1 -right-1 p-0.5 bg-amber-400 text-slate-900 rounded-full">
            <Zap className="w-3 h-3 fill-current" />
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">Level {currentLevel} Scholar</h2>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold">
              {currentXp} Total XP
            </span>
          </div>
          <p className="text-xs text-indigo-100 mt-0.5">
            {nextLevelXp - currentXp} XP needed to reach Level {currentLevel + 1}
          </p>
        </div>
      </div>

      {/* Progress Bar & Freeze Badges */}
      <div className="w-full md:w-1/2 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-indigo-100 font-medium">
          <span>Level {currentLevel} Progress</span>
          <span>{progressPercent}%</span>
        </div>

        <div className="w-full h-3 bg-white/20 backdrop-blur-md rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-amber-300 to-amber-400 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-indigo-200 mt-0.5">
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-300 fill-current" />
            {stats.currentStreak} Day Streak
          </span>
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-cyan-300" />
            {stats.streakFreezes} Streak Freezes Available
          </span>
        </div>
      </div>
    </div>
  );
};
