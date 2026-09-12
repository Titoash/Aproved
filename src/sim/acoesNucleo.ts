/** Ações do jogador sobre o Núcleo. Funções puras: devolvem `null` quando a ação não é possível. */
import { NUCLEO, RECEPTOR_CERAMICO } from "../content/era1-nucleo";
import { defDoNucleo, definicaoDaPeca } from "../content/eras";
import {
  custoReconstrucao,
  emScram,
  limparEntulho as limparEntulhoGrade,
  podeLimparEntulho,
  reconstruir as reconstruirGrade,
  scram,
} from "./cascata";
import { custoRecarga, recarregar } from "./combustivel";
import { colocar, podeColocar, podeRemover, remover, type Validacao } from "./nucleo";
import { nucleoInicial, type GameState, type NucleoState, type PecaId } from "./state";

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
  return comNucleo(state, nucleoInicial(), state.creditos - NUCLEO.custoDesbloqueio);
}

/* ------------------------------------------------------------------ */
/* Peças                                                              */
/* ------------------------------------------------------------------ */

export function custoPeca(pecaId: PecaId): number {
  return definicaoDaPeca(pecaId).custo;
}

export function validarColocacao(state: GameState, indice: number, pecaId: PecaId): Validacao {
  if (!state.nucleo) return { ok: false, motivo: "Núcleo bloqueado." };
  const v = podeColocar(state.nucleo.grade, indice, pecaId, defDoNucleo(state.nucleo));
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
  const proximo = comNucleo(
    state,
    { ...state.nucleo, grade: colocar(state.nucleo.grade, indice, pecaId, defDoNucleo(state.nucleo)) },
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

export function alternarModoSeguro(state: GameState): GameState | null {
  if (!state.nucleo) return null;
  return comNucleo(state, { ...state.nucleo, modoSeguro: !state.nucleo.modoSeguro });
}

export function podeScramManual(state: GameState): boolean {
  return !!state.nucleo && !emScram(state.nucleo);
}

export function scramManual(state: GameState): GameState | null {
  if (!state.nucleo || !podeScramManual(state)) return null;
  return comNucleo(state, scram(state.nucleo));
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

/* ------------------------------------------------------------------ */
/* Combustível (GDD §8.5.4)                                            */
/* ------------------------------------------------------------------ */

export function custoProximaRecarga(state: GameState, indice: number): number {
  if (!state.nucleo) return 0;
  return custoRecarga(state.nucleo.grade[indice], defDoNucleo(state.nucleo));
}

export function podeRecarregar(state: GameState, indice: number): boolean {
  if (!state.nucleo) return false;
  const def = defDoNucleo(state.nucleo);
  if (!recarregar(state.nucleo.grade, indice, def)) return false;
  return state.creditos >= custoRecarga(state.nucleo.grade[indice], def);
}

/** Repõe o combustível de uma peça gasta (ou parcialmente usada) por ₵. */
export function recarregarPeca(state: GameState, indice: number): GameState | null {
  if (!state.nucleo || !podeRecarregar(state, indice)) return null;
  const def = defDoNucleo(state.nucleo);
  const grade = recarregar(state.nucleo.grade, indice, def);
  if (!grade) return null;
  return comNucleo(state, { ...state.nucleo, grade }, state.creditos - custoRecarga(state.nucleo.grade[indice], def));
}
