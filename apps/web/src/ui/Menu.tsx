import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

export interface MenuProps {
  /** Trigger button content. */
  label: ReactNode;
  /** Accessible name when the label is only a glyph. */
  ariaLabel?: string;
  title?: string;
  align?: 'start' | 'end';
  /** Rendered with a `close` callback so items can dismiss the menu after acting. */
  children: (close: () => void) => ReactNode;
}

/**
 * A button that opens a small popover of secondary actions or settings.
 * Closes on outside click, Escape, or when an item calls `close`.
 */
export function Menu({ label, ariaLabel, title, align = 'start', children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={root}>
      <Button
        size="sm"
        variant="ghost"
        active={open}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={id}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      {open && (
        <div id={id} className={`menu-popover menu-${align}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export interface MenuItemProps {
  onClick(): void;
  children: ReactNode;
  hint?: string;
}

export function MenuItem({ onClick, children, hint }: MenuItemProps) {
  return (
    <button type="button" className="menu-item" onClick={onClick}>
      <span>{children}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </button>
  );
}
