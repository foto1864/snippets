// Rasterizes rendered HTML (DOCX / PPTX previews) into PDF pages.
import { addCanvasPage } from './pdfBuild';

export const QUALITY = {
  standard: { label: 'Standard', scale: 1.5, jpeg: 0.82 },
  high: { label: 'High', scale: 2, jpeg: 0.9 },
  max: { label: 'Maximum', scale: 3, jpeg: 0.95 },
};

export async function elementToCanvas(el, scale) {
  const { domToCanvas } = await import('modern-screenshot');
  return domToCanvas(el, { scale, backgroundColor: '#ffffff' });
}

/** True when a pixel row is (almost) blank, so a page break there cuts no text. */
function isBlankRow(data, width, y, x0, x1) {
  const row = y * width * 4;
  for (let x = x0; x < x1; x += 2) {
    const i = row + x * 4;
    if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) return false;
  }
  return true;
}

/**
 * Picks a break position at or above `target`, preferring a blank row within
 * the bottom `search` pixels so lines of text are not cut in half.
 */
function findCut(ctx, width, target, search, x0, x1) {
  const top = Math.max(0, Math.floor(target - search));
  const { data } = ctx.getImageData(0, top, width, Math.ceil(target - top));
  for (let y = Math.ceil(target - top) - 1; y >= 0; y--) {
    if (isBlankRow(data, width, y, x0, x1)) return top + y;
  }
  return target;
}

/**
 * Adds a captured element to the PDF, slicing it into several pages when it is
 * taller than one page (Word sections without explicit page breaks).
 * page: { widthPx, heightPx, padTop, padBottom, padX } in CSS pixels.
 */
export async function addElementPages(pdf, canvas, page, { scale, jpeg, smart = true }) {
  const pageH = Math.round(page.heightPx * scale);
  const widthPt = page.widthPx * 0.75;
  const heightPt = page.heightPx * 0.75;

  if (canvas.height <= pageH * 1.01) {
    await addCanvasPage(pdf, canvas, widthPt, (canvas.height / scale) * 0.75, jpeg);
    return 1;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const padT = Math.round((page.padTop || 0) * scale);
  const padB = Math.round((page.padBottom || 0) * scale);
  const x0 = Math.round((page.padX || 0) * scale);
  const x1 = canvas.width - x0;
  let y = 0;
  let count = 0;
  while (y < canvas.height - 2) {
    const first = count === 0;
    const offset = first ? 0 : padT;
    const avail = pageH - offset - padB;
    let end = y + avail;
    if (end >= canvas.height) end = canvas.height;
    else if (smart) end = findCut(ctx, canvas.width, end, avail * 0.25, x0, x1);
    if (end <= y + avail * 0.5) end = y + avail; // no gap found: hard cut

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = pageH;
    const sctx = slice.getContext('2d');
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, slice.width, slice.height);
    sctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, offset, canvas.width, end - y);
    await addCanvasPage(pdf, slice, widthPt, heightPt, jpeg);
    slice.width = slice.height = 0;
    y = end;
    count++;
  }
  return count;
}

/**
 * Prints rendered HTML through a hidden iframe, so the browser's
 * "Save as PDF" produces a vector PDF with selectable text.
 */
export function printHtml({ html, css, pageWidthPx, pageHeightPx }) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const size = pageWidthPx && pageHeightPx ? `${pageWidthPx * 0.75}pt ${pageHeightPx * 0.75}pt` : 'auto';
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${size}; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    ${css}
  </style></head><body>${html}</body></html>`);
  doc.close();
  const go = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 60_000);
  };
  const imgs = Array.from(doc.images);
  Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r))))).then(() =>
    setTimeout(go, 150),
  );
}
