// src/App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import convertIcon from './assets/convert-icon.png';

import Dashboard from './components/dashboard';
import SplitPDF from './components/split_pdf';
import JpgToPdf from './components/jpg_to_pdf';
import MergePDF from './components/merge_pdf';
import SvgToJpg from './components/svg_to_jpg';
import WebpToJpg from './components/webp_to_jpg';
import PngToJpg from './components/png_to_jpg';

import './App.css';
import './components/global.css'; // assuming you have header CSS there

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <Router>
      <div className="app-container">
        <header className="main-header">
          <div className="logo">
            <Link to="/" className="logo-title">Code Snippets</Link>
            <img src={convertIcon} alt="Logo" className="logo-icon" />
          </div>

          <button
            className="menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            ☰
          </button>

          <nav className="nav-menu">
            <Link to="/" className="header-link">Home</Link>

            <div className="dropdown">
              <span className="header-link dropdown-toggle">
                Features <span className="dropdown-icon">▼</span>
              </span>
              <div className="dropdown-menu">
                <Link to="/split-pdf" className="dropdown-item">Split PDF</Link>
                <Link to="/jpg-to-pdf" className="dropdown-item">JPG to PDF</Link>
                <Link to="/merge-pdf" className="dropdown-item">Merge PDF</Link>
                <Link to="/svg-to-jpg" className="dropdown-item">SVG To JPG</Link>
                <Link to="/webp-to-jpg" className="dropdown-item">WEBP To JPG</Link>
                <Link to="/png-to-jpg" className="dropdown-item">PNG To JPG</Link>
              </div>
            </div>
          </nav>
        </header>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="mobile-menu open">
            <Link to="/" className="header-link" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
            <Link to="/split-pdf" className="header-link" onClick={() => setIsMobileMenuOpen(false)}>Split PDF</Link>
            <Link to="/jpg-to-pdf" className="header-link" onClick={() => setIsMobileMenuOpen(false)}>JPG to PDF</Link>
            <Link to="/merge-pdf" className="header-link" onClick={() => setIsMobileMenuOpen(false)}>Merge PDF</Link>
            <Link to="/svg-to-jpg" className="header-link" onClick={() => setIsMobileMenuOpen(false)}>SVG to JPG</Link>
            <Link to="/webp-to-jpg" className="header-link" onClick={() => setIsMobileMenuOpen(false)}>WEBP to JPG</Link>
            <Link to="/png-to-jpg" className="header-link" onClick={() => setIsMobileMenuOpen(false)}>PNG to JPG</Link>
          </div>
        )}

        <main className="main-content" style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/split-pdf" element={<SplitPDF />} />
            <Route path="/jpg-to-pdf" element={<JpgToPdf />} />
            <Route path="/merge-pdf" element={<MergePDF />} />
            <Route path="/svg-to-jpg" element={<SvgToJpg />} />
            <Route path="/webp-to-jpg" element={<WebpToJpg />} />
            <Route path="/png-to-jpg" element={<PngToJpg />} />
          </Routes>
        </main>

        <footer className="main-footer">
          <p>© {new Date().getFullYear()} Code Snippets. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
