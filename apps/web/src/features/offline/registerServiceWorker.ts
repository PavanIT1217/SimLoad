import { useUiStore } from '../../state/uiStore';
import { readStorage, writeStorage } from '../persistence/storage';

const READY_KEY = 'simload:offline-ready';

/**
 * Installs the service worker that caches the app for offline use. The first
 * install announces that SimLoad now works offline; a later update (a new
 * deploy picked up in the background) suggests a reload.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  const hadController = sw.controller !== null;

  sw.addEventListener('controllerchange', () => {
    const ui = useUiStore.getState();
    if (hadController) ui.showToast('SimLoad was updated. Reload to use the new version.');
    else if (readStorage(READY_KEY) !== '1') {
      writeStorage(READY_KEY, '1');
      ui.showToast('Ready offline: SimLoad now opens without an internet connection.');
    }
  });

  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    sw.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Offline support is an enhancement; the app works the same without it.
    });
  });
}
