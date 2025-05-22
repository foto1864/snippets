// src/components/dashboard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './global.css'

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div class="whole-page">

      <div class="div1"></div>

      <div class="mainframe">
        <h1>File Converter</h1>
        <p>Welcome to my version of a Free Converter! I have made 2 specific modules for the time being. 
          The first one allows the user to input a PDF file and split it into custom ranges.
          The second one allows the user to input an image file such as JPG or PNG and convert it into a PDF.
          You can select your desired function from the menu below. Thank you!</p>
        <button class="main-buttons" onClick={() => navigate("/split")}>Split PDF</button>
        <button class="main-buttons" onClick={() => navigate("/convert")}>JPG to PDF</button>
        <button class="main-buttons" onClick={() => navigate("/merge")}>Merge PDF</button>
      </div>

      <div class="div1"></div>

    </div>
  );
}