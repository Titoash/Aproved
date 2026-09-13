import { beforeEach, describe, expect, it } from "vitest";
import { USINAS } from "../content/era1";
import { OBSTACULOS } from "../content/era1-arquipelago";
import { naPlataforma } from "../sim/arquipelago";
import { arquipelagoDaEra1 } from "../sim/gerarArquipelago";
import { obstaculoEm, quantidadeDe } from "../sim/producao";
import { useGameStore } from "./gameStore";

const arq = arquipelagoDaEra1();

/** k-ésima casa livre da ilha principal (sem obstáculo, fora da plataforma e dos caminhos). */
function casaLivre(k = 0): number {
  let vistas = 0;
  for (const i of arq.ilhas[0].casas) {
    if (arq.obstaculos[i] !== 255 || arq.caminho[i] === 1) continue;
    if (naPlataforma(arq.plataforma, i % arq.n, Math.floor(i / arq.n))) continue;
    if (useGameStore.getState().state.mundo.construcoes[i]) continue;
    if (vistas++ < k) continue;
    return i;
  }
  throw new Error("sem casa livre");
}

/** Primeira casa com o obstáculo pedido na ilha principal. */
function casaCom(tipo: string): number {
  const mundoAtual = useGameStore.getState().state.mundo;
  for (const i of arq.ilhas[0].casas) if (obstaculoEm(mundoAtual, i) === tipo) return i;
  throw new Error(`sem ${tipo}`);
}

/** Jogo novo abre o card de abertura e pausa; os testes de jogo o fecham antes. */
function fecharCards() {
  for (let i = 0; i < 10 && useGameStore.getState().cardAberto; i++) useGameStore.getState().avancarCard();
}

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.getState().resetar();
    fecharCards();
  });

  it("colocar um cata-vento na aldeia aumenta a potência e rende créditos ao avançar", () => {
    const g = () => useGameStore.getState();
    // a subestação de nascença escoa o que for colocado a até 3 casas dela
    const sub = arq.inicio.subestacao;
    const casa = arq.ilhas[0].casas.find(
      (i) =>
        !g().state.mundo.construcoes[i] &&
        arq.obstaculos[i] === 255 &&
        arq.caminho[i] === 0 &&
        Math.max(Math.abs((i % arq.n) - (sub % arq.n)), Math.abs(Math.floor(i / arq.n) - Math.floor(sub / arq.n))) <= 3,
    )!;
    g().selecionarFerramentaMundo("cataVento");
    expect(g().agirNoMundo(casa)).toBe(true);
    const antes = g().state.creditos;
    g().avancarTicks(10);
    const depois = g().state;
    expect(quantidadeDe(depois, "cataVento")).toBe(1);
    expect(depois.creditos).toBeGreaterThan(antes);
    expect(depois.tempoMs).toBe(1000);
  });

  it("não constrói o que não pode e avisa o motivo", () => {
    const g = () => useGameStore.getState();
    const antes = g().state;
    g().selecionarFerramentaMundo("cataVento");
    expect(g().agirNoMundo(arq.terra.indexOf(0))).toBe(false); // mar
    expect(g().state).toBe(antes);
    expect(g().avisoGrade?.texto).toContain("terra");
  });

  it("com um prédio selecionado, tocar num obstáculo manda o Bipe desmatar", () => {
    const g = () => useGameStore.getState();
    const arvore = casaCom("arvore");
    g().selecionarFerramentaMundo("cataVento");
    const creditos = g().state.creditos;
    expect(g().agirNoMundo(arvore)).toBe(true);
    expect(g().state.creditos).toBe(creditos - OBSTACULOS.arvore.custo);
    expect(g().state.mundo.remocoes[0].indice).toBe(arvore);
    expect(g().avisoGrade?.texto).toContain("Bipe");
    g().avancarTicks(OBSTACULOS.arvore.tempoMs / 100);
    expect(obstaculoEm(g().state.mundo, arvore)).toBeNull();
  });

  it("exportar e importar preservam o estado", () => {
    const casa = casaLivre();
    useGameStore.getState().colocar(casa, "cataVento");
    const json = useGameStore.getState().exportar();
    useGameStore.getState().resetar();
    expect(quantidadeDe(useGameStore.getState().state, "cataVento")).toBe(0);
    useGameStore.getState().importar(json);
    expect(quantidadeDe(useGameStore.getState().state, "cataVento")).toBe(1);
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
    expect(g().colocar(casaLivre(), "bateria")).toBe(true);
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
    expect(g().colocar(casaLivre(), "bateria")).toBe(true);
    expect(g().cardAberto).toBeNull();
  });
});
