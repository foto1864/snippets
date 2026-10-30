let counter = 0;
export const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

export const baseName = (name) => name.replace(/\.[^./\\]+$/, '') || name;
export const withExt = (name, ext) => `${baseName(name)}.${ext}`;

const EXT_KIND = {
  pdf: 'pdf',
  jpg: 'jpg', jpeg: 'jpg', jfif: 'jpg', pjpeg: 'jpg',
  png: 'png', apng: 'png',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
  avif: 'avif',
  svg: 'svg',
  heic: 'heic', heif: 'heic',
  docx: 'docx',
  pptx: 'pptx',
  xlsx: 'xlsx', xlsm: 'xlsx', xls: 'xlsx', ods: 'xlsx', csv: 'xlsx',
  mp4: 'mp4', m4v: 'mp4', mov: 'mov', webm: 'webm', mkv: 'mkv',
  mp3: 'mp3', m4a: 'm4a', aac: 'm4a', wav: 'wav', ogg: 'ogg', oga: 'ogg', opus: 'ogg', flac: 'flac',
};

const MIME_KIND = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
};

/** Best-effort file kind detection from extension, falling back to MIME type. */
export function detectKind(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return EXT_KIND[ext] || MIME_KIND[file.type] || null;
}

export const RASTER_KINDS = ['jpg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic'];
export const IMAGE_KINDS = [...RASTER_KINDS, 'svg'];
export const VIDEO_KINDS = ['mp4', 'mov', 'webm', 'mkv'];
export const AUDIO_KINDS = ['mp3', 'm4a', 'wav', 'ogg', 'flac'];
export const MEDIA_KINDS = [...VIDEO_KINDS, ...AUDIO_KINDS];

/** Input `accept` attribute for a list of kinds. */
export function acceptFor(kinds) {
  const map = {
    pdf: '.pdf,application/pdf',
    jpg: '.jpg,.jpeg,.jfif,image/jpeg',
    png: '.png,image/png',
    webp: '.webp,image/webp',
    gif: '.gif,image/gif',
    bmp: '.bmp,image/bmp',
    avif: '.avif,image/avif',
    svg: '.svg,image/svg+xml',
    heic: '.heic,.heif,image/heic,image/heif',
    docx: '.docx',
    pptx: '.pptx',
    xlsx: '.xlsx,.xlsm,.xls,.ods,.csv',
    mp4: '.mp4,.m4v,video/mp4',
    mov: '.mov,video/quicktime',
    webm: '.webm,video/webm',
    mkv: '.mkv,video/x-matroska',
    mp3: '.mp3,audio/mpeg',
    m4a: '.m4a,.aac,audio/mp4',
    wav: '.wav,audio/wav',
    ogg: '.ogg,.oga,.opus,audio/ogg',
    flac: '.flac,audio/flac',
  };
  return kinds.map((k) => map[k]).filter(Boolean).join(',');
}

/** Ensures every name in a list is unique by appending (2), (3)... */
export function uniqueNames(names) {
  const seen = new Map();
  return names.map((name) => {
    const n = seen.get(name) || 0;
    seen.set(name, n + 1);
    if (n === 0) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)} (${n + 1})${name.slice(dot)}` : `${name} (${n + 1})`;
  });
}

/** Lets the browser paint between heavy synchronous steps. */
export const nextFrame = () => new Promise((r) => setTimeout(r, 0));
