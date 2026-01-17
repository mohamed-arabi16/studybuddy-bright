import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Types
type ExtractionMode = 'text' | 'ocr';

interface ProbeResult {
  mode: ExtractionMode;
  totalPages: number;
  probeText: string;
  charCount: number;
}

interface PageImage {
  pageNumber: number;
  imageBase64: string;
  width: number;
  height: number;
}

const CHAR_THRESHOLD = 1200;
const PROBE_PAGES = 5;

self.onmessage = async (e: MessageEvent) => {
  const { id, type, arrayBuffer, ...options } = e.data;
  try {
    switch (type) {
      case 'probe': {
        const probeResult = await probePdf(arrayBuffer);
        self.postMessage({ id, type: 'probeResult', data: probeResult });
        break;
      }
      case 'extractFullText': {
        const text = await extractFullText(arrayBuffer);
        self.postMessage({ id, type: 'extractResult', data: text });
        break;
      }
      case 'renderPages': {
        const images = await renderPagesToImages(arrayBuffer, options);
        self.postMessage({ id, type: 'renderResult', data: images });
        break;
      }
      case 'getPageCount': {
        const count = await getPageCount(arrayBuffer);
        self.postMessage({ id, type: 'pageCountResult', data: count });
        break;
      }
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    self.postMessage({ id, type: 'error', error: error.message || String(error) });
  }
};

async function getDocument(arrayBuffer: ArrayBuffer) {
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

async function probePdf(arrayBuffer: ArrayBuffer): Promise<ProbeResult> {
  const pdf = await getDocument(arrayBuffer);

  const totalPages = pdf.numPages;
  const maxProbePages = Math.min(totalPages, PROBE_PAGES);
  let probeText = '';

  for (let i = 1; i <= maxProbePages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: any) => item.str) // eslint-disable-line @typescript-eslint/no-explicit-any
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

async function extractFullText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocument(arrayBuffer);
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: any) => item.str) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter(Boolean);
    fullText += strings.join(' ') + '\n\n';
  }

  return fullText.trim();
}

async function getPageCount(arrayBuffer: ArrayBuffer): Promise<number> {
  const pdf = await getDocument(arrayBuffer);
  return pdf.numPages;
}

async function renderPagesToImages(
  arrayBuffer: ArrayBuffer,
  options: { startPage: number; endPage?: number; scale?: number; quality?: number }
): Promise<PageImage[]> {
  const pdf = await getDocument(arrayBuffer);
  const { startPage = 1, endPage, scale = 1.5, quality = 0.75 } = options;
  const lastPage = endPage ?? pdf.numPages;
  const images: PageImage[] = [];

  for (let i = startPage; i <= lastPage; i++) {
    const image = await renderPageToImage(pdf, i, scale, quality);
    images.push(image);
  }

  return images;
}

async function renderPageToImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  quality: number
): Promise<PageImage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Use OffscreenCanvas in worker
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  await page.render({
    canvasContext: ctx as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    viewport,
  }).promise;

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  const base64 = await blobToBase64(blob);

  return {
    pageNumber,
    imageBase64: base64,
    width: viewport.width,
    height: viewport.height,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:image/jpeg;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
