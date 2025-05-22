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
          <div className='my-selectors'>
        <button class="main-buttons" onClick={() => navigate("/split-pdf")}>Split PDF</button>
        <button class="main-buttons" onClick={() => navigate("/merge-pdf")}>Merge PDF</button>
        <button class="main-buttons" onClick={() => navigate("/jpg-to-pdf")}>JPG to PDF</button>
        <button class="main-buttons" onClick={() => navigate("/svg-to-jpg")}>SVG to JPG</button>
        <button class="main-buttons" onClick={() => navigate("/webp-to-jpg")}>WEBP to JPG</button>
        <button class="main-buttons" onClick={() => navigate("/png-to-jpg")}>PNG to JPG</button>
        <button class="main-buttons" onClick={() => navigate("/jpg-to-png")}>JPG to PNG</button>
          </div>

      </div>

      <div class="div1"></div>

    </div>
  );
}