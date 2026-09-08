import { beforeEach, describe, expect, it } from "vitest";
import { USINAS } from "../content/era1";
import { useGameStore } from "./gameStore";

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.getState().resetar();
  });

  it("comprar cata-vento aumenta a potência e rende créditos ao avançar", () => {
    const store = useGameStore.getState();
    expect(store.comprarUsina("cataVento")).toBe(true);
    const antes = useGameStore.getState().state.creditos;
    useGameStore.getState().avancarTicks(10);
    const depois = useGameStore.getState().state;
    expect(depois.rede.usinas.cataVento.quantidade).toBe(1);
    expect(depois.creditos).toBeGreaterThan(antes);
    expect(depois.tempoMs).toBe(1000);
  });

  it("não compra o que não pode e não muda o estado", () => {
    const antes = useGameStore.getState().state;
    expect(useGameStore.getState().comprarUsina("turbinaEolica")).toBe(false);
    expect(useGameStore.getState().state).toBe(antes);
  });

  it("exportar e importar preservam o estado", () => {
    useGameStore.getState().comprarUsina("cataVento");
    const json = useGameStore.getState().exportar();
    useGameStore.getState().resetar();
    expect(useGameStore.getState().state.rede.usinas.cataVento.quantidade).toBe(0);
    useGameStore.getState().importar(json);
    expect(useGameStore.getState().state.rede.usinas.cataVento.quantidade).toBe(1);
    expect(USINAS.cataVento.potenciaKw).toBeGreaterThan(0);
  });

  it("importar JSON inválido lança erro", () => {
    expect(() => useGameStore.getState().importar("{")).toThrow();
  });
});
