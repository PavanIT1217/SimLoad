import type { ReactNode } from 'react';

export interface SectionProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, actions, children }: SectionProps) {
  return (
    <section className="section hud">
      <header className="section-header">
        <h3>{title}</h3>
        {actions}
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

export interface StatProps {
  label: string;
  value: ReactNode;
  tone?: 'ok' | 'warn' | 'bad' | 'muted';
}

export function Stat({ label, value, tone }: StatProps) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value mono">{value}</span>
    </div>
  );
}
