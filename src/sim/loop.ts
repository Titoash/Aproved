/**
 * Loop de jogo: requestAnimationFrame + acumulador em timestep fixo.
 * O tempo acumulado é limitado a `DT_ACUMULADO_MAX_MS` para que uma aba
 * em segundo plano não dispare milhares de ticks ao voltar.
 */
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "./tick";

export interface LoopOptions {
  /** Chamado uma vez por frame com o número de ticks a aplicar (≥ 1). */
  onTicks: (ticks: number) => void;
  now?: () => number;
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (id: number) => void;
  tickMs?: number;
  maxAccumulatedMs?: number;
}

export interface Loop {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

/** Calcula quantos ticks cabem no acumulado e devolve o resto. Função pura. */
export function consumeTicks(
  accumulatedMs: number,
  tickMs: number = TICK_MS,
): { ticks: number; restMs: number } {
  const ticks = Math.floor(accumulatedMs / tickMs);
  return { ticks, restMs: accumulatedMs - ticks * tickMs };
}

export function createLoop(options: LoopOptions): Loop {
  const now = options.now ?? (() => performance.now());
  const requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
  const tickMs = options.tickMs ?? TICK_MS;
  const maxAccumulatedMs = options.maxAccumulatedMs ?? DT_ACUMULADO_MAX_MS;

  let frameId: number | null = null;
  let lastMs = 0;
  let accumulatedMs = 0;

  const frame = () => {
    const t = now();
    accumulatedMs = Math.min(accumulatedMs + Math.max(0, t - lastMs), maxAccumulatedMs);
    lastMs = t;
    const { ticks, restMs } = consumeTicks(accumulatedMs, tickMs);
    accumulatedMs = restMs;
    if (ticks > 0) options.onTicks(ticks);
    if (frameId !== null) frameId = requestFrame(frame);
  };

  return {
    start() {
      if (frameId !== null) return;
      lastMs = now();
      accumulatedMs = 0;
      frameId = requestFrame(frame);
    },
    stop() {
      if (frameId === null) return;
      cancelFrame(frameId);
      frameId = null;
    },
    isRunning: () => frameId !== null,
  };
}
