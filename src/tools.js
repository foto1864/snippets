import { lazy } from 'react';
import { AUDIO_KINDS, IMAGE_KINDS, MEDIA_KINDS, RASTER_KINDS, VIDEO_KINDS } from './lib/files';

const ImageConvert = lazy(() => import('./tools/ImageConvert'));
const ImagesToPdf = lazy(() => import('./tools/ImagesToPdf'));
const PngToSvg = lazy(() => import('./tools/PngToSvg'));
const MergePdf = lazy(() => import('./tools/MergePdf'));
const SplitPdf = lazy(() => import('./tools/SplitPdf'));
const PdfToImage = lazy(() => import('./tools/PdfToImage'));
const DocxToPdf = lazy(() => import('./tools/DocxToPdf'));
const PptxToPdf = lazy(() => import('./tools/PptxToPdf'));
const XlsxToPdf = lazy(() => import('./tools/XlsxToPdf'));
const VideoToAudio = lazy(() => import('./tools/VideoToAudio'));
const Compress = lazy(() => import('./tools/Compress'));

export const CATEGORIES = [
  { id: 'pdf', label: 'PDF tools' },
  { id: 'image', label: 'Image converters' },
  { id: 'office', label: 'Office to PDF' },
  { id: 'heic', label: 'iPhone photos (HEIC)' },
  { id: 'compress', label: 'Compress' },
  { id: 'media', label: 'Audio & video' },
];

const imageTool = (from, to, extra = {}) => ({
  slug: `${from}-to-${to}`,
  title: `${from.toUpperCase()} to ${to.toUpperCase()}`,
  category: 'image',
  from,
  to,
  accepts: IMAGE_KINDS,
  component: ImageConvert,
  ...extra,
});

export const TOOLS = [
  {
    slug: 'merge-pdf',
    title: 'Merge PDF',
    category: 'pdf',
    from: 'pdf',
    to: 'pdf',
    description: 'Combine PDFs (and images) into one document. Reorder files and pick page ranges.',
    accepts: ['pdf', ...IMAGE_KINDS],
    component: MergePdf,
  },
  {
    slug: 'split-pdf',
    title: 'Split PDF',
    category: 'pdf',
    from: 'pdf',
    to: 'pdf',
    description: 'Extract pages, split by ranges, every N pages, or into single pages.',
    accepts: ['pdf'],
    component: SplitPdf,
  },
  {
    slug: 'jpg-to-pdf',
    title: 'JPG to PDF',
    category: 'pdf',
    from: 'jpg',
    to: 'pdf',
    description: 'Turn photos and images into a PDF with page size, orientation and margin controls.',
    accepts: IMAGE_KINDS,
    component: ImagesToPdf,
  },
  {
    slug: 'pdf-to-jpg',
    title: 'PDF to JPG',
    category: 'pdf',
    from: 'pdf',
    to: 'jpg',
    description: 'Export PDF pages as high-quality JPG, PNG or WebP images at any resolution.',
    accepts: ['pdf'],
    component: PdfToImage,
  },
  {
    slug: 'extract-cover',
    title: 'Extract Cover',
    category: 'pdf',
    from: 'pdf',
    to: 'jpg',
    description: 'Save the first page (cover) of one or many PDFs as a JPG image.',
    accepts: ['pdf'],
    coverOnly: true,
    component: PdfToImage,
  },

  imageTool('jpg', 'png', { description: 'Convert JPG photos to lossless PNG images.' }),
  imageTool('png', 'jpg', { description: 'Convert PNG to smaller JPG files, with background colour for transparency.' }),
  imageTool('webp', 'jpg', { description: 'Convert WebP images to universally supported JPG.' }),
  imageTool('jpg', 'webp', { description: 'Shrink JPG photos with modern WebP compression.' }),
  imageTool('webp', 'png', { description: 'Convert WebP to PNG while keeping transparency.' }),
  imageTool('png', 'webp', { description: 'Compress PNG to WebP while keeping transparency.' }),
  imageTool('svg', 'png', {
    accepts: ['svg'],
    description: 'Render SVG vector graphics to sharp PNG images at any size.',
  }),
  {
    slug: 'png-to-svg',
    title: 'PNG to SVG',
    category: 'image',
    from: 'png',
    to: 'svg',
    description: 'Trace images into scalable vector SVGs, or wrap them losslessly in an SVG.',
    accepts: RASTER_KINDS,
    component: PngToSvg,
  },

  {
    slug: 'docx-to-pdf',
    title: 'DOCX to PDF',
    category: 'office',
    from: 'docx',
    to: 'pdf',
    description: 'Convert Word documents to PDF, with a live preview.',
    accepts: ['docx'],
    component: DocxToPdf,
  },
  {
    slug: 'pptx-to-pdf',
    title: 'PPTX to PDF',
    category: 'office',
    from: 'pptx',
    to: 'pdf',
    description: 'Convert PowerPoint presentations to PDF, one slide per page.',
    accepts: ['pptx'],
    component: PptxToPdf,
  },
  {
    slug: 'xlsx-to-pdf',
    title: 'XLSX to PDF',
    category: 'office',
    from: 'xlsx',
    to: 'pdf',
    description: 'Convert Excel spreadsheets (XLSX, XLS, ODS, CSV) to clean, searchable PDF tables.',
    accepts: ['xlsx'],
    component: XlsxToPdf,
  },

  imageTool('heic', 'jpg', {
    category: 'heic',
    accepts: ['heic'],
    description: 'Convert iPhone HEIC photos to JPG (or PNG / WebP).',
  }),
  {
    slug: 'heic-to-pdf',
    title: 'HEIC to PDF',
    category: 'heic',
    from: 'heic',
    to: 'pdf',
    description: 'Put iPhone HEIC photos into a single PDF or one PDF per photo.',
    accepts: IMAGE_KINDS,
    component: ImagesToPdf,
  },

  {
    slug: 'compress',
    title: 'File Compressor',
    category: 'compress',
    badges: ['pdf', 'jpg', 'png', 'mp4', 'mp3'],
    description: 'Make PDFs, images, videos and audio smaller in one go. Pick light, recommended or strong.',
    accepts: ['pdf', 'jpg', 'png', 'webp', ...MEDIA_KINDS],
    component: Compress,
  },
  {
    slug: 'compress-pdf',
    title: 'Compress PDF',
    category: 'compress',
    from: 'pdf',
    to: 'pdf',
    description: 'Shrink PDFs by optimizing their images while keeping text sharp, or flatten for maximum savings.',
    accepts: ['pdf'],
    component: Compress,
  },
  {
    slug: 'compress-image',
    title: 'Compress Image',
    category: 'compress',
    badges: ['jpg', 'png', 'webp'],
    description: 'Reduce JPG, PNG and WebP file size with smart quality and colour optimization.',
    accepts: ['jpg', 'png', 'webp'],
    component: Compress,
  },
  {
    slug: 'compress-video',
    title: 'Compress Video',
    category: 'media',
    from: 'mp4',
    to: 'mp4',
    description: 'Make videos smaller (MP4, MOV, WebM, MKV) by lowering resolution and bitrate.',
    accepts: VIDEO_KINDS,
    component: Compress,
  },
  {
    slug: 'mp4-to-mp3',
    title: 'MP4 to MP3',
    category: 'media',
    from: 'mp4',
    to: 'mp3',
    description: 'Extract the audio from videos as MP3 or WAV. Choose quality, mono, or just a part of the clip.',
    accepts: [...VIDEO_KINDS, ...AUDIO_KINDS],
    component: VideoToAudio,
  },
];

export const toolBySlug = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

/** Tools that can take a given input kind, best matches first. */
export function toolsForKind(kind) {
  const direct = TOOLS.filter((t) => t.from === kind);
  const other = TOOLS.filter((t) => t.from !== kind && t.accepts.includes(kind));
  return [...direct, ...other];
}

/** Old URLs from the previous version of the site. */
export const REDIRECTS = { 'svg-to-jpg': 'svg-to-png' };
