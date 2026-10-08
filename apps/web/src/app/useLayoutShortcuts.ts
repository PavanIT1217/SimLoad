import { useEffect } from 'react';
import { useLayoutStore } from '../state/layoutStore';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
}

/** [ and ] toggle the side panels, \ toggles the charts, F toggles focus mode. */
export function useLayoutShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const layout = useLayoutStore.getState();
      if (e.key === '[') layout.toggle('palette');
      else if (e.key === ']') layout.toggle('inspector');
      else if (e.key === '\\') layout.toggle('metrics');
      else if (e.key === 'f' || e.key === 'F') layout.toggleFocus();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
