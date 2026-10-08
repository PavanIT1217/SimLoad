import type { ComponentKind } from '@simload/engine';

const PATHS: Record<ComponentKind, string> = {
  client: 'M4 5h16v10H4zM9 19h6M12 15v4',
  cdn: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  loadBalancer: 'M12 4v5M12 9L5 15M12 9l7 6M12 9v6M3 15h4v4H3zM10 15h4v4h-4zM17 15h4v4h-4z',
  service: 'M4 6h16v4H4zM4 14h16v4H4zM7 8h.01M7 16h.01',
  cache: 'M13 3L5 13h6l-1 8 8-10h-6z',
  queue: 'M3 8h4v8H3zM10 8h4v8h-4zM17 8h4v8h-4z',
  database:
    'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  externalApi: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
};

export interface KindIconProps {
  kind: ComponentKind;
  size?: number;
}

export function KindIcon({ kind, size = 18 }: KindIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}
