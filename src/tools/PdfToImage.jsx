import { useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Slider } from '../components/controls';
import { baseName, nextFrame } from '../lib/files';
import { FORMATS, canvasToBlob } from '../lib/image';
import { closePdf, openPdf, parseRanges, rangesToIndices, renderPage } from '../lib/pdf';

const DPIS = [72, 150, 200, 300, 600];

export default function PdfToImage({ tool }) {
  const c = useConverter({ kinds: tool.accepts });
  const [format, setFormat] = useState(tool.to);
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(90);
  const [pages, setPages] = useState('');

  const fmt = FORMATS[format];

  const onRun = () =>
    c.run(async (report) => {
      // Open everything first so progress can be reported per page overall.
      const jobs = [];
      for (const { file } of c.items) {
        const doc = await openPdf(file).catch((e) => {
          throw new Error(`${file.name}: ${e.message}`);
        });
        let indices = tool.coverOnly ? [0] : Array.from({ length: doc.numPages }, (_, i) => i);
        if (!tool.coverOnly && pages.trim()) {
          try {
            indices = rangesToIndices(parseRanges(pages, doc.numPages));
          } catch (e) {
            closePdf(doc);
            throw new Error(c.items.length > 1 ? `${file.name}: ${e.message}` : e.message);
          }
        }
        jobs.push({ file, doc, indices });
      }
      const total = jobs.reduce((s, j) => s + j.indices.length, 0);
      const outputs = [];
      let done = 0;
      try {
        for (const { file, doc, indices } of jobs) {
          const pad = String(doc.numPages).length;
          for (const i of indices) {
            report(done / total, `Rendering page ${done + 1} of ${total}`);
            await nextFrame();
            const canvas = await renderPage(doc, i + 1, dpi / 72, fmt.alpha ? null : '#ffffff');
            const blob = await canvasToBlob(canvas, fmt.mime, fmt.lossy ? quality / 100 : undefined);
            const name = tool.coverOnly
              ? `${baseName(file.name)}_cover.${fmt.ext}`
              : doc.numPages === 1
                ? `${baseName(file.name)}.${fmt.ext}`
                : `${baseName(file.name)}_page-${String(i + 1).padStart(pad, '0')}.${fmt.ext}`;
            outputs.push({ name, blob, note: `${canvas.width}×${canvas.height}` });
            canvas.width = canvas.height = 0;
            done++;
          }
        }
      } finally {
        jobs.forEach((j) => closePdf(j.doc));
      }
      return outputs;
    });

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      onRun={onRun}
      runLabel={tool.coverOnly ? `Extract cover as ${fmt.label}` : `Convert to ${fmt.label}`}
      zipName={tool.coverOnly ? 'covers.zip' : `${c.items[0] ? baseName(c.items[0].file.name) : 'pdf'}-images.zip`}
      options={
        <>
          <Field label="Image format">
            <Segmented
              ariaLabel="Image format"
              value={format}
              onChange={setFormat}
              options={Object.entries(FORMATS).map(([value, f]) => ({ value, label: f.label }))}
            />
          </Field>
          <Field
            label="Resolution"
            hint={dpi >= 300 ? 'Print quality. Large files, slower.' : dpi <= 72 ? 'Screen size, smallest files.' : 'Sharp on screens, reasonable size.'}
          >
            <Segmented
              ariaLabel="Resolution"
              value={dpi}
              onChange={setDpi}
              options={DPIS.map((v) => ({ value: v, label: `${v} DPI` }))}
            />
          </Field>
          {fmt.lossy && (
            <Field label="Quality">
              <Slider value={quality} onChange={setQuality} min={10} max={100} format={(v) => `${v}%`} />
            </Field>
          )}
          {!tool.coverOnly && (
            <Field label="Pages" hint='Leave empty for all pages, or e.g. "1, 3-5".'>
              <input className="input" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="All pages" />
            </Field>
          )}
        </>
      }
    />
  );
}
