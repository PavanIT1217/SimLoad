import type { KeyboardEvent, PointerEvent } from 'react';
import { useRef } from 'react';

export interface SplitterProps {
  /** 'x' resizes a column (vertical bar), 'y' resizes a row (horizontal bar). */
  axis: 'x' | 'y';
  label: string;
  /** CSS custom property on `.app` that holds the panel size in px. */
  cssVar: string;
  size: number;
  min: number;
  max: number;
  /** True when dragging towards negative x/y grows the panel (inspector, metrics). */
  invert?: boolean;
  collapsed: boolean;
  onCommit(size: number): void;
  onToggle(): void;
}

const KEY_STEP = 24;

/**
 * Drag handle between panels. While dragging it writes the CSS variable
 * directly (no React render per pointer move) and commits on release.
 */
export function Splitter(props: SplitterProps) {
  const {
    axis,
    label,
    cssVar,
    size,
    min,
    max,
    invert = false,
    collapsed,
    onCommit,
    onToggle,
  } = props;
  const drag = useRef<{ start: number; size: number; latest: number } | null>(null);

  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)));
  const root = (el: Element) => el.closest<HTMLElement>('.app');

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = axis === 'x' ? e.clientX : e.clientY;
    const from = collapsed ? min : size;
    drag.current = { start, size: from, latest: from };
    root(e.currentTarget)?.classList.add('is-resizing', `is-resizing-${axis}`);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = (axis === 'x' ? e.clientX : e.clientY) - d.start;
    d.latest = clamp(d.size + (invert ? -delta : delta));
    root(e.currentTarget)?.style.setProperty(cssVar, `${d.latest}px`);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    root(e.currentTarget)?.classList.remove('is-resizing', `is-resizing-${axis}`);
    if (d && d.latest !== d.size) onCommit(d.latest);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const grow =
      axis === 'x' ? (invert ? 'ArrowLeft' : 'ArrowRight') : invert ? 'ArrowUp' : 'ArrowDown';
    const shrink =
      axis === 'x' ? (invert ? 'ArrowRight' : 'ArrowLeft') : invert ? 'ArrowDown' : 'ArrowUp';
    if (e.key === grow) onCommit(clamp(size + KEY_STEP));
    else if (e.key === shrink) onCommit(clamp(size - KEY_STEP));
    else if (e.key === 'Enter' || e.key === ' ') onToggle();
    else return;
    e.preventDefault();
  };

  // Chevrons point the way the panel edge will move when toggled.
  const hideGlyph = invert ? (axis === 'x' ? '›' : '⌄') : axis === 'x' ? '‹' : '⌃';
  const showGlyph = invert ? (axis === 'x' ? '‹' : '⌃') : axis === 'x' ? '›' : '⌄';

  return (
    <div
      className={`splitter splitter-${axis} ${collapsed ? 'is-collapsed' : ''}`}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={`Resize ${label}`}
      aria-valuenow={collapsed ? 0 : size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="splitter-toggle"
        onClick={onToggle}
        tabIndex={-1}
        title={`${collapsed ? 'Show' : 'Hide'} ${label}`}
        aria-label={`${collapsed ? 'Show' : 'Hide'} ${label}`}
      >
        {collapsed ? showGlyph : hideGlyph}
      </button>
    </div>
  );
}
