import React, { useState } from 'react';

export default function SvgToJpg() {
  const [svgFiles, setSvgFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [jpgFiles, setJpgFiles] = useState([]);
  const [status, setStatus] = useState("No files selected.");

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter(file =>
      file.name.toLowerCase().endsWith('.svg')
    );

    if (files.length === 0) {
      setStatus("Please upload valid .svg files.");
      return;
    }

    setSvgFiles(files);
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(newPreviewUrls);
    setJpgFiles([]);
    setStatus(`${files.length} SVG file(s) loaded. Ready to convert.`);
  };

  const handleConvert = () => {
    const promises = svgFiles.map((file, index) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const svgData = reader.result;
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width || 800;
            canvas.height = img.height || 600;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const jpgDataUrl = canvas.toDataURL('image/jpeg');
            resolve({
              name: file.name.replace(/\.svg$/, '.jpg'),
              url: jpgDataUrl
            });
            URL.revokeObjectURL(url);
          };

          img.onerror = reject;
          img.src = url;
        };

        reader.onerror = reject;
        reader.readAsText(file);
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
        <h2>SVG to JPG</h2>

        <p className="inner-paragraph">
          Upload one or more SVG files to preview them. Then press "Convert" to turn them into JPGs and download each file.
        </p>

        <div className="file-upload">
          <label htmlFor="svg-upload" className="choose-file">Choose SVGs</label>
          <input
            id="svg-upload"
            type="file"
            accept=".svg"
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
                <img key={idx} src={url} alt={`SVG Preview ${idx}`} className="preview-image" />
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
