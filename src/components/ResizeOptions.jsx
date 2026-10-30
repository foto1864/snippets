import { Field, NumberInput, Segmented, Slider } from './controls';

export const DEFAULT_RESIZE = { mode: 'none', percent: 50, width: null, height: null };

export default function ResizeOptions({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <Field
      label="Resize"
      hint={
        value.mode === 'fit'
          ? 'Shrinks images to fit inside the box, keeping proportions. Never enlarges.'
          : value.mode === 'exact'
            ? 'Leave one side empty to keep proportions.'
            : null
      }
    >
      <Segmented
        ariaLabel="Resize mode"
        value={value.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'none', label: 'Original' },
          { value: 'percent', label: 'Scale %' },
          { value: 'fit', label: 'Max size' },
          { value: 'exact', label: 'Exact' },
        ]}
      />
      {value.mode === 'percent' && (
        <Slider value={value.percent} onChange={(percent) => set({ percent })} min={5} max={400} step={5} format={(v) => `${v}%`} />
      )}
      {(value.mode === 'fit' || value.mode === 'exact') && (
        <div className="row">
          <NumberInput value={value.width} onChange={(width) => set({ width })} min={1} placeholder="Width" suffix="px" />
          <span className="muted">×</span>
          <NumberInput value={value.height} onChange={(height) => set({ height })} min={1} placeholder="Height" suffix="px" />
        </div>
      )}
    </Field>
  );
}
