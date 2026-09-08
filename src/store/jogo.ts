/** Liga o loop de simulação ao store e cuida do save ao sair/ocultar a aba. */
import { criarLoop } from "../sim/loop";
import { useGameStore } from "./gameStore";

/** Inicia o jogo e devolve a função que o para (para o cleanup do React). */
export function iniciarJogo(): () => void {
  const loop = criarLoop({
    aoTicks: (n) => useGameStore.getState().avancarTicks(n),
  });

  const salvarSeOculto = () => {
    if (document.visibilityState === "hidden") useGameStore.getState().salvarAgora();
  };
  const salvarAoSair = () => {
    useGameStore.getState().salvarAgora();
  };

  document.addEventListener("visibilitychange", salvarSeOculto);
  window.addEventListener("beforeunload", salvarAoSair);
  loop.iniciar();

  return () => {
    loop.parar();
    document.removeEventListener("visibilitychange", salvarSeOculto);
    window.removeEventListener("beforeunload", salvarAoSair);
  };
}
