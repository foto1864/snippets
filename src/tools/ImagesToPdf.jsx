import { useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Select } from '../components/controls';
import { baseName, nextFrame, withExt } from '../lib/files';
import { PAGE_SIZES } from '../lib/pdf';
import { addImagePage, embedImageFile, newPdf, savePdf } from '../lib/pdfBuild';

export const COMPRESSION = {
  original: { label: 'Original', quality: null, maxDim: 0, title: 'Keep images untouched when possible' },
  balanced: { label: 'Balanced', quality: 0.82, maxDim: 2400, title: 'Good quality, much smaller' },
  small: { label: 'Smallest', quality: 0.6, maxDim: 1600, title: 'Smallest file, good for email' },
};

export const MARGINS = { 0: 'None', 18: 'Small', 36: 'Medium', 72: 'Large' };

export default function ImagesToPdf({ tool }) {
  const c = useConverter({ kinds: tool.accepts });
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('auto');
  const [margin, setMargin] = useState(0);
  const [compression, setCompression] = useState(tool.from === 'heic' ? 'balanced' : 'original');
  const [mode, setMode] = useState('single');

  const onRun = () =>
    c.run(async (report) => {
      const layout = { pageSize, orientation, margin };
      const comp = COMPRESSION[compression];
      const total = c.items.length;
      const outputs = [];

      if (mode === 'single') {
        const doc = await newPdf();
        for (const [n, { file }] of c.items.entries()) {
          report(n / total, `Adding image ${n + 1} of ${total}`);
          await nextFrame();
          const image = await embedImageFile(doc, file, comp).catch((e) => {
            throw new Error(`${file.name}: ${e.message}`);
          });
          addImagePage(doc, image, layout);
        }
        report(0.98, 'Saving PDF…');
        const name = total === 1 ? withExt(c.items[0].file.name, 'pdf') : `${baseName(c.items[0].file.name)}-and-${total - 1}-more.pdf`;
        outputs.push({ name, blob: await savePdf(doc), note: `${total} page${total === 1 ? '' : 's'}` });
      } else {
        for (const [n, { file }] of c.items.entries()) {
          report(n / total, `Creating PDF ${n + 1} of ${total}`);
          await nextFrame();
          const doc = await newPdf();
          addImagePage(doc, await embedImageFile(doc, file, comp), layout);
          outputs.push({ name: withExt(file.name, 'pdf'), blob: await savePdf(doc) });
        }
      }
      return outputs;
    });

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      sortable
      onRun={onRun}
      runLabel="Create PDF"
      zipName="images-pdf.zip"
      listHeader={c.items.length > 1 && <p className="muted small">Drag to reorder pages.</p>}
      options={
        <>
          <Field label="Page size">
            <Select
              value={pageSize}
              onChange={setPageSize}
              options={[
                { value: 'fit', label: 'Same as image' },
                ...Object.entries(PAGE_SIZES).map(([value, s]) => ({ value, label: s.label })),
              ]}
            />
          </Field>
          {pageSize !== 'fit' && (
            <Field label="Orientation">
              <Segmented
                ariaLabel="Orientation"
                value={orientation}
                onChange={setOrientation}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Landscape' },
                ]}
              />
            </Field>
          )}
          <Field label="Margin">
            <Segmented
              ariaLabel="Margin"
              value={margin}
              onChange={setMargin}
              options={Object.entries(MARGINS).map(([v, label]) => ({ value: Number(v), label }))}
            />
          </Field>
          <Field label="Image compression" hint={COMPRESSION[compression].title}>
            <Segmented
              ariaLabel="Compression"
              value={compression}
              onChange={setCompression}
              options={Object.entries(COMPRESSION).map(([value, o]) => ({ value, label: o.label }))}
            />
          </Field>
          {c.items.length > 1 && (
            <Field label="Output">
              <Segmented
                ariaLabel="Output"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'single', label: 'One PDF' },
                  { value: 'each', label: 'One PDF per image' },
                ]}
              />
            </Field>
          )}
        </>
      }
    />
  );
}
