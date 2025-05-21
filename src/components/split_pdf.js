import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import './global.css'

export default function SplitPDF() {
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [ranges, setRanges] = useState("");
  const [status, setStatus] = useState("No file uploaded.");
  const [downloadLinks, setDownloadLinks] = useState([]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const buffer = await file.arrayBuffer();     // ✅ wait for the data
      setPdfBuffer(buffer);                        // ✅ set actual data, not a promise
      setStatus(`Selected: ${file.name}`);
    } else {
      setStatus("No file selected.");
    }
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
    <div className="whole-page">

      <div className="div1"></div>

      <div className="mainframe">
        <h2>Split PDF</h2>

        <p class="inner-paragraph">This specific module is designed to help the user split a PDF file into multiple ones. If you have a PDF, 
          and you want to extract only specific pages, you can select the ranges you would like to have at the end.  
          <br />
          <br />
          For example, say you want to extract pages 2 through 5. You type [2,5] in the box below and click convert.
          For single pages, the range can be used as [x,x], so if you want to extract only the 3rd page, you select
          [3,3] as a range. What is more, both methods can be combined, since the user can select more than 1 range.
          For example, selecting: "[1,2]; [3,4]; [5,5]", 3 files are created. One containing pages 1 & 2, another
          containing pages 3 & 4, and finally one containing only the 5th page of the document.
          <br />
          <br />
          All ranges must be seperated with a semicolon ";" except for the last one.
        </p>

        <div className="file-upload">
          <label htmlFor="file-upload" className="choose-file">Choose PDF</label>
          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>  

        <input
          type="text"
          value={ranges}
          onChange={e => setRanges(e.target.value)}
          placeholder="Enter range in the form: [1,2]; [3,4]"
          className="ranges-textbox"
        />
        
        <br/><br/>

        <button className="inner-buttons"onClick={handleConvert}>Convert</button><br /><br />

        <div><strong>Status:</strong> {status}</div><br />

        {downloadLinks.length > 0 && (
          <div>
            <strong>Download:</strong>
            <ul>
              {downloadLinks.map((file, index) => (
                <li key={index}>
                  <a className="download-files" href={file.url} download={file.name}>{file.name}</a>
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
