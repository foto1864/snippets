import { useEffect, useRef, useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Toggle } from '../components/controls';
import { formatBytes, nextFrame, withExt } from '../lib/files';
import { QUALITY, addElementPages, elementToCanvas, printHtml } from '../lib/capture';
import { newPdf, savePdf } from '../lib/pdfBuild';

const px = (v) => parseFloat(v) || 0;

export default function DocxToPdf({ tool }) {
  const c = useConverter({ kinds: tool.accepts, multiple: false });
  const file = c.items[0]?.file;
  const bodyRef = useRef(null);
  const styleRef = useRef(null);
  const [state, setState] = useState('idle'); // idle | rendering | ready | error
  const [renderError, setRenderError] = useState(null);
  const [quality, setQuality] = useState('high');
  const [smart, setSmart] = useState(true);
  const [headers, setHeaders] = useState(true);

  useEffect(() => {
    if (!file || !bodyRef.current) return;
    let alive = true;
    setState('rendering');
    setRenderError(null);
    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        bodyRef.current.innerHTML = '';
        styleRef.current.innerHTML = '';
        await renderAsync(await file.arrayBuffer(), bodyRef.current, styleRef.current, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: headers,
          renderFooters: headers,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
          experimental: true,
        });
        if (document.fonts?.ready) await document.fonts.ready;
        if (alive) setState('ready');
      } catch (e) {
        console.error(e);
        if (alive) {
          setState('error');
          setRenderError('This document could not be read. Is it a valid .docx file (not the older .doc format)?');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, headers, c.status === 'done']);

  const sections = () => Array.from(bodyRef.current?.querySelectorAll('section.docx') || []);

  const onRun = () =>
    c.run(async (report) => {
      const q = QUALITY[quality];
      const pdf = await newPdf();
      const list = sections();
      if (!list.length) throw new Error('The document appears to be empty.');
      let pages = 0;
      for (const [n, section] of list.entries()) {
        report(n / list.length, `Rendering section ${n + 1} of ${list.length}…`);
        await nextFrame();
        const cs = getComputedStyle(section);
        const page = {
          widthPx: section.offsetWidth,
          heightPx: px(cs.minHeight) || (section.offsetWidth * 297) / 210,
          padTop: px(cs.paddingTop),
          padBottom: px(cs.paddingBottom),
          padX: px(cs.paddingLeft),
        };
        const canvas = await elementToCanvas(section, q.scale);
        pages += await addElementPages(pdf, canvas, page, { scale: q.scale, jpeg: q.jpeg, smart });
        canvas.width = canvas.height = 0;
      }
      report(0.98, 'Saving PDF…');
      return [{ name: withExt(file.name, 'pdf'), blob: await savePdf(pdf), note: `${pages} pages` }];
    });

  const onPrint = () => {
    const first = sections()[0];
    const cs = first && getComputedStyle(first);
    printHtml({
      html: bodyRef.current.innerHTML,
      css: `${Array.from(styleRef.current.querySelectorAll('style')).map((s) => s.textContent).join('\n')}
        .docx-wrapper { background: none !important; padding: 0 !important; display: block !important; }
        .docx-wrapper > section.docx { box-shadow: none !important; margin: 0 !important; break-after: page; }`,
      pageWidthPx: first?.offsetWidth,
      pageHeightPx: cs ? px(cs.minHeight) : undefined,
    });
  };

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      multiple={false}
      hideList
      onRun={onRun}
      canRun={state === 'ready'}
      runLabel="Convert to PDF"
      emptyHint="Select a Word document (.docx) · drop or paste"
      listHeader={
        file && (
          <div className="doc-header">
            <div>
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                {formatBytes(file.size)}
                {state === 'ready' ? ` · ${sections().length} section(s) previewed` : ''}
              </div>
            </div>
          </div>
        )
      }
      options={
        <>
          <Field label="Image quality">
            <Segmented
              ariaLabel="Quality"
              value={quality}
              onChange={setQuality}
              options={Object.entries(QUALITY).map(([value, q]) => ({ value, label: q.label }))}
            />
          </Field>
          <Field hint="Moves page breaks into gaps between lines so text is never cut.">
            <Toggle checked={smart} onChange={setSmart}>
              Smart page breaks
            </Toggle>
          </Field>
          <Field>
            <Toggle checked={headers} onChange={setHeaders}>
              Include headers & footers
            </Toggle>
          </Field>
          <div className="alt-action">
            <p className="field-hint">
              Need selectable, searchable text? Print the preview and choose <b>Save as PDF</b> as the printer.
            </p>
            <button className="btn btn-block" disabled={state !== 'ready'} onClick={onPrint}>
              Print / Save as PDF (text)
            </button>
          </div>
        </>
      }
    >
      {state === 'rendering' && <p className="muted">Rendering preview…</p>}
      {renderError && <p className="error">{renderError}</p>}
      <div className="doc-preview" hidden={state === 'error'}>
        <div ref={styleRef} />
        <div ref={bodyRef} />
      </div>
    </ToolShell>
  );
}
