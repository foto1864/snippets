import { detectKind } from './files';
import { canvasToBlob, decodeImage, drawToCanvas, jpegOrientation, targetSize } from './image';
import { PAGE_SIZES } from './pdf';

export async function newPdf() {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setProducer('Snippets File Converter');
  doc.setCreator('Snippets File Converter');
  return doc;
}

const toBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

/**
 * Embeds an image file in a pdf-lib document.
 * quality: null keeps the original bytes whenever possible (lossless & fast),
 * otherwise images are re-encoded as JPEG at that quality.
 * maxDim: optional longest-edge limit in pixels.
 */
export async function embedImageFile(doc, file, { quality = null, maxDim = 0 } = {}) {
  const kind = detectKind(file);

  if (!quality && !maxDim) {
    if (kind === 'jpg' && (await jpegOrientation(file)) === 1) {
      try {
        return await doc.embedJpg(await toBytes(file));
      } catch {
        /* unusual JPEG flavour: re-encode below */
      }
    }
    if (kind === 'png') {
      try {
        return await doc.embedPng(await toBytes(file));
      } catch {
        /* re-encode below */
      }
    }
  }

  const decoded = await decodeImage(file);
  try {
    let { width, height } = decoded;
    if (decoded.isVector) {
      // Rasterize vectors crisply (~2x their nominal size, capped).
      const f = Math.min(4, 2400 / Math.max(width, height)) || 1;
      width = Math.round(width * Math.max(1, f));
      height = Math.round(height * Math.max(1, f));
    }
    if (maxDim) ({ width, height } = targetSize(width, height, { mode: 'fit', width: maxDim, height: maxDim }));

    const mayHaveAlpha = ['png', 'webp', 'gif', 'svg', 'avif'].includes(kind);
    if (!quality && mayHaveAlpha) {
      const canvas = drawToCanvas(decoded, width, height, null);
      const blob = await canvasToBlob(canvas, 'image/png');
      return await doc.embedPng(await toBytes(blob));
    }
    const canvas = drawToCanvas(decoded, width, height, '#ffffff');
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality || 0.92);
    return await doc.embedJpg(await toBytes(blob));
  } finally {
    decoded.close();
  }
}

/**
 * Adds a page holding an embedded image.
 * layout: { pageSize: 'fit' | keyof PAGE_SIZES, orientation: 'auto'|'portrait'|'landscape',
 *           margin: points, dpi: for 'fit' pages (pixel → point conversion) }
 */
export function addImagePage(doc, image, layout = {}) {
  const { pageSize = 'fit', orientation = 'auto', margin = 0, dpi = 96 } = layout;

  if (pageSize === 'fit') {
    const k = 72 / dpi;
    const w = image.width * k;
    const h = image.height * k;
    const page = doc.addPage([w + margin * 2, h + margin * 2]);
    page.drawImage(image, { x: margin, y: margin, width: w, height: h });
    return page;
  }

  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
  let pw = size.width;
  let ph = size.height;
  const landscape =
    orientation === 'landscape' || (orientation === 'auto' && image.width > image.height);
  if (landscape) [pw, ph] = [ph, pw];

  const page = doc.addPage([pw, ph]);
  const boxW = Math.max(1, pw - margin * 2);
  const boxH = Math.max(1, ph - margin * 2);
  const f = Math.min(boxW / image.width, boxH / image.height);
  const w = image.width * f;
  const h = image.height * f;
  page.drawImage(image, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  return page;
}

/** Adds a canvas as a full-bleed page of the given size in points. */
export async function addCanvasPage(doc, canvas, widthPt, heightPt, quality = 0.9) {
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  const image = await doc.embedJpg(await toBytes(blob));
  const page = doc.addPage([widthPt, heightPt]);
  page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });
  return page;
}

export async function savePdf(doc) {
  const bytes = await doc.save({ useObjectStreams: true });
  return new Blob([bytes], { type: 'application/pdf' });
}
