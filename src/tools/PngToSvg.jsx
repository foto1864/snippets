import { useEffect, useRef, useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Slider, Toggle } from '../components/controls';
import { detectKind, nextFrame, withExt } from '../lib/files';
import { canvasToBlob, decodeImage, drawToCanvas, targetSize } from '../lib/image';

const DETAIL = {
  high: { label: 'High', ltres: 0.5, qtres: 0.5, pathomit: 2 },
  medium: { label: 'Medium', ltres: 1, qtres: 1, pathomit: 8 },
  low: { label: 'Low', ltres: 2, qtres: 2, pathomit: 20 },
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Runs tracing jobs in a worker so the page stays responsive. */
function useTracer() {
  const worker = useRef(null);
  const jobs = useRef(new Map());
  useEffect(
    () => () => {
      worker.current?.terminate();
      jobs.current.forEach(({ reject }) => reject(new DOMException('Cancelled', 'AbortError')));
    },
    [],
  );
  return (imageData, options) => {
    if (!worker.current) {
      worker.current = new Worker(new URL('../workers/trace.worker.js', import.meta.url), { type: 'module' });
      worker.current.onmessage = ({ data }) => {
        const job = jobs.current.get(data.id);
        jobs.current.delete(data.id);
        if (data.error) job?.reject(new Error(data.error));
        else job?.resolve(data.svg);
      };
    }
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      jobs.current.set(id, { resolve, reject });
      worker.current.postMessage({ id, imageData, options });
    });
  };
}

export default function PngToSvg({ tool }) {
  const c = useConverter({ kinds: tool.accepts });
  const trace = useTracer();
  const [mode, setMode] = useState('trace');
  const [colors, setColors] = useState(16);
  const [detail, setDetail] = useState('medium');
  const [smooth, setSmooth] = useState(0);
  const [maxSize, setMaxSize] = useState(1200);
  const [ignoreWhite, setIgnoreWhite] = useState(false);

  const onRun = () =>
    c.run(async (report) => {
      const outputs = [];
      for (const [n, { file }] of c.items.entries()) {
        const step = `${n + 1} of ${c.items.length}`;
        report(n / c.items.length, mode === 'trace' ? `Tracing ${step} (this can take a moment)…` : `Wrapping ${step}`);
        await nextFrame();

        if (mode === 'embed') {
          const decoded = await decodeImage(file);
          let png = file;
          if (detectKind(file) !== 'png') {
            const canvas = drawToCanvas(decoded, decoded.width, decoded.height, null);
            png = await canvasToBlob(canvas, 'image/png');
          }
          const { width, height } = decoded;
          decoded.close();
          const href = await blobToDataUrl(png);
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="${href}" xlink:href="${href}"/></svg>`;
          outputs.push({
            name: withExt(file.name, 'svg'),
            blob: new Blob([svg], { type: 'image/svg+xml' }),
            note: 'embedded',
          });
          continue;
        }

        const decoded = await decodeImage(file);
        const size = targetSize(decoded.width, decoded.height, { mode: 'fit', width: maxSize, height: maxSize });
        const canvas = drawToCanvas(decoded, size.width, size.height, null);
        decoded.close();
        const imageData = canvas.getContext('2d').getImageData(0, 0, size.width, size.height);
        if (ignoreWhite) {
          // Make near-white pixels transparent so backgrounds don't become shapes.
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) d[i + 3] = 0;
          }
        }
        const { ltres, qtres, pathomit } = DETAIL[detail];
        let svg = await trace(imageData, {
          numberofcolors: colors,
          colorsampling: 2,
          colorquantcycles: 3,
          ltres,
          qtres,
          pathomit,
          blurradius: smooth,
          blurdelta: 20,
          rightangleenhance: true,
          strokewidth: 0,
          roundcoords: 1,
          viewbox: true,
          desc: false,
        });
        // Drop fully transparent paths and give the SVG a nominal size.
        svg = svg
          .replace(/<path[^>]*opacity="0"[^>]*\/>/g, '')
          .replace('<svg ', `<svg width="${size.width}" height="${size.height}" `);
        outputs.push({
          name: withExt(file.name, 'svg'),
          blob: new Blob([svg], { type: 'image/svg+xml' }),
          note: `traced, ${colors} colours`,
        });
      }
      return outputs;
    });

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      onRun={onRun}
      runLabel="Convert to SVG"
      zipName="svg-images.zip"
      options={
        <>
          <Field
            label="Method"
            hint={
              mode === 'trace'
                ? 'Turns the image into real vector shapes. Best for logos, icons and illustrations.'
                : 'Places the original pixels inside an SVG. Lossless, but not truly scalable.'
            }
          >
            <Segmented
              ariaLabel="Method"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'trace', label: 'Vectorize' },
                { value: 'embed', label: 'Embed image' },
              ]}
            />
          </Field>
          {mode === 'trace' && (
            <>
              <Field label="Colours" hint="Use 2 for black & white logos.">
                <Segmented
                  ariaLabel="Colours"
                  value={colors}
                  onChange={setColors}
                  options={[2, 4, 8, 16, 32, 64].map((v) => ({ value: v, label: String(v) }))}
                />
              </Field>
              <Field label="Detail">
                <Segmented
                  ariaLabel="Detail"
                  value={detail}
                  onChange={setDetail}
                  options={Object.entries(DETAIL).map(([value, d]) => ({ value, label: d.label }))}
                />
              </Field>
              <Field label="Smoothing" hint="Blurs noise before tracing; helps with photos and JPG artefacts.">
                <Slider value={smooth} onChange={setSmooth} min={0} max={5} format={(v) => (v ? v : 'Off')} />
              </Field>
              <Field label="Trace resolution" hint="Images are scaled down to this size first. Higher is slower.">
                <Segmented
                  ariaLabel="Trace resolution"
                  value={maxSize}
                  onChange={setMaxSize}
                  options={[600, 1200, 2000].map((v) => ({ value: v, label: `${v}px` }))}
                />
              </Field>
              <Field>
                <Toggle checked={ignoreWhite} onChange={setIgnoreWhite}>
                  Remove white background
                </Toggle>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
