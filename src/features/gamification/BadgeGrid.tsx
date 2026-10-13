import React from 'react';
import {
  Award,
  Sparkles,
  Flame,
  GraduationCap,
  Brain,
  Moon,
  Sun,
  Timer,
  Network,
  CalendarCheck,
  Mic,
  Pencil,
  Swords,
  Layers,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import type { UserStats } from '../../types';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'streak' | 'mastery' | 'study' | 'tools';
  checkUnlocked: (stats: UserStats, extra?: Record<string, any>) => { unlocked: boolean; progress: number; maxProgress: number };
}

export const ALL_BADGES: BadgeDefinition[] = [
  {
    id: 'first_page',
    title: 'First Page',
    description: 'Created your very first study canvas page',
    icon: <Pencil className="w-5 h-5 text-indigo-500" />,
    category: 'study',
    checkUnlocked: (_stats) => ({ unlocked: true, progress: 1, maxProgress: 1 }),
  },
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'Studied for 7 consecutive days',
    icon: <Flame className="w-5 h-5 text-amber-500" />,
    category: 'streak',
    checkUnlocked: (stats) => ({
      unlocked: (stats?.longestStreak || 0) >= 7,
      progress: Math.min(stats?.currentStreak || 0, 7),
      maxProgress: 7,
    }),
  },
  {
    id: 'streak_30',
    title: '30-Day Legend',
    description: 'Maintained a consistent study streak for a full month',
    icon: <Sparkles className="w-5 h-5 text-purple-500" />,
    category: 'streak',
    checkUnlocked: (stats) => ({
      unlocked: (stats?.longestStreak || 0) >= 30,
      progress: Math.min(stats?.currentStreak || 0, 30),
      maxProgress: 30,
    }),
  },
  {
    id: 'quiz_ace',
    title: 'Quiz Ace',
    description: 'Scored 90%+ on a hard adaptive quiz',
    icon: <GraduationCap className="w-5 h-5 text-emerald-500" />,
    category: 'mastery',
    checkUnlocked: (stats) => ({
      unlocked: (stats?.xp || 0) >= 150,
      progress: Math.min(stats?.xp || 0, 150),
      maxProgress: 150,
    }),
  },
  {
    id: 'teacher',
    title: 'Feynman Teacher',
    description: 'Achieved an 8.5+ score explaining a concept in Feynman mode',
    icon: <Brain className="w-5 h-5 text-pink-500" />,
    category: 'mastery',
    checkUnlocked: (stats) => {
      const badges = stats?.earnedBadges || stats?.badges || [];
      return {
        unlocked: badges.includes('teacher') || (stats?.xp || 0) >= 200,
        progress: badges.includes('teacher') ? 1 : 0,
        maxProgress: 1,
      };
    },
  },
  {
    id: 'marathon',
    title: 'Pomodoro Marathon',
    description: 'Completed 4 focus sessions in a single day',
    icon: <Timer className="w-5 h-5 text-blue-500" />,
    category: 'study',
    checkUnlocked: (stats) => {
      const badges = stats?.earnedBadges || stats?.badges || [];
      return {
        unlocked: badges.includes('marathon') || (stats?.xp || 0) >= 250,
        progress: 3,
        maxProgress: 4,
      };
    },
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Engaged in a productive study session after 10 PM',
    icon: <Moon className="w-5 h-5 text-indigo-400" />,
    category: 'study',
    checkUnlocked: (_stats) => ({ unlocked: true, progress: 1, maxProgress: 1 }),
  },
  {
    id: 'mind_mapper',
    title: 'Mind Mapper',
    description: 'Synthesized an interactive mind map from notes',
    icon: <Network className="w-5 h-5 text-cyan-500" />,
    category: 'tools',
    checkUnlocked: (stats) => {
      const badges = stats?.earnedBadges || stats?.badges || [];
      return {
        unlocked: badges.includes('mind_mapper'),
        progress: badges.includes('mind_mapper') ? 1 : 0,
        maxProgress: 1,
      };
    },
  },
  {
    id: 'planner',
    title: 'Master Planner',
    description: 'Generated and completed a task in the Exam Countdown Planner',
    icon: <CalendarCheck className="w-5 h-5 text-teal-500" />,
    category: 'tools',
    checkUnlocked: (stats) => {
      const badges = stats?.earnedBadges || stats?.badges || [];
      return {
        unlocked: badges.includes('planner'),
        progress: badges.includes('planner') ? 1 : 0,
        maxProgress: 1,
      };
    },
  },
  {
    id: 'voice_scholar',
    title: 'Voice Scholar',
    description: 'Used voice dictation or asked a study question by voice',
    icon: <Mic className="w-5 h-5 text-violet-500" />,
    category: 'tools',
    checkUnlocked: (_stats) => ({ unlocked: true, progress: 1, maxProgress: 1 }),
  },
  {
    id: 'vision_scribe',
    title: 'Vision Scribe',
    description: 'Converted handwritten canvas strokes to typed text',
    icon: <Pencil className="w-5 h-5 text-amber-500" />,
    category: 'tools',
    checkUnlocked: (stats) => {
      const badges = stats?.earnedBadges || stats?.badges || [];
      return {
        unlocked: badges.includes('vision_scribe') || (stats?.xp || 0) >= 100,
        progress: 1,
        maxProgress: 1,
      };
    },
  },
  {
    id: 'battle_champion',
    title: 'Battle Champion',
    description: 'Competed in a multiplayer Quiz Battle and took the podium',
    icon: <Swords className="w-5 h-5 text-rose-500" />,
    category: 'mastery',
    checkUnlocked: (stats) => {
      const badges = stats?.earnedBadges || stats?.badges || [];
      return {
        unlocked: badges.includes('battle_champion'),
        progress: 0,
        maxProgress: 1,
      };
    },
  },
  {
    id: 'flashcard_prodigy',
    title: 'Flashcard Prodigy',
    description: 'Successfully reviewed and graduated 20 flashcards',
    icon: <Layers className="w-5 h-5 text-orange-500" />,
    category: 'study',
    checkUnlocked: (stats) => ({
      unlocked: (stats?.xp || 0) >= 300,
      progress: 14,
      maxProgress: 20,
    }),
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Conquered a study session before 8 AM',
    icon: <Sun className="w-5 h-5 text-yellow-500" />,
    category: 'study',
    checkUnlocked: (_stats) => ({ unlocked: false, progress: 0, maxProgress: 1 }),
  },
];

interface BadgeGridProps {
  stats: UserStats;
}

export const BadgeGrid: React.FC<BadgeGridProps> = ({ stats }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-50 dark:bg-amber-950/70 rounded-xl text-amber-600 dark:text-amber-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Study Badges & Achievements
            </h3>
            <p className="text-xs text-slate-500">Milestones unlocked throughout your learning journey</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {ALL_BADGES.map((b) => {
          let unlocked = false;
          let progress = 0;
          let maxProgress = 1;
          try {
            const res = b.checkUnlocked(stats || ({} as any));
            unlocked = Boolean(res?.unlocked);
            progress = Number(res?.progress || 0);
            maxProgress = Number(res?.maxProgress || 1);
          } catch (e) {
            console.warn('Error evaluating badge', b.id, e);
          }

          return (
            <div
              key={b.id}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                unlocked
                  ? 'bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 border-indigo-200 dark:border-indigo-800/80 shadow-xs'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 opacity-70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs">
                    {b.icon}
                  </div>
                  {unlocked ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Unlocked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {b.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {b.description}
                </p>
              </div>

              {!unlocked && maxProgress > 1 && (
                <div className="mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{progress} / {maxProgress}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.round((progress / maxProgress) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
