import { describe, expect, it } from "vitest";
import { MELHORIAS } from "../../content/era1";
import { NUCLEO, PECAS } from "../../content/era1-nucleo";
import { colocarPeca } from "../acoesNucleo";
import { comprarMelhoria, podeComprarMelhoria } from "../melhorias";
import { anel, colocar, contar, entulharAnel1, equilibrioU, aquecedoresEfetivos, expandirGrade, podeColocar } from "../nucleo";
import { desserializar } from "../save";
import { estadoInicial, gradeVazia, indiceReceptor, ladoDaGrade, nucleoInicial, VERSAO_SAVE, type Casa, type GameState } from "../state";
import { ANEL1, ANEL2, configuracao } from "./nucleo.test";

const ANEL3 = Array.from({ length: 49 }, (_, i) => i).filter((i) => {
  const x = i % 7;
  const y = Math.floor(i / 7);
  return Math.max(Math.abs(x - 3), Math.abs(y - 3)) === 3;
});

describe("Grade 7×7 (Parte D)", () => {
  it("anel() para lado = 7: 24 é anel 0, 8 vizinhas anel 1, 16 seguintes anel 2, 24 externas anel 3", () => {
    expect(indiceReceptor(7)).toBe(24);
    expect(anel(24, 7)).toBe(0);
    const contagem = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    for (let i = 0; i < 49; i++) if (i !== 24) contagem[anel(i, 7)]++;
    expect(contagem).toEqual({ 1: 8, 2: 16, 3: 24 });
    expect(ANEL3).toHaveLength(24);
    for (const i of ANEL3) expect(anel(i, 7)).toBe(3);
    // O 5×5 continua igual.
    expect(anel(12)).toBe(0);
    for (const i of ANEL1) expect(anel(i, 5)).toBe(1);
  });

  it("expandirGrade preserva cada peça na casa correspondente e mantém o Receptor no centro", () => {
    let g5 = configuracao(5);
    g5 = entulharAnel1(g5, 10); // anel 1 vira entulho: testa peças, entulho e Receptor
    const g7 = expandirGrade(g5);
    expect(g7).toHaveLength(49);
    expect(ladoDaGrade(g7)).toBe(7);
    expect(g7[24]).toEqual({ tipo: "receptor" });
    g5.forEach((casa, i) => {
      const x = i % 5;
      const y = Math.floor(i / 5);
      expect(g7[x + 1 + (y + 1) * 7]).toEqual(casa);
    });
    for (const i of ANEL3) expect(g7[i]).toBeNull();
    expect(contar(g7).entulhos).toBe(contar(g5).entulhos);
    expect(aquecedoresEfetivos(g7)).toBe(aquecedoresEfetivos(g5));
  });

  it("h com anel 3 a 0,25; só heliostato entra no anel 3", () => {
    expect(NUCLEO.pesoEspelhoAnel3).toBe(0.25);
    expect(PECAS.heliostato.aneis).toEqual([1, 2, 3]);
    let g7 = gradeVazia(7);
    expect(podeColocar(g7, ANEL3[0], "heliostato").ok).toBe(true);
    expect(podeColocar(g7, ANEL3[0], "turbina").ok).toBe(false);
    expect(podeColocar(g7, ANEL3[0], "radiador").ok).toBe(false);
    expect(podeColocar(g7, ANEL3[0], "tanque").ok).toBe(false);
    expect(podeColocar(g7, 24, "heliostato").ok).toBe(false); // Receptor no centro do 7×7
    for (const i of ANEL3) g7 = colocar(g7, i, "heliostato");
    expect(contar(g7).aquecedoresPorAnel[2]).toBe(24);
    expect(aquecedoresEfetivos(g7)).toBe(6);
    // Cheia de espelhos com 2 turbinas: h = 6 + 8 + 6 = 20 → Q* = 333 (GDD §8.3).
    let cheia = expandirGrade(configuracao(6)); // 4 no anel 1 + 4 no anel 2, 2 turbinas
    // completa o anel 1 (2 casas livres) e o anel 2 (12 livres) do 7×7
    cheia.forEach((casa, i) => {
      if (casa === null && anel(i, 7) !== 0) cheia = colocar(cheia, i, "heliostato");
    });
    expect(contar(cheia).conversores).toBe(2);
    expect(aquecedoresEfetivos(cheia)).toBe(6 + 8 + 6);
    expect(equilibrioU(cheia)).toBeCloseTo(333.3, 1);
  });

  it("a Grade 7×7 exige ₵ 800 e 🔬 150, é única, exige Núcleo, e depois dela podeColocar aceita o índice 48", () => {
    expect(MELHORIAS.grade7x7.custo).toBe(800);
    expect(MELHORIAS.grade7x7.pesquisa).toBe(150);
    const semNucleo = { ...estadoInicial(), creditos: 1000, pesquisa: 200 };
    expect(podeComprarMelhoria(semNucleo, "grade7x7")).toBe(false);
    const s = { ...semNucleo, nucleo: { ...nucleoInicial(), grade: configuracao(5) } };
    expect(podeComprarMelhoria({ ...s, pesquisa: 100 }, "grade7x7")).toBe(false);
    expect(podeComprarMelhoria({ ...s, creditos: 700 }, "grade7x7")).toBe(false);
    expect(podeColocar(s.nucleo.grade, 48, "heliostato").ok).toBe(false); // fora do 5×5
    const s1 = comprarMelhoria(s, "grade7x7")!;
    expect(s1).not.toBeNull();
    expect(s1.creditos).toBe(200);
    expect(s1.pesquisa).toBe(200);
    expect(s1.nucleo!.lado).toBe(7);
    expect(s1.nucleo!.grade).toHaveLength(49);
    expect(aquecedoresEfetivos(s1.nucleo!.grade)).toBe(5);
    expect(podeColocar(s1.nucleo!.grade, 48, "heliostato").ok).toBe(true);
    expect(colocarPeca(s1, 48, "heliostato")!.nucleo!.grade[48]).toEqual({ tipo: "peca", id: "heliostato" });
    expect(comprarMelhoria({ ...s1, creditos: 5000 }, "grade7x7")).toBeNull();
    expect(s1.eventos.at(-1)).toEqual({ tipo: "melhoriaComprada", id: "grade7x7" });
  });

  it("migração v3 → v4 preserva tudo e adiciona lado, ultimaCascata e cardsVistos", () => {
    const s0 = estadoInicial();
    s0.creditos = 1234;
    s0.pesquisa = 77;
    s0.rede.usinas.painelSolar = { quantidade: 3, nivel: 1 };
    s0.melhorias.laminasDeFibra = true;
    s0.nucleo = { ...nucleoInicial(), grade: configuracao(5), calorU: 80, estabilidade: 12, cascatas: 2 };
    const v3 = JSON.parse(JSON.stringify(s0));
    delete v3.cardsVistos;
    delete v3.eventos;
    delete v3.nucleo.lado;
    delete v3.nucleo.ultimaCascata;
    delete v3.melhorias.grade7x7;
    v3.versao = 3;
    const s = desserializar(JSON.stringify(v3), 5);
    expect(s.versao).toBe(VERSAO_SAVE);
    expect(s.creditos).toBe(1234);
    expect(s.pesquisa).toBe(77);
    expect(s.rede.usinas.painelSolar).toEqual({ quantidade: 3, nivel: 1 });
    expect(s.melhorias).toEqual({ laminasDeFibra: true, rastreamentoSolar: false, grade7x7: false });
    expect(s.nucleo!.lado).toBe(5);
    expect(s.nucleo!.grade).toEqual(configuracao(5));
    expect(s.nucleo!.cascatas).toBe(2);
    expect(s.nucleo!.ultimaCascata).toBeNull();
    expect(s.cardsVistos).toEqual([]);
    expect(s.eventos).toEqual([]);
  });

  it("um save v4 com grade 7×7 faz a viagem de ida e volta; casa inválida no anel 3 cai", () => {
    const s0 = { ...estadoInicial(), nucleo: { ...nucleoInicial(), lado: 7, grade: expandirGrade(configuracao(5)) } };
    s0.nucleo.grade[0] = { tipo: "peca", id: "heliostato" };
    s0.cardsVistos = ["abertura"];
    const json = JSON.stringify({ ...s0, salvoEmMs: 9 });
    const s = desserializar(json, 9);
    expect(s.nucleo!.lado).toBe(7);
    expect(s.nucleo!.grade).toEqual(s0.nucleo.grade);
    expect(s.cardsVistos).toEqual(["abertura"]);
    const bruto = JSON.parse(json);
    bruto.nucleo.grade[1] = { tipo: "peca", id: "turbina" }; // turbina no anel 3
    expect(desserializar(JSON.stringify(bruto), 9).nucleo!.grade[1]).toBeNull();
  });
});

describe("eventos", () => {
  it("primeiraCompra dispara só na primeira unidade", () => {
    const s = { ...estadoInicial(), creditos: 1e6, pesquisa: 100, nucleo: nucleoInicial() };
    const s1 = colocarPeca(s, ANEL1[0], "tanque")!;
    expect(s1.eventos).toEqual([{ tipo: "primeiraCompra", item: "tanque" }]);
    const s2 = colocarPeca({ ...s1, eventos: [] }, ANEL1[1], "tanque")!;
    expect(s2.eventos).toEqual([]);
    const s3 = colocarPeca({ ...s2, eventos: [] }, ANEL2[0], "heliostato")!;
    expect(s3.eventos).toEqual([{ tipo: "primeiraCompra", item: "heliostato" }]);
  });

  it("a Cascata carrega entrada e saída iguais ao balanço do tick", async () => {
    const { avancarTicks, tick, TICK_MS } = await import("../tick");
    const grade = configuracao(6.5);
    const s0 = { ...estadoInicial(), nucleo: { ...nucleoInicial(), grade, calorU: 100, estabilidade: 50 } };
    let s: GameState = s0;
    let evento: Extract<(typeof s.eventos)[number], { tipo: "cascata" }> | undefined;
    let qAntes = 0;
    for (let i = 0; i < 200 && !evento; i++) {
      qAntes = s.nucleo!.calorU;
      s = tick(s, TICK_MS);
      evento = s.eventos.find((e): e is Extract<typeof e, { tipo: "cascata" }> => e.tipo === "cascata");
    }
    expect(evento).toBeDefined();
    expect(evento!.entradaUs).toBeCloseTo(4 * 6.5, 10);
    expect(evento!.saidaUs).toBeCloseTo(NUCLEO.consumoTurbina * 2 * qAntes, 10);
    expect(s.nucleo!.ultimaCascata).toEqual({ tempoMs: s.tempoMs, entradaUs: evento!.entradaUs, saidaUs: evento!.saidaUs });
    // O tick seguinte limpa a fila.
    expect(avancarTicks(s, 1).eventos).toEqual([]);
  });

  it("marcarCardVisto persiste no save", async () => {
    const { marcarCardVisto, cardVisto } = await import("../cards");
    const { exportarJson, importarJson } = await import("../save");
    const s = marcarCardVisto(marcarCardVisto(estadoInicial(), "abertura"), "abertura");
    expect(s.cardsVistos).toEqual(["abertura"]);
    expect(cardVisto(s, "abertura")).toBe(true);
    expect(importarJson(exportarJson(s, 1), 1).cardsVistos).toEqual(["abertura"]);
  });
});

describe("sanidade do 5×5 depois da Parte D", () => {
  it("gradeVazia() continua 25 casas com o Receptor em 12", () => {
    const g: Casa[] = gradeVazia();
    expect(g).toHaveLength(25);
    expect(g[12]).toEqual({ tipo: "receptor" });
    expect(ladoDaGrade(g)).toBe(5);
  });
});
