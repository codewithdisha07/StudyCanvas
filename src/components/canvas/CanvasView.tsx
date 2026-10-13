import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Page, Stroke, TextBox, ToolType, Point, SelectionRect } from '../../types';
import { renderBackground, renderStroke, isStrokeIntersecting } from '../../canvas/CanvasEngine';
import { SelectionMenu } from './SelectionMenu';

interface CanvasViewProps {
  page: Page;
  onChangePage: (page: Page) => void;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  scale: number;
  panX: number;
  panY: number;
  onChangeTransform: (transform: { scale: number; panX: number; panY: number }) => void;
  isDark: boolean;
  onOpenAIWithSelection?: (rect: SelectionRect, action: 'explain' | 'summarize' | 'refine') => void;
  onConvertHandwriting?: () => void;
  selectionRect: SelectionRect | null;
  setSelectionRect: (rect: SelectionRect | null) => void;
  // History
  pushHistory: (page: Page) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  page,
  onChangePage,
  tool,
  color,
  size,
  opacity,
  scale,
  panX,
  panY,
  onChangeTransform,
  isDark,
  onOpenAIWithSelection,
  onConvertHandwriting,
  selectionRect,
  setSelectionRect,
  pushHistory,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction state
  const isPointerDownRef = useRef(false);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectStartRef = useRef<{ x: number; y: number } | null>(null);

  // Active editing text box
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [draggingTextBoxId, setDraggingTextBoxId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: clientX, y: clientY };
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      return {
        x: (rawX - panX) / scale,
        y: (rawY - panY) / scale,
      };
    },
    [panX, panY, scale]
  );

  // Redraw the canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Reset transform and render background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderBackground(ctx, width, height, page.background, { scale, panX, panY }, isDark);

    // Apply viewport scale & pan for strokes
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, panX * dpr, panY * dpr);

    // Render all saved strokes
    page.strokes.forEach((stroke) => renderStroke(ctx, stroke, isDark));

    // Render active stroke currently being drawn
    if (activeStrokeRef.current) {
      renderStroke(ctx, activeStrokeRef.current, isDark);
    }

    // Render selection rectangle if active
    if (selectionRect) {
      ctx.save();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([6 / scale, 6 / scale]);
      ctx.fillStyle = 'rgba(79, 70, 229, 0.08)';
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
      ctx.restore();
    }
  }, [page, scale, panX, panY, isDark, selectionRect]);

  // Sync canvas size with DPR
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    redraw();
  }, [redraw]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only primary button
    if (e.button !== 0 && tool !== 'pan') return;

    canvasRef.current?.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;
    const worldPt = screenToWorld(e.clientX, e.clientY);
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    if (tool === 'pen' || tool === 'highlighter') {
      setSelectionRect(null);
      setSelectedTextBoxId(null);
      activeStrokeRef.current = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tool,
        color,
        size,
        opacity,
        points: [{ x: worldPt.x, y: worldPt.y, pressure }],
      };
      redraw();
    } else if (tool === 'eraser') {
      setSelectionRect(null);
      // Stroke-level erasing: filter out intersected strokes
      const radius = size * 1.5;
      const filtered = page.strokes.filter((s) => !isStrokeIntersecting(s, worldPt, radius));
      if (filtered.length !== page.strokes.length) {
        pushHistory(page);
        onChangePage({ ...page, strokes: filtered, updatedAt: Date.now() });
      }
    } else if (tool === 'pan') {
      panStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
    } else if (tool === 'select') {
      selectStartRef.current = { x: worldPt.x, y: worldPt.y };
      setSelectionRect({ x: worldPt.x, y: worldPt.y, width: 0, height: 0 });
    } else if (tool === 'text') {
      // Place a new text box if not clicking an existing one
      const newTextBox: TextBox = {
        id: `tb-${Date.now()}`,
        x: worldPt.x,
        y: worldPt.y,
        width: 280,
        text: 'Type your study note here...',
        fontSize: 16,
        color: isDark ? '#f1f5f9' : '#1e293b',
      };
      pushHistory(page);
      onChangePage({
        ...page,
        textBoxes: [...page.textBoxes, newTextBox],
        updatedAt: Date.now(),
      });
      setEditingTextBoxId(newTextBox.id);
      setSelectedTextBoxId(newTextBox.id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    const worldPt = screenToWorld(e.clientX, e.clientY);
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    if (activeStrokeRef.current) {
      activeStrokeRef.current.points.push({ x: worldPt.x, y: worldPt.y, pressure });
      redraw();
    } else if (tool === 'eraser') {
      const radius = size * 1.5;
      const filtered = page.strokes.filter((s) => !isStrokeIntersecting(s, worldPt, radius));
      if (filtered.length !== page.strokes.length) {
        onChangePage({ ...page, strokes: filtered, updatedAt: Date.now() });
      }
    } else if (tool === 'pan' && panStartRef.current) {
      onChangeTransform({
        scale,
        panX: e.clientX - panStartRef.current.x,
        panY: e.clientY - panStartRef.current.y,
      });
    } else if (tool === 'select' && selectStartRef.current) {
      const minX = Math.min(selectStartRef.current.x, worldPt.x);
      const minY = Math.min(selectStartRef.current.y, worldPt.y);
      const width = Math.abs(worldPt.x - selectStartRef.current.x);
      const height = Math.abs(worldPt.y - selectStartRef.current.y);
      setSelectionRect({ x: minX, y: minY, width, height });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);

    if (activeStrokeRef.current && activeStrokeRef.current.points.length > 0) {
      pushHistory(page);
      const newStrokes = [...page.strokes, activeStrokeRef.current];
      activeStrokeRef.current = null;
      onChangePage({ ...page, strokes: newStrokes, updatedAt: Date.now() });
    }

    if (tool === 'select' && selectionRect) {
      // Ignore tiny unintentional micro-clicks
      if (selectionRect.width < 15 && selectionRect.height < 15) {
        setSelectionRect(null);
      }
    }

    panStartRef.current = null;
    selectStartRef.current = null;
    redraw();
  };

  // Wheel zoom with Ctrl or trackpad pinch
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || tool === 'pan') {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newScale = Math.min(4, Math.max(0.25, scale * zoomFactor));

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - panX) * (newScale / scale);
      const newPanY = mouseY - (mouseY - panY) * (newScale / scale);

      onChangeTransform({ scale: newScale, panX: newPanX, panY: newPanY });
    } else {
      // Normal trackpad scrolling pans canvas
      onChangeTransform({
        scale,
        panX: panX - e.deltaX,
        panY: panY - e.deltaY,
      });
    }
  };

  // Text Box Manipulation
  const handleStartDragTextBox = (e: React.MouseEvent, tbId: string) => {
    e.stopPropagation();
    setSelectedTextBoxId(tbId);
    setDraggingTextBoxId(tbId);
    const tb = page.textBoxes.find((t) => t.id === tbId);
    if (!tb) return;

    const mouseWorld = screenToWorld(e.clientX, e.clientY);
    dragOffsetRef.current = {
      x: mouseWorld.x - tb.x,
      y: mouseWorld.y - tb.y,
    };
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (draggingTextBoxId) {
      const mouseWorld = screenToWorld(e.clientX, e.clientY);
      const updatedBoxes = page.textBoxes.map((tb) => {
        if (tb.id === draggingTextBoxId) {
          return {
            ...tb,
            x: mouseWorld.x - dragOffsetRef.current.x,
            y: mouseWorld.y - dragOffsetRef.current.y,
          };
        }
        return tb;
      });
      onChangePage({ ...page, textBoxes: updatedBoxes, updatedAt: Date.now() });
    }
  };

  const handleContainerMouseUp = () => {
    if (draggingTextBoxId) {
      pushHistory(page);
      setDraggingTextBoxId(null);
    }
  };

  const handleDeleteTextBox = (tbId: string) => {
    pushHistory(page);
    const updated = page.textBoxes.filter((t) => t.id !== tbId);
    onChangePage({ ...page, textBoxes: updated, updatedAt: Date.now() });
    setSelectedTextBoxId(null);
    setEditingTextBoxId(null);
  };

  // Delete items inside selection
  const handleDeleteSelection = () => {
    if (!selectionRect) return;
    pushHistory(page);

    // Filter strokes that intersect selection
    const remainingStrokes = page.strokes.filter((s) => {
      return !s.points.some(
        (p) =>
          p.x >= selectionRect.x &&
          p.x <= selectionRect.x + selectionRect.width &&
          p.y >= selectionRect.y &&
          p.y <= selectionRect.y + selectionRect.height
      );
    });

    // Filter text boxes inside selection
    const remainingTextBoxes = page.textBoxes.filter((tb) => {
      return !(
        tb.x >= selectionRect.x &&
        tb.x <= selectionRect.x + selectionRect.width &&
        tb.y >= selectionRect.y &&
        tb.y <= selectionRect.y + selectionRect.height
      );
    });

    onChangePage({
      ...page,
      strokes: remainingStrokes,
      textBoxes: remainingTextBoxes,
      updatedAt: Date.now(),
    });
    setSelectionRect(null);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden select-none touch-none ${
        tool === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : tool === 'text'
          ? 'cursor-text'
          : tool === 'select'
          ? 'cursor-crosshair'
          : tool === 'eraser'
          ? 'cursor-cell'
          : 'cursor-crosshair'
      }`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full block"
      />

      {/* Render interactive HTML overlays for Text Boxes */}
      {page.textBoxes.map((tb) => {
        const isEditing = editingTextBoxId === tb.id;
        const isSelected = selectedTextBoxId === tb.id;
        const screenX = tb.x * scale + panX;
        const screenY = tb.y * scale + panY;

        return (
          <div
            key={tb.id}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY}px`,
              width: `${tb.width * scale}px`,
              transformOrigin: 'top left',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTextBoxId(tb.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTextBoxId(tb.id);
              setSelectedTextBoxId(tb.id);
            }}
            className={`group transition-shadow ${
              isSelected
                ? 'ring-2 ring-indigo-500 rounded-lg bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs p-1 shadow-md'
                : 'hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-700 rounded-lg p-1'
            }`}
          >
            {/* Drag Handle & Delete bar when selected */}
            {isSelected && (
              <div
                onMouseDown={(e) => handleStartDragTextBox(e, tb.id)}
                className="flex items-center justify-between pb-1 mb-1 border-b border-indigo-200 dark:border-indigo-800 cursor-move text-[10px] text-indigo-500 font-semibold"
              >
                <span>Drag to move</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTextBox(tb.id);
                  }}
                  className="px-1 text-red-500 hover:text-red-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {isEditing ? (
              <textarea
                autoFocus
                value={tb.text}
                onChange={(e) => {
                  const updated = page.textBoxes.map((t) =>
                    t.id === tb.id ? { ...t, text: e.target.value } : t
                  );
                  onChangePage({ ...page, textBoxes: updated, updatedAt: Date.now() });
                }}
                onBlur={() => setEditingTextBoxId(null)}
                style={{
                  fontSize: `${tb.fontSize * scale}px`,
                  color: tb.color,
                  lineHeight: 1.35,
                }}
                className="w-full min-h-[60px] bg-transparent outline-none resize-none border-none p-0 focus:ring-0"
              />
            ) : (
              <div
                style={{
                  fontSize: `${tb.fontSize * scale}px`,
                  color: tb.color,
                  lineHeight: 1.35,
                  whiteSpace: 'pre-wrap',
                }}
                className="w-full break-words select-text"
              >
                {tb.text}
              </div>
            )}
          </div>
        );
      })}

      {/* Floating Selection AI Menu */}
      {selectionRect && (
        <SelectionMenu
          rect={selectionRect}
          scale={scale}
          panX={panX}
          panY={panY}
          onExplain={() => onOpenAIWithSelection?.(selectionRect, 'explain')}
          onSummarize={() => onOpenAIWithSelection?.(selectionRect, 'summarize')}
          onRefine={() => onOpenAIWithSelection?.(selectionRect, 'refine')}
          onConvertHandwriting={onConvertHandwriting}
          onDelete={handleDeleteSelection}
          onClose={() => setSelectionRect(null)}
        />
      )}
    </div>
  );
};
