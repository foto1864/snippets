// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import convertIcon from './assets/convert-icon.png';

import Dashboard from './components/dashboard';
import SplitPDF from './components/split_pdf';
import JpgToPdf from './components/jpg_to_pdf';

import './App.css'

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="main-header">
          <div className="logo">
            <h1>Code Snippets</h1>
            <img src={convertIcon} alt="Logo" className="logo-icon" />
          </div>

          <nav>
            <Link to="/" className="header-link">Home</Link>
            <Link to="/split" className="header-link">Split PDF</Link>
            <Link to="/convert" className="header-link-last">JPG to PDF</Link>
          </nav>
        </header>

        <main className="main-content" style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/split" element={<SplitPDF />} />
            <Route path="/convert" element={<JpgToPdf />} />
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
