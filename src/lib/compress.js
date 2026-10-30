import { VIDEO_KINDS, AUDIO_KINDS, detectKind, nextFrame, withExt } from './files';
import { canvasToBlob, decodeImage, drawToCanvas, targetSize } from './image';
import { closePdf, loadPdfLib, openPdf, renderPage } from './pdf';
import { addCanvasPage, newPdf, savePdf } from './pdfBuild';
import { compressVideo, extractAudio } from './media';

export const LEVELS = {
  light: {
    label: 'Light',
    hint: 'Best quality, smaller savings.',
    pdf: { maxDim: 2400, quality: 0.82, dpi: 150 },
    image: { quality: 0.85, maxDim: 0, colors: 0 },
    video: { maxHeight: 1080, quality: 'high' },
    audioKbps: 192,
  },
  recommended: {
    label: 'Recommended',
    hint: 'Good quality, good compression.',
    pdf: { maxDim: 1800, quality: 0.72, dpi: 120 },
    image: { quality: 0.75, maxDim: 2560, colors: 256 },
    video: { maxHeight: 1080, quality: 'medium' },
    audioKbps: 128,
  },
  strong: {
    label: 'Strong',
    hint: 'Smallest files, lower quality.',
    pdf: { maxDim: 1200, quality: 0.55, dpi: 96 },
    image: { quality: 0.6, maxDim: 1600, colors: 64 },
    video: { maxHeight: 720, quality: 'low' },
    audioKbps: 96,
  },
};

const toBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

/* ---------------------------------------------------------------- PDF ---- */

/** Undoes PNG predictors (Predictor >= 10) on 8-bit image rows. */
function unpredict(data, columns, colors) {
  const rowLen = columns * colors;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowLen + 1)];
    const src = r * (rowLen + 1) + 1;
    const dst = r * rowLen;
    for (let i = 0; i < rowLen; i++) {
      const raw = data[src + i];
      const left = i >= colors ? out[dst + i - colors] : 0;
      const up = r > 0 ? out[dst - rowLen + i] : 0;
      const upLeft = r > 0 && i >= colors ? out[dst - rowLen + i - colors] : 0;
      let v;
      switch (type) {
        case 1: v = raw + left; break;
        case 2: v = raw + up; break;
        case 3: v = raw + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
          v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: v = raw;
      }
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}

/** Number of colour components for simple colour spaces, or null if unsupported. */
function components(lib, dict, context) {
  const { PDFName, PDFArray, PDFRawStream } = lib;
  const cs = context.lookup(dict.get(PDFName.of('ColorSpace')));
  if (cs === PDFName.of('DeviceRGB') || cs === PDFName.of('CalRGB')) return 3;
  if (cs === PDFName.of('DeviceGray') || cs === PDFName.of('CalGray')) return 1;
  if (cs instanceof PDFArray && context.lookup(cs.get(0)) === PDFName.of('ICCBased')) {
    const profile = context.lookup(cs.get(1));
    const n = profile instanceof PDFRawStream ? profile.dict.lookup(PDFName.of('N'))?.asNumber?.() : null;
    return n === 3 || n === 1 ? n : null;
  }
  return null;
}

/** Tries to produce a smaller JPEG replacement for one image XObject. */
async function recompressImage(lib, context, stream, opts) {
  const { PDFName, PDFArray, PDFNumber, PDFBool } = lib;
  const { unzlibSync } = await import('fflate');
  const dict = stream.dict;
  const get = (k) => context.lookup(dict.get(PDFName.of(k)));

  if (get('ImageMask') === PDFBool.True) return null;
  if (get('Mask') instanceof PDFArray || get('Decode')) return null;
  const width = get('Width')?.asNumber?.();
  const height = get('Height')?.asNumber?.();
  if (!width || !height || width * height < 40_000) return null;

  let filter = get('Filter');
  if (filter instanceof PDFArray) filter = filter.size() === 1 ? context.lookup(filter.get(0)) : null;
  const comps = components(lib, dict, context);
  if (!comps) return null;

  let decoded;
  if (filter === PDFName.of('DCTDecode')) {
    const bmp = await createImageBitmap(new Blob([stream.contents], { type: 'image/jpeg' })).catch(() => null);
    if (!bmp) return null;
    decoded = { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } else if (filter === PDFName.of('FlateDecode')) {
    if (get('BitsPerComponent')?.asNumber?.() !== 8) return null;
    let raw;
    try {
      raw = unzlibSync(stream.contents);
    } catch {
      return null;
    }
    let parms = get('DecodeParms');
    if (parms instanceof PDFArray) parms = context.lookup(parms.get(0));
    const predictor = parms?.lookup?.(PDFName.of('Predictor'))?.asNumber?.() || 1;
    if (predictor >= 10) raw = unpredict(raw, width, comps);
    else if (predictor !== 1) return null;
    if (raw.length < width * height * comps) return null;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < width * height; i++, j += comps) {
      rgba[i * 4] = raw[j];
      rgba[i * 4 + 1] = raw[j + (comps === 3 ? 1 : 0)];
      rgba[i * 4 + 2] = raw[j + (comps === 3 ? 2 : 0)];
      rgba[i * 4 + 3] = 255;
    }
    const bmp = await createImageBitmap(new ImageData(rgba, width, height));
    decoded = { source: bmp, width, height, close: () => bmp.close() };
  } else {
    return null; // JBIG2, CCITT, JPX… left untouched
  }

  try {
    const size = targetSize(decoded.width, decoded.height, { mode: 'fit', width: opts.maxDim, height: opts.maxDim });
    const canvas = drawToCanvas(decoded, size.width, size.height, '#ffffff');
    const jpeg = await toBytes(await canvasToBlob(canvas, 'image/jpeg', opts.quality));
    canvas.width = canvas.height = 0;
    if (jpeg.length >= stream.contents.length * 0.9) return null;

    for (const k of ['DecodeParms', 'Decode', 'Length', 'Interpolate']) dict.delete(PDFName.of(k));
    dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    dict.set(PDFName.of('Width'), PDFNumber.of(size.width));
    dict.set(PDFName.of('Height'), PDFNumber.of(size.height));
    dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
    dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    return lib.PDFRawStream.of(dict, jpeg);
  } finally {
    decoded.close();
  }
}

/** Recompresses embedded images, keeping text and vectors intact. */
async function compressPdfImages(file, opts, report) {
  const lib = await import('pdf-lib');
  const doc = await loadPdfLib(file);
  const { context } = doc;
  const images = context
    .enumerateIndirectObjects()
    .filter(
      ([, obj]) =>
        obj instanceof lib.PDFRawStream && obj.dict.lookup(lib.PDFName.of('Subtype')) === lib.PDFName.of('Image'),
    );
  let replaced = 0;
  for (const [n, [ref, stream]] of images.entries()) {
    report(n / Math.max(1, images.length), `Optimizing image ${n + 1} of ${images.length}`);
    if (n % 4 === 0) await nextFrame();
    try {
      const next = await recompressImage(lib, context, stream, opts);
      if (next) {
        context.assign(ref, next);
        replaced++;
      }
    } catch (e) {
      console.warn('Skipped image', e);
    }
  }
  report(0.98, 'Saving…');
  doc.setProducer('Snippets File Converter');
  return { blob: await savePdf(doc), note: `${replaced} of ${images.length} images optimized` };
}

/** Re-renders every page as a JPEG: maximum compression, text becomes pixels. */
async function flattenPdf(file, opts, report) {
  const src = await openPdf(file);
  const out = await newPdf();
  try {
    for (let i = 1; i <= src.numPages; i++) {
      report((i - 1) / src.numPages, `Flattening page ${i} of ${src.numPages}`);
      await nextFrame();
      const page = await src.getPage(i);
      const { width, height } = page.getViewport({ scale: 1 });
      const canvas = await renderPage(src, i, opts.dpi / 72);
      await addCanvasPage(out, canvas, width, height, opts.quality);
      canvas.width = canvas.height = 0;
    }
  } finally {
    closePdf(src);
  }
  return { blob: await savePdf(out), note: 'pages flattened' };
}

/* ------------------------------------------------------------- Images ---- */

async function compressImage(file, opts) {
  const kind = detectKind(file);
  const decoded = await decodeImage(file);
  try {
    const size = targetSize(decoded.width, decoded.height, { mode: 'fit', width: opts.maxDim || Infinity, height: opts.maxDim || Infinity });
    if (kind === 'png') {
      const canvas = drawToCanvas(decoded, size.width, size.height, null);
      const { data } = canvas.getContext('2d').getImageData(0, 0, size.width, size.height);
      const { default: UPNG } = await import('upng-js');
      const png = UPNG.encode([data.buffer], size.width, size.height, opts.colors);
      return { blob: new Blob([png], { type: 'image/png' }), ext: 'png', note: opts.colors ? `${opts.colors} colours` : 'lossless' };
    }
    const mime = kind === 'webp' ? 'image/webp' : 'image/jpeg';
    const canvas = drawToCanvas(decoded, size.width, size.height, kind === 'webp' ? null : '#ffffff');
    const blob = await canvasToBlob(canvas, mime, opts.quality);
    return { blob, ext: kind === 'webp' ? 'webp' : 'jpg', note: `${size.width}×${size.height}` };
  } finally {
    decoded.close();
  }
}

/* ----------------------------------------------------------- Dispatch ---- */

export const COMPRESSIBLE = ['pdf', 'jpg', 'png', 'webp', ...VIDEO_KINDS, ...AUDIO_KINDS];

/**
 * Compresses one file. Returns { name, blob, note }. When the result would not
 * be smaller, the original file is returned instead.
 */
export async function compressFile(file, { level, flatten }, report, signal) {
  const L = LEVELS[level];
  const kind = detectKind(file);
  let result;
  if (kind === 'pdf') {
    result = flatten ? await flattenPdf(file, L.pdf, report) : await compressPdfImages(file, L.pdf, report);
    result.ext = 'pdf';
  } else if (VIDEO_KINDS.includes(kind)) {
    result = await compressVideo(file, L.video, (p) => report(p, `Re-encoding video · ${Math.round(p * 100)}%`), signal);
    result.note = `max ${L.video.maxHeight}p`;
  } else if (AUDIO_KINDS.includes(kind)) {
    const blob = await extractAudio(
      file,
      { format: 'mp3', bitrate: L.audioKbps },
      (p) => report(p, `Encoding audio · ${Math.round(p * 100)}%`),
      signal,
    );
    result = { blob, ext: 'mp3', note: `${L.audioKbps} kbps MP3` };
  } else {
    result = await compressImage(file, L.image);
  }

  if (result.blob.size >= file.size) {
    return { name: file.name, blob: file, note: 'already optimized — kept original' };
  }
  const saved = Math.round((1 - result.blob.size / file.size) * 100);
  return { name: withExt(file.name, result.ext), blob: result.blob, note: `−${saved}% · ${result.note}` };
}
