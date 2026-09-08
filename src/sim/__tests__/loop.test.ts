import { describe, expect, it } from "vitest";
import { consumirAcumulado, criarLoop } from "../loop";
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "../tick";

describe("loop", () => {
  it("consome ticks inteiros e guarda o resto", () => {
    expect(consumirAcumulado(250)).toEqual({ ticks: 2, restoMs: 50 });
    expect(consumirAcumulado(99)).toEqual({ ticks: 0, restoMs: 99 });
  });

  it("limita o tempo acumulado a 5 s", () => {
    let agora = 0;
    const frames: Array<(t: number) => void> = [];
    const ticksPorFrame: number[] = [];
    const loop = criarLoop({
      aoTicks: (n) => ticksPorFrame.push(n),
      agora: () => agora,
      requestFrame: (cb) => frames.push(cb),
      cancelFrame: () => void frames.splice(0),
    });
    loop.iniciar();
    const rodarFrame = () => frames.shift()!(agora);

    agora += 16;
    rodarFrame();
    expect(ticksPorFrame).toEqual([]);
    agora += 100;
    rodarFrame();
    expect(ticksPorFrame).toEqual([1]);

    // Aba em segundo plano por um minuto: só 5 s são aplicados.
    agora += 60_000;
    rodarFrame();
    expect(ticksPorFrame).toEqual([1, DT_ACUMULADO_MAX_MS / TICK_MS]);

    loop.parar();
    expect(loop.ativo()).toBe(false);
    expect(frames).toHaveLength(0);
  });
});
