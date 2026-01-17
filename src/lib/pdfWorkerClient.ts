import { ProbeResult, PageImage } from './pdfExtractor';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    // Import worker using Vite's worker import syntax
    worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export async function probePdfAsync(file: File): Promise<ProbeResult> {
  const w = getWorker();
  const arrayBuffer = await file.arrayBuffer();
  const id = Math.random().toString(36).substring(7);

  return new Promise<ProbeResult>((resolve, reject) => {
    try {
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id !== id) return;

        if (e.data.type === 'probeResult') {
          w.removeEventListener('message', handleMessage);
          resolve(e.data.data);
        }
        if (e.data.type === 'error') {
          w.removeEventListener('message', handleMessage);
          reject(new Error(e.data.error));
        }
      };

      w.addEventListener('message', handleMessage);
      w.postMessage({ id, type: 'probe', arrayBuffer }, [arrayBuffer]);
    } catch (error) {
      reject(error);
    }
  });
}

export async function extractFullTextAsync(file: File): Promise<string> {
  const w = getWorker();
  const arrayBuffer = await file.arrayBuffer();
  const id = Math.random().toString(36).substring(7);

  return new Promise<string>((resolve, reject) => {
    try {
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id !== id) return;

        if (e.data.type === 'extractResult') {
          w.removeEventListener('message', handleMessage);
          resolve(e.data.data);
        }
        if (e.data.type === 'error') {
          w.removeEventListener('message', handleMessage);
          reject(new Error(e.data.error));
        }
      };

      w.addEventListener('message', handleMessage);
      w.postMessage({ id, type: 'extractFullText', arrayBuffer }, [arrayBuffer]);
    } catch (error) {
      reject(error);
    }
  });
}

export async function renderPagesToImagesAsync(
  file: File,
  options: { startPage: number; endPage?: number; scale?: number; quality?: number }
): Promise<PageImage[]> {
  const w = getWorker();
  const arrayBuffer = await file.arrayBuffer();
  const id = Math.random().toString(36).substring(7);

  return new Promise<PageImage[]>((resolve, reject) => {
    try {
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id !== id) return;

        if (e.data.type === 'renderResult') {
          w.removeEventListener('message', handleMessage);
          resolve(e.data.data);
        }
        if (e.data.type === 'error') {
          w.removeEventListener('message', handleMessage);
          reject(new Error(e.data.error));
        }
      };

      w.addEventListener('message', handleMessage);
      w.postMessage({ id, type: 'renderPages', arrayBuffer, ...options }, [arrayBuffer]);
    } catch (error) {
      reject(error);
    }
  });
}

export async function getPageCountAsync(file: File): Promise<number> {
  const w = getWorker();
  const arrayBuffer = await file.arrayBuffer();
  const id = Math.random().toString(36).substring(7);

  return new Promise<number>((resolve, reject) => {
    try {
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id !== id) return;

        if (e.data.type === 'pageCountResult') {
          w.removeEventListener('message', handleMessage);
          resolve(e.data.data);
        }
        if (e.data.type === 'error') {
          w.removeEventListener('message', handleMessage);
          reject(new Error(e.data.error));
        }
      };

      w.addEventListener('message', handleMessage);
      w.postMessage({ id, type: 'getPageCount', arrayBuffer }, [arrayBuffer]);
    } catch (error) {
      reject(error);
    }
  });
}

export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
