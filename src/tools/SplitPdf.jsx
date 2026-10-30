import { useEffect, useMemo, useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import PageGrid from '../components/PageGrid';
import { Field, NumberInput, Segmented, Toggle } from '../components/controls';
import { baseName, formatBytes, nextFrame } from '../lib/files';
import { closePdf, loadPdfLib, openPdf, parseRanges, rangesToIndices } from '../lib/pdf';
import { savePdf } from '../lib/pdfBuild';

const MODES = [
  { value: 'select', label: 'Select' },
  { value: 'ranges', label: 'Ranges' },
  { value: 'every', label: 'Every N' },
  { value: 'all', label: 'Each page' },
];

/** Splits page indices into output groups for the current settings. */
function computeGroups({ mode, count, selected, action, separate, rangeText, every, mergeRanges }) {
  const all = Array.from({ length: count }, (_, i) => i);
  switch (mode) {
    case 'select': {
      const picked = action === 'delete' ? all.filter((i) => !selected.has(i)) : all.filter((i) => selected.has(i));
      if (!picked.length) return { groups: [] };
      return { groups: separate && action === 'extract' ? picked.map((i) => [i]) : [picked] };
    }
    case 'ranges': {
      if (!rangeText.trim()) return { groups: [] };
      try {
        const ranges = parseRanges(rangeText, count);
        const groups = ranges.map((r) => rangesToIndices([r]));
        return { groups: mergeRanges ? [groups.flat()] : groups };
      } catch (e) {
        return { groups: [], error: e.message };
      }
    }
    case 'every': {
      const n = Math.max(1, every || 1);
      const groups = [];
      for (let i = 0; i < count; i += n) groups.push(all.slice(i, i + n));
      return { groups };
    }
    default:
      return { groups: all.map((i) => [i]) };
  }
}

const describe = (group) => {
  const parts = [];
  let start = group[0];
  let prev = group[0];
  for (const i of [...group.slice(1), null]) {
    if (i !== null && i === prev + 1) {
      prev = i;
      continue;
    }
    parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
    start = prev = i;
  }
  return parts.join(',');
};

export default function SplitPdf({ tool }) {
  const c = useConverter({ kinds: tool.accepts, multiple: false });
  const file = c.items[0]?.file;
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [mode, setMode] = useState('select');
  const [selected, setSelected] = useState(() => new Set());
  const [action, setAction] = useState('extract');
  const [separate, setSeparate] = useState(false);
  const [rangeText, setRangeText] = useState('');
  const [mergeRanges, setMergeRanges] = useState(false);
  const [every, setEvery] = useState(1);

  useEffect(() => {
    setDoc(null);
    setLoadError(null);
    setSelected(new Set());
    if (!file) return;
    let alive = true;
    let opened;
    openPdf(file)
      .then((d) => {
        opened = d;
        if (alive) setDoc(d);
        else closePdf(d);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
      closePdf(opened);
    };
  }, [file]);

  const count = doc?.numPages || 0;
  const { groups, error: rangeError } = useMemo(
    () => computeGroups({ mode, count, selected, action, separate, rangeText, every, mergeRanges }),
    [mode, count, selected, action, separate, rangeText, every, mergeRanges],
  );

  // Badge each page with the output file it ends up in.
  const labels = useMemo(() => {
    if (mode === 'select') return null;
    const l = {};
    groups.forEach((g, n) => g.forEach((i) => (l[i] = groups.length > 1 ? `File ${n + 1}` : '✓')));
    return l;
  }, [groups, mode]);

  const toggle = (i) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const selectWhere = (fn) => setSelected(new Set(Array.from({ length: count }, (_, i) => i).filter(fn)));

  const onRun = () =>
    c.run(async (report) => {
      const src = await loadPdfLib(file);
      const { PDFDocument } = await import('pdf-lib');
      const base = baseName(file.name);
      const outputs = [];
      for (const [n, group] of groups.entries()) {
        report(n / groups.length, `Creating file ${n + 1} of ${groups.length}`);
        await nextFrame();
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, group);
        pages.forEach((p) => out.addPage(p));
        outputs.push({
          name: `${base}_${group.length === 1 ? `page-${group[0] + 1}` : `pages-${describe(group)}`}.pdf`,
          blob: await savePdf(out),
          note: `${group.length} page${group.length === 1 ? '' : 's'}`,
        });
      }
      return outputs;
    });

  const totalPages = groups.reduce((s, g) => s + g.length, 0);

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      multiple={false}
      hideList
      onRun={onRun}
      canRun={!!doc && groups.length > 0}
      runLabel={groups.length > 1 ? `Split into ${groups.length} PDFs` : 'Create PDF'}
      zipName={`${file ? baseName(file.name) : 'split'}-split.zip`}
      emptyHint="Select one PDF · drop or paste"
      listHeader={
        file && (
          <div className="doc-header">
            <div>
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                {formatBytes(file.size)}
                {count ? ` · ${count} pages` : ''}
              </div>
            </div>
            {mode === 'select' && doc && (
              <div className="row wrap">
                <button className="btn btn-sm" onClick={() => selectWhere(() => true)}>All</button>
                <button className="btn btn-sm" onClick={() => selectWhere(() => false)}>None</button>
                <button className="btn btn-sm" onClick={() => selectWhere((i) => i % 2 === 0)}>Odd</button>
                <button className="btn btn-sm" onClick={() => selectWhere((i) => i % 2 === 1)}>Even</button>
                <button className="btn btn-sm" onClick={() => selectWhere((i) => !selected.has(i))}>Invert</button>
              </div>
            )}
          </div>
        )
      }
      options={
        <>
          <Field label="Split mode">
            <Segmented ariaLabel="Split mode" value={mode} onChange={setMode} options={MODES} />
          </Field>
          {mode === 'select' && (
            <>
              <Field label="Selected pages" hint="Click pages on the left to select them.">
                <Segmented
                  ariaLabel="Action"
                  value={action}
                  onChange={setAction}
                  options={[
                    { value: 'extract', label: 'Extract them' },
                    { value: 'delete', label: 'Remove them' },
                  ]}
                />
              </Field>
              {action === 'extract' && (
                <Field>
                  <Toggle checked={separate} onChange={setSeparate}>
                    Save each page as a separate PDF
                  </Toggle>
                </Field>
              )}
            </>
          )}
          {mode === 'ranges' && (
            <>
              <Field label="Page ranges" hint='One output file per range, e.g. "1-3, 4-8, 9-".'>
                <input
                  className="input"
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  placeholder={count ? `e.g. 1-${Math.min(3, count)}, ${Math.min(4, count)}-${count}` : '1-3, 4-8'}
                />
              </Field>
              <Field>
                <Toggle checked={mergeRanges} onChange={setMergeRanges}>
                  Merge all ranges into one PDF
                </Toggle>
              </Field>
            </>
          )}
          {mode === 'every' && (
            <Field label="Pages per file">
              <NumberInput value={every} onChange={(v) => setEvery(v || 1)} min={1} max={count || undefined} suffix="pages" width="9em" />
            </Field>
          )}
          {rangeError ? (
            <p className="error">{rangeError}</p>
          ) : (
            doc && (
              <p className="summary">
                {groups.length
                  ? `${groups.length} PDF${groups.length === 1 ? '' : 's'} · ${totalPages} page${totalPages === 1 ? '' : 's'}`
                  : mode === 'select'
                    ? 'No pages selected yet.'
                    : 'Enter page ranges.'}
              </p>
            )
          )}
        </>
      }
    >
      {loadError && <p className="error">{loadError}</p>}
      {!doc && !loadError && <p className="muted">Loading pages…</p>}
      {doc && (
        <PageGrid
          doc={doc}
          selected={mode === 'select' ? selected : null}
          onToggle={mode === 'select' ? toggle : undefined}
          labels={labels}
        />
      )}
    </ToolShell>
  );
}
