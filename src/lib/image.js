import { detectKind } from './files';

export const FORMATS = {
  jpg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG', lossy: true, alpha: false },
  png: { mime: 'image/png', ext: 'png', label: 'PNG', lossy: false, alpha: true },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', lossy: true, alpha: true },
};

let heicModule;
const loadHeic = () => (heicModule ??= import('heic-to'));

/** Decodes HEIC/HEIF into a PNG blob (lossless intermediate). */
export async function heicToBlob(file, type = 'image/png', quality) {
  const { heicTo } = await loadHeic();
  return heicTo({ blob: file, type, quality });
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = url;
  });
}

/**
 * Reads an SVG and makes sure it carries explicit pixel dimensions, otherwise
 * browsers rasterize it at an arbitrary 300×150 (or refuse to draw it).
 */
async function prepareSvg(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('This file is not a valid SVG.');
  }
  const num = (v) => {
    const n = parseFloat(v);
    return v && !String(v).trim().endsWith('%') && Number.isFinite(n) && n > 0 ? n : null;
  };
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const vbW = vb.length === 4 && vb[2] > 0 ? vb[2] : null;
  const vbH = vb.length === 4 && vb[3] > 0 ? vb[3] : null;
  let w = num(svg.getAttribute('width'));
  let h = num(svg.getAttribute('height'));
  if (!w && !h) {
    w = vbW || 512;
    h = vbH || 512;
  } else if (!w) {
    w = vbW && vbH ? (h * vbW) / vbH : h;
  } else if (!h) {
    h = vbW && vbH ? (w * vbH) / vbW : w;
  }
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  return { blob, width: w, height: h };
}

/**
 * Decodes any supported image into something drawable on a canvas.
 * Returns { source, width, height, close }.
 */
export async function decodeImage(file) {
  const kind = detectKind(file);

  if (kind === 'svg') {
    const { blob, width, height } = await prepareSvg(file);
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImageElement(url);
      return { source: img, width, height, isVector: true, close: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }

  let blob = file;
  if (kind === 'heic') blob = await heicToBlob(file);

  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // Some formats (or older browsers) only decode through <img>.
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImageElement(url);
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw new Error(
        kind === 'heic'
          ? 'This HEIC file could not be decoded.'
          : 'Your browser cannot decode this image format.',
      );
    }
  }
}

/** Computes the output size for a resize setting. */
export function targetSize(width, height, resize) {
  if (!resize || resize.mode === 'none') return { width, height };
  if (resize.mode === 'percent') {
    const f = Math.max(1, resize.percent) / 100;
    return { width: Math.max(1, Math.round(width * f)), height: Math.max(1, Math.round(height * f)) };
  }
  if (resize.mode === 'exact') {
    const w = resize.width > 0 ? resize.width : null;
    const h = resize.height > 0 ? resize.height : null;
    if (w && h) return { width: Math.round(w), height: Math.round(h) };
    if (w) return { width: Math.round(w), height: Math.max(1, Math.round((height * w) / width)) };
    if (h) return { width: Math.max(1, Math.round((width * h) / height)), height: Math.round(h) };
    return { width, height };
  }
  // 'fit': shrink to fit inside a box, never upscale.
  const maxW = resize.width > 0 ? resize.width : Infinity;
  const maxH = resize.height > 0 ? resize.height : Infinity;
  const f = Math.min(1, maxW / width, maxH / height);
  return { width: Math.max(1, Math.round(width * f)), height: Math.max(1, Math.round(height * f)) };
}

export function drawToCanvas(decoded, width, height, background) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.source, 0, 0, width, height);
  return canvas;
}

export function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('The image is too large for your browser to encode.'));
        if (blob.type !== mime) {
          return reject(
            new Error(
              `Your browser cannot create ${mime.split('/')[1].toUpperCase()} files. Try Chrome, Edge or Firefox.`,
            ),
          );
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

/**
 * Converts one image file.
 * opts: { format: 'jpg'|'png'|'webp', quality: 0..1, background: css color|null,
 *         resize, scale (vector inputs only) }
 */
export async function convertImage(file, opts) {
  const format = FORMATS[opts.format];
  const decoded = await decodeImage(file);
  try {
    let { width, height } = decoded;
    if (decoded.isVector && opts.scale) {
      width = Math.round(width * opts.scale);
      height = Math.round(height * opts.scale);
    }
    ({ width, height } = targetSize(width, height, opts.resize));
    // Formats without transparency always need a solid backdrop.
    const background = !format.alpha ? opts.background || '#ffffff' : opts.background || null;
    const canvas = drawToCanvas(decoded, width, height, background);
    const blob = await canvasToBlob(canvas, format.mime, format.lossy ? opts.quality : undefined);
    canvas.width = canvas.height = 0;
    return { blob, width, height };
  } finally {
    decoded.close();
  }
}

/** Reads the EXIF orientation of a JPEG (1 when absent). */
export async function jpegOrientation(file) {
  const view = new DataView(await file.slice(0, 128 * 1024).arrayBuffer());
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      if (tiff + 8 > view.byteLength) return 1;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 10 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00) return 1;
    offset += 2 + size;
  }
  return 1;
}

/** Small preview data URL for file lists. */
export async function imageThumbnail(file, max = 160) {
  const decoded = await decodeImage(file);
  try {
    const { width, height } = targetSize(decoded.width, decoded.height, {
      mode: 'fit',
      width: max,
      height: max,
    });
    const canvas = drawToCanvas(decoded, width, height, null);
    return canvas.toDataURL('image/png');
  } finally {
    decoded.close();
  }
}
