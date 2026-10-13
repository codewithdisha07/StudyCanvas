import React from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Type,
  BoxSelect,
  Hand,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  ListFilter,
  FileText,
  CircleDot,
  Palette,
  Mic,
  Volume2,
  Sparkles,
} from 'lucide-react';
import type { ToolType, BackgroundType } from '../../types';

interface ToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  color: string;
  onChangeColor: (color: string) => void;
  size: number;
  onChangeSize: (size: number) => void;
  opacity: number;
  onChangeOpacity: (opacity: number) => void;
  background: BackgroundType;
  onChangeBackground: (bg: BackgroundType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onOpenVoiceDictation?: () => void;
  onOpenHandwritingConversion?: () => void;
  onReadThisPage?: () => void;
}

const PRESET_COLORS = [
  '#0f172a', // Slate black
  '#4f46e5', // Indigo
  '#0284c7', // Sky blue
  '#10b981', // Emerald green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  color,
  onChangeColor,
  size,
  onChangeSize,
  opacity,
  onChangeOpacity,
  background,
  onChangeBackground,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenVoiceDictation,
  onOpenHandwritingConversion,
  onReadThisPage,
}) => {
  const [showColorPopover, setShowColorPopover] = React.useState(false);
  const [showBgPopover, setShowBgPopover] = React.useState(false);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-1.5 p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-950/10 transition-all">
      {/* Primary Tools */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Pen Tool (P)"
          title="Pen (P)"
          onClick={() => onSelectTool('pen')}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'pen'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Pen className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Highlighter Tool (H)"
          title="Highlighter (H)"
          onClick={() => onSelectTool('highlighter')}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'highlighter'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Highlighter className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Eraser Tool (E)"
          title="Eraser (E)"
          onClick={() => onSelectTool('eraser')}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'eraser'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Eraser className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Text Box Tool (T)"
          title="Text Box (T)"
          onClick={() => onSelectTool('text')}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'text'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Type className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Selection Tool (S)"
          title="Selection Lasso (S)"
          onClick={() => onSelectTool('select')}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'select'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BoxSelect className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Pan Tool (Space)"
          title="Pan (Hold Space)"
          onClick={() => onSelectTool('pan')}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'pan'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

      {/* Color & Size Controls */}
      <div className="flex items-center gap-1.5 relative">
        <button
          type="button"
          aria-label="Color Palette"
          title="Choose Color"
          onClick={() => setShowColorPopover(!showColorPopover)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <span
            className="w-4 h-4 rounded-full border border-black/10 shadow-inner"
            style={{ backgroundColor: color }}
          />
          <Palette className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {showColorPopover && (
          <div className="absolute top-12 left-0 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col gap-2.5 z-30 w-48">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Palette</span>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChangeColor(c);
                    setShowColorPopover(false);
                  }}
                  className={`w-7 h-7 rounded-lg border transition-transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-indigo-500 scale-105' : 'border-black/10'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">Custom</span>
              <input
                type="color"
                value={color}
                onChange={(e) => onChangeColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
              />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">Opacity</span>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={opacity}
                onChange={(e) => onChangeOpacity(Number(e.target.value))}
                className="w-20 accent-indigo-600 cursor-pointer h-1.5"
                title={`Opacity: ${Math.round(opacity * 100)}%`}
              />
            </div>
          </div>
        )}

        {/* Brush Size Slider */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          <span className="text-xs font-medium text-slate-500 w-4 text-center">{size}</span>
          <input
            type="range"
            min={currentTool === 'highlighter' ? 10 : 1}
            max={currentTool === 'eraser' ? 40 : currentTool === 'highlighter' ? 36 : 20}
            value={size}
            onChange={(e) => onChangeSize(Number(e.target.value))}
            className="w-16 accent-indigo-600 cursor-pointer h-1.5"
            title={`Size: ${size}px`}
          />
        </div>
      </div>

      <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

      {/* Page Background Selector */}
      <div className="relative">
        <button
          type="button"
          aria-label="Paper Background Pattern"
          title="Background Template"
          onClick={() => setShowBgPopover(!showBgPopover)}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          {background === 'ruled' && <FileText className="w-4 h-4" />}
          {background === 'grid' && <Grid3X3 className="w-4 h-4" />}
          {background === 'dotted' && <CircleDot className="w-4 h-4" />}
          {background === 'blank' && <ListFilter className="w-4 h-4" />}
        </button>

        {showBgPopover && (
          <div className="absolute top-12 left-0 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col gap-1 z-30 w-36">
            {(['blank', 'ruled', 'grid', 'dotted'] as BackgroundType[]).map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => {
                  onChangeBackground(bg);
                  setShowBgPopover(false);
                }}
                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg capitalize transition ${
                  background === bg
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {bg === 'ruled' && <FileText className="w-3.5 h-3.5" />}
                {bg === 'grid' && <Grid3X3 className="w-3.5 h-3.5" />}
                {bg === 'dotted' && <CircleDot className="w-3.5 h-3.5" />}
                {bg === 'blank' && <ListFilter className="w-3.5 h-3.5" />}
                {bg} Paper
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

      {/* Undo & Redo */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Undo (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Redo (Ctrl+Shift+Z)"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Zoom Out"
          title="Zoom Out"
          onClick={onZoomOut}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label="Reset Zoom to 100%"
          title="Reset Zoom"
          onClick={onResetZoom}
          className="text-xs font-medium text-slate-600 dark:text-slate-300 px-1 hover:text-indigo-600 transition"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom In"
          title="Zoom In"
          onClick={onZoomIn}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {(onOpenVoiceDictation || onOpenHandwritingConversion || onReadThisPage) && (
        <>
          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />
          <div className="flex items-center gap-1">
            {onOpenVoiceDictation && (
              <button
                type="button"
                onClick={onOpenVoiceDictation}
                title="Dictate to Canvas (Voice Input)"
                aria-label="Dictate to Canvas"
                className="p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            {onOpenHandwritingConversion && (
              <button
                type="button"
                onClick={onOpenHandwritingConversion}
                title="Convert Handwriting to Typed Text"
                aria-label="Convert Handwriting to Typed Text"
                className="p-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {onReadThisPage && (
              <button
                type="button"
                onClick={onReadThisPage}
                title="Read This Page Aloud"
                aria-label="Read This Page Aloud"
                className="p-2 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
