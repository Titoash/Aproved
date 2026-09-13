/**
 * Reator PWR da Era 2 (GDD Parte 2 §5). A tabela de exemplos de §5.3 inteira vira teste, mais o teste
 * obrigatório escrito lá — no espírito da regra 2 do `CLAUDE.md`.
 *
 * Geometria da grade 5×5: o Vaso é o índice 12; o anel 1 são as 8 vizinhas (6, 7, 8, 11, 13, 16, 17,
 * 18) e o anel 2 são as 16 casas restantes.
 */
import { describe, expect, it } from "vitest";
import { REATOR, SCRAM_ERA2, VARETA } from "../../content/era2-nucleo";
import { faixaDeCalor, pesquisaPorSegundo, temperatura, temperaturaNucleo } from "../calor";
import { efeitosDos } from "../efeitos";
import { capacidadeDoNucleo, equilibrioMotor, motorDoNucleo, potenciaMotor } from "../motor";
import { avaliarTroca, contarReator, entradaReatorUs, esperaParaTrocaMs, fracaoDecaimento, temPiscinaVizinha, varetaNova, vizinhas8 } from "../reator";
import { colocarPeca, podeTrocarVareta, scramManual, trocarVareta } from "../acoesNucleo";
import { avancarTicks, potenciaNucleoEfetivaKw } from "../tick";
import { gradeVazia, type Casa, type GameState, type NucleoState, type PecaId } from "../state";
import { estadoLimpo } from "./ajuda";

/* ------------------------------------------------------------------ */
/* Montagem                                                            */
/* ------------------------------------------------------------------ */

const ANEL1 = [6, 7, 8, 11, 13, 16, 17, 18];

export interface Montagem {
  /** Casas do anel 1 com vareta. */
  varetas1?: readonly number[];
  /** Casas do anel 2 com vareta. */
  varetas2?: readonly number[];
  turbinas?: readonly number[];
  torres?: readonly number[];
  piscinas?: readonly number[];
  barras?: readonly number[];
}

function gradeReator(m: Montagem): Casa[] {
  const grade = gradeVazia(REATOR.ladoInicial);
  const por = (casas: readonly number[] | undefined, id: PecaId, comCombustivel = false) => {
    for (const i of casas ?? []) grade[i] = comCombustivel ? { tipo: "peca", id, vareta: varetaNova() } : { tipo: "peca", id };
  };
  por(m.varetas1, "vareta", true);
  por(m.varetas2, "vareta", true);
  por(m.turbinas, "turbinaAlta");
  por(m.torres, "torreResfriamento");
  por(m.piscinas, "piscina");
  por(m.barras, "barraControle");
  return grade;
}

function nucleoReator(m: Montagem): NucleoState {
  return {
    era: 2,
    lado: REATOR.ladoInicial,
    grade: gradeReator(m),
    calorU: 0,
    tempoAcimaDoLimiteMs: 0,
    scramRestanteMs: 0,
    scramInicioMs: null,
    trocasEmFaixa: 0,
    estabilidade: 0,
    modoSeguro: false,
    receptorCeramico: false,
    cascatas: 0,
    ultimaCascataMs: null,
    ultimaCascata: null,
  };
}

function estadoReator(m: Montagem, creditos = 1e7): GameState {
  return { ...estadoLimpo(creditos), era: 2, nucleo: nucleoReator(m) };
}

/** A montagem clássica de §5.3: 4 varetas no anel 1, 2 no anel 2, 2 turbinas. */
const SEIS_VARETAS: Montagem = { varetas1: [6, 7, 8, 16], turbinas: [11, 13], varetas2: [0, 4] };

const efeitos = efeitosDos([]);
const motorDe = (m: Montagem, tempoMs = 0) => motorDoNucleo(nucleoReator(m), efeitos, tempoMs);
const tEstrela = (m: Montagem) => {
  const motor = motorDe(m);
  return temperatura(equilibrioMotor(motor), motor.capacidadeU);
};
const potenciaNoEquilibrio = (m: Montagem) => {
  const motor = motorDe(m);
  return potenciaMotor(motor, equilibrioMotor(motor));
};

/* ------------------------------------------------------------------ */
/* §5.1 — peças                                                        */
/* ------------------------------------------------------------------ */

describe("peças do reator (GDD Parte 2 §5.1)", () => {
  it("o Vaso guarda 500 u, e cada piscina adjacente soma 250 u", () => {
    expect(capacidadeDoNucleo(nucleoReator({}), efeitos)).toBe(500);
    expect(capacidadeDoNucleo(nucleoReator({ piscinas: [6] }), efeitos)).toBe(750);
    expect(capacidadeDoNucleo(nucleoReator({ piscinas: [6, 8] }), efeitos)).toBe(1000);
  });

  it("a vareta injeta 20 u/s no anel 1, 10 u/s no anel 2 e 5 u/s no anel 3", () => {
    expect(entradaReatorUs(nucleoReator({ varetas1: [6] }), efeitos)).toBe(20);
    expect(entradaReatorUs(nucleoReator({ varetas2: [0] }), efeitos)).toBe(10);
    // o anel 3 só existe no 7×7 (nó "Reator 7×7")
    const grande: NucleoState = { ...nucleoReator({}), lado: 7, grade: gradeVazia(7) };
    grande.grade[0] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
    expect(entradaReatorUs(grande, efeitos)).toBe(5);
  });

  it("a torre de resfriamento dissipa 30 u/s e a turbina consome 12 % de Q por segundo, a 8 kW por u", () => {
    const motor = motorDe({ varetas1: [6], turbinas: [11], torres: [13] });
    expect(motor.dissipacaoUs).toBe(REATOR.dissipacaoTorre);
    expect(motor.fatorTurbina).toBeCloseTo(0.12, 10);
    expect(motor.kwPorU).toBe(8);
  });

  it("a barra de controle vale para as 8 vizinhas e duas barras não somam", () => {
    expect(vizinhas8(12, 5).sort((a, b) => a - b)).toEqual(ANEL1);
    // barra na casa 2: vizinhas 1, 3, 6, 7 e 8 — pega três varetas do anel 1
    const comUma = entradaReatorUs(nucleoReator({ varetas1: [6, 7, 8], barras: [2] }), efeitos);
    expect(comUma).toBe(30);
    // uma segunda barra sobre as mesmas varetas não corta de novo
    const comDuas = entradaReatorUs(nucleoReator({ varetas1: [6, 7, 8], barras: [2, 1] }), efeitos);
    expect(comDuas).toBe(comUma);
  });

  it("a pesquisa do Núcleo é kW × 0,01 × faixa (a Era 1 usava 0,1)", () => {
    expect(REATOR.pesquisaPorKw).toBe(0.01);
    expect(pesquisaPorSegundo(800, 0.83, REATOR.pesquisaPorKw)).toBeCloseTo(10.4, 6);
  });
});

/* ------------------------------------------------------------------ */
/* §5.3 — a tabela de exemplos, linha a linha                          */
/* ------------------------------------------------------------------ */

describe("exemplos de referência do reator (GDD Parte 2 §5.3)", () => {
  it("6 varetas (4 no anel 1 + 2 no anel 2) e 2 turbinas: Q* = 416,7 u, T* = 83 %, 800 kW, 🔬 10,4/s", () => {
    const motor = motorDe(SEIS_VARETAS);
    expect(motor.entradaUs).toBe(100);
    expect(equilibrioMotor(motor)).toBeCloseTo(416.7, 1);
    expect(tEstrela(SEIS_VARETAS)).toBeCloseTo(0.833, 3);
    expect(faixaDeCalor(tEstrela(SEIS_VARETAS)).id).toBe("ouro");
    expect(potenciaNoEquilibrio(SEIS_VARETAS)).toBeCloseTo(800, 6);
    expect(pesquisaPorSegundo(800, tEstrela(SEIS_VARETAS), motor.pesquisaPorKw)).toBeCloseTo(10.4, 6);
  });

  it("7 varetas (110 u/s) e 2 turbinas: Q* = 458,3 u, T* = 92 %, alerta", () => {
    const m: Montagem = { ...SEIS_VARETAS, varetas2: [0, 4, 20] };
    expect(motorDe(m).entradaUs).toBe(110);
    expect(equilibrioMotor(motorDe(m))).toBeCloseTo(458.3, 1);
    expect(tEstrela(m)).toBeCloseTo(0.917, 3);
    expect(faixaDeCalor(tEstrela(m)).id).toBe("alerta");
  });

  it("8 varetas (120 u/s) e 2 turbinas: T* = 100 % exato — assintótico, nunca cascateia", () => {
    const m: Montagem = { ...SEIS_VARETAS, varetas2: [0, 4, 20, 24] };
    expect(motorDe(m).entradaUs).toBe(120);
    expect(equilibrioMotor(motorDe(m))).toBeCloseTo(500, 6);
    expect(tEstrela(m)).toBeCloseTo(1, 9);
    let s = estadoReator(m);
    s = avancarTicks(s, 1200); // 120 s
    expect(temperaturaNucleo(s.nucleo!)).toBeLessThanOrEqual(1);
    expect(s.nucleo!.cascatas).toBe(0);
  });

  it("mais uma vareta no anel 3 do 7×7 (125 u/s): T* = 104 % → Cascata", () => {
    const m: Montagem = { ...SEIS_VARETAS, varetas2: [0, 4, 20, 24] };
    const grande: NucleoState = { ...nucleoReator(m), lado: 7, grade: gradeVazia(7) };
    // reposiciona o 5×5 no centro do 7×7 e põe a nona vareta no anel 3
    const mapa = (i: number) => (i % 5) + 1 + (Math.floor(i / 5) + 1) * 7;
    gradeReator(m).forEach((casa, i) => {
      if (casa && casa.tipo !== "receptor") grande.grade[mapa(i)] = casa;
    });
    grande.grade[0] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
    expect(entradaReatorUs(grande, efeitos)).toBe(125);
    const motor = motorDoNucleo(grande, efeitos, 0);
    expect(equilibrioMotor(motor)).toBeCloseTo(520.8, 1);
    expect(temperatura(equilibrioMotor(motor), motor.capacidadeU)).toBeCloseTo(1.042, 3);
  });

  it("6 varetas, 2 turbinas e 1 torre (100 − 30 u/s): Q* = 291,7 u, T* = 58 %, 560 kW", () => {
    const m: Montagem = { varetas1: [6, 7, 8], turbinas: [11, 13], torres: [16], varetas2: [0, 4] };
    // a torre ocupa uma casa do anel 1; a quarta vareta vai para o anel 2 para manter 100 u/s
    const comQuatro: Montagem = { ...m, varetas1: [6, 7, 8, 18], torres: [16], turbinas: [11, 13], varetas2: [0, 4] };
    const motor = motorDe(comQuatro);
    expect(motor.entradaUs).toBe(100);
    expect(motor.dissipacaoUs).toBe(30);
    expect(equilibrioMotor(motor)).toBeCloseTo(291.7, 1);
    expect(tEstrela(comQuatro)).toBeCloseTo(0.583, 3);
    expect(faixaDeCalor(tEstrela(comQuatro)).id).toBe("normal");
    expect(potenciaNoEquilibrio(comQuatro)).toBeCloseTo(560, 6);
  });

  it("6 varetas compradas juntas, aos 600 s: 7 u/s de decaimento, Q* = 29 u, 6 %, 56 kW", () => {
    const gastas = nucleoReator(SEIS_VARETAS);
    const grade = gastas.grade.map((c) => (c && c.tipo === "peca" && c.id === "vareta" ? { ...c, vareta: { restanteS: 0, gastaDesdeMs: 600_000 } } : c));
    const nucleo: NucleoState = { ...gastas, grade };
    const motor = motorDoNucleo(nucleo, efeitos, 600_000);
    expect(motor.entradaUs).toBeCloseTo(7, 6); // 7 % de 100 u/s
    expect(equilibrioMotor(motor)).toBeCloseTo(29.2, 1);
    expect(temperatura(equilibrioMotor(motor), motor.capacidadeU)).toBeCloseTo(0.058, 3);
    expect(potenciaMotor(motor, equilibrioMotor(motor))).toBeCloseTo(56, 1);
  });

  it("3 das 6 com uma barra vizinha (30 + 40 = 70 u/s): 58 %, 560 kW, e elas duram 1 200 s", () => {
    const m: Montagem = { varetas1: [6, 7, 8, 16], barras: [2], turbinas: [11, 13], varetas2: [0, 4] };
    const motor = motorDe(m);
    expect(motor.entradaUs).toBe(70);
    expect(tEstrela(m)).toBeCloseTo(0.583, 3);
    expect(potenciaNoEquilibrio(m)).toBeCloseTo(560, 6);

    // troca escalonada de graça: as três com barra duram o dobro
    let s = estadoReator(m);
    s = avancarTicks(s, 6_000); // 600 s
    const gastas = (estado: GameState) => contarReator(estado.nucleo!.grade).varetasGastas;
    expect(gastas(s)).toBe(3); // as três sem barra acabaram
    s = avancarTicks(s, 6_000); // 1 200 s
    expect(gastas(s)).toBe(6);
  });

  it("6 varetas + Piscina (capacidade 750) + 2 turbinas: o mesmo Q*, mas 56 % — a piscina compra margem", () => {
    const m: Montagem = { varetas1: [6, 7, 8], piscinas: [16], turbinas: [11, 13], varetas2: [0, 4, 20] };
    const motor = motorDe(m);
    expect(motor.capacidadeU).toBe(750);
    expect(motor.entradaUs).toBe(90);
    // com uma vareta do anel 1 a menos a entrada cai; o que a linha da tabela mostra é a capacidade
    const cheio: Montagem = { varetas1: [6, 7, 8, 18], piscinas: [16], turbinas: [11, 13], varetas2: [0, 4] };
    expect(motorDe(cheio).entradaUs).toBe(100);
    expect(equilibrioMotor(motorDe(cheio))).toBeCloseTo(416.7, 1);
    expect(tEstrela(cheio)).toBeCloseTo(0.556, 3);
    expect(faixaDeCalor(tEstrela(cheio)).id).toBe("normal");
  });
});

/* ------------------------------------------------------------------ */
/* Teste obrigatório da Sessão 8 (GDD Parte 2 §5.3)                    */
/* ------------------------------------------------------------------ */

describe("teste obrigatório da Era 2 (GDD Parte 2 §5.3)", () => {
  it("6 varetas + 2 turbinas estabilizam em 83 % e não cascateiam em 120 s", () => {
    let s = estadoReator(SEIS_VARETAS);
    s = avancarTicks(s, 1_200); // 120 s
    const t = temperaturaNucleo(s.nucleo!);
    expect(t).toBeGreaterThan(0.8);
    expect(t).toBeLessThanOrEqual(0.834);
    expect(faixaDeCalor(t).id).toBe("ouro");
    expect(s.nucleo!.cascatas).toBe(0);
    expect(potenciaNucleoEfetivaKw(s.nucleo, efeitos, s.tempoMs)).toBeGreaterThan(760);
  });

  it("a 9ª vareta dispara a Cascata 5 s depois de T passar de 100 %", () => {
    // 8 varetas (120 u/s) estabilizam em 100 % sem cascatear; a nona leva a 130 u/s → T* = 108 %
    const oito: Montagem = { ...SEIS_VARETAS, varetas2: [0, 4, 20, 24] };
    let s = estadoReator(oito);
    s = avancarTicks(s, 1_200);
    expect(s.nucleo!.cascatas).toBe(0);

    const comNove = colocarPeca(s, 2, "vareta")!;
    expect(motorDoNucleo(comNove.nucleo!, efeitos, comNove.tempoMs).entradaUs).toBe(130);
    let t = comNove;
    let ticksAcima = 0;
    for (let i = 0; i < 3_000 && t.nucleo!.cascatas === 0; i++) {
      const antes = temperaturaNucleo(t.nucleo!);
      t = avancarTicks(t, 1);
      if (antes > 1) ticksAcima++;
    }
    expect(t.nucleo!.cascatas).toBe(1);
    // cinco segundos contínuos acima de 100 %, nem mais nem menos
    expect(ticksAcima).toBe(50);
  });

  it("aos 600 s as 6 esgotam e a potência do reator cai para 56 kW no novo equilíbrio", () => {
    let s = estadoReator(SEIS_VARETAS);
    s = avancarTicks(s, 5_990); // 599 s: ainda com combustível
    expect(contarReator(s.nucleo!.grade).varetasGastas).toBe(0);
    s = avancarTicks(s, 20); // 601 s
    expect(contarReator(s.nucleo!.grade).varetasGastas).toBe(6);
    expect(contarReator(s.nucleo!.grade).varetasAtivas).toBe(0);
    const motor = motorDoNucleo(s.nucleo!, efeitos, s.tempoMs);
    // 1 s depois de esgotar o decaimento já caiu um pouco: 7 u/s × 2^(−1/60)
    expect(motor.entradaUs).toBeCloseTo(7, 0);
    expect(potenciaMotor(motor, equilibrioMotor(motor))).toBeGreaterThan(55);
    expect(potenciaMotor(motor, equilibrioMotor(motor))).toBeLessThanOrEqual(56);
    // e a potência real cai de verdade: em mais 120 s já perdeu mais de 80 % do que dava
    const antes = potenciaNucleoEfetivaKw(s.nucleo, efeitos, s.tempoMs);
    const depois = avancarTicks(s, 1_200);
    expect(potenciaNucleoEfetivaKw(depois.nucleo, efeitos, depois.tempoMs)).toBeLessThan(antes * 0.2);
  });

  it("com Piscina vizinha a troca é imediata; sem ela, só depois de 180 s", () => {
    // com piscina ao lado da vareta 6 (a piscina na casa 11 é vizinha de 6, 7, 12, 16, 17)
    const comPiscina: Montagem = { varetas1: [6, 7, 8, 18], piscinas: [11], turbinas: [13, 16], varetas2: [0, 4] };
    let s = estadoReator(comPiscina);
    expect(temPiscinaVizinha(s.nucleo!.grade, 6, 5)).toBe(true);
    s = avancarTicks(s, 6_010); // 601 s: esgotadas
    expect(podeTrocarVareta(s, 6)).toBe(true);
    const trocada = trocarVareta(s, 6)!;
    expect(trocada.nucleo!.grade[6]).toEqual({ tipo: "peca", id: "vareta", vareta: { restanteS: VARETA.combustivelS, gastaDesdeMs: null } });
    expect(s.creditos - trocada.creditos).toBe(VARETA.custoTroca);

    // sem piscina: a vareta continua quente demais até o decaimento cair abaixo de 1 %
    let semPiscina = estadoReator(SEIS_VARETAS);
    semPiscina = avancarTicks(semPiscina, 6_010);
    expect(podeTrocarVareta(semPiscina, 6)).toBe(false);
    expect(avaliarTroca(semPiscina.nucleo, 6, semPiscina.creditos, semPiscina.tempoMs).motivo).toContain("Quente demais");
    const aos179 = avancarTicks(semPiscina, 1_780); // 178,9 s depois de esgotar
    expect(podeTrocarVareta(aos179, 6)).toBe(false);
    const aos181 = avancarTicks(aos179, 30); // 181,9 s
    expect(podeTrocarVareta(aos181, 6)).toBe(true);
    expect(esperaParaTrocaMs()).toBe(180_000);
  });
});

/* ------------------------------------------------------------------ */
/* §5.2 — decaimento, SCRAM e Cascata                                  */
/* ------------------------------------------------------------------ */

describe("calor de decaimento (GDD Parte 2 §5.2)", () => {
  it("o decaimento é 7 % no instante do desligamento e cai pela metade a cada 60 s", () => {
    expect(fracaoDecaimento(0)).toBeCloseTo(0.07, 10);
    expect(fracaoDecaimento(60_000)).toBeCloseTo(0.035, 10);
    expect(fracaoDecaimento(180_000)).toBeCloseTo(0.00875, 10);
    // ≈ 1 % depois de uma hora não vale para esta meia-vida de jogo, mas a curva é a mesma forma
    expect(fracaoDecaimento(180_000)).toBeLessThan(VARETA.limiarTroca);
  });

  it("a piscina absorve o decaimento das varetas gastas vizinhas: elas não esquentam o Vaso", () => {
    const m: Montagem = { varetas1: [6, 7], piscinas: [11], turbinas: [13, 16] };
    const nucleo = nucleoReator(m);
    const grade = nucleo.grade.map((c) => (c && c.tipo === "peca" && c.id === "vareta" ? { ...c, vareta: { restanteS: 0, gastaDesdeMs: 0 } } : c));
    expect(entradaReatorUs({ ...nucleo, grade }, efeitos, 0)).toBe(0);
  });

  it("o SCRAM da Era 2 dura 60 + 30 s e põe todas as varetas em decaimento no Vaso", () => {
    expect(SCRAM_ERA2.totalMs).toBe(90_000);
    let s = estadoReator(SEIS_VARETAS);
    s = avancarTicks(s, 600);
    const emScram = scramManual(s)!;
    expect(emScram.nucleo!.scramRestanteMs).toBe(SCRAM_ERA2.totalMs);
    expect(emScram.nucleo!.scramInicioMs).toBe(emScram.tempoMs);
    // a entrada cai para o decaimento (7 % de 100 u/s) e as turbinas param
    const motor = motorDoNucleo(emScram.nucleo!, efeitos, emScram.tempoMs);
    expect(motor.entradaUs).toBeCloseTo(7, 6);
    expect(motor.fatorTurbina).toBe(0);
    // o combustível não some: as varetas voltam de onde estavam
    const antes = emScram.nucleo!.grade.filter((c) => c?.tipo === "peca" && c.id === "vareta").map((c) => (c as { vareta: { restanteS: number } }).vareta.restanteS);
    const depois = avancarTicks(emScram, 600).nucleo!.grade.filter((c) => c?.tipo === "peca" && c.id === "vareta").map((c) => (c as { vareta: { restanteS: number } }).vareta.restanteS);
    expect(depois).toEqual(antes);
    // e ao fim dos 90 s o reator volta sozinho
    const voltou = avancarTicks(emScram, 901);
    expect(voltou.nucleo!.scramRestanteMs).toBe(0);
    expect(voltou.nucleo!.scramInicioMs).toBeNull();
  });

  it("a Cascata deixa entulho quente: a vareta destruída continua decaindo e o Vaso não perde Q", () => {
    const oito: Montagem = { ...SEIS_VARETAS, varetas2: [0, 4, 20, 24] };
    let s = estadoReator(oito);
    s = avancarTicks(s, 1_200);
    s = colocarPeca(s, 2, "vareta")!;
    for (let i = 0; i < 3_000 && s.nucleo!.cascatas === 0; i++) s = avancarTicks(s, 1);
    expect(s.nucleo!.cascatas).toBe(1);
    // as varetas do anel 1 viraram entulho, e o entulho guarda o combustível já em decaimento
    const entulhos = s.nucleo!.grade.filter((c) => c?.tipo === "entulho" && c.id === "vareta");
    expect(entulhos.length).toBeGreaterThan(0);
    for (const e of entulhos) expect((e as { vareta?: { gastaDesdeMs: number | null } }).vareta?.gastaDesdeMs).not.toBeNull();
    // o calor guardado não é zerado pela Cascata
    expect(s.nucleo!.calorU).toBeGreaterThan(400);
    expect(entradaReatorUs(s.nucleo!, efeitos, s.tempoMs)).toBeGreaterThan(0);
  });
});
