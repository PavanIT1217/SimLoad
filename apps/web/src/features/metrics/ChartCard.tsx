import type { ReactNode } from 'react';

export interface ChartCardProps {
  title: string;
  value?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, value, children }: ChartCardProps) {
  return (
    <figure className="chart-card hud">
      <figcaption className="chart-card-header">
        <span>{title}</span>
        {value !== undefined && <span className="chart-card-value mono">{value}</span>}
      </figcaption>
      <div className="chart-card-body">{children}</div>
    </figure>
  );
}
