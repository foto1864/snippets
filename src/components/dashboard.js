// src/components/dashboard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div class="dashboard-mainframe">
      <h1>PDF Toolkit</h1>
      <button onClick={() => navigate("/split")}>Split PDF</button>
      <button onClick={() => navigate("/convert")}>JPG to PDF</button>
    </div>
  );
}
