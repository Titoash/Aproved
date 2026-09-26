/**
 * Melhorias por tipo (GDD Parte 1 §7.1, §8.3, §8.5, §8.6; Parte 2 §3.2, §4.2, §5.1; v0.8 e v0.9).
 * Um nível vale para todas as unidades do tipo; nenhuma fórmula muda, os níveis entram como fatores.
 */
import { describe, expect, it } from "vitest";
import { LABORATORIO } from "../../content/cidade-era1";
import { CABO, SUBESTACAO } from "../../content/era1-arquipelago";
import { NIVEL_CIENCIA, NIVEL_PECA, NIVEL_USINA } from "../../content/melhorias";
import { PECAS } from "../../content/era1-nucleo";
import { REATOR, VARETA } from "../../content/era2-nucleo";
import { USINAS } from "../../content/usinas";
import { efeitosDe, efeitosDos } from "../efeitos";
import { avaliarMelhoria, custoProximoNivel, melhorar, nivelDe, nivelMaximo } from "../melhorias";
import { equilibrioMotor, motorDoNucleo } from "../motor";
import { colocar, comprarIlha, custoCabo, ligarCabo } from "../mundo";
import { analisar } from "../producao";
import { calorNominalVaretaUs, capacidadeReatorU, dissipacaoReatorUs, varetaNova } from "../reator";
import { desserializar, serializar } from "../save";
import { gradeVazia, nucleoInicial, type AlvoMelhoria, type Casa, type GameState } from "../state";
import { estadoLimpo, plantar } from "./ajuda";
import { configuracao } from "./nucleo.test";

/** Compra `vezes` níveis seguidos e devolve o estado e o que cada um custou. */
function comprar(s: GameState, alvo: AlvoMelhoria, vezes: number): { s: GameState; custos: number[] } {
  const custos: number[] = [];
  let atual = s;
  for (let k = 0; k < vezes; k++) {
    const proximo = melhorar(atual, alvo);
    expect(proximo, `nível ${k + 1}`).not.toBeNull();
    custos.push(atual.creditos - proximo!.creditos);
    atual = proximo!;
  }
  return { s: atual, custos };
}

describe("usinas: nível por tipo (§7, §7.1)", () => {
  const alvo = { tipo: "usina", id: "cataVento" } as const;

  it("exige uma unidade colocada: nível sem unidade não sai de graça", () => {
    const s = estadoLimpo();
    expect(melhorar(s, alvo)).toBeNull();
    expect(avaliarMelhoria(s, alvo).motivo).toBe("Coloque um primeiro");
  });

  it("custa base × 3^(n+1), produz +50 % por nível e para no 5", () => {
    const s0 = plantar(estadoLimpo(), "cataVento", 1);
    const bruto0 = analisar(s0).brutoKw;
    const { s, custos } = comprar(s0, alvo, NIVEL_USINA.maximo);
    expect(custos).toEqual([45, 135, 405, 1215, 3645].map((c) => (c / 15) * USINAS.cataVento.custoBase));
    expect(nivelDe(s, alvo)).toBe(5);
    expect(analisar(s).brutoKw).toBeCloseTo(bruto0 * (1 + 5 * NIVEL_USINA.bonusPorNivel), 10);
    expect(avaliarMelhoria(s, alvo).motivo).toContain("Nível máximo");
    expect(melhorar(s, alvo)).toBeNull();
  });

  it("vale para todas as unidades do tipo, inclusive as que vêm depois", () => {
    const s1 = plantar(estadoLimpo(), "cataVento", 3);
    const s2 = melhorar(s1, alvo)!;
    const por = (s: GameState) => analisar(s).usinas.filter((u) => u.tipo === "cataVento").map((u) => u.brutoKw);
    for (const kw of por(s2)) expect(kw).toBeCloseTo(USINAS.cataVento.potenciaKw * 1.5, 10);
    const s3 = plantar(s2, "cataVento", 1);
    expect(por(s3)).toHaveLength(4);
    for (const kw of por(s3)) expect(kw).toBeCloseTo(USINAS.cataVento.potenciaKw * 1.5, 10);
  });

  it("emite o evento de melhoria para o diário", () => {
    const s = melhorar(plantar(estadoLimpo(), "cataVento", 1), alvo)!;
    expect(s.eventos.at(-1)).toEqual({ tipo: "melhoria", alvo, nivel: 1 });
  });
});

describe("peças do Núcleo: nível por tipo (§8.3, Parte 2 §5.1)", () => {
  const comTorre = (grade: Casa[]): GameState => ({ ...estadoLimpo(), nucleo: { ...nucleoInicial(), grade } });
  const heliostato = { tipo: "peca", id: "heliostato" } as const;

  it("custa 5 × custo da peça × 2ⁿ: Heliostato 150, 300, 600, 1 200, 2 400", () => {
    const { s, custos } = comprar(comTorre(configuracao(5)), heliostato, NIVEL_PECA.maximo);
    expect(PECAS.heliostato.custo).toBe(30);
    expect(custos).toEqual([150, 300, 600, 1200, 2400]);
    expect(avaliarMelhoria(s, heliostato).motivo).toContain("Nível máximo");
  });

  it("a nível 0 os exemplos de §8.3 não mudam; a nível 2 os Heliostatos sobem Q* 20 %", () => {
    const s0 = comTorre(configuracao(5));
    expect(equilibrioMotor(motorDoNucleo(s0.nucleo!, efeitosDe(s0)))).toBeCloseTo(83.333, 2);
    const { s: s2 } = comprar(s0, heliostato, 2);
    // h = 5, t = 2: Q* = 4 × 1,2 × 5 ÷ 0,24 = 100 — o limite exato. Subir o nível é decisão de calor.
    expect(equilibrioMotor(motorDoNucleo(s2.nucleo!, efeitosDe(s2)))).toBeCloseTo(100, 6);
  });

  it("turbina: +10 % de kW por u sem mexer no Q*; radiador e tanque também sobem", () => {
    const s0 = comTorre(configuracao(5));
    const { s } = comprar(s0, { tipo: "peca", id: "turbina" }, 1);
    const m0 = motorDoNucleo(s0.nucleo!, efeitosDe(s0));
    const m1 = motorDoNucleo(s.nucleo!, efeitosDe(s));
    expect(equilibrioMotor(m1)).toBeCloseTo(equilibrioMotor(m0), 10);
    expect(m1.kwPorU).toBeCloseTo(m0.kwPorU * 1.1, 10);
    const e = efeitosDos([], { radiador: 3, tanque: 5 });
    expect(e.dissipacaoRadiador).toBeCloseTo(efeitosDos([]).dissipacaoRadiador * 1.3, 10);
    expect(e.capacidadeTanqueU).toBeCloseTo(efeitosDos([]).capacidadeTanqueU * 1.5, 10);
  });

  it("os nós de era multiplicam por cima do nível (Heliostato de dois eixos)", () => {
    const soNo = efeitosDos(["heliostatoDoisEixos"]);
    const noENivel = efeitosDos(["heliostatoDoisEixos"], { heliostato: 2 });
    expect(noENivel.calorPorEspelho).toBeCloseTo(soNo.calorPorEspelho * 1.2, 10);
  });

  it("só com a peça na grade, só da era atual; a Barra de controle não tem nível", () => {
    const s = comTorre(configuracao(5));
    expect(avaliarMelhoria(s, { tipo: "peca", id: "radiador" }).motivo).toBe("Coloque um primeiro");
    expect(avaliarMelhoria(s, { tipo: "peca", id: "vareta" }).motivo).toContain("outra era");
    expect(avaliarMelhoria(estadoLimpo(), heliostato).motivo).toBe("Núcleo bloqueado");
    expect(nivelMaximo({ tipo: "peca", id: "barraControle" })).toBe(0);
  });

  it("Era 2 a nível 2: 6 varetas injetam 120 u/s e T* vai a 100 %; o decaimento acompanha o nominal", () => {
    const grade = gradeVazia(REATOR.ladoInicial);
    for (const i of [6, 7, 8, 16, 0, 4]) grade[i] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
    grade[11] = { tipo: "peca", id: "turbinaAlta" };
    grade[13] = { tipo: "peca", id: "turbinaAlta" };
    const nucleo = { ...nucleoInicial(), era: 2 as const, lado: REATOR.ladoInicial, grade };
    const nivel0 = motorDoNucleo(nucleo, efeitosDos([]));
    expect(nivel0.entradaUs).toBeCloseTo(100, 10);
    expect(equilibrioMotor(nivel0) / nivel0.capacidadeU).toBeCloseTo(0.8333, 3);
    const e2 = efeitosDos([], { vareta: 2 });
    const nivel2 = motorDoNucleo(nucleo, e2);
    expect(nivel2.entradaUs).toBeCloseTo(120, 10);
    expect(equilibrioMotor(nivel2) / nivel2.capacidadeU).toBeCloseTo(1, 10);
    // o decaimento é 7 % do nominal já com o nível (Parte 2 §5.1)
    expect(calorNominalVaretaUs(grade, 6, REATOR.ladoInicial, e2) * VARETA.fracaoDecaimento).toBeCloseTo(24 * 0.07, 10);
  });

  it("torre e piscina: +10 % de dissipação e de capacidade por nível", () => {
    const grade = gradeVazia(REATOR.ladoInicial);
    grade[7] = { tipo: "peca", id: "torreResfriamento" };
    grade[11] = { tipo: "peca", id: "piscina" };
    expect(dissipacaoReatorUs(grade, efeitosDos([], { torreResfriamento: 3 }))).toBeCloseTo(REATOR.dissipacaoTorre * 1.3, 10);
    expect(capacidadeReatorU(grade, efeitosDos([], { piscina: 2 }))).toBeCloseTo(REATOR.capacidadeVasoU + REATOR.capacidadePiscinaU * 1.2, 10);
  });
});

describe("subestações: nível por tipo (§8.5, Parte 2 §3.2)", () => {
  const alvo = { tipo: "subestacao", id: "subestacao" } as const;

  it("custa base × 3^(n+1) × N e dobra o teto de todas; a nova nasce no nível do tipo", () => {
    const s0 = plantar(estadoLimpo(), "subestacao", 2);
    expect(custoProximoNivel(s0, alvo)).toBe(SUBESTACAO.custoBase * 3 * 2);
    const s1 = melhorar(s0, alvo)!;
    expect(s0.creditos - s1.creditos).toBe(SUBESTACAO.custoBase * 3 * 2);
    expect(analisar(s1).subestacoes.map((x) => x.tetoKw)).toEqual([80, 80]);
    const s2 = plantar(s1, "subestacao", 1);
    expect(analisar(s2).subestacoes.map((x) => x.tetoKw)).toEqual([80, 80, 80]);
    expect(custoProximoNivel(s2, alvo)).toBe(SUBESTACAO.custoBase * 9 * 3);
  });

  it("para no nível máximo 3 (320 kW); a offshore para no 2 (tabela de Parte 2 §3.2)", () => {
    const { s } = comprar(plantar(estadoLimpo(), "subestacao", 1), alvo, SUBESTACAO.nivelMax);
    expect(analisar(s).subestacoes[0].tetoKw).toBe(320);
    expect(avaliarMelhoria(s, alvo).motivo).toContain("ponha outra subestação");
    expect(nivelMaximo({ tipo: "subestacao", id: "subestacaoOffshore" })).toBe(2);
    expect(nivelMaximo({ tipo: "subestacao", id: "subestacao138" })).toBe(3);
  });
});

describe("cabos: nível global (§8.5, Parte 2 §3.2)", () => {
  const alvo = { tipo: "cabos" } as const;

  it("sem cabo ligado não há nível; o custo é a soma das rotas × 3^(n+1) e o teto dobra em todos", () => {
    let s = comprarIlha(estadoLimpo(), "ventania")!;
    expect(avaliarMelhoria(s, alvo).motivo).toBe("Ligue um cabo primeiro");
    s = ligarCabo(s, "ventania")!;
    expect(custoProximoNivel(s, alvo)).toBe(custoCabo("ventania") * CABO.custoNivel);
    s = melhorar(s, alvo)!;
    expect(s.melhorias.cabos).toBe(1);
    // o cabo novo nasce no nível global
    s = ligarCabo(comprarIlha(s, "solar")!, "solar")!;
    expect(analisar(s).cabos.map((c) => c.tetoKw)).toEqual([CABO.tetoKw * 2, CABO.tetoKw * 2]);
    expect(custoProximoNivel(s, alvo)).toBe((custoCabo("ventania") + custoCabo("solar")) * 9);
    expect(nivelMaximo(alvo)).toBeNull();
  });
});

describe("ciência: nível por tipo (v0.9, §7.1)", () => {
  const alvo = { tipo: "ciencia", id: "laboratorio" } as const;

  it("custa base × 3^(n+1) × N e rende +25 % de 🔬 por nível, até o 5", () => {
    const s0 = plantar(estadoLimpo(), "laboratorio", 2);
    expect(analisar(s0).pesquisaPorSegundo).toBeCloseTo(2 * LABORATORIO.pesquisaPorSegundo, 10);
    expect(custoProximoNivel(s0, alvo)).toBe(LABORATORIO.custoBase * 3 * 2);
    const { s, custos } = comprar(s0, alvo, NIVEL_CIENCIA.maximo);
    expect(custos[0]).toBe(360);
    expect(analisar(s).pesquisaPorSegundo).toBeCloseTo(2 * LABORATORIO.pesquisaPorSegundo * 2.25, 10);
    expect(avaliarMelhoria(s, alvo).motivo).toContain("Nível máximo");
  });
});

describe("caches: os níveis entram nos efeitos e na análise sem cálculo à toa", () => {
  it("nível de peça troca os efeitos; nível de usina não", () => {
    const s = { ...plantar(estadoLimpo(), "cataVento", 1), nucleo: { ...nucleoInicial(), grade: configuracao(5) } };
    const e0 = efeitosDe(s);
    const comUsina = melhorar(s, { tipo: "usina", id: "cataVento" })!;
    expect(efeitosDe(comUsina)).toBe(e0);
    const comPeca = melhorar(s, { tipo: "peca", id: "heliostato" })!;
    expect(efeitosDe(comPeca)).not.toBe(e0);
    // e a análise do mundo percebe o nível da usina sem o mundo mudar
    expect(analisar(comUsina).brutoKw).toBeGreaterThan(analisar(s).brutoKw);
  });
});

describe("save v8 → v9: níveis por unidade viram nível do tipo", () => {
  it("usinas vão para melhorias; subestações e cabos nascem no maior nível que tinham", () => {
    const base = plantar(estadoLimpo(), "subestacao", 3);
    const casas = Object.keys(base.mundo.construcoes).map(Number);
    const v9 = JSON.parse(serializar(base, 1000));
    const { melhorias: _m, ...resto } = v9;
    const v8 = {
      ...resto,
      versao: 8,
      rede: { usinas: { cataVento: { nivel: 7 }, painelSolar: { nivel: 2 }, turbinaEolica: { nivel: 0 } }, bateria: { kwh: 3 } },
      mundo: {
        ...v9.mundo,
        ilhasAbertas: ["principal", "ventania", "solar"],
        cabos: { ventania: 2, solar: 1 },
        construcoes: {
          ...v9.mundo.construcoes,
          [casas[0]]: { tipo: "subestacao", nivel: 2, colocadoEmMs: 0 },
          [casas[1]]: { tipo: "subestacao", nivel: 1, colocadoEmMs: 0 },
          [casas[2]]: { tipo: "subestacao", nivel: 0, colocadoEmMs: 0 },
        },
      },
    };
    const s = desserializar(JSON.stringify(v8), 1000);
    expect(s.melhorias.usinas.cataVento).toBe(7); // acima do máximo novo: fica, só não sobe mais
    expect(avaliarMelhoria({ ...s, creditos: 1e12 }, { tipo: "usina", id: "cataVento" }).motivo ?? "").toMatch(/Coloque|Nível máximo/);
    expect(s.melhorias.usinas.painelSolar).toBe(2);
    expect(s.melhorias.subestacoes.subestacao).toBe(2);
    for (const i of casas) expect(s.mundo.construcoes[i].nivel).toBe(0);
    expect(s.melhorias.cabos).toBe(2);
    expect(s.mundo.cabos).toEqual({ ventania: 0, solar: 0 });
    expect(Object.values(s.melhorias.pecas).every((n) => n === 0)).toBe(true);
    expect(s.rede.bateria.kwh).toBe(3);
  });

  it("um nível de subestação acima do máximo é cortado no máximo", () => {
    const v9 = JSON.parse(serializar(estadoLimpo(), 1000));
    const s = desserializar(JSON.stringify({ ...v9, melhorias: { ...v9.melhorias, subestacoes: { subestacao: 6, subestacao138: 9, subestacaoOffshore: 4 } } }), 1000);
    expect(s.melhorias.subestacoes).toEqual({ subestacao: 3, subestacao138: 3, subestacaoOffshore: 2 });
  });

  it("colocar uma subestação não mexe no nível do tipo", () => {
    const s0 = plantar(estadoLimpo(), "subestacao", 1);
    const s1 = melhorar(s0, { tipo: "subestacao", id: "subestacao" })!;
    const livre = Object.keys(plantar(estadoLimpo(), "subestacao", 2).mundo.construcoes).map(Number).find((i) => !s1.mundo.construcoes[i])!;
    const s2 = colocar(s1, livre, "subestacao")!;
    expect(s2.mundo.construcoes[livre].nivel).toBe(0);
    expect(s2.melhorias.subestacoes.subestacao).toBe(1);
  });
});
