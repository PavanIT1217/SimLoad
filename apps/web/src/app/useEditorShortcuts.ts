import { useEffect } from 'react';
import { useDesignStore } from '../state/designStore';
import { useUiStore } from '../state/uiStore';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
}

/** Ctrl/⌘ + Z / Shift+Z / Y / C / V / D for undo, redo, copy, paste and duplicate. */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
      const store = useDesignStore.getState();
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) store.undo();
      else if ((key === 'z' && e.shiftKey) || key === 'y') store.redo();
      else if (key === 'c') {
        if (!store.copySelection()) return;
        useUiStore.getState().showToast('Component copied — Ctrl+V to paste');
      } else if (key === 'v') {
        if (!store.paste()) return;
      } else if (key === 'd') {
        if (!store.copySelection()) return;
        store.paste();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
