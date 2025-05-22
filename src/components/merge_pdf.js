import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import './global.css';

export default function MergePDF() {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [status, setStatus] = useState("No PDF files selected.");
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type === "application/pdf");

    if (files.length === 0) {
      setStatus("No valid PDF files selected.");
      setPdfFiles([]);
      setDownloadUrl(null);
      return;
    }

    setPdfFiles(files);
    setStatus(`${files.length} PDF(s) loaded.`);
    setDownloadUrl(null);
  };

  const handleMerge = async () => {
    if (pdfFiles.length === 0) {
      setStatus("Please select at least two PDFs.");
      return;
    }

    setStatus("Merging...");

    const mergedPdf = await PDFDocument.create();

    for (const file of pdfFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    setDownloadUrl(url);
    setStatus("Merge complete.");
  };

  return (
    <div className="whole-page">
      <div className="div1"></div>

      <div className="mainframe">
        <h2>Merge PDF</h2>

        <p className="inner-paragraph">
          This module allows you to merge multiple PDF files into a single document.
          Upload two or more PDF files, and they will be combined in the order you select them.
          <br /><br />
          Click "Choose PDFs", select your files, and press "Merge" to download the final document.
        </p>

        <div className="file-upload">
          <label htmlFor="pdf-upload" className="choose-file">Choose PDFs</label>
          <input
            id="pdf-upload"
            type="file"
            multiple
            accept="application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        <br />

        <button className="inner-buttons" onClick={handleMerge}>Merge</button><br /><br />

        <div><strong>Status:</strong> {status}</div><br />

        {downloadUrl && (
          <div>
            <strong className="leave-space">Download:</strong><br />
            <ul>
                <li>
                    <a className="download-files" href={downloadUrl} download="merged.pdf">merged.pdf</a>
                </li>
            </ul>
          </div>
        )}
      </div>

      <div className="div1"></div>
    </div>
  );
}
