import { describe, expect, it } from "vitest";
import { consumeTicks, createLoop } from "../loop";
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "../tick";

describe("loop", () => {
  it("consome ticks inteiros e guarda o resto", () => {
    expect(consumeTicks(250)).toEqual({ ticks: 2, restMs: 50 });
    expect(consumeTicks(99)).toEqual({ ticks: 0, restMs: 99 });
  });

  it("limita o tempo acumulado a 5 s", () => {
    let agora = 0;
    const frames: Array<(t: number) => void> = [];
    const ticksPorFrame: number[] = [];
    const loop = createLoop({
      onTicks: (n) => ticksPorFrame.push(n),
      now: () => agora,
      requestFrame: (cb) => frames.push(cb),
      cancelFrame: () => void frames.splice(0),
    });
    loop.start();
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

    loop.stop();
    expect(loop.isRunning()).toBe(false);
    expect(frames).toHaveLength(0);
  });
});
