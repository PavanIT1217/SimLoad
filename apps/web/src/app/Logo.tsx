export interface LogoProps {
  active: boolean;
}

/** Orbit-style mark: a core node with three satellites; spins while the simulation runs. */
export function Logo({ active }: LogoProps) {
  return (
    <svg
      className={`logo ${active ? 'is-active' : ''}`}
      width="28"
      height="28"
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" className="logo-orbit" />
      <circle cx="16" cy="16" r="7.5" className="logo-orbit" />
      <g className="logo-spin">
        <circle cx="16" cy="3" r="2.2" className="logo-sat" />
        <circle cx="27.3" cy="22.5" r="2.2" className="logo-sat" />
        <circle cx="4.7" cy="22.5" r="2.2" className="logo-sat" />
      </g>
      <circle cx="16" cy="16" r="3.2" className="logo-core" />
    </svg>
  );
}
