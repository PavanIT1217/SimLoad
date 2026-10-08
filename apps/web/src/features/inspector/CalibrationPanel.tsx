import { fitFromPercentiles } from '@syssim/engine';
import type { DesignNode, LatencyFit } from '@syssim/engine';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Field';
import { formatMs } from '../../ui/format';
import { Section } from '../../ui/Section';
import { FORMAT_LABELS, importLoadTest } from './loadTestImport';

export interface CalibrationPanelProps {
  node: DesignNode;
}

/** Validation mode: calibrate a node from real measurements. */
export function CalibrationPanel({ node }: CalibrationPanelProps) {
  const updateNodeConfig = useDesignStore((s) => s.updateNodeConfig);
  const [p50, setP50] = useState(node.config.baseLatencyMs || 10);
  const [p99, setP99] = useState((node.config.baseLatencyMs || 10) * 3);
  const [capacity, setCapacity] = useState(node.config.capacityRps);
  const [fit, setFit] = useState<LatencyFit | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyFit = (f: LatencyFit) => {
    updateNodeConfig(node.id, {
      baseLatencyMs: Number(f.medianMs.toFixed(3)),
      latencySigma: Number(f.sigma.toFixed(3)),
    });
  };

  const applyPercentiles = () => {
    try {
      const f = fitFromPercentiles(p50, p99);
      applyFit(f);
      setMessage(`Applied median ${formatMs(f.medianMs)}, σ ${f.sigma.toFixed(2)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const onCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = importLoadTest(await file.text());
      setFit(imported.fit);
      setMessage(
        `${FORMAT_LABELS[imported.format]}: ` +
          (imported.samples.length > 0
            ? `fitted ${imported.samples.length.toLocaleString()} samples from ${file.name}`
            : `fitted from reported percentiles in ${file.name}`),
      );
    } catch (error) {
      setFit(null);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Section title="Calibrate from measurements">
      <p className="muted small">
        Enter what you measured in production, or import load-test results: CSV, JMeter JTL, k6
        (summary or JSON output) or Gatling simulation.log.
      </p>
      <div className="field-grid">
        <Field label="Measured p50 (ms)">
          <NumberInput value={p50} min={0.001} step={0.5} onChange={setP50} />
        </Field>
        <Field label="Measured p99 (ms)">
          <NumberInput value={p99} min={0.001} step={0.5} onChange={setP99} />
        </Field>
      </div>
      <Button onClick={applyPercentiles}>Apply latency</Button>
      {node.kind !== 'client' && node.kind !== 'queue' && (
        <div className="field-grid">
          <Field label="Measured max req/s per instance">
            <NumberInput value={capacity} min={1} onChange={setCapacity} />
          </Field>
          <Button
            onClick={() => {
              updateNodeConfig(node.id, { capacityRps: capacity });
              setMessage(`Capacity set to ${capacity.toLocaleString()} req/s per instance`);
            }}
          >
            Apply capacity
          </Button>
        </div>
      )}
      <label className="btn btn-default btn-md file-button">
        Import load-test results
        <input type="file" accept=".csv,.jtl,.json,.log,.txt" onChange={onCsv} hidden />
      </label>
      {fit && (
        <div className="fit-result mono">
          <span>n = {fit.count.toLocaleString()}</span>
          <span>p50 {formatMs(fit.p50)}</span>
          <span>p99 {formatMs(fit.p99)}</span>
          <span>median {formatMs(fit.medianMs)}</span>
          <span>σ {fit.sigma.toFixed(3)}</span>
          <Button size="sm" variant="primary" onClick={() => applyFit(fit)}>
            Apply fit
          </Button>
        </div>
      )}
      {message && <p className="muted small">{message}</p>}
    </Section>
  );
}
