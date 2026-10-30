import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Home from './pages/Home';
import ToolPage from './pages/ToolPage';
import { CATEGORIES, REDIRECTS, TOOLS, toolBySlug } from './tools';
import logo from './assets/convert-icon.png';

function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || null);
  const isDark =
    theme === 'dark' || (!theme && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return (
    <button
      className="icon-btn"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      onClick={() => {
        const next = isDark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {
          /* private mode */
        }
        setTheme(next);
      }}
    >
      {isDark ? '☀' : '☾'}
    </button>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <img src={logo} alt="" width="28" height="28" />
          <span>Snippets</span>
        </Link>
        <nav className={`main-nav${open ? ' is-open' : ''}`} aria-label="Tools">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="nav-group">
              <button type="button" className="nav-trigger">
                {cat.label.replace(' (HEIC)', '')} <span aria-hidden>▾</span>
              </button>
              <div className="nav-menu">
                {TOOLS.filter((t) => t.category === cat.id).map((t) => (
                  <NavLink key={t.slug} to={`/${t.slug}`} className="nav-item">
                    {t.title}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <button
            className="icon-btn menu-btn"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}

function ToolRoute() {
  const { slug } = useParams();
  if (REDIRECTS[slug]) return <Navigate to={`/${REDIRECTS[slug]}`} replace />;
  const tool = toolBySlug[slug];
  if (!tool) return <NotFound />;
  return <ToolPage key={slug} tool={tool} />;
}

function NotFound() {
  useEffect(() => {
    document.title = 'Page not found — Snippets';
  }, []);
  return (
    <div className="container page center">
      <h1>Page not found</h1>
      <p className="muted">That converter doesn’t exist (yet).</p>
      <Link to="/" className="btn btn-primary">
        See all tools
      </Link>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Braces matter: scrollTo returns a Promise in recent browsers, and React
    // would try to call any returned value as a cleanup function.
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <Header />
      <main>
        <Suspense fallback={<div className="container page muted">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:slug" element={<ToolRoute />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <p>
            <b>Snippets</b> — free, fast and private file conversion. Everything runs in your browser; your files never leave
            your device.
          </p>
          <p className="muted">© {new Date().getFullYear()} Snippets</p>
        </div>
      </footer>
    </div>
  );
}
