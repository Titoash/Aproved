import { describe, expect, it } from "vitest";
import { CASCATA, MODO_SEGURO } from "../../content/era1-nucleo";
import { temperaturaNucleo } from "../calor";
import { custoReconstrucao, faltaParaLimpezaMs, podeLimparEntulho, reconstruir, scram } from "../cascata";
import { equilibrioU } from "../nucleo";
import { estadoInicial, nucleoInicial, type Casa, type GameState } from "../state";
import { avancarTicks, balancoDoEstado, potenciaNucleoEfetivaKw, tick, TICK_MS } from "../tick";
import { ANEL1, ANEL2, configuracao, montar } from "./nucleo.test";

function comNucleo(grade: Casa[], calorU: number, extra: Partial<GameState> = {}): GameState {
  const s = estadoInicial();
  return {
    ...s,
    ...extra,
    nucleo: { ...nucleoInicial(), grade, calorU, estabilidade: 50 },
  };
}

/** Avança até `condicao` ser verdadeira ou o limite de ticks; devolve estado e ticks gastos. */
function ateQue(s0: GameState, condicao: (s: GameState) => boolean, maxTicks: number) {
  let s = s0;
  for (let i = 1; i <= maxTicks; i++) {
    s = tick(s, TICK_MS);
    if (condicao(s)) return { s, ticks: i };
  }
  return { s, ticks: Infinity };
}

describe("Cascata", () => {
  it("h = 6 com 2 turbinas estabiliza em 100 % e não cascateia em 120 s", () => {
    const s = avancarTicks(comNucleo(configuracao(6), 0), 1200);
    expect(s.nucleo!.cascatas).toBe(0);
    expect(temperaturaNucleo(s.nucleo!)).toBeCloseTo(1, 3);
    expect(temperaturaNucleo(s.nucleo!)).toBeLessThanOrEqual(1);
    expect(s.nucleo!.tempoAcimaDoLimiteMs).toBe(0);
  });

  it("acrescentar um espelho de anel 2 (h = 6,5) dispara a Cascata 5,0 s ± 0,1 depois de T passar de 100 %", () => {
    const grade6 = configuracao(6);
    const s0 = comNucleo(grade6, equilibrioU(grade6)); // equilíbrio exato de h = 6
    const gradeExtra = grade6.slice();
    gradeExtra[ANEL2[5]] = { tipo: "peca", id: "heliostato" };
    const s1 = { ...s0, nucleo: { ...s0.nucleo!, grade: gradeExtra } };

    const passou = ateQue(s1, (s) => temperaturaNucleo(s.nucleo!) > 1, 100);
    expect(passou.ticks).toBe(1);
    const cascata = ateQue(s1, (s) => s.nucleo!.cascatas === 1, 200);
    expect(cascata.ticks).not.toBe(Infinity);
    const atrasoS = ((cascata.ticks - passou.ticks) * TICK_MS) / 1000;
    expect(Math.abs(atrasoS - 5.0)).toBeLessThanOrEqual(0.1);
  });

  it("aplica exatamente: −30 de Estabilidade, SCRAM de 20 s, entulho no anel 1, bateria −10 %, pesquisa intacta", () => {
    const grade = configuracao(6.5);
    const s0 = comNucleo(grade, 100, { pesquisa: 123.4 });
    // Bateria cheia: o excedente do Núcleo não pode carregá-la antes da Cascata.
    s0.rede.bateria = { kwh: 10, capacidadeKwh: 10, unidades: 1 };
    const { s, ticks } = ateQue(s0, (x) => x.nucleo!.cascatas === 1, 200);
    expect(ticks).not.toBe(Infinity);
    const n = s.nucleo!;
    expect(n.estabilidade).toBe(20);
    expect(n.scramRestanteMs).toBe(CASCATA.scramMs);
    for (const i of ANEL1) if (grade[i]) expect(n.grade[i]?.tipo).toBe("entulho");
    expect(n.grade[ANEL2[0]]).toEqual({ tipo: "peca", id: "heliostato" });
    expect(s.rede.bateria.kwh).toBeCloseTo(9, 10);
    expect(s.pesquisa).toBeGreaterThan(123.4); // ganhou pesquisa até a Cascata e não perdeu nada
    expect(n.tempoAcimaDoLimiteMs).toBe(0);
    expect(n.ultimaCascataMs).toBe(s.tempoMs);
  });

  it("Estabilidade tem piso em 0", () => {
    const s0 = comNucleo(configuracao(6.5), 100);
    s0.nucleo!.estabilidade = 10;
    const { s } = ateQue(s0, (x) => x.nucleo!.cascatas === 1, 200);
    expect(s.nucleo!.estabilidade).toBe(0);
  });
});

describe("SCRAM", () => {
  it("durante o SCRAM não há pesquisa nem potência do Núcleo, e Q cai", () => {
    const grade = configuracao(6, { radiadores: 1 });
    const s0 = comNucleo(grade, 80, { pesquisa: 5 });
    const s1 = { ...s0, nucleo: scram(s0.nucleo!) };
    expect(potenciaNucleoEfetivaKw(s1.nucleo)).toBe(0);
    const s2 = avancarTicks(s1, 10);
    expect(s2.pesquisa).toBe(5);
    expect(s2.nucleo!.calorU).toBeLessThan(80);
    expect(s2.nucleo!.scramRestanteMs).toBe(CASCATA.scramMs - 1000);
    expect(balancoDoEstado(s2).ofertaNucleoKw).toBe(0);
  });

  it("o SCRAM acaba depois de 20 s e o Núcleo volta a produzir", () => {
    const s0 = comNucleo(configuracao(5), 80);
    const s1 = { ...s0, nucleo: scram(s0.nucleo!) };
    const s2 = avancarTicks(s1, 201);
    expect(s2.nucleo!.scramRestanteMs).toBe(0);
    expect(potenciaNucleoEfetivaKw(s2.nucleo)).toBeGreaterThan(0);
  });

  it("modo seguro dispara SCRAM a 95 % e nunca deixa chegar a 100 %", () => {
    const s0 = comNucleo(configuracao(6.5), 0);
    s0.nucleo!.modoSeguro = true;
    let s = s0;
    let tMax = 0;
    let houveScram = false;
    for (let i = 0; i < 1200; i++) {
      s = tick(s, TICK_MS);
      tMax = Math.max(tMax, temperaturaNucleo(s.nucleo!));
      if (s.nucleo!.scramRestanteMs > 0) houveScram = true;
    }
    expect(houveScram).toBe(true);
    expect(tMax).toBeGreaterThanOrEqual(MODO_SEGURO.limiarT);
    expect(tMax).toBeLessThan(1);
    expect(s.nucleo!.cascatas).toBe(0);
  });

  it("modo seguro reduz a potência do Núcleo para ×0,7", () => {
    const grade = configuracao(5);
    const s = comNucleo(grade, equilibrioU(grade));
    expect(potenciaNucleoEfetivaKw(s.nucleo)).toBeCloseTo(16, 6);
    s.nucleo!.modoSeguro = true;
    expect(potenciaNucleoEfetivaKw(s.nucleo)).toBeCloseTo(16 * 0.7, 6);
  });
});

describe("acoplamento Núcleo → Rede e ordem do tick", () => {
  it("a potência do Núcleo soma na oferta e move o r", () => {
    const grade = configuracao(5);
    const s = comNucleo(grade, equilibrioU(grade));
    const b = balancoDoEstado(s);
    expect(b.ofertaUsinasKw).toBe(0);
    expect(b.ofertaNucleoKw).toBeCloseTo(16, 6);
    expect(b.ofertaKw).toBeCloseTo(16, 6);
    expect(b.r).toBeCloseTo(16 / 5, 6);
    expect(b.faixa.id).toBe("saturacao");
  });

  it("a receita usa a potência do Q do início do tick", () => {
    const s0 = comNucleo(configuracao(5), 0);
    s0.creditos = 0;
    const s1 = tick(s0, TICK_MS);
    expect(s1.nucleo!.calorU).toBeGreaterThan(0); // o calor subiu dentro do tick…
    expect(s1.creditos).toBe(0); // …mas a venda usou Q = 0
    const s2 = tick(s1, TICK_MS);
    expect(s2.creditos).toBeGreaterThan(0);
  });

  it("pesquisa acumula com o Núcleo na zona de ouro (16 kW → 2,08 🔬/s)", () => {
    const grade = configuracao(5);
    const s = avancarTicks(comNucleo(grade, equilibrioU(grade)), 10);
    expect(s.pesquisa).toBeCloseTo(2.08, 3);
  });

  it("Estabilidade sobe +2,5/min na zona de ouro e +1,5/min fora dela", () => {
    const ouro = configuracao(5);
    const sOuro = avancarTicks(comNucleo(ouro, equilibrioU(ouro)), 600);
    expect(sOuro.nucleo!.estabilidade).toBeCloseTo(52.5, 6);
    const frio = configuracao(6, { tanques: 1 }); // T ≈ 40 %
    const sFrio = avancarTicks(comNucleo(frio, equilibrioU(frio) * 0.99), 600);
    expect(sFrio.nucleo!.estabilidade).toBeCloseTo(51.5, 6);
  });

  it("sem Núcleo o tick da Sessão 1 não muda", () => {
    const s0 = estadoInicial();
    s0.rede.usinas.cataVento = { quantidade: 6, nivel: 0 };
    s0.creditos = 0;
    expect(avancarTicks(s0, 100).creditos).toBeCloseTo(50, 6);
  });
});

describe("entulho", () => {
  it("limpar é grátis só depois de 30 s; reconstruir custa 50 %", () => {
    const casa: Casa = { tipo: "entulho", id: "turbina", desdeMs: 1000 };
    expect(podeLimparEntulho(casa, 1000 + CASCATA.limpezaGratisMs - 1)).toBe(false);
    expect(faltaParaLimpezaMs(casa, 1000)).toBe(CASCATA.limpezaGratisMs);
    expect(podeLimparEntulho(casa, 1000 + CASCATA.limpezaGratisMs)).toBe(true);
    expect(custoReconstrucao(casa)).toBe(25);
    const grade = montar(["turbina"]);
    grade[ANEL1[0]] = casa;
    expect(reconstruir(grade, ANEL1[0])[ANEL1[0]]).toEqual({ tipo: "peca", id: "turbina" });
  });
});
