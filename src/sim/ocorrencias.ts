/**
 * Ocorrências (GDD Parte 1 §4.4 e Parte 2 §5.4, v0.9): o sub-jogo opcional de operação do Núcleo.
 * TypeScript puro.
 *
 * A cada 4 min de jogo ativo o sim sorteia uma Ocorrência que a grade atual pode ganhar e a oferece por 60 s.
 * Quem aceita opera **um controle só** (carga das turbinas na Era 1, potência das varetas ativas na Era 2)
 * contra uma perturbação do motor e ganha 🛡 +3 ou 60 s de 🔬 se segurar a meta em 75 % da duração. A
 * perturbação e o controle entram no motor como multiplicadores (`MultiplicadoresMotor`): nenhuma fórmula
 * de §4.2, §8.3 ou Parte 2 §5 muda. Nunca offline e nunca automática.
 */
import { CONTROLE, OCORRENCIAS, OCORRENCIAS_DA_ERA, OCORRENCIAS_DEF, OCORRENCIA_APOS_SCRAM, PRIMEIRA_OCORRENCIA } from "../content/ocorrencias";
import type { OcorrenciaDef, OcorrenciaId } from "../content/ocorrencias";
import { rnd } from "./aleatorio";
import { faixaDeCalor, temperatura } from "./calor";
import { efeitosDe, type EfeitosArvore } from "./efeitos";
import { limitarEstabilidade } from "./estabilidade";
import { equilibrioMotor, motorDoNucleo, MULTIPLICADORES_NEUTROS, potenciaMotor, type MotorCalor, type MultiplicadoresMotor } from "./motor";
import { contar } from "./nucleo";
import { contarReator } from "./reator";
import type { EventoJogo, GameState, NucleoState, OcorrenciaEmCurso, OcorrenciasState } from "./state";

/* ------------------------------------------------------------------ */
/* Perfil e multiplicadores                                            */
/* ------------------------------------------------------------------ */

/** Turbinas que contam no motor (adjacentes ao componente crítico), na era do Núcleo. */
export function turbinasDo(nucleo: NucleoState): number {
  return nucleo.era === 2 ? contarReator(nucleo.grade).turbinas : contar(nucleo.grade).turbinas;
}

/**
 * Quanto da perturbação vale `decorridoMs` depois do aceite: sobe de 0 a 1 na rampa de entrada, fica em 1 no
 * platô e desce na rampa de saída (5 s cada; o Xenônio, 15 s). Fora da duração, 0.
 */
export function fracaoDoPerfil(def: OcorrenciaDef, decorridoMs: number): number {
  const s = decorridoMs / 1000;
  const d = def.duracaoS;
  if (!(s > 0) || s >= d) return 0;
  const { entradaS, saidaS } = def.perfil;
  if (s < entradaS) return s / entradaS;
  if (s > d - saidaS) return (d - s) / saidaS;
  return 1;
}

/**
 * Multiplicadores da perturbação com a fração `f` do perfil (1 = platô), ainda sem o controle. Uma turbina em
 * meia carga faz o fator das turbinas valer `(t − 1 + carga) ÷ t`: com duas turbinas, 1,5 turbina (§4.4).
 */
export function multiplicadoresDaPerturbacao(def: OcorrenciaDef, f: number, turbinas: number): MultiplicadoresMotor {
  const p = def.perturbacao;
  if (!p || !(f > 0)) return MULTIPLICADORES_NEUTROS;
  const valor = 1 + (p.valor - 1) * Math.min(1, f);
  if (p.termo === "entrada") return { ...MULTIPLICADORES_NEUTROS, entrada: valor };
  if (p.termo === "dissipacao") return { ...MULTIPLICADORES_NEUTROS, dissipacao: valor };
  return { ...MULTIPLICADORES_NEUTROS, turbina: turbinas > 0 ? Math.max(0, turbinas - 1 + valor) / turbinas : 1 };
}

/**
 * O controle da era sobre os multiplicadores: a **carga das turbinas** multiplica o fator das turbinas
 * (`0,12 × Q × carga`, Era 1); a **potência das varetas** multiplica só a injeção ativa (Era 2).
 */
export function comControle(m: MultiplicadoresMotor, era: 1 | 2, controle: number): MultiplicadoresMotor {
  return era === 2 ? { ...m, entrada: m.entrada * controle } : { ...m, turbina: m.turbina * controle };
}

/** Os multiplicadores do motor no instante `tempoMs`: neutros sem Ocorrência ativa. */
export function multiplicadoresDoEstado(state: GameState, tempoMs: number = state.tempoMs): MultiplicadoresMotor {
  const a = state.ocorrencia.atual;
  const nucleo = state.nucleo;
  if (!a || a.fase !== "ativa" || !nucleo) return MULTIPLICADORES_NEUTROS;
  const def = OCORRENCIAS_DEF[a.id];
  if (def.era !== nucleo.era) return MULTIPLICADORES_NEUTROS;
  const base = multiplicadoresDaPerturbacao(def, fracaoDoPerfil(def, tempoMs - a.inicioMs), turbinasDo(nucleo));
  return comControle(base, nucleo.era, a.controle);
}

/** Limita o controle aos extremos da era (50–150 % na Era 1, 50–125 % na Era 2). */
export function limitarControle(valor: number, era: 1 | 2): number {
  const c = CONTROLE[era];
  if (!Number.isFinite(valor)) return 1;
  return Math.min(c.max, Math.max(c.min, valor));
}

/* ------------------------------------------------------------------ */
/* O controle que a fórmula pede                                       */
/* ------------------------------------------------------------------ */

/**
 * O controle que põe o `Q*` em `qAlvo`, a partir de um motor com a perturbação e **sem** o controle, sem limitar:
 *   Era 1: `Q* = (E − D) ÷ (F × carga)`          → `carga = (E − D) ÷ (F × qAlvo)`;
 *   Era 2: `Q* = (A × p + decaimento − D) ÷ F`   → `p = (qAlvo × F − decaimento + D) ÷ A`.
 * `NaN` quando o controle não alcança o alvo (sem turbina, sem calor líquido, sem vareta ativa).
 */
export function controleParaQ(motorBase: MotorCalor, era: 1 | 2, qAlvo: number): number {
  if (motorBase.fatorTurbina <= 0 || !(qAlvo > 0)) return NaN;
  if (era === 2) {
    if (motorBase.entradaAtivaUs <= 0) return NaN;
    return (qAlvo * motorBase.fatorTurbina - motorBase.decaimentoUs + motorBase.dissipacaoUs) / motorBase.entradaAtivaUs;
  }
  const liquido = motorBase.entradaUs - motorBase.dissipacaoUs;
  if (liquido <= 0) return NaN;
  return liquido / (motorBase.fatorTurbina * qAlvo);
}

/**
 * A potência das varetas que põe a potência de equilíbrio em `alvoKw` (só na Era 2: na Torre, em equilíbrio,
 * a carga não muda a potência — continua 0,8 kW por u que entra, §4.4). No equilíbrio as turbinas tiram
 * todo o calor líquido: `P = (A × p + decaimento − D) × kW por u`.
 */
export function controleParaPotencia(motorBase: MotorCalor, era: 1 | 2, alvoKw: number): number {
  if (era !== 2 || motorBase.entradaAtivaUs <= 0 || motorBase.kwPorU <= 0 || motorBase.fatorTurbina <= 0) return NaN;
  return ((alvoKw + motorBase.consumoKwFixo) / motorBase.kwPorU - motorBase.decaimentoUs + motorBase.dissipacaoUs) / motorBase.entradaAtivaUs;
}

function motorCom(nucleo: NucleoState, efeitos: EfeitosArvore, tempoMs: number, mult: MultiplicadoresMotor): MotorCalor {
  return motorDoNucleo(nucleo, efeitos, tempoMs, mult);
}

/** `T*` do equilíbrio com os multiplicadores. */
function tEquilibrioCom(nucleo: NucleoState, efeitos: EfeitosArvore, tempoMs: number, mult: MultiplicadoresMotor): number {
  const m = motorCom(nucleo, efeitos, tempoMs, mult);
  return temperatura(equilibrioMotor(m), m.capacidadeU);
}

/** Potência bruta (sem o fator do modo seguro) no equilíbrio, com os multiplicadores. */
function potenciaNoEquilibrio(nucleo: NucleoState, efeitos: EfeitosArvore, tempoMs: number, mult: MultiplicadoresMotor): number {
  const m = motorCom(nucleo, efeitos, tempoMs, mult);
  const q = equilibrioMotor(m);
  return Number.isFinite(q) ? potenciaMotor(m, q) : 0;
}

/**
 * O controle que **compensa** a perturbação no instante `tempoMs` — o que a rota operador da simulação faz a
 * cada tick (Sessão 10 F), acompanhando o perfil em vez de parar no valor do platô desde o aceite:
 *   meta de calor → devolve o `Q*` de antes da perturbação (se ele estava no ouro; senão, 80 %);
 *   meta de potência → põe a potência de equilíbrio no meio da faixa (70 % da referência).
 * Sem perturbação, 1. Já limitado aos extremos da era.
 */
export function controleQueCompensa(state: GameState, tempoMs: number = state.tempoMs): number {
  const a = state.ocorrencia.atual;
  const nucleo = state.nucleo;
  if (!a || !nucleo) return 1;
  const def = OCORRENCIAS_DEF[a.id];
  if (def.era !== nucleo.era) return 1;
  const efeitos = efeitosDe(state);
  const f = a.fase === "ativa" ? fracaoDoPerfil(def, tempoMs - a.inicioMs) : 1;
  return controleAlvo(nucleo, efeitos, tempoMs, def, f, def.meta.tipo === "potencia" ? a.potenciaRefKw : 0);
}

/** O controle que leva ao alvo da meta com a fração `f` da perturbação; `refKw` é a referência da meta de potência. */
function controleAlvo(nucleo: NucleoState, efeitos: EfeitosArvore, tempoMs: number, def: OcorrenciaDef, f: number, refKw: number): number {
  const base = multiplicadoresDaPerturbacao(def, f, turbinasDo(nucleo));
  const motorBase = motorCom(nucleo, efeitos, tempoMs, base);
  if (def.meta.tipo === "potencia") {
    const ref = refKw > 0 ? refKw : potenciaNoEquilibrio(nucleo, efeitos, tempoMs, MULTIPLICADORES_NEUTROS);
    const alvo = ref * ((def.meta.de + def.meta.ate) / 2);
    return limitarControle(controleParaPotencia(motorBase, nucleo.era, alvo), nucleo.era);
  }
  const tAntes = tEquilibrioCom(nucleo, efeitos, tempoMs, MULTIPLICADORES_NEUTROS);
  const tAlvo = faixaDeCalor(tAntes).id === "ouro" ? tAntes : OCORRENCIAS.alvoT;
  return limitarControle(controleParaQ(motorBase, nucleo.era, tAlvo * motorBase.capacidadeU), nucleo.era);
}

/* ------------------------------------------------------------------ */
/* Oferta: bloqueio, exigência, "só se oferece o que se pode ganhar"    */
/* ------------------------------------------------------------------ */

/**
 * Por que não pode haver oferta agora (Parte 1 §4.4): Núcleo bloqueado, em SCRAM, sem turbina ou desligado
 * (nada aquecendo: o equilíbrio é zero). `null` quando pode.
 */
export function motivoBloqueio(state: GameState): string | null {
  const n = state.nucleo;
  if (!n) return "O Núcleo ainda está bloqueado.";
  if (n.scramRestanteMs > 0) return "O Núcleo está em SCRAM.";
  if (turbinasDo(n) === 0) return "O Núcleo está sem turbina.";
  const m = motorCom(n, efeitosDe(state), state.tempoMs, MULTIPLICADORES_NEUTROS);
  if (!(equilibrioMotor(m) > 0)) return "O Núcleo está desligado.";
  return null;
}

/** A coluna "Exige" das tabelas: o mínimo, que sozinho não basta (falta ser ganhável). */
export function atendeExigencia(nucleo: NucleoState, def: OcorrenciaDef): boolean {
  if (def.era !== nucleo.era) return false;
  const e = def.exige;
  if (nucleo.era === 1) {
    const c = contar(nucleo.grade);
    const heliostatos = c.espelhosAnel1 + c.espelhosAnel2 + c.espelhosAnel3;
    return heliostatos >= (e.heliostatos ?? 0) && c.turbinas >= (e.turbinas ?? 0);
  }
  const c = contarReator(nucleo.grade);
  return c.varetasAtivas >= (e.varetasAtivas ?? 0) && c.turbinas >= (e.turbinas ?? 0) && (e.heliostatos ?? 0) === 0;
}

/**
 * "Só se oferece o que se pode ganhar" (§4.4): no platô da perturbação, o controle que mira o meio da meta
 * (`T` = 80 %, ou 70 % da potência), limitado aos extremos da era, deixa o equilíbrio **dentro** da meta. A Nuvem,
 * por exemplo, fica de fora de grades cujos radiadores dissipam muito, porque a carga não desce de 50 %.
 */
export function ganhavel(state: GameState, id: OcorrenciaId): boolean {
  const n = state.nucleo;
  if (!n) return false;
  const def = OCORRENCIAS_DEF[id];
  if (!atendeExigencia(n, def)) return false;
  const efeitos = efeitosDe(state);
  const tempoMs = state.tempoMs;
  const base = multiplicadoresDaPerturbacao(def, 1, turbinasDo(n));
  const motorBase = motorCom(n, efeitos, tempoMs, base);
  if (def.meta.tipo === "potencia") {
    const ref = potenciaNoEquilibrio(n, efeitos, tempoMs, MULTIPLICADORES_NEUTROS);
    if (!(ref > 0)) return false;
    const p = controleParaPotencia(motorBase, n.era, ref * ((def.meta.de + def.meta.ate) / 2));
    if (!Number.isFinite(p)) return false;
    const razao = potenciaNoEquilibrio(n, efeitos, tempoMs, comControle(base, n.era, limitarControle(p, n.era))) / ref;
    return razao >= def.meta.de - 1e-9 && razao <= def.meta.ate + 1e-9;
  }
  const c = controleParaQ(motorBase, n.era, OCORRENCIAS.alvoT * motorBase.capacidadeU);
  if (!Number.isFinite(c)) return false;
  return faixaDeCalor(tEquilibrioCom(n, efeitos, tempoMs, comControle(base, n.era, limitarControle(c, n.era)))).id === "ouro";
}

/** As Ocorrências que o sorteio aceitaria agora, na ordem do content. */
export function candidatas(state: GameState): OcorrenciaId[] {
  const n = state.nucleo;
  if (!n || motivoBloqueio(state)) return [];
  return OCORRENCIAS_DA_ERA[n.era].filter((id) => ganhavel(state, id));
}

/**
 * Sorteio determinístico (`sim/aleatorio.ts`, semente no estado). A primeira oferta do save é a Nuvem (ou o
 * Xenônio, na Era 2); depois de um SCRAM na Era 2, o Xenônio — quando a grade pode ganhá-los.
 */
export function sortear(state: GameState): { id: OcorrenciaId; semente: number } | null {
  const n = state.nucleo;
  const lista = candidatas(state);
  if (!n || lista.length === 0) return null;
  const o = state.ocorrencia;
  const preferida = !o.primeiraOfertaFeita ? PRIMEIRA_OCORRENCIA[n.era] : n.era === 2 && o.xenonioPendente ? OCORRENCIA_APOS_SCRAM : null;
  if (preferida && lista.includes(preferida)) return { id: preferida, semente: o.semente };
  const v = rnd(o.semente)();
  return { id: lista[Math.min(lista.length - 1, Math.floor(v * lista.length))], semente: Math.floor(v * 4294967296) >>> 0 || 1 };
}

/* ------------------------------------------------------------------ */
/* Meta                                                                */
/* ------------------------------------------------------------------ */

/** Potência bruta do Núcleo agora (sem o fator do modo seguro, que não pode valer como atalho da meta). */
export function potenciaBrutaKw(state: GameState, mult: MultiplicadoresMotor = multiplicadoresDoEstado(state)): number {
  const n = state.nucleo;
  if (!n || n.scramRestanteMs > 0) return 0;
  return potenciaMotor(motorCom(n, efeitosDe(state), state.tempoMs, mult), n.calorU);
}

/** A meta está cumprida neste instante: `T` na zona de ouro, ou a potência na faixa da referência. */
export function metaCumprida(state: GameState, a: OcorrenciaEmCurso): boolean {
  const n = state.nucleo;
  if (!n || n.scramRestanteMs > 0) return false;
  const def = OCORRENCIAS_DEF[a.id];
  if (def.meta.tipo === "potencia") {
    if (!(a.potenciaRefKw > 0)) return false;
    const razao = potenciaBrutaKw(state) / a.potenciaRefKw;
    return razao >= def.meta.de && razao <= def.meta.ate;
  }
  const m = motorCom(n, efeitosDe(state), state.tempoMs, MULTIPLICADORES_NEUTROS);
  return faixaDeCalor(temperatura(n.calorU, m.capacidadeU)).id === "ouro";
}

/** ms na meta que a Ocorrência precisa para ser superada: 75 % da duração. */
export function metaMs(id: OcorrenciaId): number {
  return OCORRENCIAS_DEF[id].duracaoS * 1000 * OCORRENCIAS.fracaoMeta;
}

/* ------------------------------------------------------------------ */
/* Passo do tick                                                       */
/* ------------------------------------------------------------------ */

export interface ContextoOcorrencias {
  dtMs: number;
  /** A Cascata disparou neste tick. */
  cascatou: boolean;
  /** 🔬/s total do tick (Núcleo + laboratórios, universidades, institutos): base da recompensa em 🔬. */
  pesquisaPorSegundo: number;
}

const encerrada = (o: OcorrenciasState): OcorrenciasState => ({ ...o, atual: null, relogioMs: 0 });

/**
 * Relógio, oferta, meta e fim, depois do passo do Núcleo (o estado já traz `T`, o SCRAM e a Cascata do tick).
 * Função pura; acrescenta os eventos em `state.eventos`.
 */
export function passoOcorrencias(state: GameState, ctx: ContextoOcorrencias): GameState {
  const n = state.nucleo;
  if (!n) return state;
  let o = state.ocorrencia;
  const eventos: EventoJogo[] = [];
  const emScram = n.scramRestanteMs > 0;
  // Depois de um SCRAM na Era 2 a próxima oferta é o Xenônio (Parte 2 §5.4).
  if (n.era === 2 && emScram && !o.xenonioPendente) o = { ...o, xenonioPendente: true };

  const a = o.atual;
  if (a) {
    const def = OCORRENCIAS_DEF[a.id];
    if (def.era !== n.era) {
      // A era mudou no meio (o Reator foi construído): a oferta ou a Ocorrência some sem recompensa.
      o = encerrada(o);
    } else if (a.fase === "oferta") {
      if (state.tempoMs - a.inicioMs >= OCORRENCIAS.janelaOfertaMs || motivoBloqueio(state)) o = encerrada(o);
    } else if (ctx.cascatou || emScram) {
      // Cascata ou SCRAM (inclusive o automático do modo seguro a 95 %) reprovam a meta na hora.
      o = encerrada(o);
      eventos.push({ tipo: "ocorrenciaTerminou", id: a.id, superada: false });
    } else {
      const naMetaMs = a.naMetaMs + (metaCumprida(state, a) ? ctx.dtMs : 0);
      if (state.tempoMs - a.inicioMs >= def.duracaoS * 1000) {
        const superada = naMetaMs >= metaMs(a.id) - 1e-6;
        o = encerrada(o);
        if (superada) {
          const pesquisa = Math.max(0, ctx.pesquisaPorSegundo) * OCORRENCIAS.recompensaPesquisaS;
          o = { ...o, recompensa: { id: a.id, pesquisa }, superadas: o.superadas + 1 };
        }
        eventos.push({ tipo: "ocorrenciaTerminou", id: a.id, superada });
      } else {
        o = { ...o, atual: { ...a, naMetaMs } };
      }
    }
  } else if (!o.recompensa) {
    // O relógio só anda sem oferta, sem Ocorrência e sem recompensa por escolher ("uma por vez").
    o = { ...o, relogioMs: Math.min(OCORRENCIAS.intervaloMs, o.relogioMs + ctx.dtMs) };
    if (o.relogioMs >= OCORRENCIAS.intervaloMs) {
      const s = sortear({ ...state, ocorrencia: o });
      if (s) {
        const aposScram = s.id === OCORRENCIA_APOS_SCRAM && o.xenonioPendente;
        o = {
          ...o,
          semente: s.semente,
          primeiraOfertaFeita: true,
          xenonioPendente: false,
          atual: { id: s.id, fase: "oferta", inicioMs: state.tempoMs, controle: 1, naMetaMs: 0, potenciaRefKw: 0, aposScram },
        };
        eventos.push({ tipo: "ocorrenciaOferecida", id: s.id });
      }
    }
  }

  if (o === state.ocorrencia && eventos.length === 0) return state;
  return { ...state, ocorrencia: o, eventos: eventos.length > 0 ? [...state.eventos, ...eventos] : state.eventos };
}

/* ------------------------------------------------------------------ */
/* Ações do jogador                                                    */
/* ------------------------------------------------------------------ */

export interface Avaliacao {
  ok: boolean;
  motivo: string | null;
}

export function avaliarAceite(state: GameState): Avaliacao {
  const a = state.ocorrencia.atual;
  if (!a || a.fase !== "oferta") return { ok: false, motivo: "Não há Ocorrência oferecida." };
  const bloqueio = motivoBloqueio(state);
  if (bloqueio) return { ok: false, motivo: bloqueio };
  if (!atendeExigencia(state.nucleo!, OCORRENCIAS_DEF[a.id])) return { ok: false, motivo: "A grade mudou: esta Ocorrência não se aplica mais." };
  return { ok: true, motivo: null };
}

/** Aceita a oferta: o controle aparece em 100 % e a perturbação começa pela rampa de entrada. */
export function aceitarOcorrencia(state: GameState): GameState | null {
  if (!avaliarAceite(state).ok) return null;
  const a = state.ocorrencia.atual!;
  const potenciaRefKw = potenciaBrutaKw(state, MULTIPLICADORES_NEUTROS);
  const atual: OcorrenciaEmCurso = { ...a, fase: "ativa", inicioMs: state.tempoMs, controle: 1, naMetaMs: 0, potenciaRefKw };
  return { ...state, ocorrencia: { ...state.ocorrencia, atual } };
}

/** Move o controle, dentro dos limites da era. Só durante a Ocorrência. */
export function ajustarControle(state: GameState, valor: number): GameState | null {
  const a = state.ocorrencia.atual;
  const n = state.nucleo;
  if (!a || a.fase !== "ativa" || !n) return null;
  const controle = limitarControle(valor, n.era);
  if (controle === a.controle) return state;
  return { ...state, ocorrencia: { ...state.ocorrencia, atual: { ...a, controle } } };
}

/** "Agora não": a oferta some sem custo e o relógio recomeça. */
export function recusarOcorrencia(state: GameState): GameState | null {
  const a = state.ocorrencia.atual;
  if (!a || a.fase !== "oferta") return null;
  return { ...state, ocorrencia: encerrada(state.ocorrencia) };
}

export type TipoRecompensa = "estabilidade" | "pesquisa";

/** A escolha depois de superar: 🛡 +3 (sem passar de 100) ou a 🔬 guardada no instante em que superou. */
export function escolherRecompensa(state: GameState, tipo: TipoRecompensa): GameState | null {
  const r = state.ocorrencia.recompensa;
  if (!r) return null;
  const ocorrencia = { ...state.ocorrencia, recompensa: null, relogioMs: 0 };
  if (tipo === "estabilidade") {
    if (!state.nucleo) return null;
    const antes = state.nucleo.estabilidade;
    const estabilidade = limitarEstabilidade(antes + OCORRENCIAS.recompensaEstabilidade);
    return {
      ...state,
      nucleo: { ...state.nucleo, estabilidade },
      ocorrencia,
      eventos: [...state.eventos, { tipo: "recompensaEscolhida", id: r.id, recompensa: "estabilidade", valor: OCORRENCIAS.recompensaEstabilidade }],
    };
  }
  return {
    ...state,
    pesquisa: state.pesquisa + r.pesquisa,
    ocorrencia,
    eventos: [...state.eventos, { tipo: "recompensaEscolhida", id: r.id, recompensa: "pesquisa", valor: r.pesquisa }],
  };
}

/**
 * O offline ignora as Ocorrências (§4.4): a oferta pendente e a Ocorrência em curso ao fechar são descartadas
 * sem recompensa, e o controle volta a 100 % (ele só existe durante a Ocorrência). O relógio não anda offline.
 */
export function descartarAoCarregar(o: OcorrenciasState): OcorrenciasState {
  return o.atual ? encerrada(o) : o;
}

/* ------------------------------------------------------------------ */
/* Resumo para a interface                                             */
/* ------------------------------------------------------------------ */

export interface ResumoOcorrencia {
  def: OcorrenciaDef;
  fase: "oferta" | "ativa";
  /** Oferta: quanto falta para expirar. Ativa: quanto falta para acabar. */
  restanteMs: number;
  /** Fração de 0 a 1 do tempo já passado da fase. */
  progresso: number;
  naMetaMs: number;
  /** ms na meta para superar (75 % da duração). */
  metaMs: number;
  /** Ainda dá para superar: o que falta cabe no tempo que resta. */
  aindaDa: boolean;
  controle: number;
  /** `T` agora e o `T*` com a perturbação e o controle deste instante (a marca de `Q*` da barra). */
  t: number;
  tEquilibrio: number;
  /** A meta está cumprida neste instante. */
  cumprindo: boolean;
  /** Meta de potência: potência bruta agora, a referência do aceite e a de equilíbrio com o controle atual. */
  potenciaKw: number;
  potenciaRefKw: number;
  potenciaEquilibrioKw: number;
  /** A causa que o cartão mostra (Xenônio). */
  causa: string | null;
}

/** Tudo o que o cartão da Ocorrência mostra, tirado do estado. `null` sem oferta nem Ocorrência. */
export function resumoOcorrencia(state: GameState): ResumoOcorrencia | null {
  const a = state.ocorrencia.atual;
  const n = state.nucleo;
  if (!a || !n) return null;
  const def = OCORRENCIAS_DEF[a.id];
  const efeitos = efeitosDe(state);
  const mult = multiplicadoresDoEstado(state);
  const m = motorCom(n, efeitos, state.tempoMs, mult);
  const qEq = equilibrioMotor(m);
  const decorrido = Math.max(0, state.tempoMs - a.inicioMs);
  const totalMs = a.fase === "oferta" ? OCORRENCIAS.janelaOfertaMs : def.duracaoS * 1000;
  const restanteMs = Math.max(0, totalMs - decorrido);
  const meta = metaMs(a.id);
  return {
    def,
    fase: a.fase,
    restanteMs,
    progresso: Math.min(1, decorrido / totalMs),
    naMetaMs: a.naMetaMs,
    metaMs: meta,
    aindaDa: a.fase === "oferta" || a.naMetaMs + restanteMs >= meta - 1e-6,
    controle: a.controle,
    t: temperatura(n.calorU, m.capacidadeU),
    tEquilibrio: temperatura(qEq, m.capacidadeU),
    cumprindo: a.fase === "ativa" && metaCumprida(state, a),
    potenciaKw: potenciaBrutaKw(state, mult),
    potenciaRefKw: a.potenciaRefKw,
    potenciaEquilibrioKw: Number.isFinite(qEq) && n.scramRestanteMs === 0 ? potenciaMotor(m, qEq) : 0,
    causa: a.aposScram && def.causaAposScram ? def.causaAposScram : (def.causa ?? null),
  };
}
