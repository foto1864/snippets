import { useEffect, useRef, useState } from 'react';
import Dropzone from './Dropzone';
import FileList from './FileList';
import Results from './Results';
import { Progress } from './controls';
import { formatBytes, uid } from '../lib/files';
import { takePendingFiles } from '../lib/handoff';

const isPhone = () => window.matchMedia?.('(pointer: coarse)').matches;

/** Everything happens in memory, so warn before very large jobs. */
function largeFileWarning(files) {
  const limit = (isPhone() ? 150 : 750) * 1024 * 1024;
  const big = files.find((f) => f.size > limit);
  if (!big) return null;
  return `"${big.name}" is very large (${formatBytes(big.size)}). It is processed in your browser's memory, so it may be slow${
    isPhone() ? ' and can fail on phones — a computer works best' : ''
  }.`;
}

/** Wraps picked files in list items with stable ids. */
export const toItems = (files) => files.map((file) => ({ id: uid(), file }));

/**
 * Shared state for a converter: selected files, run status, progress and results.
 */
export function useConverter({ kinds, multiple = true }) {
  const [items, setItems] = useState(() => {
    const pending = takePendingFiles(kinds);
    return toItems(multiple ? pending : pending.slice(0, 1));
  });
  const [status, setStatus] = useState('idle'); // idle | working | done
  const [progress, setProgress] = useState({ value: 0, label: '' });
  const [outputs, setOutputs] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const controller = useRef(null);

  const addFiles = (files) => {
    setError(null);
    const big = largeFileWarning(files);
    setNotice(big);
    setItems((list) => (multiple ? [...list, ...toItems(files)] : toItems(files.slice(0, 1))));
  };

  const reject = (files) =>
    setNotice(
      `Skipped ${files.length === 1 ? `"${files[0].name}"` : `${files.length} files`} — not a supported format here.`,
    );

  const run = async (fn) => {
    setError(null);
    setNotice(null);
    setStatus('working');
    setProgress({ value: 0, label: 'Starting…' });
    const ctrl = new AbortController();
    controller.current = ctrl;
    const { signal } = ctrl;
    try {
      const report = (value, label) => {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        setProgress({ value, label });
      };
      const result = await fn(report, signal);
      if (signal.aborted) return;
      const outs = Array.isArray(result) ? result : result.outputs;
      if (!outs.length) throw new Error(result.warnings?.join(' ') || 'Nothing was produced.');
      setOutputs(outs);
      setWarnings(Array.isArray(result) ? [] : result.warnings || []);
      setStatus('done');
    } catch (e) {
      if (signal.aborted) return;
      console.error(e);
      setStatus('idle');
      if (e?.name !== 'AbortError') setError(e?.message || String(e));
    }
  };

  const cancel = () => {
    controller.current?.abort();
    setStatus('idle');
  };

  const reset = () => {
    setItems([]);
    setOutputs([]);
    setStatus('idle');
    setError(null);
    setNotice(null);
  };

  // Free result blobs when leaving the page.
  useEffect(
    () => () => {
      controller.current?.abort();
      setOutputs([]);
    },
    [],
  );

  return {
    items,
    setItems,
    addFiles,
    reject,
    status,
    progress,
    outputs,
    warnings,
    error,
    setError,
    notice,
    run,
    cancel,
    reset,
    backToEdit: () => setStatus('idle'),
  };
}

/**
 * Standard tool layout: drop zone → file list + options → progress → results.
 */
export default function ToolShell({
  converter: c,
  kinds,
  multiple = true,
  sortable = false,
  options,
  onRun,
  runLabel = 'Convert',
  canRun = true,
  renderExtra,
  emptyHint,
  zipName,
  children,
  listHeader,
  hideList = false,
  compareSize = false,
}) {
  const inputSize = c.items.reduce((s, i) => s + i.file.size, 0);

  if (c.status === 'done') {
    return (
      <>
        <Results
          outputs={c.outputs}
          warnings={c.warnings}
          onReset={c.reset}
          zipName={zipName}
          inputSize={compareSize ? inputSize : null}
        />
        <div className="center">
          <button className="btn btn-ghost" onClick={c.backToEdit}>
            ← Change settings and convert again
          </button>
        </div>
      </>
    );
  }

  if (!c.items.length) {
    return (
      <>
        <Dropzone kinds={kinds} multiple={multiple} onFiles={c.addFiles} onReject={c.reject} hint={emptyHint} />
        {c.notice && <p className="notice">{c.notice}</p>}
      </>
    );
  }

  const working = c.status === 'working';

  return (
    <div className="workspace">
      <div className="workspace-main">
        {listHeader}
        {!hideList && (
          <FileList items={c.items} setItems={c.setItems} sortable={sortable && !working} renderExtra={renderExtra} />
        )}
        {children}
        {multiple && !working && (
          <Dropzone kinds={kinds} multiple onFiles={c.addFiles} onReject={c.reject} compact />
        )}
      </div>
      <aside className="workspace-side">
        {options && <div className="options">{options}</div>}
        {c.notice && <p className="notice">{c.notice}</p>}
        {c.error && <p className="error">{c.error}</p>}
        {working ? (
          <>
            <Progress value={c.progress.value} label={c.progress.label} />
            <button className="btn btn-ghost btn-block" onClick={c.cancel}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-lg btn-block" disabled={!canRun} onClick={onRun}>
              {runLabel}
            </button>
            <button className="btn btn-ghost btn-block" onClick={c.reset}>
              Clear all
            </button>
          </>
        )}
        <p className="privacy-note">
          <span aria-hidden>🔒</span> Processed on your device. Files are never uploaded.
        </p>
      </aside>
    </div>
  );
}
