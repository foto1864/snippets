import { useEffect, useMemo, useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Select, Slider, Toggle } from '../components/controls';
import { formatBytes, nextFrame, withExt } from '../lib/files';

let xlsxModule;
const loadXlsx = () => (xlsxModule ??= import('xlsx'));

const fontCache = {};
async function loadFont(name) {
  if (!fontCache[name]) {
    fontCache[name] = fetch(`/fonts/${name}`)
      .then((r) => {
        if (!r.ok) throw new Error('Font could not be loaded.');
        return r.arrayBuffer();
      })
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      });
  }
  return fontCache[name];
}

async function readWorkbook(file) {
  const XLSX = await loadXlsx();
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: 'string', cellDates: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  return { XLSX, wb };
}

/**
 * Turns a worksheet into a grid of autotable cells (with merges), trimmed to
 * the used area and skipping hidden rows/columns.
 */
function sheetToGrid(XLSX, ws, { skipHidden = true } = {}) {
  if (!ws?.['!ref']) return null;
  const range = XLSX.utils.decode_range(ws['!ref']);
  let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
  const text = (r, c) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.t === 'z') return '';
    return cell.w ?? XLSX.utils.format_cell(cell) ?? '';
  };
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (String(text(r, c)).trim() !== '') {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR < 0) return null;

  const hiddenRow = (r) => skipHidden && ws['!rows']?.[r]?.hidden;
  const hiddenCol = (c) => skipHidden && ws['!cols']?.[c]?.hidden;
  const rows = [];
  const cols = [];
  for (let r = minR; r <= maxR; r++) if (!hiddenRow(r)) rows.push(r);
  for (let c = minC; c <= maxC; c++) if (!hiddenCol(c)) cols.push(c);

  const covered = new Set();
  const spans = new Map();
  for (const m of ws['!merges'] || []) {
    const colSpan = cols.filter((c) => c >= m.s.c && c <= m.e.c).length;
    const rowSpan = rows.filter((r) => r >= m.s.r && r <= m.e.r).length;
    if (colSpan * rowSpan <= 1) continue;
    spans.set(`${m.s.r},${m.s.c}`, { colSpan, rowSpan });
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) covered.add(`${r},${c}`);
  }

  const grid = rows.map((r) =>
    cols
      .filter((c) => !covered.has(`${r},${c}`))
      .map((c) => {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        const out = { content: String(text(r, c)) };
        const span = spans.get(`${r},${c}`);
        if (span) Object.assign(out, span);
        if (cell && (cell.t === 'n' || cell.t === 'd')) out.styles = { halign: 'right' };
        return out;
      }),
  );
  return { grid, rowCount: rows.length, colCount: cols.length };
}

export default function XlsxToPdf({ tool }) {
  const c = useConverter({ kinds: tool.accepts, multiple: false });
  const file = c.items[0]?.file;
  const [book, setBook] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [previewSheet, setPreviewSheet] = useState(null);

  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('auto');
  const [fit, setFit] = useState('wrap');
  const [fontSize, setFontSize] = useState(9);
  const [gridlines, setGridlines] = useState(true);
  const [headerRow, setHeaderRow] = useState(true);
  const [titles, setTitles] = useState(true);

  useEffect(() => {
    setBook(null);
    setLoadError(null);
    if (!file) return;
    let alive = true;
    readWorkbook(file)
      .then(({ XLSX, wb }) => {
        if (!alive) return;
        const sheets = wb.SheetNames.map((name) => ({ name, ...(sheetToGrid(XLSX, wb.Sheets[name]) || { grid: null }) }));
        setBook({ sheets });
        const nonEmpty = sheets.filter((s) => s.grid).map((s) => s.name);
        setSelected(nonEmpty);
        setPreviewSheet(nonEmpty[0] || null);
      })
      .catch((e) => {
        console.error(e);
        if (alive) setLoadError('This spreadsheet could not be read.');
      });
    return () => {
      alive = false;
    };
  }, [file]);

  const preview = useMemo(() => book?.sheets.find((s) => s.name === previewSheet), [book, previewSheet]);

  const onRun = () =>
    c.run(async (report) => {
      report(0.05, 'Loading PDF engine and fonts…');
      const [{ jsPDF }, { autoTable }, regular, bold] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        loadFont('NotoSans-Regular.ttf'),
        loadFont('NotoSans-Bold.ttf'),
      ]);
      const sheets = book.sheets.filter((s) => s.grid && selected.includes(s.name));
      let pdf = null;
      for (const [n, sheet] of sheets.entries()) {
        report(0.1 + (0.85 * n) / sheets.length, `Laying out "${sheet.name}"…`);
        await nextFrame();
        const landscape = orientation === 'landscape' || (orientation === 'auto' && sheet.colCount > 7);
        const opts = { unit: 'pt', format: pageSize, orientation: landscape ? 'landscape' : 'portrait', compress: true };
        if (!pdf) {
          pdf = new jsPDF(opts);
          pdf.addFileToVFS('NotoSans-Regular.ttf', regular);
          pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
          pdf.addFileToVFS('NotoSans-Bold.ttf', bold);
          pdf.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
          pdf.setProperties({ title: file.name, creator: 'Snippets File Converter' });
        } else {
          pdf.addPage(pageSize, landscape ? 'landscape' : 'portrait');
        }
        const margin = 28;
        let startY = margin;
        if (titles && sheets.length > 0) {
          pdf.setFont('NotoSans', 'bold');
          pdf.setFontSize(fontSize + 4);
          pdf.text(sheet.name, margin, margin + fontSize);
          startY = margin + fontSize + 12;
        }
        const [head, ...rest] = sheet.grid;
        autoTable(pdf, {
          head: headerRow ? [head] : undefined,
          body: headerRow ? rest : sheet.grid,
          startY,
          margin: { top: margin, right: margin, bottom: margin, left: margin },
          theme: gridlines ? 'grid' : 'plain',
          tableWidth: fit === 'wrap' ? 'auto' : 'wrap',
          horizontalPageBreak: fit === 'split',
          horizontalPageBreakRepeat: fit === 'split' ? 0 : undefined,
          showHead: 'everyPage',
          styles: {
            font: 'NotoSans',
            fontSize,
            cellPadding: Math.max(2, fontSize * 0.35),
            overflow: 'linebreak',
            lineColor: [200, 204, 210],
            lineWidth: gridlines ? 0.5 : 0,
            textColor: [20, 20, 20],
            valign: 'middle',
          },
          headStyles: { font: 'NotoSans', fontStyle: 'bold', fillColor: [238, 240, 244], textColor: [20, 20, 20] },
          alternateRowStyles: gridlines ? undefined : { fillColor: [248, 249, 251] },
          didDrawPage: () => {
            const total = pdf.getNumberOfPages();
            pdf.setFont('NotoSans', 'normal');
            pdf.setFontSize(7);
            pdf.setTextColor(140);
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();
            pdf.text(`${sheet.name} · ${total}`, w - margin, h - 12, { align: 'right' });
            pdf.setTextColor(20);
          },
        });
      }
      report(0.97, 'Saving PDF…');
      const blob = pdf.output('blob');
      return [{ name: withExt(file.name, 'pdf'), blob, note: `${pdf.getNumberOfPages()} pages` }];
    });

  const toggleSheet = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      multiple={false}
      hideList
      onRun={onRun}
      canRun={!!book && selected.length > 0}
      runLabel="Convert to PDF"
      emptyHint="Select a spreadsheet (.xlsx, .xls, .ods, .csv) · drop or paste"
      listHeader={
        file && (
          <div className="doc-header">
            <div>
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                {formatBytes(file.size)}
                {book ? ` · ${book.sheets.length} sheet${book.sheets.length === 1 ? '' : 's'}` : ''}
              </div>
            </div>
          </div>
        )
      }
      options={
        book && (
          <>
            {book.sheets.length > 1 && (
              <Field label="Sheets to include">
                <div className="checklist">
                  {book.sheets.map((s) => (
                    <Toggle key={s.name} checked={selected.includes(s.name)} onChange={() => toggleSheet(s.name)}>
                      {s.name}{' '}
                      <span className="muted small">{s.grid ? `${s.rowCount}×${s.colCount}` : 'empty'}</span>
                    </Toggle>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Page">
              <div className="row">
                <Select
                  value={pageSize}
                  onChange={setPageSize}
                  options={[
                    { value: 'a4', label: 'A4' },
                    { value: 'a3', label: 'A3' },
                    { value: 'letter', label: 'US Letter' },
                    { value: 'legal', label: 'US Legal' },
                  ]}
                />
                <Select
                  value={orientation}
                  onChange={setOrientation}
                  options={[
                    { value: 'auto', label: 'Auto orientation' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' },
                  ]}
                />
              </div>
            </Field>
            <Field
              label="Wide tables"
              hint={fit === 'wrap' ? 'All columns fit the page width; long text wraps.' : 'Columns that do not fit continue on the next page.'}
            >
              <Segmented
                ariaLabel="Wide tables"
                value={fit}
                onChange={setFit}
                options={[
                  { value: 'wrap', label: 'Fit to width' },
                  { value: 'split', label: 'Split across pages' },
                ]}
              />
            </Field>
            <Field label="Text size">
              <Slider value={fontSize} onChange={setFontSize} min={5} max={14} format={(v) => `${v} pt`} />
            </Field>
            <Field>
              <div className="checklist">
                <Toggle checked={headerRow} onChange={setHeaderRow}>First row is a header (repeat on each page)</Toggle>
                <Toggle checked={gridlines} onChange={setGridlines}>Gridlines</Toggle>
                <Toggle checked={titles} onChange={setTitles}>Sheet name above each table</Toggle>
              </div>
            </Field>
          </>
        )
      }
    >
      {loadError && <p className="error">{loadError}</p>}
      {!book && !loadError && <p className="muted">Reading spreadsheet…</p>}
      {book && (
        <div className="sheet-preview">
          {book.sheets.length > 1 && (
            <div className="tabs">
              {book.sheets.map((s) => (
                <button
                  key={s.name}
                  className={`tab${s.name === previewSheet ? ' is-active' : ''}`}
                  onClick={() => setPreviewSheet(s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {preview?.grid ? (
            <div className="table-scroll">
              <table>
                <tbody>
                  {preview.grid.slice(0, 40).map((row, r) => (
                    <tr key={r} className={r === 0 && headerRow ? 'is-head' : ''}>
                      {row.map((cell, i) => (
                        <td key={i} colSpan={cell.colSpan} rowSpan={cell.rowSpan} style={{ textAlign: cell.styles?.halign }}>
                          {cell.content}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rowCount > 40 && <p className="muted small">Showing 40 of {preview.rowCount} rows.</p>}
            </div>
          ) : (
            <p className="muted">This sheet is empty.</p>
          )}
        </div>
      )}
    </ToolShell>
  );
}
