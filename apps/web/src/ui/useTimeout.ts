import { useEffect } from 'react';

/** Calls `onDone` once `ms` after `active` becomes true (e.g. to hide a toast). */
export function useTimeout(active: boolean, ms: number, onDone: () => void): void {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [active, ms, onDone]);
}
