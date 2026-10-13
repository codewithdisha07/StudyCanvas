import React, { useMemo, useState } from 'react';
import { Flame, Calendar, Trophy } from 'lucide-react';
import type { UserStats } from '../../types';

interface HeatmapProps {
  xpMap: Record<string, number>; // "YYYY-MM-DD" -> XP earned
  stats: UserStats;
}

export const Heatmap: React.FC<HeatmapProps> = ({ xpMap, stats }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    dateStr: string;
    xp: number;
    x: number;
    y: number;
  } | null>(null);

  // Compute last 52 weeks (364 days + current week)
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    // End on upcoming Saturday to complete grid
    const end = new Date(today);
    const dayOfWeek = end.getDay(); // 0 is Sunday
    end.setDate(end.getDate() + (6 - dayOfWeek));

    const totalDays = 52 * 7;
    const start = new Date(end);
    start.setDate(start.getDate() - totalDays + 1);

    const generatedWeeks: Array<Array<{ date: Date; dateStr: string; xp: number }>> = [];
    const months: Array<{ label: string; weekIndex: number }> = [];

    let currentDay = new Date(start);
    let currentWeek: Array<{ date: Date; dateStr: string; xp: number }> = [];
    let lastMonth = -1;

    while (currentDay <= end) {
      const year = currentDay.getFullYear();
      const month = String(currentDay.getMonth() + 1).padStart(2, '0');
      const day = String(currentDay.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      if (currentDay.getMonth() !== lastMonth && currentDay.getDate() <= 7) {
        lastMonth = currentDay.getMonth();
        months.push({
          label: currentDay.toLocaleString('default', { month: 'short' }),
          weekIndex: generatedWeeks.length,
        });
      }

      currentWeek.push({
        date: new Date(currentDay),
        dateStr,
        xp: xpMap[dateStr] || 0,
      });

      if (currentWeek.length === 7) {
        generatedWeeks.push(currentWeek);
        currentWeek = [];
      }

      currentDay.setDate(currentDay.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      generatedWeeks.push(currentWeek);
    }

    return { weeks: generatedWeeks, monthLabels: months };
  }, [xpMap]);

  const getColor = (xp: number) => {
    if (xp === 0) return 'var(--cell-empty, #e2e8f0)';
    if (xp < 30) return '#a5b4fc'; // Light indigo
    if (xp < 70) return '#818cf8'; // Medium indigo
    if (xp < 120) return '#6366f1'; // Deep indigo
    return '#4338ca'; // Intense indigo
  };

  const cellSize = 11;
  const cellGap = 3;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
      {/* Top Header with Streaks */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/70 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Study Activity Heatmap
            </h3>
            <p className="text-xs text-slate-500">Last 52 weeks of focused study sessions & XP</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500 animate-bounce" />
            <span>{stats.currentStreak} Day Streak</span>
            {stats.streakFreezes > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full font-medium ml-1">
                ❄️ {stats.streakFreezes} Freeze
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-medium text-slate-700 dark:text-slate-300">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Best: {stats.longestStreak} days</span>
          </div>
        </div>
      </div>

      {/* SVG Heatmap */}
      <div className="overflow-x-auto pb-2 relative">
        <svg
          width={weeks.length * (cellSize + cellGap) + 40}
          height={7 * (cellSize + cellGap) + 30}
          className="select-none"
        >
          {/* Month labels */}
          {monthLabels.map((m, idx) => (
            <text
              key={idx}
              x={m.weekIndex * (cellSize + cellGap) + 30}
              y={12}
              className="fill-slate-400 dark:fill-slate-500 text-[9px] font-sans"
            >
              {m.label}
            </text>
          ))}

          {/* Day of week labels */}
          <text x={4} y={32} className="fill-slate-400 dark:fill-slate-500 text-[8px]">
            Mon
          </text>
          <text x={4} y={58} className="fill-slate-400 dark:fill-slate-500 text-[8px]">
            Wed
          </text>
          <text x={4} y={84} className="fill-slate-400 dark:fill-slate-500 text-[8px]">
            Fri
          </text>

          {/* Grid Cells */}
          <g transform="translate(30, 20)">
            {weeks.map((week, wIdx) =>
              week.map((cell, dIdx) => (
                <rect
                  key={cell.dateStr}
                  x={wIdx * (cellSize + cellGap)}
                  y={dIdx * (cellSize + cellGap)}
                  width={cellSize}
                  height={cellSize}
                  rx={2.5}
                  fill={cell.xp === 0 ? 'currentColor' : getColor(cell.xp)}
                  className={`${
                    cell.xp === 0
                      ? 'text-slate-100 dark:text-slate-800'
                      : 'hover:stroke hover:stroke-indigo-300 dark:hover:stroke-indigo-500 transition-all cursor-pointer'
                  }`}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredCell({
                      dateStr: cell.dateStr,
                      xp: cell.xp,
                      x: rect.left,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={() => setHoveredCell(null)}
                />
              ))
            )}
          </g>
        </svg>

        {/* Floating Tooltip */}
        {hoveredCell && (
          <div
            style={{
              position: 'fixed',
              left: `${hoveredCell.x}px`,
              top: `${hoveredCell.y - 38}px`,
            }}
            className="z-50 pointer-events-none -translate-x-1/2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-lg whitespace-nowrap"
          >
            {hoveredCell.xp > 0 ? `${hoveredCell.xp} XP` : 'No study recorded'} on{' '}
            {hoveredCell.dateStr}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span>Daily activity intensity</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 dark:bg-slate-800" />
          <span className="w-2.5 h-2.5 rounded-xs bg-indigo-300" />
          <span className="w-2.5 h-2.5 rounded-xs bg-indigo-400" />
          <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
          <span className="w-2.5 h-2.5 rounded-xs bg-indigo-800" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
