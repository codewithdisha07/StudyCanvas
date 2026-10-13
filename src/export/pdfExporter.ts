import { jsPDF } from 'jspdf';
import type { Page } from '../types';
import { renderPageOffscreen } from '../canvas/CanvasEngine';

export interface PDFExportOptions {
  projectTitle: string;
  pages: Page[];
  exportOnlyCurrentPage?: boolean;
  currentPageIndex?: number;
  onProgress?: (current: number, total: number) => void;
}

/**
 * High-resolution PDF export using jsPDF and offscreen vector re-rendering.
 * Renders pages at 2x resolution to maintain crisp handwriting and typography.
 */
export async function exportProjectToPDF({
  projectTitle,
  pages,
  exportOnlyCurrentPage = false,
  currentPageIndex = 0,
  onProgress,
}: PDFExportOptions): Promise<void> {
  const targetPages = exportOnlyCurrentPage ? [pages[currentPageIndex]] : pages;

  if (targetPages.length === 0 || !targetPages[0]) {
    throw new Error('No pages available for export.');
  }

  // Standard A4 portrait in points: 595.28 x 841.89
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < targetPages.length; i++) {
    const page = targetPages[i];
    if (onProgress) {
      onProgress(i + 1, targetPages.length);
    }

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // Render offscreen at 1200x1697 (approx A4 aspect ratio 1:1.414) at 2x DPR
    const offscreenCanvas = renderPageOffscreen(page, 1200, 1697, 2, false);
    const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.95);

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    // Tiny footer on each page
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    const footerText = `${projectTitle} • Page ${i + 1} of ${targetPages.length} • StudyCanvas AI`;
    pdf.text(footerText, 30, pdfHeight - 15);
  }

  const cleanFileName = (projectTitle || 'StudyNotes')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  const suffix = exportOnlyCurrentPage ? `_Page_${currentPageIndex + 1}` : '_Complete';
  pdf.save(`${cleanFileName}${suffix}.pdf`);
}
