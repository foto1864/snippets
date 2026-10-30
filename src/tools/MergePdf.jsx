import { useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Select } from '../components/controls';
import { detectKind, nextFrame } from '../lib/files';
import { PAGE_SIZES, loadPdfLib, parseRanges, rangesToIndices } from '../lib/pdf';
import { addImagePage, embedImageFile, newPdf, savePdf } from '../lib/pdfBuild';

export default function MergePdf({ tool }) {
  const c = useConverter({ kinds: tool.accepts });
  const [ranges, setRanges] = useState({});
  const [imagePage, setImagePage] = useState('a4');
  const [name, setName] = useState('merged');

  const onRun = () =>
    c.run(async (report) => {
      const out = await newPdf();
      const total = c.items.length;
      for (const [n, { id, file }] of c.items.entries()) {
        report(n / total, `Adding ${n + 1} of ${total}: ${file.name}`);
        await nextFrame();
        if (detectKind(file) === 'pdf') {
          const src = await loadPdfLib(file);
          const count = src.getPageCount();
          const spec = (ranges[id] || '').trim();
          let indices = src.getPageIndices();
          if (spec) {
            try {
              indices = rangesToIndices(parseRanges(spec, count));
            } catch (e) {
              throw new Error(`${file.name}: ${e.message}`);
            }
          }
          const pages = await out.copyPages(src, indices);
          pages.forEach((p) => out.addPage(p));
        } else {
          const image = await embedImageFile(out, file);
          addImagePage(out, image, { pageSize: imagePage, margin: imagePage === 'fit' ? 0 : 24 });
        }
      }
      report(0.97, 'Saving…');
      const blob = await savePdf(out);
      return [{ name: `${(name || 'merged').replace(/\.pdf$/i, '')}.pdf`, blob, note: `${out.getPageCount()} pages` }];
    });

  const hasImages = c.items.some((i) => detectKind(i.file) !== 'pdf');

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      sortable
      onRun={onRun}
      runLabel="Merge PDF"
      canRun={c.items.length >= 2}
      emptyHint="Select two or more PDFs (images work too) · drop or paste"
      listHeader={
        <p className="muted small">
          {c.items.length < 2 ? 'Add at least one more file. ' : ''}Drag files to set the order. Optionally pick pages per file.
        </p>
      }
      renderExtra={(item, thumb) =>
        detectKind(item.file) === 'pdf' && (
          <input
            className="input input-sm"
            placeholder={thumb?.pages ? `Pages: all (1–${thumb.pages})` : 'Pages: all'}
            value={ranges[item.id] || ''}
            onChange={(e) => setRanges((r) => ({ ...r, [item.id]: e.target.value }))}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Pages to include from ${item.file.name}`}
          />
        )
      }
      options={
        <>
          <Field label="File name">
            <span className="number-input" style={{ width: '100%' }}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              <span className="suffix">.pdf</span>
            </span>
          </Field>
          {hasImages && (
            <Field label="Image pages" hint="Page size used for images in the merge.">
              <Select
                value={imagePage}
                onChange={setImagePage}
                options={[
                  { value: 'fit', label: 'Same as image' },
                  ...Object.entries(PAGE_SIZES).map(([value, s]) => ({ value, label: s.label })),
                ]}
              />
            </Field>
          )}
          <Field label="Page ranges" hint='Examples: "1-3, 5", "2-" (2 to end). Leave empty for all pages.' />
          {c.items.length > 1 && (
            <Field label="Quick order">
              <Segmented
                ariaLabel="Sort files"
                value={null}
                onChange={(v) =>
                  c.setItems((list) =>
                    v === 'reverse'
                      ? [...list].reverse()
                      : [...list].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })),
                  )
                }
                options={[
                  { value: 'name', label: 'Sort A→Z' },
                  { value: 'reverse', label: 'Reverse' },
                ]}
              />
            </Field>
          )}
        </>
      }
    />
  );
}
