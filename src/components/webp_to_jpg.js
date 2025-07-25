import React, { useState } from 'react';

export default function WebpToJpg() {
  const [webpFiles, setWebpFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [jpgFiles, setJpgFiles] = useState([]);
  const [status, setStatus] = useState("No files selected.");

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter(file =>
      file.name.toLowerCase().endsWith('.webp')
    );

    if (files.length === 0) {
      setStatus("Please upload valid .webp files.");
      return;
    }

    setWebpFiles(files);
    setPreviewUrls(files.map(file => URL.createObjectURL(file)));
    setJpgFiles([]);
    setStatus(`${files.length} WEBP file(s) loaded. Ready to convert.`);
  };

  const handleConvert = () => {
    const promises = webpFiles.map((file, index) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const jpgDataUrl = canvas.toDataURL('image/jpeg');
          resolve({
            name: file.name.replace(/\.webp$/, '.jpg'),
            url: jpgDataUrl
          });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    });

    setStatus("Converting...");

    Promise.all(promises)
      .then(results => {
        setJpgFiles(results);
        setStatus("Conversion complete.");
      })
      .catch(() => {
        setStatus("Conversion failed.");
      });
  };

  return (
    <div className="whole-page">
      <div className="div1"></div>

      <div className="mainframe">
        <h2>WEBP to JPG</h2>

        <p className="inner-paragraph">
          Upload one or more WEBP images to preview them. Then press "Convert" to turn them into JPGs and download each file.
        </p>

        <div className="file-upload">
          <label htmlFor="webp-upload" className="choose-file">Choose WEBPs</label>
          <input
            id="webp-upload"
            type="file"
            accept=".webp"
            multiple
            onChange={handleFileChange}
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

        {jpgFiles.length > 0 && (
          <div>
            <strong className="leave-space">Download:</strong><br />
            <ul className="download-list">
              {jpgFiles.map((file, idx) => (
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
