export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
}

export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange(value: T): void;
  label: string;
}

/** Instrument-style tab strip with arrow-key navigation. */
export function Tabs<T extends string>({ items, value, onChange, label }: TabsProps<T>) {
  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = items.findIndex((t) => t.id === value);
        const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
        if (next) onChange(next.id);
      }}
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          className={`tab ${t.id === value ? 'is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.badge !== undefined && t.badge !== 0 && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
