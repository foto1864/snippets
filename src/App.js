// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import convertIcon from './assets/convert-icon.png';

import Dashboard from './components/dashboard';
import SplitPDF from './components/split_pdf';
import JpgToPdf from './components/jpg_to_pdf';
import MergePDF from './components/merge_pdf';

import './App.css'

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="main-header">
          <div className="logo">
            <Link to="/" className="logo-title">Code Snippets</Link>
            <img src={convertIcon} alt="Logo" className="logo-icon" />
          </div>

          <nav className="nav-menu">
            <Link to="/" className="header-link">Home</Link>

            <div className="dropdown">
              <span className="header-link dropdown-toggle">
                Features <span className="dropdown-icon">▼</span>
              </span>
              <div className="dropdown-menu">
                <Link to="/split" className="dropdown-item">Split PDF</Link>
                <Link to="/convert" className="dropdown-item">JPG to PDF</Link>
                <Link to="/merge" className="dropdown-item">Merge PDF</Link>
              </div>
            </div>
          </nav>

        </header>

        <main className="main-content" style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/split" element={<SplitPDF />} />
            <Route path="/convert" element={<JpgToPdf />} />
            <Route path="/merge" element={<MergePDF />} />
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
