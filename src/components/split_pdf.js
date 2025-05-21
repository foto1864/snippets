import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';

export default function SplitPDF() {
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [ranges, setRanges] = useState("");
  const [status, setStatus] = useState("No file uploaded.");
  const [downloadLinks, setDownloadLinks] = useState([]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setPdfBuffer(buffer);
    setStatus(`PDF loaded: ${file.name}`);
    setDownloadLinks([]);
  };

  const handleConvert = async () => {
    if (!pdfBuffer) {
      setStatus("Please upload a PDF file first.");
      return;
    }

    if (!ranges.trim()) {
      setStatus("Enter a valid range like [1,2]; [3,4]");
      return;
    }

    let parts;
    try {
      parts = ranges.split(";").map(r => {
        const trimmed = r.trim();
        if (!/^\[\d+,\d+\]$/.test(trimmed)) throw new Error("Invalid format");
        return JSON.parse(trimmed);
      });
    } catch {
      setStatus("Invalid range format. Use: [1,2]; [3,4]");
      return;
    }

    setStatus("Converting...");
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    const links = [];

    for (let i = 0; i < parts.length; i++) {
      const [start, end] = parts[i];
      const newPdf = await PDFDocument.create();

      for (let p = start - 1; p < end; p++) {
        if (p >= 0 && p < totalPages) {
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [p]);
          newPdf.addPage(copiedPage);
        } else {
          setStatus(`Page ${p + 1} is out of bounds`);
          return;
        }
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      links.push({ name: `part_${i + 1}.pdf`, url });
    }

    setDownloadLinks(links);
    setStatus("Conversion complete.");
  };

  return (
    <div>
      <h2>Split PDF</h2>

      <input type="file" accept="application/pdf" onChange={handleFileSelect} /><br /><br />

      <input
        type="text"
        value={ranges}
        onChange={e => setRanges(e.target.value)}
        placeholder="[1,2]; [3,4]"
        style={{ width: "300px" }}
      /><br /><br />

      <button onClick={handleConvert}>Convert</button><br /><br />

      <div><strong>Status:</strong> {status}</div><br />

      {downloadLinks.length > 0 && (
        <div>
          <strong>Download:</strong>
          <ul>
            {downloadLinks.map((file, index) => (
              <li key={index}>
                <a href={file.url} download={file.name}>{file.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
