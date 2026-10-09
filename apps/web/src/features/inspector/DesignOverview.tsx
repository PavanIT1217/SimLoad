import { validateDesign } from '@simload/engine';
import { useMemo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { Section } from '../../ui/Section';

export function DesignOverview() {
  const design = useDesignStore((s) => s.design);
  const rename = useDesignStore((s) => s.rename);
  const select = useDesignStore((s) => s.select);
  const issues = useMemo(() => validateDesign(design), [design]);

  return (
    <div className="inspector-content">
      <header className="inspector-header">
        <div className="inspector-titles">
          <input
            className="input inspector-name"
            value={design.name}
            aria-label="Design name"
            onChange={(e) => rename(e.target.value)}
          />
          <span className="muted small">
            {design.nodes.length} components · {design.edges.length} connections
          </span>
        </div>
      </header>
      <Section title={`Validation (${issues.length})`}>
        {issues.length === 0 ? (
          <p className="muted small">No issues. Select a node or connection to edit it.</p>
        ) : (
          <ul className="issue-list">
            {issues.map((issue, i) => (
              <li key={i} className={`issue issue-${issue.severity}`}>
                <button
                  type="button"
                  className="issue-button"
                  disabled={!issue.nodeIds?.length}
                  onClick={() => {
                    const id = issue.nodeIds?.[0];
                    if (id) select({ type: 'node', id });
                  }}
                >
                  <strong>{issue.severity === 'error' ? 'Error' : 'Warning'}:</strong>{' '}
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
