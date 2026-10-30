import { useEffect, useRef, useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented } from '../components/controls';
import { formatBytes, nextFrame, withExt } from '../lib/files';
import { QUALITY, elementToCanvas } from '../lib/capture';
import { addCanvasPage, newPdf, savePdf } from '../lib/pdfBuild';

// Slides are laid out at this CSS width; capture scale multiplies it.
const RENDER_WIDTH = 960;

export default function PptxToPdf({ tool }) {
  const c = useConverter({ kinds: tool.accepts, multiple: false });
  const file = c.items[0]?.file;
  const hostRef = useRef(null);
  const [state, setState] = useState('idle');
  const [renderError, setRenderError] = useState(null);
  const [slideCount, setSlideCount] = useState(0);
  const [quality, setQuality] = useState('high');

  useEffect(() => {
    if (!file || !hostRef.current) return;
    let alive = true;
    let previewer;
    setState('rendering');
    setRenderError(null);
    (async () => {
      try {
        const { init } = await import('pptx-preview');
        hostRef.current.innerHTML = '';
        previewer = init(hostRef.current, { width: RENDER_WIDTH, mode: 'list' });
        await previewer.preview(await file.arrayBuffer());
        if (document.fonts?.ready) await document.fonts.ready;
        // Charts render asynchronously; give them a moment.
        await new Promise((r) => setTimeout(r, 400));
        if (!alive) return;
        setSlideCount(hostRef.current.querySelectorAll('.pptx-preview-slide-wrapper').length);
        setState('ready');
      } catch (e) {
        console.error(e);
        if (alive) {
          setState('error');
          setRenderError('This presentation could not be read. Is it a valid .pptx file (not the older .ppt format)?');
        }
      }
    })();
    return () => {
      alive = false;
      try {
        previewer?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [file, c.status === 'done']);

  const onRun = () =>
    c.run(async (report) => {
      const q = QUALITY[quality];
      const slides = Array.from(hostRef.current.querySelectorAll('.pptx-preview-slide-wrapper'));
      if (!slides.length) throw new Error('No slides found in this presentation.');
      const pdf = await newPdf();
      for (const [n, slide] of slides.entries()) {
        report(n / slides.length, `Rendering slide ${n + 1} of ${slides.length}…`);
        await nextFrame();
        // The previewer adds spacing between slides; capture without it.
        const margin = slide.style.margin;
        slide.style.margin = '0';
        try {
          const canvas = await elementToCanvas(slide, q.scale);
          // 960 CSS px = 10in, the standard PowerPoint slide width.
          const k = 720 / slide.offsetWidth;
          await addCanvasPage(pdf, canvas, slide.offsetWidth * k, slide.offsetHeight * k, q.jpeg);
          canvas.width = canvas.height = 0;
        } finally {
          slide.style.margin = margin;
        }
      }
      report(0.98, 'Saving PDF…');
      return [{ name: withExt(file.name, 'pdf'), blob: await savePdf(pdf), note: `${slides.length} slides` }];
    });

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      multiple={false}
      hideList
      onRun={onRun}
      canRun={state === 'ready'}
      runLabel="Convert to PDF"
      emptyHint="Select a PowerPoint presentation (.pptx) · drop or paste"
      listHeader={
        file && (
          <div className="doc-header">
            <div>
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                {formatBytes(file.size)}
                {state === 'ready' ? ` · ${slideCount} slides` : ''}
              </div>
            </div>
          </div>
        )
      }
      options={
        <>
          <Field label="Image quality" hint="Higher quality makes text sharper but files larger.">
            <Segmented
              ariaLabel="Quality"
              value={quality}
              onChange={setQuality}
              options={Object.entries(QUALITY).map(([value, q]) => ({ value, label: q.label }))}
            />
          </Field>
          <p className="field-hint">
            Animations and transitions are not included. Fonts missing on your device are replaced with similar ones.
          </p>
        </>
      }
    >
      {state === 'rendering' && <p className="muted">Rendering slides…</p>}
      {renderError && <p className="error">{renderError}</p>}
      <div className="doc-preview slides-preview" hidden={state === 'error'}>
        <div ref={hostRef} />
      </div>
    </ToolShell>
  );
}
