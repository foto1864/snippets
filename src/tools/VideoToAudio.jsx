import { useEffect, useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Toggle } from '../components/controls';
import { withExt } from '../lib/files';
import { AUDIO_FORMATS, extractAudio, formatTime, parseTime, probeMedia } from '../lib/media';

const BITRATES = [96, 128, 192, 256, 320];

/** Shows duration (or a problem) under each file. */
function MediaInfo({ file }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let alive = true;
    probeMedia(file)
      .then((i) => alive && setInfo(i))
      .catch((e) => alive && setInfo({ error: e.message }));
    return () => {
      alive = false;
    };
  }, [file]);
  if (!info) return <div className="file-meta">Reading…</div>;
  if (info.error) return <div className="file-meta error-text">{info.error}</div>;
  return (
    <div className="file-meta">
      {formatTime(info.duration)}
      {info.width ? ` · ${info.width}×${info.height}` : ''}
      {!info.hasAudio && <span className="error-text"> · no audio track</span>}
    </div>
  );
}

export default function VideoToAudio({ tool }) {
  const c = useConverter({ kinds: tool.accepts });
  const [format, setFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState(192);
  const [mono, setMono] = useState(false);
  const [trimOn, setTrimOn] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const startS = trimOn ? parseTime(start) : null;
  const endS = trimOn ? parseTime(end) : null;
  const trimError =
    Number.isNaN(startS) || Number.isNaN(endS)
      ? 'Use a time like 1:30 or 0:01:30.'
      : startS != null && endS != null && endS <= startS
        ? 'The end must be after the start.'
        : null;

  const onRun = () =>
    c.run(async (report, signal) => {
      const outputs = [];
      const warnings = [];
      const total = c.items.length;
      for (const [n, { file }] of c.items.entries()) {
        const label = `Extracting audio ${total > 1 ? `${n + 1} of ${total}` : ''}`.trim();
        report(n / total, `${label}…`);
        try {
          const blob = await extractAudio(
            file,
            { format, bitrate, mono, trim: { start: startS, end: endS } },
            (p) => report((n + p) / total, `${label} · ${Math.round(p * 100)}%`),
            signal,
          );
          outputs.push({
            name: withExt(file.name, AUDIO_FORMATS[format].ext),
            blob,
            note: format === 'mp3' ? `${bitrate} kbps${mono ? ' mono' : ''}` : 'lossless',
          });
        } catch (e) {
          if (e?.name === 'AbortError' || total === 1) throw e;
          warnings.push(`${file.name}: ${e.message}`);
        }
      }
      return { outputs, warnings };
    });

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      onRun={onRun}
      canRun={!trimError}
      runLabel={`Convert to ${AUDIO_FORMATS[format].label}`}
      zipName="audio.zip"
      emptyHint="Videos (MP4, MOV, WebM, MKV) or audio files · drop or paste"
      renderExtra={(item) => <MediaInfo file={item.file} />}
      options={
        <>
          <Field label="Audio format">
            <Segmented
              ariaLabel="Audio format"
              value={format}
              onChange={setFormat}
              options={Object.entries(AUDIO_FORMATS).map(([value, f]) => ({ value, label: f.label }))}
            />
          </Field>
          {format === 'mp3' && (
            <Field
              label="Quality"
              hint={bitrate >= 256 ? 'Best quality, larger files.' : bitrate <= 96 ? 'Fine for speech and podcasts.' : 'Great for music.'}
            >
              <Segmented
                ariaLabel="Bitrate"
                value={bitrate}
                onChange={setBitrate}
                options={BITRATES.map((v) => ({ value: v, label: `${v}k` }))}
              />
            </Field>
          )}
          <Field>
            <div className="checklist">
              <Toggle checked={mono} onChange={setMono}>
                Mono (half the size, good for voice)
              </Toggle>
              <Toggle checked={trimOn} onChange={setTrimOn}>
                Only extract part of it
              </Toggle>
            </div>
          </Field>
          {trimOn && (
            <Field label="From – to" hint="Leave a side empty to use the start / end of the file.">
              <div className="row">
                <input className="input" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0:00" />
                <span className="muted">–</span>
                <input className="input" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="end" />
              </div>
              {trimError && <div className="field-hint error-text">{trimError}</div>}
            </Field>
          )}
        </>
      }
    />
  );
}
