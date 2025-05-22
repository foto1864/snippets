import React, { useState } from 'react';

export default function JpgToPng() {
  const [jpgFiles, setJpgFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [pngFiles, setPngFiles] = useState([]);
  const [status, setStatus] = useState("No files selected.");

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter(file =>
      file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')
    );

    if (files.length === 0) {
      setStatus("Please upload valid .jpg files.");
      return;
    }

    setJpgFiles(files);
    setPreviewUrls(files.map(file => URL.createObjectURL(file)));
    setPngFiles([]);
    setStatus(`${files.length} JPG file(s) loaded. Ready to convert.`);
  };

  const handleConvert = () => {
    const promises = jpgFiles.map((file, index) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const pngDataUrl = canvas.toDataURL('image/png');
          resolve({
            name: file.name.replace(/\.(jpg|jpeg)$/, '.png'),
            url: pngDataUrl
          });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    });

    setStatus("Converting...");

    Promise.all(promises)
      .then(results => {
        setPngFiles(results);
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
        <h2>JPG to PNG</h2>

        <p className="inner-paragraph">
          Upload one or more JPG images to preview them. Then press "Convert" to turn them into PNGs and download each file.
        </p>

        <div className="file-upload">
          <label htmlFor="jpg-upload" className="choose-file">Choose JPGs</label>
          <input
            id="jpg-upload"
            type="file"
            accept=".jpg,.jpeg"
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

        {pngFiles.length > 0 && (
          <div>
            <strong className="leave-space">Download:</strong><br />
            <ul className="download-list">
              {pngFiles.map((file, idx) => (
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
