import { beforeEach, describe, expect, it } from "vitest";
import { USINAS } from "../content/era1";
import { useGameStore } from "./gameStore";

/** Jogo novo abre o card de abertura e pausa; os testes de jogo o fecham antes. */
function fecharCards() {
  for (let i = 0; i < 10 && useGameStore.getState().cardAberto; i++) useGameStore.getState().avancarCard();
}

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.getState().resetar();
    fecharCards();
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
    fecharCards();
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

describe("gameStore — cards explicativos", () => {
  beforeEach(() => {
    useGameStore.getState().resetar();
  });

  it("jogo novo abre o card de abertura, pausa, e ao terminar marca como visto e despausa", () => {
    const g = () => useGameStore.getState();
    expect(g().cardAberto).toEqual({ id: "abertura", tela: 0 });
    expect(g().pausado).toBe(true);
    const tempo = g().state.tempoMs;
    g().avancarTicks(10);
    expect(g().state.tempoMs).toBe(tempo); // pausado: nada anda
    g().avancarCard();
    expect(g().cardAberto).toEqual({ id: "abertura", tela: 1 });
    g().avancarCard();
    g().avancarCard();
    expect(g().cardAberto).toBeNull();
    expect(g().pausado).toBe(false);
    expect(g().state.cardsVistos).toEqual(["abertura"]);
    g().avancarTicks(10);
    expect(g().state.tempoMs).toBe(tempo + 1000);
  });

  it("cards de compra aparecem uma vez e enfileiram", () => {
    const g = () => useGameStore.getState();
    g().avancarCard(); g().avancarCard(); g().avancarCard();
    g().importar(JSON.stringify({ ...g().state, creditos: 5000, pesquisa: 50, cardsVistos: ["abertura"] }));
    expect(g().cardAberto).toBeNull();
    expect(g().comprarBateria()).toBe(true);
    expect(g().cardAberto).toEqual({ id: "bateria", tela: 0 });
    expect(g().pausado).toBe(false);
    expect(g().comprarMelhoria("rastreamentoSolar")).toBe(true);
    expect(g().filaCards).toEqual(["rastreamento"]);
    g().avancarCard();
    expect(g().cardAberto).toEqual({ id: "rastreamento", tela: 0 });
    g().avancarCard();
    expect(g().cardAberto).toBeNull();
    expect(g().state.cardsVistos).toEqual(["abertura", "bateria", "rastreamento"]);
    // Segunda bateria não repete o card.
    expect(g().comprarBateria()).toBe(true);
    expect(g().cardAberto).toBeNull();
  });
});
