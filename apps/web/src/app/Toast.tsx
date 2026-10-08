import { useUiStore } from '../state/uiStore';
import { useTimeout } from '../ui/useTimeout';

const TOAST_MS = 4_000;

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const clearToast = useUiStore((s) => s.clearToast);
  useTimeout(toast !== null, TOAST_MS, clearToast);
  if (!toast) return null;
  return (
    <div className="toast" role="status" onClick={clearToast}>
      {toast}
    </div>
  );
}
