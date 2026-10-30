// Audio extraction and video re-encoding with Mediabunny (WebCodecs).
// Input files are read lazily in chunks, so even very large videos are never
// loaded into memory as a whole.

let mediaPromise;

async function loadMedia() {
  mediaPromise ??= (async () => {
    const mb = await import('mediabunny');
    if (!(await mb.canEncodeAudio('mp3'))) {
      const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
      registerMp3Encoder();
    }
    return mb;
  })();
  return mediaPromise;
}

export const AUDIO_FORMATS = {
  mp3: { label: 'MP3', ext: 'mp3', mime: 'audio/mpeg' },
  wav: { label: 'WAV', ext: 'wav', mime: 'audio/wav' },
};

function friendlyError(err) {
  const msg = err?.message || String(err);
  if (/unsupported|not supported|unrecognized|no tracks|could not/i.test(msg)) {
    return new Error('This file format or codec is not supported by your browser. Try Chrome or Edge.');
  }
  return err instanceof Error ? err : new Error(msg);
}

/** Opens a media file and returns basic info, or throws a readable error. */
export async function probeMedia(file) {
  const mb = await loadMedia();
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const [duration, audio, video] = await Promise.all([
      input.computeDuration(),
      input.getPrimaryAudioTrack(),
      input.getPrimaryVideoTrack(),
    ]);
    return {
      duration,
      hasAudio: !!audio,
      width: video?.displayWidth,
      height: video?.displayHeight,
    };
  } catch (e) {
    throw friendlyError(e);
  } finally {
    input.dispose?.();
  }
}

async function runConversion(mb, input, output, options, onProgress, signal, invalidMessage) {
  const conversion = await mb.Conversion.init({ input, output, showWarnings: false, ...options });
  if (!conversion.isValid) throw new Error(invalidMessage);
  const abort = () => conversion.cancel();
  signal?.addEventListener('abort', abort);
  conversion.onProgress = (p) => onProgress?.(p);
  try {
    await conversion.execute();
  } finally {
    signal?.removeEventListener('abort', abort);
  }
  return output.target.buffer;
}

/**
 * Extracts the audio track of a video/audio file.
 * opts: { format: 'mp3'|'wav', bitrate: kbps, mono, trim: { start, end } (seconds) }
 */
export async function extractAudio(file, opts, onProgress, signal) {
  const mb = await loadMedia();
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const format = opts.format === 'wav' ? new mb.WavOutputFormat() : new mb.Mp3OutputFormat();
    const output = new mb.Output({ format, target: new mb.BufferTarget() });
    const trim = {};
    if (opts.trim?.start > 0) trim.start = opts.trim.start;
    if (opts.trim?.end > 0) trim.end = opts.trim.end;
    const buffer = await runConversion(
      mb,
      input,
      output,
      {
        video: { discard: true },
        audio: {
          ...(opts.format === 'mp3' ? { quality: new mb.Quality({ bitrate: opts.bitrate * 1000 }) } : {}),
          ...(opts.mono ? { numberOfChannels: 1 } : {}),
        },
        ...(Object.keys(trim).length ? { trim } : {}),
      },
      onProgress,
      signal,
      'No audio track that your browser can decode was found in this file.',
    );
    return new Blob([buffer], { type: AUDIO_FORMATS[opts.format].mime });
  } catch (e) {
    if (e?.name === 'AbortError' || signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    throw friendlyError(e);
  } finally {
    input.dispose?.();
  }
}

/**
 * Re-encodes a video to a smaller MP4 (H.264, or VP9/WebM when H.264 encoding
 * is unavailable). opts: { maxHeight, quality: 'very-low'..'high' }
 * Returns { blob, ext }.
 */
export async function compressVideo(file, opts, onProgress, signal) {
  const mb = await loadMedia();
  const useAvc = await mb.canEncodeVideo('avc');
  if (!useAvc && !(await mb.canEncodeVideo('vp9'))) {
    throw new Error('Your browser cannot encode video. Try Chrome or Edge.');
  }
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const output = new mb.Output({
      format: useAvc ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
      target: new mb.BufferTarget(),
    });
    const buffer = await runConversion(
      mb,
      input,
      output,
      {
        video: (track) => {
          const h = track.displayHeight;
          const w = track.displayWidth;
          const scale = h > opts.maxHeight && w > opts.maxHeight ? opts.maxHeight / Math.min(w, h) : 1;
          return {
            codec: useAvc ? 'avc' : 'vp9',
            quality: new mb.Quality(opts.quality),
            forceTranscode: true,
            ...(scale < 1
              ? { width: Math.round((w * scale) / 2) * 2, height: Math.round((h * scale) / 2) * 2, fit: 'fill' }
              : {}),
          };
        },
        audio: { quality: new mb.Quality(opts.quality === 'high' ? 'medium' : 'low') },
      },
      onProgress,
      signal,
      'Your browser cannot decode the video in this file. Try Chrome or Edge.',
    );
    return { blob: new Blob([buffer], { type: useAvc ? 'video/mp4' : 'video/webm' }), ext: useAvc ? 'mp4' : 'webm' };
  } catch (e) {
    if (e?.name === 'AbortError' || signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    throw friendlyError(e);
  } finally {
    input.dispose?.();
  }
}

/** Parses "1:23", "01:02:03" or "83.5" into seconds; null when empty/invalid. */
export function parseTime(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0) || parts.length > 3) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
