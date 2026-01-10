import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type ExtractionMode = 'text' | 'ocr';

export interface ProbeResult {
  mode: ExtractionMode;
  totalPages: number;
  probeText: string;
  charCount: number;
}

export interface PageImage {
  pageNumber: number;
  imageBase64: string;
  width: number;
  height: number;
}

// Thresholds for determining extraction mode
const CHAR_THRESHOLD = 1200; // Total chars in probe to be considered text-based
const PROBE_PAGES = 5; // Number of pages to sample

/**
 * Probe first N pages of a PDF to determine extraction mode
 */
export async function probePdf(file: File): Promise<ProbeResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const totalPages = pdf.numPages;
  const maxProbePages = Math.min(totalPages, PROBE_PAGES);
  let probeText = '';
  
  for (let i = 1; i <= maxProbePages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: unknown) => (item as { str?: string }).str)
      .filter(Boolean);
    probeText += strings.join(' ') + '\n';
  }
  
  const charCount = probeText.trim().length;
  const mode: ExtractionMode = charCount >= CHAR_THRESHOLD ? 'text' : 'ocr';
  
  return {
    mode,
    totalPages,
    probeText,
    charCount,
  };
}

/**
 * Extract full text from all pages (TEXT mode)
 */
export async function extractFullText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: unknown) => (item as { str?: string }).str)
      .filter(Boolean);
    fullText += strings.join(' ') + '\n\n';
  }
  
  return fullText.trim();
}

/**
 * Render a single page to JPEG image (for OCR mode)
 */
async function renderPageToImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number = 1.5,
  quality: number = 0.75
): Promise<PageImage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Render page to canvas
  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;
  
  // Convert to JPEG base64
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1];
  
  // Cleanup
  canvas.width = 0;
  canvas.height = 0;
  
  return {
    pageNumber,
    imageBase64: base64,
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Render pages to images for OCR (OCR mode)
 * Returns pages in batches to avoid memory issues
 */
export async function renderPagesToImages(
  file: File,
  startPage: number = 1,
  endPage?: number,
  scale: number = 1.5,
  quality: number = 0.75
): Promise<PageImage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const lastPage = endPage ?? pdf.numPages;
  const images: PageImage[] = [];
  
  for (let i = startPage; i <= lastPage; i++) {
    const image = await renderPageToImage(pdf, i, scale, quality);
    images.push(image);
  }
  
  return images;
}

/**
 * Get total page count of a PDF
 */
export async function getPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}
