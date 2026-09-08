/**
 * Loop de jogo: requestAnimationFrame + acumulador em timestep fixo.
 * O tempo acumulado é limitado a `DT_ACUMULADO_MAX_MS` para que uma aba
 * em segundo plano não dispare milhares de ticks ao voltar.
 */
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "./tick";

export interface OpcoesLoop {
  /** Chamado uma vez por frame com o número de ticks a aplicar (≥ 1). */
  aoTicks: (ticks: number) => void;
  agora?: () => number;
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (id: number) => void;
  tickMs?: number;
  acumuladoMaxMs?: number;
}

export interface Loop {
  iniciar: () => void;
  parar: () => void;
  ativo: () => boolean;
}

/** Calcula quantos ticks cabem no acumulado e devolve o resto. Função pura. */
export function consumirAcumulado(
  acumuladoMs: number,
  tickMs: number = TICK_MS,
): { ticks: number; restoMs: number } {
  const ticks = Math.floor(acumuladoMs / tickMs);
  return { ticks, restoMs: acumuladoMs - ticks * tickMs };
}

export function criarLoop(opcoes: OpcoesLoop): Loop {
  const agora = opcoes.agora ?? (() => performance.now());
  const requestFrame = opcoes.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = opcoes.cancelFrame ?? ((id) => cancelAnimationFrame(id));
  const tickMs = opcoes.tickMs ?? TICK_MS;
  const acumuladoMaxMs = opcoes.acumuladoMaxMs ?? DT_ACUMULADO_MAX_MS;

  let idFrame: number | null = null;
  let ultimoMs = 0;
  let acumuladoMs = 0;

  const frame = () => {
    const t = agora();
    acumuladoMs = Math.min(acumuladoMs + Math.max(0, t - ultimoMs), acumuladoMaxMs);
    ultimoMs = t;
    const { ticks, restoMs } = consumirAcumulado(acumuladoMs, tickMs);
    acumuladoMs = restoMs;
    if (ticks > 0) opcoes.aoTicks(ticks);
    if (idFrame !== null) idFrame = requestFrame(frame);
  };

  return {
    iniciar() {
      if (idFrame !== null) return;
      ultimoMs = agora();
      acumuladoMs = 0;
      idFrame = requestFrame(frame);
    },
    parar() {
      if (idFrame === null) return;
      cancelFrame(idFrame);
      idFrame = null;
    },
    ativo: () => idFrame !== null,
  };
}
