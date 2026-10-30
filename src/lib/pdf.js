// pdf.js is only needed to *render* PDFs (thumbnails, PDF → image), so it is
// loaded lazily. pdf-lib handles all structural editing.

let pdfjsPromise;

export function getPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

const ASSETS = '/pdfjs/';

// Above this size, pdf.js reads only the byte ranges it needs from the file
// instead of copying the whole thing into memory.
const RANGE_THRESHOLD = 16 * 1024 * 1024;

function blobTransport(pdfjs, blob) {
  const transport = new pdfjs.PDFDataRangeTransport(blob.size, null);
  transport.requestDataRange = (begin, end) => {
    blob
      .slice(begin, end)
      .arrayBuffer()
      .then((buf) => transport.onDataRange(begin, new Uint8Array(buf)))
      .catch(() => transport.onDataRange(begin, null));
  };
  return transport;
}

export async function openPdf(data, password) {
  const pdfjs = await getPdfjs();
  const source =
    data instanceof Blob && data.size > RANGE_THRESHOLD
      ? { range: blobTransport(pdfjs, data), rangeChunkSize: 1024 * 1024, disableAutoFetch: true }
      : { data: data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data };
  const task = pdfjs.getDocument({
    ...source,
    password,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
  });
  try {
    return await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new Error('This PDF is password protected.');
    }
    throw new Error('This file could not be read as a PDF.');
  }
}

/** Releases a document opened with openPdf (and its worker resources). */
export function closePdf(doc) {
  doc?.loadingTask?.destroy().catch(() => {});
}

/** Renders a page onto a new canvas. `scale` 1 = 72 DPI. */
export async function renderPage(doc, pageNumber, scale, background = '#ffffff') {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvas, canvasContext: ctx, viewport, background }).promise;
  page.cleanup();
  return canvas;
}

/** Renders a page to a thumbnail data URL with the given CSS width. */
export async function pageThumbnail(doc, pageNumber, width = 160) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const canvas = await renderPage(doc, pageNumber, (width * ratio) / base.width);
  const url = canvas.toDataURL('image/jpeg', 0.8);
  canvas.width = canvas.height = 0;
  return url;
}

/** Loads a PDF with pdf-lib, with a friendly error for encrypted files. */
export async function loadPdfLib(file) {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (/encrypt/i.test(err?.message || '')) {
      // Owner-password-only PDFs (no open password) can still be copied safely.
      try {
        return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      } catch {
        /* fall through */
      }
      throw new Error(`"${file.name}" is encrypted and cannot be edited.`);
    }
    throw new Error(`"${file.name}" is not a valid PDF.`);
  }
}

/**
 * Parses page selections such as "1-3, 5, 8-" into [start, end] pairs
 * (1-based, inclusive). Throws a readable error for invalid input.
 */
export function parseRanges(input, pageCount) {
  const parts = input
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one page or range, e.g. 1-3, 5.');
  return parts.map((part) => {
    const m = part.match(/^(\d+)?\s*(?:(-|–|to)\s*(\d+)?)?$/i);
    if (!m || (!m[1] && !m[3])) throw new Error(`"${part}" is not a valid page range.`);
    const start = m[1] ? parseInt(m[1], 10) : 1;
    const end = m[2] ? (m[3] ? parseInt(m[3], 10) : pageCount) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`"${part}" is outside the document (1–${pageCount}).`);
    }
    if (start > end) throw new Error(`"${part}" goes backwards.`);
    return [start, end];
  });
}

/** Flattens ranges into a list of 0-based page indices. */
export const rangesToIndices = (ranges) =>
  ranges.flatMap(([s, e]) => Array.from({ length: e - s + 1 }, (_, i) => s - 1 + i));

export const PAGE_SIZES = {
  a4: { label: 'A4', width: 595.28, height: 841.89 },
  letter: { label: 'US Letter', width: 612, height: 792 },
  legal: { label: 'US Legal', width: 612, height: 1008 },
  a3: { label: 'A3', width: 841.89, height: 1190.55 },
  a5: { label: 'A5', width: 419.53, height: 595.28 },
};
