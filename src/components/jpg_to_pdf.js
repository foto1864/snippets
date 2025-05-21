// src/components/jpg_to_pdf.js
import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';

export default function JpgToPdf() {
  const [imageFiles, setImageFiles] = useState([]);
  const [status, setStatus] = useState("No images selected.");
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files).filter(f =>
      f.type === "image/jpeg" || f.type === "image/png"
    );

    if (files.length === 0) {
      setStatus("No valid images selected.");
      setImageFiles([]);
      setDownloadUrl(null);
      return;
    }

    setImageFiles(files);
    setStatus(`${files.length} image(s) loaded.`);
    setDownloadUrl(null);
  };

  const handleConvert = async () => {
    if (imageFiles.length === 0) {
      setStatus("Please select JPG or PNG images first.");
      return;
    }

    setStatus("Converting...");

    const pdfDoc = await PDFDocument.create();

    for (const file of imageFiles) {
      const imageBytes = await file.arrayBuffer();
      let image;
      if (file.type === "image/jpeg") {
        image = await pdfDoc.embedJpg(imageBytes);
      } else if (file.type === "image/png") {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        setStatus("Unsupported file type.");
        return;
      }

      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    setDownloadUrl(url);
    setStatus("Conversion complete.");
  };

  return (
    <div>
      <h2>JPG to PDF</h2>

      <input type="file" multiple accept="image/jpeg, image/png" onChange={handleImageSelect} /><br /><br />

      <button onClick={handleConvert}>Convert</button><br /><br />

      <div><strong>Status:</strong> {status}</div><br />

      {downloadUrl && (
        <div>
          <strong>Download:</strong><br />
          <a href={downloadUrl} download="converted.pdf">converted.pdf</a>
        </div>
      )}
    </div>
  );
}
