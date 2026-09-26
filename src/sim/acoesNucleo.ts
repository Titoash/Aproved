/** Ações do jogador sobre o Núcleo. Funções puras: devolvem `null` quando a ação não é possível. */
import { NUCLEO, RECEPTOR_CERAMICO } from "../content/era1-nucleo";
import { PECA_POR_ID } from "../content/pecas";
import {
  custoReconstrucao,
  emScram,
  limparEntulho as limparEntulhoGrade,
  podeLimparEntulho,
  reconstruir as reconstruirGrade,
  scram,
} from "./cascata";
import { colocar, podeColocar, podeRemover, remover, type Validacao } from "./nucleo";
import { VARETA } from "../content/era2-nucleo";
import { ordemDasPecas } from "../content/pecas";
import { avaliarTroca, prontaParaTroca, varetaNova } from "./reator";
import { efeitosDe } from "./efeitos";
import { faixaDeCalor, temperaturaNucleo } from "./calor";
import { nucleoInicial, type Casa, type GameState, type NucleoState, type PecaId } from "./state";

function comNucleo(state: GameState, nucleo: NucleoState, creditos = state.creditos): GameState {
  return { ...state, creditos, nucleo };
}

/* ------------------------------------------------------------------ */
/* Desbloqueio                                                        */
/* ------------------------------------------------------------------ */

export function podeDesbloquearNucleo(state: GameState): boolean {
  return state.nucleo === null && state.creditos >= NUCLEO.custoDesbloqueio;
}

export function desbloquearNucleo(state: GameState): GameState | null {
  if (!podeDesbloquearNucleo(state)) return null;
  const proximo = comNucleo(state, nucleoInicial(), state.creditos - NUCLEO.custoDesbloqueio);
  // O card "As cinco peças" (GDD §10, v0.6) explica a grade antes da primeira colocação.
  return { ...proximo, eventos: [...state.eventos, { tipo: "nucleoDesbloqueado" }] };
}

/* ------------------------------------------------------------------ */
/* Peças                                                              */
/* ------------------------------------------------------------------ */

export function custoPeca(pecaId: PecaId): number {
  return PECA_POR_ID[pecaId].custo;
}

/** As peças que a era oferece; barra de controle e piscina só depois do nó (GDD Parte 2 §6). */
export function pecaDisponivel(state: GameState, pecaId: PecaId): boolean {
  const era = state.nucleo?.era ?? state.era;
  if (!ordemDasPecas(era).includes(pecaId)) return false;
  if (pecaId === "barraControle" || pecaId === "piscina") return efeitosDe(state).pecasLiberadas.includes(pecaId);
  return true;
}

export function validarColocacao(state: GameState, indice: number, pecaId: PecaId): Validacao {
  if (!state.nucleo) return { ok: false, motivo: "Núcleo bloqueado." };
  if (!pecaDisponivel(state, pecaId)) return { ok: false, motivo: "Peça de outra era ou ainda não pesquisada." };
  const v = podeColocar(state.nucleo.grade, indice, pecaId);
  if (!v.ok) return v;
  if (state.creditos < custoPeca(pecaId)) return { ok: false, motivo: "Créditos insuficientes." };
  return { ok: true };
}

/** Quantas peças intactas deste tipo há na grade. */
function quantasPecas(state: GameState, pecaId: PecaId): number {
  return state.nucleo?.grade.filter((c) => c?.tipo === "peca" && c.id === pecaId).length ?? 0;
}

export function colocarPeca(state: GameState, indice: number, pecaId: PecaId): GameState | null {
  if (!state.nucleo || !validarColocacao(state, indice, pecaId).ok) return null;
  const primeira = quantasPecas(state, pecaId) === 0;
  // A vareta nasce com combustível: 600 s na régua nominal (GDD Parte 2 §5.2).
  let grade = colocar(state.nucleo.grade, indice, pecaId);
  if (pecaId === "vareta") {
    grade = grade.slice();
    grade[indice] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
  }
  const proximo = comNucleo(
    state,
    { ...state.nucleo, grade },
    state.creditos - custoPeca(pecaId),
  );
  // A primeira unidade de um tipo dispara o card correspondente (só o tanque tem card hoje).
  return primeira ? { ...proximo, eventos: [...state.eventos, { tipo: "primeiraCompra", item: pecaId }] } : proximo;
}

/** Remover não reembolsa (o preço das peças é fixo e baixo; a limitação é o espaço). */
export function removerPeca(state: GameState, indice: number): GameState | null {
  if (!state.nucleo || !podeRemover(state.nucleo.grade, indice)) return null;
  return comNucleo(state, { ...state.nucleo, grade: remover(state.nucleo.grade, indice) });
}

export function limparEntulho(state: GameState, indice: number): GameState | null {
  if (!state.nucleo || !podeLimparEntulho(state.nucleo.grade[indice], state.tempoMs)) return null;
  return comNucleo(state, { ...state.nucleo, grade: limparEntulhoGrade(state.nucleo.grade, indice) });
}

export function podeReconstruir(state: GameState, indice: number): boolean {
  if (!state.nucleo) return false;
  const casa = state.nucleo.grade[indice];
  return !!casa && casa.tipo === "entulho" && state.creditos >= custoReconstrucao(casa);
}

export function reconstruir(state: GameState, indice: number): GameState | null {
  if (!state.nucleo || !podeReconstruir(state, indice)) return null;
  const custo = custoReconstrucao(state.nucleo.grade[indice]);
  return comNucleo(state, { ...state.nucleo, grade: reconstruirGrade(state.nucleo.grade, indice) }, state.creditos - custo);
}

/* ------------------------------------------------------------------ */
/* Operação                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Troca de vareta (Era 2, GDD Parte 2 §5.2)                          */
/* ------------------------------------------------------------------ */

export function avaliarTrocaVareta(state: GameState, indice: number) {
  return avaliarTroca(state.nucleo, indice, state.creditos, state.tempoMs);
}

export function podeTrocarVareta(state: GameState, indice: number): boolean {
  return avaliarTrocaVareta(state, indice).ok;
}

/**
 * Troca uma vareta gasta por uma nova: ₵ 8 000 (o combustível). A troca feita sem o reator sair da
 * zona de ouro é o capítulo "Troca escalonada" — por isso o contador.
 */
export function trocarVareta(state: GameState, indice: number): GameState | null {
  if (!state.nucleo || !podeTrocarVareta(state, indice)) return null;
  const grade: Casa[] = state.nucleo.grade.slice();
  grade[indice] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
  const naFaixa = faixaDeCalor(temperaturaNucleo(state.nucleo, efeitosDe(state))).id === "ouro";
  const proximo = comNucleo(
    state,
    { ...state.nucleo, grade, trocasEmFaixa: state.nucleo.trocasEmFaixa + (naFaixa ? 1 : 0) },
    state.creditos - VARETA.custoTroca,
  );
  return { ...proximo, eventos: [...state.eventos, { tipo: "varetaTrocada", indice }] };
}

export interface AvaliacaoTrocarTodas {
  ok: boolean;
  motivo: string | null;
  /** Varetas gastas que já podem sair, em ordem de casa. */
  indices: number[];
  /** Todas as gastas da grade, prontas ou não. */
  gastas: number;
  /** A soma: prontas × ₵ 8 000. */
  custo: number;
  /** Quanto falta para a próxima gasta esfriar, em ms; `null` quando não há quem esperar. */
  proximaEmMs: number | null;
}

/**
 * "Trocar todas as gastas" (Parte 2 §5.1, v0.8): uma ação, cobra a soma, só as que já podem. Tudo ou
 * nada: sem ₵ para o lote inteiro, recusa — o GDD fala de cobrar a soma, não de troca parcial.
 */
export function avaliarTrocarTodas(state: GameState): AvaliacaoTrocarTodas {
  const vazio = (motivo: string, gastas = 0, proximaEmMs: number | null = null): AvaliacaoTrocarTodas => ({ ok: false, motivo, indices: [], gastas, custo: 0, proximaEmMs });
  const nucleo = state.nucleo;
  if (!nucleo || nucleo.era !== 2) return vazio("O reator ainda não existe.");
  const indices: number[] = [];
  let gastas = 0;
  let proximaEmMs: number | null = null;
  nucleo.grade.forEach((casa, i) => {
    if (!casa || casa.tipo !== "peca" || casa.id !== "vareta" || !casa.vareta || casa.vareta.gastaDesdeMs === null) return;
    gastas++;
    const pronta = prontaParaTroca(nucleo, i, state.tempoMs);
    if (pronta.ok) indices.push(i);
    else if (pronta.faltaMs > 0) proximaEmMs = proximaEmMs === null ? pronta.faltaMs : Math.min(proximaEmMs, pronta.faltaMs);
  });
  if (gastas === 0) return vazio("Nenhuma vareta gasta.");
  if (indices.length === 0) return vazio("Nenhuma esfriou ainda: espere o decaimento (ou ponha uma Piscina ao lado).", gastas, proximaEmMs);
  const custo = indices.length * VARETA.custoTroca;
  if (state.creditos < custo) return { ok: false, motivo: "₵ insuficientes para o lote inteiro", indices, gastas, custo, proximaEmMs };
  return { ok: true, motivo: null, indices, gastas, custo, proximaEmMs };
}

/**
 * Troca de uma vez todas as gastas que já podem sair, com um débito só. Na zona de ouro o lote conta
 * **uma** troca em faixa para o capítulo "Troca escalonada" — trocar tudo junto não é escalonar.
 */
export function trocarTodasAsGastas(state: GameState): GameState | null {
  const a = avaliarTrocarTodas(state);
  if (!a.ok || !state.nucleo) return null;
  const grade: Casa[] = state.nucleo.grade.slice();
  for (const i of a.indices) grade[i] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
  const naFaixa = faixaDeCalor(temperaturaNucleo(state.nucleo, efeitosDe(state))).id === "ouro";
  const proximo = comNucleo(state, { ...state.nucleo, grade, trocasEmFaixa: state.nucleo.trocasEmFaixa + (naFaixa ? 1 : 0) }, state.creditos - a.custo);
  return { ...proximo, eventos: [...state.eventos, ...a.indices.map((indice) => ({ tipo: "varetaTrocada" as const, indice }))] };
}

export function alternarModoSeguro(state: GameState): GameState | null {
  if (!state.nucleo) return null;
  return comNucleo(state, { ...state.nucleo, modoSeguro: !state.nucleo.modoSeguro });
}

export function podeScramManual(state: GameState): boolean {
  return !!state.nucleo && !emScram(state.nucleo);
}

export function scramManual(state: GameState): GameState | null {
  if (!state.nucleo || !podeScramManual(state)) return null;
  const proximo = comNucleo(state, scram(state.nucleo, state.tempoMs));
  return { ...proximo, eventos: [...state.eventos, { tipo: "scram", era: state.nucleo.era }] };
}

/* ------------------------------------------------------------------ */
/* Melhoria                                                           */
/* ------------------------------------------------------------------ */

export function podeComprarReceptorCeramico(state: GameState): boolean {
  return (
    !!state.nucleo &&
    !state.nucleo.receptorCeramico &&
    state.creditos >= RECEPTOR_CERAMICO.custo &&
    state.pesquisa >= RECEPTOR_CERAMICO.pesquisa
  );
}

export function comprarReceptorCeramico(state: GameState): GameState | null {
  if (!state.nucleo || !podeComprarReceptorCeramico(state)) return null;
  return comNucleo(state, { ...state.nucleo, receptorCeramico: true }, state.creditos - RECEPTOR_CERAMICO.custo);
}
