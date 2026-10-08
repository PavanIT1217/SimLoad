export interface GaugeProps {
  /** Load factor ρ (0..1+); the ring fills to 100% and turns red beyond. */
  value: number;
  size?: number;
}

const STROKE = 3;

/** Circular utilisation gauge (ρ), drawn with a single SVG arc. */
export function Gauge({ value, size = 34 }: GaugeProps) {
  const r = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(1, value));
  return (
    <svg
      className="gauge"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle className="gauge-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={STROKE} />
      <circle
        className="gauge-value"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={STROKE}
        strokeDasharray={`${circumference * fill} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text className="gauge-text" x="50%" y="52%" dominantBaseline="middle" textAnchor="middle">
        {value >= 10 ? '≫1' : Math.round(value * 100)}
      </text>
    </svg>
  );
}
