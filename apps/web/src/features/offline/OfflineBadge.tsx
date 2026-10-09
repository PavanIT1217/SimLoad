import { useOnline } from './useOnline';
import './offline.css';

/** Shown in the top bar while there is no connection; everything keeps working. */
export function OfflineBadge() {
  const online = useOnline();
  if (online) return null;
  return (
    <span
      className="offline-badge mono"
      role="status"
      title="No internet connection. SimLoad runs entirely in your browser, so everything keeps working."
    >
      <span className="offline-dot" aria-hidden="true" />
      Offline
    </span>
  );
}
