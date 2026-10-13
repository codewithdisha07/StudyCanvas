import type { Stroke, TextBox, Point, BackgroundType } from '../types';

export interface ViewportTransform {
  scale: number;
  panX: number;
  panY: number;
}

/**
 * Calculates distance from point (px, py) to line segment (x1, y1)-(x2, y2)
 */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Check if a stroke intersects with an eraser point with given radius
 */
export function isStrokeIntersecting(stroke: Stroke, eraserPoint: Point, radius: number): boolean {
  const points = stroke.points;
  if (points.length === 0) return false;
  if (points.length === 1) {
    return Math.hypot(points[0].x - eraserPoint.x, points[0].y - eraserPoint.y) <= radius + stroke.size / 2;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegment(eraserPoint.x, eraserPoint.y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    if (d <= radius + stroke.size / 2) {
      return true;
    }
  }
  return false;
}

/**
 * Draw background pattern (blank, ruled, grid, dotted)
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  type: BackgroundType,
  transform: ViewportTransform,
  isDark: boolean
) {
  const bgFill = isDark ? '#14151b' : '#ffffff';
  ctx.save();
  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, width, height);

  if (type === 'blank') {
    ctx.restore();
    return;
  }

  const lineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const dotColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.18)';
  const marginColor = isDark ? 'rgba(244, 63, 94, 0.25)' : 'rgba(239, 68, 68, 0.35)';

  ctx.translate(transform.panX, transform.panY);
  ctx.scale(transform.scale, transform.scale);

  // Visible canvas bounds in world coordinates
  const left = -transform.panX / transform.scale;
  const top = -transform.panY / transform.scale;
  const right = left + width / transform.scale;
  const bottom = top + height / transform.scale;

  const spacing = 32;

  if (type === 'ruled') {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1 / transform.scale;
    const startY = Math.floor(top / spacing) * spacing;
    ctx.beginPath();
    for (let y = startY; y <= bottom; y += spacing) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    // Red margin line on left
    ctx.strokeStyle = marginColor;
    ctx.lineWidth = 1.5 / transform.scale;
    ctx.beginPath();
    ctx.moveTo(70, top);
    ctx.lineTo(70, bottom);
    ctx.stroke();
  } else if (type === 'grid') {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1 / transform.scale;
    const startX = Math.floor(left / spacing) * spacing;
    const startY = Math.floor(top / spacing) * spacing;
    ctx.beginPath();
    for (let x = startX; x <= right; x += spacing) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= bottom; y += spacing) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  } else if (type === 'dotted') {
    ctx.fillStyle = dotColor;
    const dotSpacing = 28;
    const startX = Math.floor(left / dotSpacing) * dotSpacing;
    const startY = Math.floor(top / dotSpacing) * dotSpacing;
    const r = 1.5 / transform.scale;
    for (let x = startX; x <= right; x += dotSpacing) {
      for (let y = startY; y <= bottom; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Maps ink colors dynamically for dark mode without modifying persistent stroke data
 */
export function getAdaptiveInkColor(color: string, isDark: boolean): string {
  if (!isDark) return color;
  const lower = color.toLowerCase();
  if (lower === '#0f172a' || lower === '#000000' || lower === '#1e293b' || lower === '#181920' || lower === '#334155') {
    return '#f1f5f9';
  }
  return color;
}

/**
 * Render strokes smoothly with quadratic Bézier curves
 */
export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, isDark = false) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;

  const displayColor = stroke.tool === 'highlighter' ? stroke.color : getAdaptiveInkColor(stroke.color, isDark);

  ctx.save();
  ctx.strokeStyle = displayColor;
  ctx.fillStyle = displayColor;
  ctx.lineCap = stroke.tool === 'highlighter' ? 'square' : 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = stroke.tool === 'highlighter' ? Math.min(stroke.opacity, 0.45) : stroke.opacity;

  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';
  }

  if (pts.length === 1) {
    // Single dot
    const p = pts[0];
    const r = (stroke.size * (p.pressure ? 0.5 + p.pressure * 0.5 : 1)) / 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (pts.length === 2) {
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Smooth quadratic curve through midpoints
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 1; i < pts.length - 1; i++) {
    const current = pts[i];
    const next = pts[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.lineWidth = stroke.size * (current.pressure ? 0.4 + current.pressure * 0.8 : 1);
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Render typed text boxes directly on canvas (for export or offscreen rendering)
 */
export function renderTextBox(ctx: CanvasRenderingContext2D, tb: TextBox, isDark = false) {
  ctx.save();
  ctx.font = `${tb.fontSize}px 'Plus Jakarta Sans', system-ui, sans-serif`;
  ctx.fillStyle = getAdaptiveInkColor(tb.color, isDark);
  ctx.textBaseline = 'top';

  const lines = tb.text.split('\n');
  const lineHeight = tb.fontSize * 1.35;

  lines.forEach((line, index) => {
    ctx.fillText(line, tb.x, tb.y + index * lineHeight);
  });

  ctx.restore();
}

/**
 * High-resolution offscreen rendering of a page (used for PDF export, thumbnails, and AI vision)
 */
export function renderPageOffscreen(
  page: { strokes: Stroke[]; textBoxes: TextBox[]; background: BackgroundType },
  width = 1200,
  height = 1600,
  scale = 2,
  isDark = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);

  // Render background
  renderBackground(ctx, width, height, page.background, { scale: 1, panX: 0, panY: 0 }, isDark);

  // Render all strokes
  page.strokes.forEach((s) => renderStroke(ctx, s, isDark));

  // Render all text boxes
  page.textBoxes.forEach((tb) => renderTextBox(ctx, tb, isDark));

  return canvas;
}
