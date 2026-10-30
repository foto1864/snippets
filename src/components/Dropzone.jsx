import { useEffect, useId, useRef, useState } from 'react';
import { acceptFor, detectKind } from '../lib/files';

/**
 * Click / drag-and-drop / paste file picker.
 * Files of unsupported kinds are reported through onReject.
 */
export default function Dropzone({
  kinds,
  multiple = true,
  onFiles,
  onReject,
  compact = false,
  label,
  hint,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const handle = (list) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    const ok = files.filter((f) => kinds.includes(detectKind(f)));
    const bad = files.filter((f) => !ok.includes(f));
    if (bad.length) onReject?.(bad);
    if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
  };

  // Paste files (e.g. screenshots) anywhere on the page.
  const handleRef = useRef(handle);
  handleRef.current = handle;
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) {
        e.preventDefault();
        handleRef.current(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <label
      htmlFor={inputId}
      className={`dropzone${dragging ? ' is-dragging' : ''}${compact ? ' is-compact' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple={multiple}
        accept={acceptFor(kinds)}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
        hidden
      />
      {compact ? (
        <span className="dropzone-compact">
          <span className="plus" aria-hidden>+</span> {label || 'Add more files'}
        </span>
      ) : (
        <>
          <svg className="dropzone-icon" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="btn btn-primary btn-lg">{label || (multiple ? 'Choose files' : 'Choose file')}</span>
          <span className="dropzone-hint">
            {hint || 'or drop them here · paste with Ctrl+V'}
          </span>
        </>
      )}
    </label>
  );
}
