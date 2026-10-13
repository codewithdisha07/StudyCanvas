import type { Page, AIScope, SelectionRect } from '../types';
import { renderPageOffscreen } from '../canvas/CanvasEngine';
import { getDigest, saveDigest } from '../db';

export interface PageContextSummary {
  id: string;
  projectId: string;
  pageNumber: number;
  title: string;
  text: string;
  hasStrokes: boolean;
  strokeCount: number;
}

export interface GroundedContextPayload {
  scope: AIScope;
  pages: PageContextSummary[];
  images: { dataUrl: string; mimeType: string }[];
}

/**
 * Fast content hash to detect changes to a page
 */
export function computePageContentHash(page: Page): string {
  const strokeSample = page.strokes.map((s) => `${s.id}-${s.points.length}-${s.color}`).join(';');
  const textSample = page.textBoxes.map((t) => `${t.id}-${t.text.length}-${t.text.slice(0, 20)}`).join(';');
  const raw = `${page.id}-${page.title}-${page.background}-${strokeSample}-${textSample}`;
  // Simple fast hash code
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash-${Math.abs(hash)}`;
}

/**
 * Check if a text box is enclosed or intersects with a selection rectangle
 */
function isTextBoxInSelection(tb: { x: number; y: number; width: number; fontSize: number; text: string }, rect: SelectionRect): boolean {
  const tbHeight = tb.fontSize * (tb.text.split('\n').length + 1);
  return (
    tb.x < rect.x + rect.width &&
    tb.x + tb.width > rect.x &&
    tb.y < rect.y + rect.height &&
    tb.y + tbHeight > rect.y
  );
}

/**
 * Renders cropped region of canvas as PNG
 */
export function renderCropOffscreen(page: Page, rect: SelectionRect): string {
  const fullCanvas = renderPageOffscreen(page, 1200, 1600, 1.5, false);
  const cropCanvas = document.createElement('canvas');
  const cropWidth = Math.max(50, Math.min(rect.width, 1200));
  const cropHeight = Math.max(50, Math.min(rect.height, 1600));

  cropCanvas.width = cropWidth * 1.5;
  cropCanvas.height = cropHeight * 1.5;

  const ctx = cropCanvas.getContext('2d');
  if (!ctx) return fullCanvas.toDataURL('image/png');

  // Copy rect region
  ctx.drawImage(
    fullCanvas,
    rect.x * 1.5,
    rect.y * 1.5,
    cropWidth * 1.5,
    cropHeight * 1.5,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  return cropCanvas.toDataURL('image/png');
}

/**
 * Main Context Builder
 */
export async function buildGroundedContext({
  pages,
  currentPageId,
  scope,
  selectionRect,
}: {
  pages: Page[];
  currentPageId: string;
  scope: AIScope;
  selectionRect?: SelectionRect | null;
}): Promise<GroundedContextPayload> {
  const images: { dataUrl: string; mimeType: string }[] = [];
  const summaries: PageContextSummary[] = [];

  const currentPageIndex = pages.findIndex((p) => p.id === currentPageId);
  const currentPage = pages[currentPageIndex] || pages[0];

  if (scope === 'selection' && selectionRect && currentPage) {
    // Crop selection snapshot
    const cropDataUrl = renderCropOffscreen(currentPage, selectionRect);
    images.push({ dataUrl: cropDataUrl, mimeType: 'image/png' });

    // Filter text boxes inside selection
    const selectedBoxes = currentPage.textBoxes.filter((tb) => isTextBoxInSelection(tb, selectionRect));
    const text = selectedBoxes.map((tb) => tb.text).join('\n\n');

    summaries.push({
      id: currentPage.id,
      projectId: currentPage.projectId,
      pageNumber: currentPageIndex >= 0 ? currentPageIndex + 1 : 1,
      title: `${currentPage.title} (Selected Region)`,
      text,
      hasStrokes: currentPage.strokes.length > 0,
      strokeCount: currentPage.strokes.length,
    });

    return {
      scope: 'selection',
      pages: summaries,
      images,
    };
  }

  if (scope === 'current' && currentPage) {
    const pageNum = currentPageIndex >= 0 ? currentPageIndex + 1 : 1;
    // Render high-res snapshot
    const canvas = renderPageOffscreen(currentPage, 800, 1100, 1.0, false);
    images.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.8), mimeType: 'image/jpeg' });

    const text = currentPage.textBoxes.map((tb) => tb.text).join('\n\n');
    summaries.push({
      id: currentPage.id,
      projectId: currentPage.projectId,
      pageNumber: pageNum,
      title: currentPage.title,
      text,
      hasStrokes: currentPage.strokes.length > 0,
      strokeCount: currentPage.strokes.length,
    });

    return {
      scope: 'current',
      pages: summaries,
      images,
    };
  }

  // Entire Project Scope (all pages in order)
  const MAX_PAGES_MULTIMODAL = 6;
  const projectPages = pages.slice(0, MAX_PAGES_MULTIMODAL);

  for (let i = 0; i < projectPages.length; i++) {
    const p = projectPages[i];
    const pageNum = i + 1;
    const contentHash = computePageContentHash(p);

    // Check digest cache
    const cachedDigest = await getDigest(p.id, contentHash);

    // Efficient canvas snapshot
    const offscreen = renderPageOffscreen(p, 650, 900, 0.8, false);
    images.push({ dataUrl: offscreen.toDataURL('image/jpeg', 0.75), mimeType: 'image/jpeg' });

    const baseText = p.textBoxes.map((tb) => tb.text).join('\n\n');
    const enrichedText = cachedDigest ? `${baseText}\n[Cached Notes Digest: ${cachedDigest.digest}]` : baseText;

    summaries.push({
      id: p.id,
      projectId: p.projectId,
      pageNumber: pageNum,
      title: p.title,
      text: enrichedText,
      hasStrokes: p.strokes.length > 0,
      strokeCount: p.strokes.length,
    });

    // If no digest yet, store a simple initial cache
    if (!cachedDigest && p.textBoxes.length > 0) {
      await saveDigest({
        id: `digest-${p.id}`,
        pageId: p.id,
        contentHash,
        digest: baseText.slice(0, 150),
        updatedAt: Date.now(),
      });
    }
  }

  return {
    scope: 'project',
    pages: summaries,
    images,
  };
}
