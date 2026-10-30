import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Dropzone from '../components/Dropzone';
import { CATEGORIES, TOOLS } from '../tools';
import { detectKind } from '../lib/files';
import { setPendingFiles } from '../lib/handoff';

const ALL_KINDS = [...new Set(TOOLS.flatMap((t) => t.accepts))];

export function KindBadge({ kind }) {
  return <span className={`kind kind-${kind}`}>{kind.toUpperCase()}</span>;
}

function ToolCard({ tool, onClick }) {
  const content = (
    <>
      <span className="tool-card-kinds">
        {tool.badges ? (
          tool.badges.map((k) => <KindBadge key={k} kind={k} />)
        ) : (
          <>
            <KindBadge kind={tool.from} />
            <span className="arrow" aria-hidden>→</span>
            <KindBadge kind={tool.to} />
          </>
        )}
      </span>
      <span className="tool-card-title">{tool.title}</span>
      <span className="tool-card-desc">{tool.description}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="tool-card" onClick={onClick}>
      {content}
    </button>
  ) : (
    <Link to={`/${tool.slug}`} className="tool-card">
      {content}
    </Link>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [dropped, setDropped] = useState(null);

  useEffect(() => {
    document.title = 'Snippets — Free Online File Converter';
  }, []);

  const suggestions = useMemo(() => {
    if (!dropped) return [];
    const kinds = [...new Set(dropped.map(detectKind))];
    return TOOLS.filter((t) => kinds.every((k) => t.accepts.includes(k))).sort(
      (a, b) => (kinds.includes(b.from) ? 1 : 0) - (kinds.includes(a.from) ? 1 : 0),
    );
  }, [dropped]);

  const q = query.trim().toLowerCase();
  const filtered = TOOLS.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.accepts.some((k) => k === q),
  );

  const open = (tool) => {
    setPendingFiles(dropped || []);
    navigate(`/${tool.slug}`);
  };

  return (
    <div className="container page">
      <section className="hero">
        <h1>
          Convert files <span className="accent">instantly</span>.
          <br />
          Free, private, no uploads.
        </h1>
        <p className="lead">
          PDFs, images, iPhone photos, Office documents, audio and video — all converted and compressed right in your browser. No sign-up, no limits,
          no watermarks.
        </p>
        {!dropped ? (
          <Dropzone
            kinds={ALL_KINDS}
            onFiles={setDropped}
            label="Choose any files"
            hint="or drop / paste them — we’ll suggest what you can do"
          />
        ) : (
          <div className="suggest">
            <div className="suggest-head">
              <h2>
                What should we do with {dropped.length === 1 ? `“${dropped[0].name}”` : `these ${dropped.length} files`}?
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setDropped(null)}>
                Choose other files
              </button>
            </div>
            {suggestions.length ? (
              <div className="tool-grid">
                {suggestions.map((t) => (
                  <ToolCard key={t.slug} tool={t} onClick={() => open(t)} />
                ))}
              </div>
            ) : (
              <p className="notice">No single tool accepts this mix of files. Try selecting files of one type.</p>
            )}
          </div>
        )}
        <ul className="features">
          <li>
            <b>🔒 Private</b> Files never leave your device.
          </li>
          <li>
            <b>⚡ Fast</b> No upload or download wait.
          </li>
          <li>
            <b>∞ Unlimited</b> Batch convert as much as you like.
          </li>
        </ul>
      </section>

      <section className="all-tools">
        <div className="all-tools-head">
          <h2>All tools</h2>
          <input
            className="input search"
            type="search"
            placeholder="Search tools, e.g. “heic” or “merge”"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {CATEGORIES.map((cat) => {
          const tools = filtered.filter((t) => t.category === cat.id);
          if (!tools.length) return null;
          return (
            <div key={cat.id} className="category">
              <h3>{cat.label}</h3>
              <div className="tool-grid">
                {tools.map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            </div>
          );
        })}
        {!filtered.length && <p className="muted">No tools match “{query}”.</p>}
      </section>
    </div>
  );
}
