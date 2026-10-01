/**
 * Parte C da Sessão 9: níveis das peças do Núcleo nas duas eras (GDD §8.3, Parte 2 §5.1 e §5.3) e
 * "Trocar todas as gastas". A nível 0 os exemplos do GDD não mudam (os testes antigos cobrem); a nível 2
 * eles mudam como o GDD diz: +20 % na grandeza da peça.
 */
import { describe, expect, it } from "vitest";
import { NUCLEO } from "../../content/era1-nucleo";
import { REATOR, VARETA } from "../../content/era2-nucleo";
import { avaliarTrocarTodas, trocarTodasAsGastas } from "../acoesNucleo";
import { efeitosDos } from "../efeitos";
import { equilibrioMotor, motorDoNucleo, potenciaMotor } from "../motor";
import { capacidadeU } from "../nucleo";
import { varetaNova } from "../reator";
import { gradeVazia, nucleoInicial, type Casa, type GameState, type NucleoState, type PecaId } from "../state";
import { estadoLimpo } from "./ajuda";
import { configuracao } from "./nucleo.test";

const nivel2 = (id: PecaId) => efeitosDos([], { [id]: 2 });

describe("Torre Solar a nível 2 (§8.3)", () => {
  const torre = (grade: Casa[]): NucleoState => ({ ...nucleoInicial(), grade });

  it("Heliostato Nv 2: h = 5, t = 2 vai de Q* 83,3 ao limite exato de 100", () => {
    const n = torre(configuracao(5));
    expect(equilibrioMotor(motorDoNucleo(n, efeitosDos([])))).toBeCloseTo(83.333, 2);
    expect(equilibrioMotor(motorDoNucleo(n, nivel2("heliostato")))).toBeCloseTo(100, 6);
  });

  it("Turbina Nv 2: a mesma zona de ouro rende 19,2 kW em vez de 16", () => {
    const n = torre(configuracao(5));
    const m0 = motorDoNucleo(n, efeitosDos([]));
    const m2 = motorDoNucleo(n, nivel2("turbina"));
    expect(potenciaMotor(m0, equilibrioMotor(m0))).toBeCloseTo(16, 6);
    expect(potenciaMotor(m2, equilibrioMotor(m2))).toBeCloseTo(19.2, 6);
  });

  it("Radiador Nv 2: h = 6,5, t = 2 e um radiador caem de 83,3 para 78,3", () => {
    const n = torre(configuracao(6.5, { radiadores: 1 }));
    expect(equilibrioMotor(motorDoNucleo(n, efeitosDos([])))).toBeCloseTo(83.333, 2);
    expect(equilibrioMotor(motorDoNucleo(n, nivel2("radiador")))).toBeCloseTo((26 - 6 * 1.2) / 0.24, 6);
  });

  it("Tanque Nv 2: a capacidade vai a 100 + 150 × 1,2 = 280 u", () => {
    const grade = configuracao(6, { tanques: 1 });
    expect(capacidadeU(grade, false, efeitosDos([]))).toBe(NUCLEO.capacidadeReceptorU + 150);
    expect(capacidadeU(grade, false, nivel2("tanque"))).toBeCloseTo(280, 10);
  });
});

describe("Reator PWR a nível 2 (Parte 2 §5.3)", () => {
  /** 6 varetas (4 no anel 1 + 2 no anel 2) e 2 turbinas: a primeira linha de §5.3. */
  function reator(extra: [number, PecaId][] = []): NucleoState {
    const grade = gradeVazia(REATOR.ladoInicial);
    for (const i of [6, 7, 8, 16, 0, 4]) grade[i] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
    grade[11] = { tipo: "peca", id: "turbinaAlta" };
    grade[13] = { tipo: "peca", id: "turbinaAlta" };
    for (const [i, id] of extra) grade[i] = { tipo: "peca", id };
    return { ...nucleoInicial(), era: 2, lado: REATOR.ladoInicial, grade };
  }
  const tStar = (n: NucleoState, e = efeitosDos([])) => {
    const m = motorDoNucleo(n, e);
    return equilibrioMotor(m) / m.capacidadeU;
  };

  it("Vareta Nv 2: entrada 120 u/s e T* = 100 %", () => {
    expect(motorDoNucleo(reator(), nivel2("vareta")).entradaUs).toBeCloseTo(120, 10);
    expect(tStar(reator(), nivel2("vareta"))).toBeCloseTo(1, 10);
  });

  it("Turbina de alta pressão Nv 2: 800 kW viram 960", () => {
    const m = motorDoNucleo(reator(), nivel2("turbinaAlta"));
    expect(potenciaMotor(m, equilibrioMotor(m))).toBeCloseTo(960, 6);
  });

  it("Torre Nv 2: 6 varetas, 2 turbinas e 1 torre ficam em Q* 266,7 (53 %)", () => {
    const n = reator([[17, "torreResfriamento"]]);
    expect(tStar(n)).toBeCloseTo(291.667 / 500, 3);
    expect(tStar(n, nivel2("torreResfriamento"))).toBeCloseTo((100 - 36) / 0.24 / 500, 6);
  });

  it("Piscina Nv 2: a capacidade vai a 800 u e T* a 52 %", () => {
    const n = reator([[17, "piscina"]]);
    expect(tStar(n)).toBeCloseTo(416.667 / 750, 3);
    expect(tStar(n, nivel2("piscina"))).toBeCloseTo(416.667 / 800, 3);
  });

  it("aos 600 s as 6 varetas Nv 2 esgotam e o decaimento é 7 % de 120 = 8,4 u/s", () => {
    const n = reator();
    const gastas = { ...n, grade: n.grade.map((c) => (c && c.tipo === "peca" && c.id === "vareta" ? { ...c, vareta: { restanteS: 0, gastaDesdeMs: 0 } } : c)) };
    expect(motorDoNucleo(gastas, nivel2("vareta"), 0).entradaUs).toBeCloseTo(120 * VARETA.fracaoDecaimento, 10);
  });
});

describe('"Trocar todas as gastas" (Parte 2 §5.1, v0.8)', () => {
  /** Reator com as casas `gastas` esgotadas no instante `desdeMs` e uma piscina opcional. */
  function comGastas(gastas: number[], desdeMs: number, piscina?: number, creditos = 1e6): GameState {
    const grade = gradeVazia(REATOR.ladoInicial);
    for (const i of [6, 7, 8, 16, 0, 4]) grade[i] = { tipo: "peca", id: "vareta", vareta: gastas.includes(i) ? { restanteS: 0, gastaDesdeMs: desdeMs } : varetaNova() };
    grade[11] = { tipo: "peca", id: "turbinaAlta" };
    grade[13] = { tipo: "peca", id: "turbinaAlta" };
    if (piscina !== undefined) grade[piscina] = { tipo: "peca", id: "piscina" };
    const base = estadoLimpo(creditos);
    return { ...base, era: 2, tempoMs: 200_000, nucleo: { ...nucleoInicial(), era: 2, lado: REATOR.ladoInicial, grade } };
  }

  it("troca só as que já esfriaram, com um débito só", () => {
    // 6 e 7 esgotaram há 190 s (já podem); 8 há 10 s (quente)
    let s = comGastas([6, 7], 10_000);
    s = { ...s, nucleo: { ...s.nucleo!, grade: s.nucleo!.grade.map((c, i) => (i === 8 ? { tipo: "peca", id: "vareta", vareta: { restanteS: 0, gastaDesdeMs: 190_000 } } : c)) } };
    const a = avaliarTrocarTodas(s);
    expect(a.gastas).toBe(3);
    expect(a.indices).toEqual([6, 7]);
    expect(a.custo).toBe(2 * VARETA.custoTroca);
    expect(a.proximaEmMs).toBeCloseTo(170_000, 6);
    const depois = trocarTodasAsGastas(s)!;
    expect(s.creditos - depois.creditos).toBe(2 * VARETA.custoTroca);
    expect(depois.nucleo!.grade[6]).toEqual({ tipo: "peca", id: "vareta", vareta: varetaNova() });
    expect(depois.nucleo!.grade[8]).toEqual(s.nucleo!.grade[8]);
    expect(depois.eventos.filter((e) => e.tipo === "varetaTrocada")).toHaveLength(2);
  });

  it("com Piscina vizinha as gastas saem na hora", () => {
    // a vareta 16 esgotou há 1 s; a piscina na casa 17 (anel 1) é vizinha dela
    const s = comGastas([16], 199_000, 17);
    expect(avaliarTrocarTodas(s).indices).toEqual([16]);
  });

  it("tudo ou nada: sem ₵ para o lote inteiro, recusa", () => {
    const s = comGastas([6, 7, 8], 0, undefined, VARETA.custoTroca * 2);
    const a = avaliarTrocarTodas(s);
    expect(a.ok).toBe(false);
    expect(a.motivo).toContain("₵ insuficientes");
    expect(trocarTodasAsGastas(s)).toBeNull();
  });

  it("sem gasta, ou sem nenhuma fria, explica o motivo", () => {
    expect(avaliarTrocarTodas(comGastas([], 0)).motivo).toBe("Nenhuma vareta gasta.");
    const quente = avaliarTrocarTodas(comGastas([6], 199_000));
    expect(quente.ok).toBe(false);
    expect(quente.motivo).toContain("Nenhuma esfriou");
    expect(quente.proximaEmMs).toBeCloseTo(179_000, 6);
    expect(avaliarTrocarTodas(estadoLimpo()).motivo).toBe("O reator ainda não existe.");
  });

  it("um lote na zona de ouro conta uma troca em faixa, não uma por vareta", () => {
    const s0 = comGastas([6, 7, 8], 0);
    // Q no ouro: 80 % de 500
    const s = { ...s0, nucleo: { ...s0.nucleo!, calorU: 400 } };
    const depois = trocarTodasAsGastas(s)!;
    expect(depois.nucleo!.trocasEmFaixa).toBe(s.nucleo!.trocasEmFaixa + 1);
  });
});
