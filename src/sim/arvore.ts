/**
 * Árvore de pesquisa: consulta e compra (GDD §3, §7, §8.6, v0.6). TypeScript puro.
 *
 * 🔬 é **saldo gastável**: `pesquisar` debita. Os efeitos acumulados vivem em `sim/efeitos.ts`.
 * As três melhorias nomeadas das sessões 3 e 4 (Lâminas de fibra, Rastreamento solar, Grade 7×7)
 * viraram nós daqui, e os desbloqueios de usina passaram a **gastar** 🔬 em vez de só exigir.
 */
import { NOS, NO_POR_ID, type NoDef } from "../content/arvore";
import { expandirGrade } from "./nucleo";
import type { GameState } from "./state";

export { efeitosDe, efeitosDos, efeitosNeutros, type EfeitosArvore } from "./efeitos";

/* ------------------------------------------------------------------ */
/* Compra                                                              */
/* ------------------------------------------------------------------ */

export function pesquisado(state: GameState, id: string): boolean {
  return state.pesquisados.includes(id);
}

export interface RecusaNo {
  ok: boolean;
  motivo: string | null;
}

/** Um nó bloqueado por exclusão nunca mais fica disponível: a escolha é definitiva (GDD §8.6). */
export function excluido(state: GameState, no: NoDef): boolean {
  if (no.exclui?.some((id) => pesquisado(state, id))) return true;
  return NOS.some((outro) => pesquisado(state, outro.id) && outro.exclui?.includes(no.id) === true);
}

export function avaliarNo(state: GameState, id: string): RecusaNo {
  const no = NO_POR_ID[id];
  if (!no) return { ok: false, motivo: "Nó desconhecido" };
  if (pesquisado(state, id)) return { ok: false, motivo: "Já pesquisado" };
  if (excluido(state, no)) return { ok: false, motivo: "Excluído pela escolha que você fez" };
  // Um nó da Era 2 só existe depois do reator construído (GDD Parte 2 §6).
  if (no.era > state.era) return { ok: false, motivo: `Exige a Era ${no.era}` };
  const faltando = (no.pre ?? []).filter((p) => !pesquisado(state, p));
  if (faltando.length > 0) return { ok: false, motivo: `Exige ${faltando.map((p) => NO_POR_ID[p]?.nome ?? p).join(" e ")}` };
  // Nós que mexem na estrutura do Núcleo só fazem sentido com o Núcleo desbloqueado.
  const exigeNucleo = no.efeitos.some((e) => e.tipo === "gradeLado" || e.tipo === "receptorCeramico");
  if (exigeNucleo && !state.nucleo) return { ok: false, motivo: "Exige o Núcleo desbloqueado" };
  if (exigeNucleo && no.efeitos.some((e) => e.tipo === "gradeLado" && state.nucleo !== null && state.nucleo.lado >= e.lado)) {
    return { ok: false, motivo: "A grade já tem este tamanho" };
  }
  if (state.pesquisa < no.pesquisa) return { ok: false, motivo: `Precisa de 🔬 ${no.pesquisa}` };
  if (no.creditos !== undefined && state.creditos < no.creditos) return { ok: false, motivo: "₵ insuficientes" };
  return { ok: true, motivo: null };
}

export function podePesquisar(state: GameState, id: string): boolean {
  return avaliarNo(state, id).ok;
}

/** Disponível = ainda não comprado, não excluído e com os pré-requisitos prontos (mesmo sem 🔬). */
export function disponivel(state: GameState, id: string): boolean {
  const no = NO_POR_ID[id];
  if (!no || pesquisado(state, id) || excluido(state, no)) return false;
  if (no.era > state.era) return false;
  return (no.pre ?? []).every((p) => pesquisado(state, p));
}

/** Gasta 🔬 (e ₵, quando o nó cobra) e aplica o efeito imediato, se houver. Função pura. */
export function pesquisar(state: GameState, id: string): GameState | null {
  if (!podePesquisar(state, id)) return null;
  const no = NO_POR_ID[id];
  const pesquisados = [...state.pesquisados, id];
  let nucleo = state.nucleo;
  for (const ef of no.efeitos) {
    // A grade e o Receptor mudam a estrutura do Núcleo na hora da compra, não a cada tick.
    if (ef.tipo === "gradeLado" && nucleo && nucleo.lado < ef.lado) nucleo = { ...nucleo, lado: ef.lado, grade: expandirGrade(nucleo.grade) };
    if (ef.tipo === "receptorCeramico" && nucleo) nucleo = { ...nucleo, receptorCeramico: true };
  }
  return {
    ...state,
    creditos: state.creditos - (no.creditos ?? 0),
    pesquisa: state.pesquisa - no.pesquisa,
    pesquisados,
    nucleo,
    eventos: [...state.eventos, { tipo: "noPesquisado", id }],
  };
}

/** O nó mais barato ainda comprável: é o que garante que 🔬 sempre tenha para onde ir (GDD §7). */
export function proximoNo(state: GameState): NoDef | null {
  let melhor: NoDef | null = null;
  for (const no of NOS) {
    if (!disponivel(state, no.id)) continue;
    if (!melhor || no.pesquisa < melhor.pesquisa) melhor = no;
  }
  return melhor;
}
