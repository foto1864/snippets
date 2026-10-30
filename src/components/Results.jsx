import { useEffect, useMemo, useState } from 'react';
import { canShareFiles, downloadBlob, downloadZip, shareFiles } from '../lib/download';
import { formatBytes } from '../lib/files';

function Preview({ output }) {
  const isImage = output.blob.type.startsWith('image/');
  const url = useMemo(() => (isImage ? URL.createObjectURL(output.blob) : null), [output, isImage]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  const ext = output.name.split('.').pop().toUpperCase();
  return (
    <div className="thumb">
      {url ? <img src={url} alt="" /> : <span className={`thumb-badge kind-${ext.toLowerCase()}`}>{ext}</span>}
    </div>
  );
}

/**
 * Shows converted files with individual / ZIP download and native share.
 * outputs: [{ name, blob, note? }]
 */
export default function Results({ outputs, warnings = [], onReset, zipName = 'converted.zip', inputSize }) {
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState(null);
  const total = outputs.reduce((s, o) => s + o.blob.size, 0);
  const shareable = useMemo(() => canShareFiles(outputs), [outputs]);
  const saved = inputSize ? 1 - total / inputSize : null;

  return (
    <section className="results" aria-live="polite">
      <div className="results-head">
        <div>
          <h2>
            <span className="check" aria-hidden>✓</span> Done!{' '}
            {outputs.length > 1 ? `${outputs.length} files ready` : 'Your file is ready'}
          </h2>
          <p className="muted">
            {formatBytes(total)} total
            {saved !== null && Math.abs(saved) >= 0.01 && (
              <>
                {' · '}
                {saved > 0 ? (
                  <span className="good">{Math.round(saved * 100)}% smaller</span>
                ) : (
                  <span>{Math.round(-saved * 100)}% larger</span>
                )}{' '}
                than the original
              </>
            )}
          </p>
        </div>
        <div className="results-actions">
          {outputs.length === 1 ? (
            <button className="btn btn-primary btn-lg" onClick={() => downloadBlob(outputs[0].blob, outputs[0].name)}>
              Download
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              disabled={zipping}
              onClick={async () => {
                setZipping(true);
                setError(null);
                try {
                  await downloadZip(outputs, zipName);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setZipping(false);
                }
              }}
            >
              {zipping ? 'Zipping…' : 'Download all (ZIP)'}
            </button>
          )}
          {shareable && (
            <button className="btn" onClick={() => shareFiles(outputs).catch((e) => setError(e.message))}>
              Share
            </button>
          )}
          <button className="btn btn-ghost" onClick={onReset}>
            Start over
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {warnings.map((w, i) => (
        <p key={i} className="notice">{w}</p>
      ))}
      <ul className="result-list">
        {outputs.map((o, i) => (
          <li key={i} className="result-item">
            <Preview output={o} />
            <div className="file-card-body">
              <div className="file-name" title={o.name}>{o.name}</div>
              <div className="file-meta">
                {formatBytes(o.blob.size)}
                {o.note ? ` · ${o.note}` : ''}
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => downloadBlob(o.blob, o.name)}>
              Download
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
