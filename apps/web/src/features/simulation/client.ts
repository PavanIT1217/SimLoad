import type { Design, Fault, FaultKind, ScenarioGoal, TrafficSettings } from '@syssim/engine';
import { useSimStore } from '../../state/simStore';
import { FrameBuffer } from './frameBuffer';
import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * Owns the simulation Web Worker. UI code talks to the engine only through
 * these typed commands; responses are written into the sim store.
 */
class SimulationClient {
  private worker: Worker | null = null;
  private readonly frames = new FrameBuffer();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
      type: 'module',
      name: 'simulation',
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data);
    worker.onerror = (event) => useSimStore.getState().setError(event.message || 'Worker error');
    this.worker = worker;
    return worker;
  }

  private send(message: WorkerRequest): void {
    this.ensure().postMessage(message);
  }

  private receive(message: WorkerResponse): void {
    const store = useSimStore.getState();
    switch (message.type) {
      case 'frame':
        this.frames.push(message.tick, message.points, message.traces, message.goal);
        return;
      case 'status':
        store.setStatus(message.running, message.ready);
        return;
      case 'reset':
        this.frames.clear();
        store.clearResults();
        return;
      case 'error':
        store.setError(message.message);
        return;
    }
  }

  load(design: Design, seed: number): void {
    this.send({ type: 'load', design, seed });
  }
  updateDesign(design: Design): void {
    this.send({ type: 'updateDesign', design });
  }
  setTraffic(traffic: TrafficSettings): void {
    this.send({ type: 'setTraffic', traffic });
  }
  play(): void {
    this.send({ type: 'play' });
  }
  pause(): void {
    this.send({ type: 'pause' });
  }
  step(): void {
    this.send({ type: 'step' });
  }
  reset(): void {
    this.send({ type: 'reset' });
  }
  setSpeed(speed: number): void {
    useSimStore.getState().setSpeed(speed);
    this.send({ type: 'setSpeed', speed });
  }
  injectFault(nodeId: string, fault: Fault, durationMs?: number): void {
    this.send({ type: 'injectFault', nodeId, fault, durationMs });
  }
  clearFault(nodeId: string, kind?: FaultKind): void {
    this.send({ type: 'clearFault', nodeId, kind });
  }
  setGoal(goal: ScenarioGoal | null): void {
    this.send({ type: 'setGoal', goal });
  }
}

export const simulation = new SimulationClient();
