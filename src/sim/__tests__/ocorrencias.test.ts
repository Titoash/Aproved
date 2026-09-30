/**
 * Ocorrências (GDD Parte 1 §4.4 e Parte 2 §5.4, v0.9). As duas tabelas viram teste, no espírito da regra 2 do
 * `CLAUDE.md`: a coluna "Sem mexer no controle" com o controle parado em 100 %, e a "Resposta" com o controle
 * **acompanhando a rampa** (`controleQueCompensa` a cada tick) e o modo seguro desligado — a Resposta vale para
 * o trecho estável; parado no valor do platô desde o aceite o controle pode passar do ponto na rampa.
 */
import { describe, expect, it } from "vitest";
import { CONTROLE, OCORRENCIAS, OCORRENCIAS_DEF, type OcorrenciaId } from "../../content/ocorrencias";
import { REATOR } from "../../content/era2-nucleo";
import { faixaDeCalor, pesquisaPorSegundo, temperatura, temperaturaNucleo } from "../calor";
import { efeitosDe } from "../efeitos";
import { equilibrioMotor, motorDoNucleo, potenciaMotor } from "../motor";
import { equilibrioU } from "../nucleo";
import {
  aceitarOcorrencia,
  ajustarControle,
  candidatas,
  comControle,
  controleQueCompensa,
  escolherRecompensa,
  fracaoDoPerfil,
  ganhavel,
  multiplicadoresDaPerturbacao,
  multiplicadoresDoEstado,
  recusarOcorrencia,
} from "../ocorrencias";
import { calcularOffline } from "../offline";
import { analisar } from "../producao";
import { desserializar, serializar } from "../save";
import { scramManual } from "../acoesNucleo";
import { nucleoInicial, gradeVazia, type Casa, type EventoJogo, type GameState, type NucleoState, type PecaId } from "../state";
import { tick, TICK_MS } from "../tick";
import { varetaNova } from "../reator";
import { estadoLimpo, plantar } from "./ajuda";
import { configuracao } from "./nucleo.test";

/* ------------------------------------------------------------------ */
/* Montagem                                                            */
/* ------------------------------------------------------------------ */

/** Torre com `h` espelhos efetivos e 2 turbinas (GDD §8.3), no equilíbrio, com a Estabilidade em 50. */
function torre(grade: Casa[], extra: Partial<NucleoState> = {}): GameState {
  const s = estadoLimpo();
  return { ...s, nucleo: { ...nucleoInicial(), grade, calorU: equilibrioU(grade), estabilidade: 50, ...extra } };
}

/** Reator com varetas nas casas dadas e 2 turbinas (11 e 13), no equilíbrio. A clássica de §5.3: 4 + 2 varetas. */
function reator(opcoes: { varetas?: number[]; gastas?: number[]; torres?: number[] } = {}, tempoMs = 0): GameState {
  const grade = gradeVazia(REATOR.ladoInicial);
  const por = (casas: number[], id: PecaId, vareta = false) => {
    for (const i of casas) grade[i] = vareta ? { tipo: "peca", id, vareta: varetaNova() } : { tipo: "peca", id };
  };
  por(opcoes.varetas ?? [6, 7, 8, 16, 0, 4], "vareta", true);
  por([11, 13], "turbinaAlta");
  por(opcoes.torres ?? [], "torreResfriamento");
  for (const i of opcoes.gastas ?? []) grade[i] = { tipo: "peca", id: "vareta", vareta: { restanteS: 0, gastaDesdeMs: tempoMs } };
  const nucleo: NucleoState = { ...nucleoInicial(), era: 2, lado: REATOR.ladoInicial, grade, estabilidade: 50 };
  const s: GameState = { ...estadoLimpo(), era: 2, tempoMs, nucleo };
  const m = motorDoNucleo(nucleo, efeitosDe(s), tempoMs);
  return { ...s, nucleo: { ...nucleo, calorU: equilibrioMotor(m) } };
}

/** Põe a oferta na mesa (como o sorteio faria) e aceita. */
function aceita(s: GameState, id: OcorrenciaId): GameState {
  const comOferta: GameState = {
    ...s,
    ocorrencia: { ...s.ocorrencia, primeiraOfertaFeita: true, atual: { id, fase: "oferta", inicioMs: s.tempoMs, controle: 1, naMetaMs: 0, potenciaRefKw: 0, aposScram: false } },
  };
  const aceito = aceitarOcorrencia(comOferta);
  if (!aceito) throw new Error(`não aceitou ${id}`);
  return aceito;
}

interface Corrida {
  s: GameState;
  superada: boolean | null;
  eventos: EventoJogo[];
  /** Maior `T` visto durante a Ocorrência. */
  tMax: number;
  /** `T` no meio do platô. */
  tPlato: number;
  controlePlato: number;
  /** Tempo na meta (fração da duração) visto no último tick antes do fim. */
  fracaoNaMeta: number;
  ticks: number;
}

/**
 * Roda a Ocorrência ativa até o fim. `modo`: "parado" deixa o controle onde está; "acompanha" põe, antes de
 * cada tick, o controle que compensa a perturbação daquele instante; um número fixa o controle desde o aceite.
 */
function correr(s0: GameState, modo: "parado" | "acompanha" | number): Corrida {
  let s = typeof modo === "number" ? ajustarControle(s0, modo)! : s0;
  const a0 = s.ocorrencia.atual!;
  const def = OCORRENCIAS_DEF[a0.id];
  const meioPlatoMs = a0.inicioMs + ((def.perfil.entradaS + (def.duracaoS - def.perfil.saidaS)) / 2) * 1000;
  const eventos: EventoJogo[] = [];
  let superada: boolean | null = null;
  let tMax = 0;
  let tPlato = NaN;
  let controlePlato = NaN;
  let naMetaMs = 0;
  let ticks = 0;
  while (s.ocorrencia.atual?.fase === "ativa" && ticks < 2000) {
    if (modo === "acompanha") s = ajustarControle(s, controleQueCompensa(s, s.tempoMs + TICK_MS)) ?? s;
    s = tick(s, TICK_MS);
    ticks++;
    eventos.push(...s.eventos);
    const t = temperaturaNucleo(s.nucleo!, efeitosDe(s));
    tMax = Math.max(tMax, t);
    if (Number.isNaN(tPlato) && s.tempoMs >= meioPlatoMs) {
      tPlato = t;
      controlePlato = s.ocorrencia.atual?.controle ?? NaN;
    }
    for (const e of s.eventos) if (e.tipo === "ocorrenciaTerminou") superada = e.superada;
    if (s.ocorrencia.atual) naMetaMs = s.ocorrencia.atual.naMetaMs;
  }
  return { s, superada, eventos, tMax, tPlato, controlePlato, fracaoNaMeta: naMetaMs / (def.duracaoS * 1000), ticks };
}

/** `Q*` no platô da perturbação com o controle `c`. */
function qPlato(s: GameState, id: OcorrenciaId, c: number): number {
  const n = s.nucleo!;
  const def = OCORRENCIAS_DEF[id];
  const turbinas = n.era === 2 ? 2 : 2;
  const mult = comControle(multiplicadoresDaPerturbacao(def, 1, turbinas), n.era, c);
  return equilibrioMotor(motorDoNucleo(n, efeitosDe(s), s.tempoMs, mult));
}

/* ------------------------------------------------------------------ */
/* Teste obrigatório da Sessão 10                                      */
/* ------------------------------------------------------------------ */

describe("teste obrigatório da Sessão 10", () => {
  it("h = 5, t = 2: a Nuvem com a carga em 100 % tira T do ouro (Q* = 50) e não é superada; com a carga em 60 % Q* volta a 83,3 e é superada", () => {
    const s = torre(configuracao(5));
    expect(qPlato(s, "nuvem", 1)).toBeCloseTo(50, 6);
    expect(qPlato(s, "nuvem", 0.6)).toBeCloseTo(83.333, 2);

    const parado = correr(aceita(s, "nuvem"), "parado");
    expect(parado.superada).toBe(false);
    expect(faixaDeCalor(parado.tPlato).id).not.toBe("ouro");
    expect(parado.tPlato).toBeCloseTo(0.5, 2);

    const acompanha = correr(aceita(s, "nuvem"), "acompanha");
    expect(acompanha.controlePlato).toBeCloseTo(0.6, 6);
    expect(acompanha.tPlato).toBeCloseTo(0.833, 2);
    expect(acompanha.superada).toBe(true);
    expect(acompanha.s.ocorrencia.recompensa?.id).toBe("nuvem");
  });

  it("a Turbina em meia carga da Era 1, sem mexer no controle, dispara a Cascata 5 s depois de T passar de 100 % (Q* = 111,1)", () => {
    const s0 = torre(configuracao(5));
    expect(qPlato(s0, "turbinaMeiaCargaTorre", 1)).toBeCloseTo(111.111, 2);
    let s = aceita(s0, "turbinaMeiaCargaTorre");
    let passouMs: number | null = null;
    let cascataMs: number | null = null;
    let superada: boolean | null = null;
    for (let i = 0; i < 400 && cascataMs === null; i++) {
      s = tick(s, TICK_MS);
      if (passouMs === null && temperaturaNucleo(s.nucleo!) > 1) passouMs = s.tempoMs;
      if (s.nucleo!.cascatas > 0) cascataMs = s.tempoMs;
      for (const e of s.eventos) if (e.tipo === "ocorrenciaTerminou") superada = e.superada;
    }
    expect(passouMs).not.toBeNull();
    expect(cascataMs).not.toBeNull();
    expect(Math.abs((cascataMs! - passouMs!) / 1000 - 5)).toBeLessThanOrEqual(0.1);
    // A Cascata reprova a meta na hora: a Ocorrência termina sem ser superada.
    expect(superada).toBe(false);
    expect(s.ocorrencia.atual).toBeNull();
  });

  it("Era 2: a Turbina em meia carga com as barras em potência 75 % devolve Q* = 416,7; barras e Xenônio não mexem no decaimento de uma vareta gasta", () => {
    const s = reator();
    expect(qPlato(s, "turbinaMeiaCargaReator", 1)).toBeCloseTo(555.556, 2);
    expect(qPlato(s, "turbinaMeiaCargaReator", 0.75)).toBeCloseTo(416.667, 2);

    // Uma vareta gasta há 30 s no anel 2 (casa 20), com as outras seis ativas.
    const comGasta = reator({ gastas: [20] }, 30_000);
    const n = comGasta.nucleo!;
    const efeitos = efeitosDe(comGasta);
    const neutro = motorDoNucleo(n, efeitos, 60_000);
    expect(neutro.decaimentoUs).toBeGreaterThan(0);
    const xenonio = multiplicadoresDaPerturbacao(OCORRENCIAS_DEF.xenonio, 1, 2);
    for (const mult of [comControle(xenonio, 2, 1), comControle(xenonio, 2, 1.25), comControle(multiplicadoresDaPerturbacao(OCORRENCIAS_DEF.turbinaMeiaCargaReator, 1, 2), 2, 0.5)]) {
      const m = motorDoNucleo(n, efeitos, 60_000, mult);
      expect(m.decaimentoUs).toBe(neutro.decaimentoUs);
      expect(m.entradaAtivaUs).toBeCloseTo(neutro.entradaAtivaUs * mult.entrada, 9);
      expect(m.entradaUs).toBeCloseTo(neutro.entradaAtivaUs * mult.entrada + neutro.decaimentoUs, 9);
    }
  });

  it("h = 8 (anel 1: 4 heliostatos, 2 turbinas, 2 radiadores; anel 2: 8 heliostatos), t = 2: a Nuvem não é sorteada", () => {
    const grade = configuracao(8, { radiadores: 2 });
    const s = torre(grade);
    expect(equilibrioU(grade)).toBeCloseTo(83.333, 2);
    // Com a carga no mínimo (50 %) o platô da Nuvem ainda deixa T em 60 %: a carga precisaria descer a 37,5 %.
    expect(qPlato(s, "nuvem", CONTROLE[1].min)).toBeCloseTo(60, 6);
    expect(ganhavel(s, "nuvem")).toBe(false);
    expect(candidatas(s)).not.toContain("nuvem");
    expect(candidatas(s).length).toBeGreaterThan(0);
    // Nem na primeira oferta do save (que prefere a Nuvem), nem em vinte sorteios seguidos.
    let atual: GameState = { ...s, ocorrencia: { ...s.ocorrencia, relogioMs: OCORRENCIAS.intervaloMs - TICK_MS } };
    for (let k = 0; k < 20; k++) {
      atual = tick(atual, TICK_MS);
      const oferta = atual.ocorrencia.atual;
      expect(oferta).not.toBeNull();
      expect(oferta!.id).not.toBe("nuvem");
      atual = { ...recusarOcorrencia(atual)!, ocorrencia: { ...recusarOcorrencia(atual)!.ocorrencia, relogioMs: OCORRENCIAS.intervaloMs - TICK_MS } };
    }
  });
});

/* ------------------------------------------------------------------ */
/* Tabelas                                                             */
/* ------------------------------------------------------------------ */

describe("tabela da Era 1 (Parte 1 §4.4): h = 5, t = 2, T* = 83 %", () => {
  const s = torre(configuracao(5));

  it("Nuvem: entrada ×0,6; sem mexer Q* = 50; carga 60 % devolve 83 %", () => {
    expect(qPlato(s, "nuvem", 1)).toBeCloseTo(50, 6);
    expect(qPlato(s, "nuvem", 0.6)).toBeCloseTo(83.333, 2);
  });

  it("Céu limpo e frio: entrada ×1,25; sem mexer Q* = 104,2 (Cascata); carga 125 % devolve 83 %", () => {
    expect(qPlato(s, "ceuLimpoFrio", 1)).toBeCloseTo(104.167, 2);
    expect(qPlato(s, "ceuLimpoFrio", 1.25)).toBeCloseTo(83.333, 2);
    const parado = correr(aceita(s, "ceuLimpoFrio"), "parado");
    expect(parado.s.nucleo!.cascatas).toBe(1);
    expect(parado.superada).toBe(false);
    const acompanha = correr(aceita(s, "ceuLimpoFrio"), "acompanha");
    expect(acompanha.controlePlato).toBeCloseTo(1.25, 6);
    expect(acompanha.superada).toBe(true);
    expect(acompanha.s.nucleo!.cascatas).toBe(0);
  });

  it("Turbina em meia carga: 1,5 turbina; sem mexer Q* = 111,1; carga 133 % devolve 83 %", () => {
    expect(qPlato(s, "turbinaMeiaCargaTorre", 1)).toBeCloseTo(111.111, 2);
    expect(qPlato(s, "turbinaMeiaCargaTorre", 4 / 3)).toBeCloseTo(83.333, 2);
    const acompanha = correr(aceita(s, "turbinaMeiaCargaTorre"), "acompanha");
    expect(acompanha.controlePlato).toBeCloseTo(4 / 3, 6);
    expect(acompanha.superada).toBe(true);
  });

  it("em equilíbrio a carga não muda a potência: continua 0,8 kW por u que entra", () => {
    const n = s.nucleo!;
    const efeitos = efeitosDe(s);
    const nuvem = multiplicadoresDaPerturbacao(OCORRENCIAS_DEF.nuvem, 1, 2);
    for (const c of [0.5, 0.6, 1, 1.5]) {
      const m = motorDoNucleo(n, efeitos, 0, comControle(nuvem, 1, c));
      expect(potenciaMotor(m, equilibrioMotor(m))).toBeCloseTo(m.entradaUs * 0.8, 9);
    }
  });
});

describe("tabela da Era 2 (Parte 2 §5.4): 6 varetas (4 + 2), 2 turbinas, Q* = 416,7, 800 kW", () => {
  const s = reator();

  it("a montagem de referência está em 83 % e 800 kW", () => {
    const m = motorDoNucleo(s.nucleo!, efeitosDe(s), 0);
    expect(equilibrioMotor(m)).toBeCloseTo(416.667, 2);
    expect(potenciaMotor(m, equilibrioMotor(m))).toBeCloseTo(800, 6);
  });

  it("Seguimento de carga: sem mexer fica em 100 % e não supera; barras em 70 % dão 560 kW e T = 58 %", () => {
    const n = s.nucleo!;
    const m70 = motorDoNucleo(n, efeitosDe(s), 0, comControle(multiplicadoresDaPerturbacao(OCORRENCIAS_DEF.seguimentoCarga, 1, 2), 2, 0.7));
    const q70 = equilibrioMotor(m70);
    expect(potenciaMotor(m70, q70)).toBeCloseTo(560, 6);
    expect(temperatura(q70, m70.capacidadeU)).toBeCloseTo(0.583, 3);

    const parado = correr(aceita(s, "seguimentoCarga"), "parado");
    expect(parado.superada).toBe(false);
    expect(parado.s.nucleo!.cascatas).toBe(0);
    const acompanha = correr(aceita(s, "seguimentoCarga"), "acompanha");
    expect(acompanha.controlePlato).toBeCloseTo(0.7, 6);
    expect(acompanha.superada).toBe(true);
  });

  it("Xenônio: injeção ativa ×0,8; sem mexer Q* = 333,3 e T = 67 % (sai do ouro); potência 110–120 % devolve o ouro", () => {
    expect(qPlato(s, "xenonio", 1)).toBeCloseTo(333.333, 2);
    expect(temperatura(qPlato(s, "xenonio", 1), 500)).toBeCloseTo(0.667, 3);
    for (const p of [1.1, 1.2]) expect(faixaDeCalor(temperatura(qPlato(s, "xenonio", p), 500)).id).toBe("ouro");
    expect(correr(aceita(s, "xenonio"), "parado").superada).toBe(false);
    const acompanha = correr(aceita(s, "xenonio"), "acompanha");
    expect(acompanha.controlePlato).toBeCloseTo(1.25, 6);
    expect(acompanha.superada).toBe(true);
  });

  it("Xenônio com as barras paradas em 125 % desde o aceite: passam de 90 % nas rampas e ficam só 69 % no ouro", () => {
    const fixo = correr(aceita(s, "xenonio"), 1.25);
    expect(fixo.tMax).toBeGreaterThan(0.9);
    expect(fixo.fracaoNaMeta).toBeCloseTo(0.69, 2);
    expect(fixo.superada).toBe(false);
  });

  it("Turbina em meia carga: sem mexer Q* = 555,6 e T = 111 % (Cascata); potência 75 % devolve 83 %", () => {
    expect(qPlato(s, "turbinaMeiaCargaReator", 1)).toBeCloseTo(555.556, 2);
    const parado = correr(aceita(s, "turbinaMeiaCargaReator"), "parado");
    expect(parado.s.nucleo!.cascatas).toBe(1);
    expect(parado.superada).toBe(false);
    const acompanha = correr(aceita(s, "turbinaMeiaCargaReator"), "acompanha");
    expect(acompanha.controlePlato).toBeCloseTo(0.75, 6);
    expect(acompanha.superada).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Regras                                                              */
/* ------------------------------------------------------------------ */

/** Estado com o relógio a um tick de completar os 4 min. */
function quaseNaHora(s: GameState): GameState {
  return { ...s, ocorrencia: { ...s.ocorrencia, relogioMs: OCORRENCIAS.intervaloMs - TICK_MS } };
}

describe("oferta, relógio e sorteio", () => {
  it("o perfil tem rampas de 5 s (Xenônio: 15/30/15) e a perturbação sai inteira no platô", () => {
    const nuvem = OCORRENCIAS_DEF.nuvem;
    expect(fracaoDoPerfil(nuvem, 0)).toBe(0);
    expect(fracaoDoPerfil(nuvem, 2500)).toBeCloseTo(0.5, 9);
    expect(fracaoDoPerfil(nuvem, 20_000)).toBe(1);
    expect(fracaoDoPerfil(nuvem, 42_500)).toBeCloseTo(0.5, 9);
    expect(fracaoDoPerfil(nuvem, 45_000)).toBe(0);
    const xe = OCORRENCIAS_DEF.xenonio;
    expect(fracaoDoPerfil(xe, 7500)).toBeCloseTo(0.5, 9);
    expect(fracaoDoPerfil(xe, 30_000)).toBe(1);
    expect(fracaoDoPerfil(xe, 52_500)).toBeCloseTo(0.5, 9);
  });

  it("a oferta sai aos 4 min de jogo ativo; a primeira do save é a Nuvem; ela expira em 60 s e o relógio recomeça", () => {
    let s = torre(configuracao(5));
    for (let i = 0; i < OCORRENCIAS.intervaloMs / TICK_MS - 1; i++) s = tick(s, TICK_MS);
    expect(s.ocorrencia.atual).toBeNull();
    s = tick(s, TICK_MS);
    expect(s.ocorrencia.atual).toMatchObject({ id: "nuvem", fase: "oferta" });
    expect(s.eventos).toContainEqual({ tipo: "ocorrenciaOferecida", id: "nuvem" });
    expect(s.ocorrencia.primeiraOfertaFeita).toBe(true);
    // Deixar expirar não custa nada: a Estabilidade e a pesquisa seguem como sem Ocorrência.
    for (let i = 0; i < OCORRENCIAS.janelaOfertaMs / TICK_MS; i++) s = tick(s, TICK_MS);
    expect(s.ocorrencia.atual).toBeNull();
    expect(s.ocorrencia.relogioMs).toBe(0);
    s = tick(s, TICK_MS);
    expect(s.ocorrencia.relogioMs).toBe(TICK_MS);
  });

  it("recusar não muda nada além de recomeçar o relógio", () => {
    const s = tick(quaseNaHora(torre(configuracao(5))), TICK_MS);
    expect(s.ocorrencia.atual?.fase).toBe("oferta");
    const r = recusarOcorrencia(s)!;
    expect(r.ocorrencia.atual).toBeNull();
    expect(r.ocorrencia.relogioMs).toBe(0);
    expect({ ...r, ocorrencia: null }).toEqual({ ...s, ocorrencia: null });
    // O motor fica igual ao de quem nunca teve a oferta.
    expect(multiplicadoresDoEstado(r)).toEqual({ entrada: 1, dissipacao: 1, turbina: 1 });
  });

  it("o relógio recomeça ao fim da Ocorrência, superada ou não, e não anda com a recompensa por escolher", () => {
    const fim = correr(aceita(torre(configuracao(5)), "nuvem"), "acompanha");
    expect(fim.superada).toBe(true);
    expect(fim.s.ocorrencia.relogioMs).toBe(0);
    let s = fim.s;
    for (let i = 0; i < 50; i++) s = tick(s, TICK_MS);
    expect(s.ocorrencia.relogioMs).toBe(0);
    s = escolherRecompensa(s, "pesquisa")!;
    s = tick(s, TICK_MS);
    expect(s.ocorrencia.relogioMs).toBe(TICK_MS);

    const falhou = correr(aceita(torre(configuracao(5)), "nuvem"), "parado");
    expect(falhou.superada).toBe(false);
    expect(falhou.s.ocorrencia.relogioMs).toBe(0);
    expect(falhou.s.ocorrencia.recompensa).toBeNull();
  });

  it("o sorteio é determinístico: a mesma semente dá a mesma sequência", () => {
    const sequencia = (semente: number) => {
      let s: GameState = torre(configuracao(5));
      s = { ...s, ocorrencia: { ...s.ocorrencia, semente, primeiraOfertaFeita: true } };
      const ids: string[] = [];
      for (let k = 0; k < 12; k++) {
        s = tick(quaseNaHora(s), TICK_MS);
        ids.push(s.ocorrencia.atual!.id);
        s = recusarOcorrencia(s)!;
      }
      return ids;
    };
    expect(sequencia(123)).toEqual(sequencia(123));
    expect(new Set(sequencia(123)).size).toBeGreaterThan(1);
    expect(sequencia(123)).not.toEqual(sequencia(987_654));
  });

  it("nenhuma oferta sai em SCRAM, sem turbina ou com o Núcleo bloqueado; a oferta pendente some no SCRAM", () => {
    const base = torre(configuracao(5));
    const emScram = scramManual(quaseNaHora(base))!;
    expect(tick(emScram, TICK_MS).ocorrencia.atual).toBeNull();
    const semTurbina = quaseNaHora(torre(configuracao(5).map((c) => (c?.tipo === "peca" && c.id === "turbina" ? null : c))));
    expect(tick(semTurbina, TICK_MS).ocorrencia.atual).toBeNull();
    const bloqueado = quaseNaHora({ ...estadoLimpo(), nucleo: null });
    expect(tick(bloqueado, TICK_MS).ocorrencia).toEqual(bloqueado.ocorrencia);
    // A oferta que já estava na mesa some quando o Núcleo entra em SCRAM.
    const oferta = tick(quaseNaHora(base), TICK_MS);
    expect(oferta.ocorrencia.atual?.fase).toBe("oferta");
    expect(tick(scramManual(oferta)!, TICK_MS).ocorrencia.atual).toBeNull();
  });

  it("depois de um SCRAM na Era 2 a próxima oferta é o Xenônio, e o cartão diz a causa", () => {
    let s = reator();
    s = { ...s, ocorrencia: { ...s.ocorrencia, primeiraOfertaFeita: true, semente: 5 } };
    s = scramManual(s)!;
    s = tick(s, TICK_MS);
    expect(s.ocorrencia.xenonioPendente).toBe(true);
    // Espera o SCRAM acabar (90 s) com o relógio já cheio: a oferta sai assim que o Núcleo volta.
    s = quaseNaHora(s);
    for (let i = 0; i < 2000 && !s.ocorrencia.atual; i++) s = tick(s, TICK_MS);
    expect(s.ocorrencia.atual).toMatchObject({ id: "xenonio", aposScram: true });
    expect(s.ocorrencia.xenonioPendente).toBe(false);
  });
});

describe("meta, recompensa e offline", () => {
  it("a recompensa em 🔬 é 60 s da 🔬/s total no instante em que a Ocorrência é superada", () => {
    const fim = correr(aceita(torre(configuracao(5)), "nuvem"), "acompanha");
    const s = fim.s;
    const efeitos = efeitosDe(s);
    const motor = motorDoNucleo(s.nucleo!, efeitos, s.tempoMs);
    // O tick guarda a 🔬/s do próprio tick; o Q do fim do tick anda muito pouco, então a conta fecha perto.
    const porSegundo = pesquisaPorSegundo(potenciaMotor(motor, s.nucleo!.calorU), temperaturaNucleo(s.nucleo!, efeitos), motor.pesquisaPorKw) + analisar(s).pesquisaPorSegundo;
    expect(s.ocorrencia.recompensa!.pesquisa).toBeCloseTo(60 * porSegundo, 0);
    const antes = s.pesquisa;
    const depois = escolherRecompensa(s, "pesquisa")!;
    expect(depois.pesquisa).toBeCloseTo(antes + s.ocorrencia.recompensa!.pesquisa, 9);
    expect(depois.nucleo!.estabilidade).toBe(s.nucleo!.estabilidade);
    expect(depois.eventos.at(-1)).toMatchObject({ tipo: "recompensaEscolhida", recompensa: "pesquisa" });
    // Proporcional à produção total: um laboratório a mais soma os 60 s da 🔬/s dele à recompensa.
    const comLab = correr(aceita(plantar(torre(configuracao(5)), "laboratorio", 1), "nuvem"), "acompanha").s;
    const doLab = analisar(comLab).pesquisaPorSegundo;
    expect(doLab).toBeGreaterThan(0);
    expect(comLab.ocorrencia.recompensa!.pesquisa - s.ocorrencia.recompensa!.pesquisa).toBeCloseTo(60 * doLab, 6);
  });

  it("🛡 +3 sem passar de 100", () => {
    const fim = correr(aceita(torre(configuracao(5)), "nuvem"), "acompanha").s;
    const e = fim.nucleo!.estabilidade;
    expect(escolherRecompensa(fim, "estabilidade")!.nucleo!.estabilidade).toBeCloseTo(e + 3, 9);
    const quaseCheia = { ...fim, nucleo: { ...fim.nucleo!, estabilidade: 99 } };
    expect(escolherRecompensa(quaseCheia, "estabilidade")!.nucleo!.estabilidade).toBe(100);
    expect(escolherRecompensa(escolherRecompensa(fim, "estabilidade")!, "estabilidade")).toBeNull();
  });

  it("o SCRAM automático do modo seguro a 95 % reprova a meta", () => {
    const s = torre(configuracao(5), { modoSeguro: true });
    const r = correr(aceita(s, "ceuLimpoFrio"), "parado");
    expect(r.superada).toBe(false);
    expect(r.s.nucleo!.scramRestanteMs).toBeGreaterThan(0);
  });

  it("o offline descarta a oferta e a Ocorrência em curso sem recompensa, e o relógio não anda", () => {
    const s = torre(configuracao(5));
    const ativa = { ...aceita(s, "nuvem"), salvoEmMs: 1_000_000 };
    const volta = calcularOffline(ativa, 1_000_000 + 30 * 60_000).state;
    expect(volta.ocorrencia.atual).toBeNull();
    expect(volta.ocorrencia.recompensa).toBeNull();
    expect(volta.ocorrencia.relogioMs).toBe(0);
    expect(multiplicadoresDoEstado(volta)).toEqual({ entrada: 1, dissipacao: 1, turbina: 1 });
    // Sem nada na mesa, o relógio fica onde estava: 30 min fora não contam como jogo ativo.
    const parado = { ...s, salvoEmMs: 1_000_000, ocorrencia: { ...s.ocorrencia, relogioMs: 90_000 } };
    expect(calcularOffline(parado, 1_000_000 + 30 * 60_000).state.ocorrencia.relogioMs).toBe(90_000);
  });

  it("as taxas novas de Estabilidade valem também no offline, com o fator ×0,7", () => {
    // T* ≈ 58 % (normal): 1,2/min × 0,7 × 10 min = 8,4.
    const s = { ...torre(configuracao(3.5)), salvoEmMs: 1_000_000 };
    const { relatorio } = calcularOffline(s, 1_000_000 + 10 * 60_000);
    expect(faixaDeCalor(relatorio.tEquilibrio!).id).toBe("normal");
    expect(relatorio.estabilidade).toBeCloseTo(8.4, 6);
  });
});

describe("save v10", () => {
  it("migra do v9 sem Ocorrência, com o relógio zerado e a primeira oferta por sair", () => {
    const v9 = JSON.parse(serializar(torre(configuracao(5)), 5000));
    delete v9.ocorrencia;
    v9.versao = 9;
    const s = desserializar(JSON.stringify(v9), 5000);
    expect(s.versao).toBe(10);
    expect(s.ocorrencia).toMatchObject({ relogioMs: 0, primeiraOfertaFeita: false, atual: null, recompensa: null });
  });

  it("um save que chega à v10 já na Era 2 recebe primeiro o Xenônio", () => {
    const v9 = JSON.parse(serializar(reator(), 5000));
    delete v9.ocorrencia;
    v9.versao = 9;
    let s = desserializar(JSON.stringify(v9), 5000);
    s = tick(quaseNaHora(s), TICK_MS);
    expect(s.ocorrencia.atual?.id).toBe("xenonio");
  });

  it("guarda o relógio, a semente e a recompensa pendente na ida e na volta", () => {
    const fim = correr(aceita(torre(configuracao(5)), "nuvem"), "acompanha").s;
    const volta = desserializar(serializar(fim, 5000), 5000);
    expect(volta.ocorrencia).toEqual(fim.ocorrencia);
  });
});
