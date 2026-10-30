import { useState } from 'react';
import ToolShell, { useConverter } from '../components/ToolShell';
import ResizeOptions, { DEFAULT_RESIZE } from '../components/ResizeOptions';
import { ColorInput, Field, Segmented, Slider, Toggle } from '../components/controls';
import { detectKind, nextFrame, withExt } from '../lib/files';
import { FORMATS, convertImage } from '../lib/image';

export default function ImageConvert({ tool }) {
  const c = useConverter({ kinds: tool.accepts });
  const [format, setFormat] = useState(FORMATS[tool.to] ? tool.to : 'png');
  const [quality, setQuality] = useState(tool.to === 'webp' ? 85 : 92);
  const [fill, setFill] = useState(false);
  const [background, setBackground] = useState('#ffffff');
  const [resize, setResize] = useState(DEFAULT_RESIZE);
  const [scale, setScale] = useState(2);

  const fmt = FORMATS[format];
  const hasVector = c.items.some((i) => detectKind(i.file) === 'svg');

  const onRun = () =>
    c.run(async (report) => {
      const outputs = [];
      const warnings = [];
      for (const [n, { file }] of c.items.entries()) {
        report(n / c.items.length, `Converting ${n + 1} of ${c.items.length}: ${file.name}`);
        await nextFrame();
        try {
          const { blob, width, height } = await convertImage(file, {
            format,
            quality: quality / 100,
            background: fmt.alpha ? (fill ? background : null) : background,
            resize,
            scale,
          });
          outputs.push({ name: withExt(file.name, fmt.ext), blob, note: `${width}×${height}` });
        } catch (e) {
          if (c.items.length === 1) throw e;
          warnings.push(`${file.name}: ${e.message}`);
        }
      }
      report(1, 'Done');
      return { outputs, warnings };
    });

  return (
    <ToolShell
      converter={c}
      kinds={tool.accepts}
      onRun={onRun}
      runLabel={`Convert to ${fmt.label}`}
      zipName={`${format}-images.zip`}
      compareSize
      options={
        <>
          <Field label="Convert to">
            <Segmented
              ariaLabel="Output format"
              value={format}
              onChange={setFormat}
              options={Object.entries(FORMATS).map(([value, f]) => ({ value, label: f.label }))}
            />
          </Field>
          {fmt.lossy && (
            <Field label="Quality" hint="Lower quality gives smaller files.">
              <Slider value={quality} onChange={setQuality} min={10} max={100} format={(v) => `${v}%`} />
            </Field>
          )}
          {fmt.alpha ? (
            <Field>
              <Toggle checked={fill} onChange={setFill}>
                Fill transparent areas
              </Toggle>
              {fill && <ColorInput value={background} onChange={setBackground} />}
            </Field>
          ) : (
            <Field label="Background" hint="JPG has no transparency; transparent pixels get this colour.">
              <ColorInput value={background} onChange={setBackground} />
            </Field>
          )}
          {hasVector && (
            <Field label="SVG render size" hint="Multiplier of the SVG's own dimensions.">
              <Segmented
                ariaLabel="SVG scale"
                value={scale}
                onChange={setScale}
                options={[1, 2, 3, 4, 8].map((v) => ({ value: v, label: `${v}×` }))}
              />
            </Field>
          )}
          <ResizeOptions value={resize} onChange={setResize} />
        </>
      }
    />
  );
}
