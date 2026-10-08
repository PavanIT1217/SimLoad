import type { ReactNode } from 'react';
import { useState } from 'react';

export interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field" title={hint}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export interface NumberInputProps {
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  /** Displayed value = stored value * scale (e.g. 100 for percentages). */
  scale?: number;
  ariaLabel?: string;
}

/** Number input that only commits valid, in-range values (on blur or Enter). */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  scale = 1,
  ariaLabel,
}: NumberInputProps) {
  const display = String(Number((value * scale).toPrecision(10)));
  const [draft, setDraft] = useState(display);
  const [prevDisplay, setPrevDisplay] = useState(display);
  if (display !== prevDisplay) {
    setPrevDisplay(display);
    setDraft(display);
  }
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(display);
      return;
    }
    let next = parsed / scale;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (next !== value) onChange(next);
    setDraft(String(Number((next * scale).toPrecision(10))));
  };
  return (
    <input
      className="input mono"
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      step={step}
      min={min !== undefined ? min * scale : undefined}
      max={max !== undefined ? max * scale : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}
