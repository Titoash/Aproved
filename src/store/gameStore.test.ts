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

describe("gameStore — Núcleo", () => {
  beforeEach(() => {
    useGameStore.getState().resetar();
  });

  it("desbloqueia o Núcleo por ₵ 100 e coloca peças pela ferramenta", () => {
    useGameStore.getState().importar(JSON.stringify({ ...useGameStore.getState().state, creditos: 1000 }));
    expect(useGameStore.getState().desbloquearNucleo()).toBe(true);
    expect(useGameStore.getState().state.creditos).toBe(900);
    useGameStore.getState().selecionarFerramenta("turbina");
    expect(useGameStore.getState().agirNaCasa(0)).toBe(false); // anel 2
    expect(useGameStore.getState().avisoGrade?.indice).toBe(0);
    expect(useGameStore.getState().agirNaCasa(6)).toBe(true);
    expect(useGameStore.getState().state.nucleo?.grade[6]).toEqual({ tipo: "peca", id: "turbina" });
    expect(useGameStore.getState().state.creditos).toBe(850);
    useGameStore.getState().selecionarFerramenta("remover");
    expect(useGameStore.getState().agirNaCasa(6)).toBe(true);
    expect(useGameStore.getState().state.nucleo?.grade[6]).toBeNull();
  });

  it("SCRAM manual e modo seguro", () => {
    useGameStore.getState().importar(JSON.stringify({ ...useGameStore.getState().state, creditos: 1000 }));
    expect(useGameStore.getState().scramManual()).toBe(false); // sem Núcleo
    useGameStore.getState().desbloquearNucleo();
    expect(useGameStore.getState().scramManual()).toBe(true);
    expect(useGameStore.getState().scramManual()).toBe(false); // já em SCRAM
    expect(useGameStore.getState().alternarModoSeguro()).toBe(true);
    expect(useGameStore.getState().state.nucleo?.modoSeguro).toBe(true);
  });
});
