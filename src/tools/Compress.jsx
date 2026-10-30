import { useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import { Field, Segmented, Toggle } from '../components/controls';
import { LEVELS, compressFile } from '../lib/compress';
import { detectKind } from '../lib/files';

export default function Compress({ tool }) {
  const c = useConverter({ kinds: tool.accepts });
  const [level, setLevel] = useState('recommended');
  const [flatten, setFlatten] = useState(false);

  const hasPdf = c.items.some((i) => detectKind(i.file) === 'pdf');

  const onRun = () =>
    c.run(async (report, signal) => {
      const outputs = [];
      const warnings = [];
      const total = c.items.length;
      for (const [n, { file }] of c.items.entries()) {
        const prefix = total > 1 ? `File ${n + 1} of ${total} · ` : '';
        report(n / total, `${prefix}Compressing ${file.name}…`);
        try {
          outputs.push(
            await compressFile(file, { level, flatten }, (p, label) => report((n + p) / total, prefix + label), signal),
          );
        } catch (e) {
          if (e?.name === 'AbortError' || total === 1) throw e;
          warnings.push(`${file.name}: ${e.message}`);
        }
      }
      return { outputs, warnings };
    });

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      onRun={onRun}
      runLabel="Compress"
      zipName="compressed.zip"
      compareSize
      options={
        <>
          <Field label="Compression" hint={LEVELS[level].hint}>
            <Segmented
              ariaLabel="Compression level"
              value={level}
              onChange={setLevel}
              options={Object.entries(LEVELS).map(([value, l]) => ({ value, label: l.label }))}
            />
          </Field>
          {hasPdf && (
            <Field
              hint={
                flatten
                  ? 'Turns each page into an image. Works on any PDF, but text can no longer be selected or searched.'
                  : 'Shrinks the images inside the PDF. Text stays sharp and selectable.'
              }
            >
              <Toggle checked={flatten} onChange={setFlatten}>
                Maximum PDF compression (flatten pages)
              </Toggle>
            </Field>
          )}
          <p className="field-hint">
            Files that can’t get any smaller are kept as they are. Image metadata (EXIF, GPS location) is removed.
          </p>
        </>
      }
    />
  );
}
