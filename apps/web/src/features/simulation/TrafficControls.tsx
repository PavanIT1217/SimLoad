import { PROFILE_LABELS, TRAFFIC_PROFILES, rpsToSlider, sliderToRps } from '@simload/engine';
import type { TrafficProfile } from '@simload/engine';
import { useDesignStore } from '../../state/designStore';
import { formatRps } from '../../ui/format';
import { Menu } from '../../ui/Menu';

const SLIDER_STEPS = 1000;

export function TrafficControls() {
  const traffic = useDesignStore((s) => s.design.traffic);
  const setTraffic = useDesignStore((s) => s.setTraffic);
  return (
    <div className="topbar-group traffic-controls" role="group" aria-label="Traffic">
      <label className="topbar-field traffic-slider">
        <span className="topbar-label">
          Peak load <strong className="mono">{formatRps(traffic.peakRps)}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={SLIDER_STEPS}
          value={Math.round(rpsToSlider(traffic.peakRps) * SLIDER_STEPS)}
          onChange={(e) =>
            setTraffic({ peakRps: sliderToRps(Number(e.target.value) / SLIDER_STEPS) })
          }
          aria-valuetext={formatRps(traffic.peakRps)}
        />
      </label>
      <Menu
        label={`${PROFILE_LABELS[traffic.profile]} · ${Math.round(traffic.readRatio * 100)}% reads ▾`}
        title="Traffic profile and read/write mix"
      >
        {() => (
          <div className="menu-form">
            <label className="menu-field">
              <span>Profile</span>
              <select
                className="input"
                value={traffic.profile}
                onChange={(e) => setTraffic({ profile: e.target.value as TrafficProfile })}
              >
                {TRAFFIC_PROFILES.map((p) => (
                  <option key={p} value={p}>
                    {PROFILE_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="menu-field">
              <span>
                Reads <strong className="mono">{Math.round(traffic.readRatio * 100)}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(traffic.readRatio * 100)}
                onChange={(e) => setTraffic({ readRatio: Number(e.target.value) / 100 })}
              />
            </label>
          </div>
        )}
      </Menu>
    </div>
  );
}
