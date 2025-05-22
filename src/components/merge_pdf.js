import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import './global.css';

export default function MergePDF() {

  const [pdfFiles, setPdfFiles] = useState([]);
  const [status, setStatus] = useState("No PDF files selected.");
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleFileSelect = async (e) => {
    const newFiles = Array.from(e.target.files).filter(f => f.type === "application/pdf");
    if (newFiles.length === 0) return;

    const updatedFiles = [...pdfFiles, ...newFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
    }))];

    setPdfFiles(updatedFiles);
    setStatus(`${updatedFiles.length} PDF(s) loaded.`);
    setDownloadUrl(null);
  };

  const handleRemove = (id) => {
    const updatedFiles = pdfFiles.filter(f => f.id !== id);
    setPdfFiles(updatedFiles);
    setStatus(`${updatedFiles.length} PDF(s) loaded.`);
    setDownloadUrl(null);
  };

  const handleMerge = async () => {
    if (pdfFiles.length < 2) {
      setStatus("Please select at least two PDFs.");
      return;
    }

    setStatus("Merging...");
    const mergedPdf = await PDFDocument.create();

    for (const { file } of pdfFiles) {
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
          This module is designed to allow the user to merge 2 or more PDF files into one. Simply upload your files and click 
          merge. You can also rearrange the order of the files using the arrows, as well as add or remove files if you need to
          remove or add more.
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
        <div className="pdf-preview-container">
          {pdfFiles.map((item, index) => (
            <div key={item.id} className="pdf-card">
              <span>{item.file.name}</span>

              <div className="reorder-controls-horizontal">
                <button
                  onClick={() => {
                    if (index > 0) {
                      const newFiles = [...pdfFiles];
                      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
                      setPdfFiles(newFiles);
                    }
                  }}
                  disabled={index === 0}
                >
                  ←
                </button>
                <button
                  onClick={() => {
                    if (index < pdfFiles.length - 1) {
                      const newFiles = [...pdfFiles];
                      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
                      setPdfFiles(newFiles);
                    }
                  }}
                  disabled={index === pdfFiles.length - 1}
                >
                  →
                </button>
              </div>

              <button className="remove-btn" onClick={() => handleRemove(item.id)}>X</button>
            </div>
          ))}
        </div>


        <br />
        <button className="inner-buttons" onClick={handleMerge}>Merge</button><br /><br />
        <div><strong>Status:</strong> {status}</div><br />

        {downloadUrl && (
          <div>
            <strong className="leave-space">Download:</strong><br />
            <ul>
              <li><a className="download-files" href={downloadUrl} download="merged.pdf">merged.pdf</a></li>
            </ul>
          </div>
        )}
      </div>

      <div className="div1"></div>
    </div>
  );
}