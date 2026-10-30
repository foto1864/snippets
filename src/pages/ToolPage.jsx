import { Suspense, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TOOLS } from '../tools';

export default function ToolPage({ tool }) {
  const Component = tool.component;

  useEffect(() => {
    document.title = `${tool.title} — Free & Private | Snippets`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${tool.title}: ${tool.description} Free, no uploads, no sign-up.`);
  }, [tool]);

  const related = TOOLS.filter((t) => t.slug !== tool.slug && (t.category === tool.category || t.from === tool.from)).slice(0, 8);

  return (
    <div className="container page">
      <div className="tool-head">
        <h1>{tool.title}</h1>
        <p className="lead">{tool.description}</p>
      </div>
      <Suspense fallback={<div className="muted center">Loading tool…</div>}>
        <Component tool={tool} />
      </Suspense>
      {related.length > 0 && (
        <section className="related">
          <h2>Related tools</h2>
          <div className="chips">
            {related.map((t) => (
              <Link key={t.slug} to={`/${t.slug}`} className="chip">
                {t.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
