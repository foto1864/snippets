import { useEffect, useRef, useState } from 'react';
import { pageThumbnail } from '../lib/pdf';

function PageThumb({ doc, index, selected, label, onClick }) {
  const ref = useRef(null);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        pageThumbnail(doc, index + 1, 140)
          .then((u) => alive && setUrl(u))
          .catch(() => {});
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [doc, index]);

  return (
    <button
      ref={ref}
      type="button"
      className={`page-thumb${selected ? ' is-selected' : ''}${onClick ? '' : ' is-static'}`}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      aria-label={`Page ${index + 1}`}
    >
      <span className="page-thumb-img">{url ? <img src={url} alt="" /> : <span className="spinner" />}</span>
      <span className="page-thumb-num">{index + 1}</span>
      {label && <span className="page-thumb-label">{label}</span>}
    </button>
  );
}

/**
 * Lazily rendered page thumbnails of a pdf.js document.
 * labels: optional per-page badge (e.g. which output file it goes to).
 */
export default function PageGrid({ doc, selected, onToggle, labels }) {
  return (
    <div className="page-grid">
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PageThumb
          key={i}
          doc={doc}
          index={i}
          selected={selected ? selected.has(i) : !!labels?.[i]}
          label={labels?.[i]}
          onClick={onToggle ? () => onToggle(i) : undefined}
        />
      ))}
    </div>
  );
}
