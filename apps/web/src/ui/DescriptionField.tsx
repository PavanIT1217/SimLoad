import { useId } from 'react';

export interface DescriptionFieldProps {
  value: string | undefined;
  onChange(value: string | undefined): void;
  placeholder: string;
  maxLength?: number;
}

/** Multi-line free text for a component's or connection's purpose. */
export function DescriptionField({
  value,
  onChange,
  placeholder,
  maxLength = 1_000,
}: DescriptionFieldProps) {
  const id = useId();
  const text = value ?? '';
  return (
    <div className="field description-field">
      <label className="field-label" htmlFor={id}>
        Description
      </label>
      <textarea
        id={id}
        className="input description-input"
        rows={3}
        value={text}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      />
      <span className="description-count mono">
        {text.length}/{maxLength} · shown when hovering on the canvas
      </span>
    </div>
  );
}
