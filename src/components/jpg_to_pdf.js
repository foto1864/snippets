// src/components/jpg_to_pdf.js
import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';

export default function JpgToPdf() {
  const [imageFiles, setImageFiles] = useState([]);
  const [status, setStatus] = useState("No images selected.");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [previewUrls, setPreviewUrls] = useState([]);

  const handleImageSelect = (e) => {
  const files = Array.from(e.target.files).filter(f =>
    f.type === "image/jpeg" || f.type === "image/png"
  );

  if (files.length === 0) {
    setStatus("No valid images selected.");
    setImageFiles([]);
    setDownloadUrl(null);
    setPreviewUrls([]);
    return;
  }

  setImageFiles(files);
  setStatus(`${files.length} image(s) loaded.`);

  // Generate object URLs for preview
  const urls = files.map(file => URL.createObjectURL(file));
  setPreviewUrls(urls);
};


  const handleConvert = async () => {
    if (imageFiles.length === 0) {
      setStatus("Please select JPG or PNG images first.");
      return;
    }

    setStatus("Converting...");
    const urls = [];

    for (const [index, file] of imageFiles.entries()) {
      const imageBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.create();

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

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      urls.push({ url, name: `image_${index + 1}.pdf` });
    }

    setStatus("Conversion complete.");
    setDownloadUrl(urls); // Now an array of download links
  };


return (
  <div className="whole-page">

    <div className="div1"></div>

    <div className="mainframe">
      <h2>JPG to PDF</h2>

      <p className="inner-paragraph">
        This module allows you to convert one or more image files into a single PDF file. You can select multiple JPG or PNG files,
        and each image will be placed on its own page within the resulting PDF. The order of pages will follow the order in which
        the files are selected from your device.
        <br /><br />
        Simply click "Choose Images", select your files, and press "Convert" to download your new PDF.
      </p>

      <div className="file-upload">
        <label htmlFor="image-upload" className="choose-file">Choose Images</label>
        <input
          id="image-upload"
          type="file"
          multiple
          accept="image/jpeg, image/png"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
      </div>

      <br />

      {previewUrls.length > 0 && (
        <div className="image-preview-gallery">
          <strong>Preview:</strong>
          <div className="image-preview-container">
            {previewUrls.map((url, idx) => (
              <img key={idx} src={url} alt={`Preview ${idx}`} className="preview-image" />
            ))}
          </div>
          <br />
        </div>
      )}

      <button className="inner-buttons" onClick={handleConvert}>Convert</button><br /><br />

      <div><strong>Status:</strong> {status}</div><br />

      {downloadUrl && downloadUrl.length > 0 && (
        <div>
          <strong className="leave-space">Download:</strong>
          <ul className="download-list">
            {downloadUrl.map((file, idx) => (
              <li key={idx}>
                <a className="download-files" href={file.url} download={file.name}>
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>

    <div className="div1"></div>

  </div>
);

}
