/** Hook que liga o loop de simulação ao store e salva ao ocultar a aba ou sair. */
import { useEffect } from "react";
import { createLoop } from "../sim/loop";
import { useGameStore } from "./gameStore";

export function useTick(): void {
  useEffect(() => {
    // O relógio e o agendador do navegador entram aqui, não no sim (ajuste 8 da Sessão 8).
    const loop = createLoop({
      onTicks: (n) => useGameStore.getState().avancarTicks(n),
      now: () => performance.now(),
      requestFrame: (cb) => requestAnimationFrame(cb),
      cancelFrame: (id) => cancelAnimationFrame(id),
    });

    const salvarSeOculto = () => {
      if (document.visibilityState === "hidden") useGameStore.getState().salvarAgora();
    };
    const salvarAoSair = () => {
      useGameStore.getState().salvarAgora();
    };

    document.addEventListener("visibilitychange", salvarSeOculto);
    window.addEventListener("beforeunload", salvarAoSair);
    loop.start();

    return () => {
      loop.stop();
      document.removeEventListener("visibilitychange", salvarSeOculto);
      window.removeEventListener("beforeunload", salvarAoSair);
    };
  }, []);
}
