/**
 * Melhorias incrementais **por tipo** (GDD Parte 1 §7.1, v0.8): ações puras. Um nível vale para todas as
 * unidades do tipo — usinas, peças do Núcleo, subestações, cabos e ciência —, e a única coisa "por
 * unidade" que sobra no jogo é o que é posição (colocar, remover, trocar uma vareta).
 *
 * Números em `content/melhorias.ts` (e `ESCOAMENTO`/`CABO` para subestações e cabos); fórmulas em
 * `sim/niveis.ts`. Aqui só se decide se dá, quanto custa e se aplica.
 */
import { UNIVERSIDADE, LABORATORIO } from "../content/cidade-era1";
import { INSTITUTO } from "../content/era2";
import { CABO, ILHAS } from "../content/era1-arquipelago";
import { NIVEL_CIENCIA, NIVEL_EQUIPE, NIVEL_PECA, NIVEL_USINA, PECAS_SEM_NIVEL, type TipoCiencia } from "../content/melhorias";
import { PECA_POR_ID } from "../content/pecas";
import { USINAS } from "../content/usinas";
import { pecaDisponivel } from "./acoesNucleo";
import { bipesDe, custoCabo, iniciarRemocoesLivres } from "./mundo";
import { custoDegrauTriplo, custoNivelEquipe, custoNivelPeca } from "./niveis";
import { ESCOAMENTO, analisar } from "./producao";
import type { AlvoMelhoria, GameState, MelhoriasState } from "./state";

export type { AlvoMelhoria };

const BASE_CIENCIA: Record<TipoCiencia, number> = {
  laboratorio: LABORATORIO.custoBase,
  universidade: UNIVERSIDADE.custoBase,
  institutoPesquisa: INSTITUTO.custoBase,
};

/** Nível atual do tipo. */
export function nivelDe(state: GameState, alvo: AlvoMelhoria): number {
  const m = state.melhorias;
  switch (alvo.tipo) {
    case "usina":
      return m.usinas[alvo.id];
    case "peca":
      return m.pecas[alvo.id];
    case "subestacao":
      return m.subestacoes[alvo.id];
    case "cabos":
      return m.cabos;
    case "ciencia":
      return m.ciencia[alvo.id];
    case "equipe":
      return m.equipe;
  }
}

/** Nível máximo do tipo; `null` = sem teto (cabos). */
export function nivelMaximo(alvo: AlvoMelhoria): number | null {
  switch (alvo.tipo) {
    case "usina":
      return NIVEL_USINA.maximo;
    case "peca":
      return PECAS_SEM_NIVEL.includes(alvo.id) ? 0 : NIVEL_PECA.maximo;
    case "subestacao":
      return ESCOAMENTO[alvo.id].nivelMax;
    case "cabos":
      return null;
    case "ciencia":
      return NIVEL_CIENCIA.maximo;
    case "equipe":
      return NIVEL_EQUIPE.maximo;
  }
}

/** Ilhas com cabo ligado, na ordem do conteúdo (a soma das rotas não depende da ordem do objeto). */
function ilhasComCabo(state: GameState) {
  return ILHAS.filter((i) => i.id !== "principal" && state.mundo.cabos[i.id] !== undefined).map((i) => i.id);
}

/** Quantas unidades do tipo existem: é o N de `base × 3ⁿ × N` e a condição "tenha pelo menos uma". */
export function unidadesDe(state: GameState, alvo: AlvoMelhoria): number {
  switch (alvo.tipo) {
    case "usina":
    case "subestacao":
    case "ciencia":
      return analisar(state).contagem[alvo.id];
    case "peca":
      return state.nucleo ? state.nucleo.grade.filter((c) => c?.tipo === "peca" && c.id === alvo.id).length : 0;
    case "cabos":
      return ilhasComCabo(state).length;
    case "equipe":
      return bipesDe(state);
  }
}

/**
 * Custo do próximo nível (§7.1):
 * - usina: `base × 3^(n+1)` · peça: `5 × custo × 2ⁿ` · cabos: `soma das rotas ligadas × 3^(n+1)`;
 * - subestação e ciência: `base × 3^(n+1) × N`, porque o nível vale para as N unidades do tipo.
 */
export function custoProximoNivel(state: GameState, alvo: AlvoMelhoria): number {
  const n = nivelDe(state, alvo);
  switch (alvo.tipo) {
    case "usina":
      return custoDegrauTriplo(USINAS[alvo.id].custoBase, n, NIVEL_USINA.crescimento);
    case "peca":
      return custoNivelPeca(PECA_POR_ID[alvo.id].custo, n);
    case "subestacao": {
      const def = ESCOAMENTO[alvo.id];
      return custoDegrauTriplo(def.custoBase, n, def.custoNivel, unidadesDe(state, alvo));
    }
    case "cabos": {
      const soma = ilhasComCabo(state).reduce((total, id) => total + custoCabo(id), 0);
      return custoDegrauTriplo(soma, n, CABO.custoNivel);
    }
    case "ciencia":
      return custoDegrauTriplo(BASE_CIENCIA[alvo.id], n, NIVEL_CIENCIA.crescimento, unidadesDe(state, alvo));
    case "equipe":
      return custoNivelEquipe(n);
  }
}

export interface RecusaMelhoria {
  ok: boolean;
  motivo: string | null;
}

const recusa = (motivo: string): RecusaMelhoria => ({ ok: false, motivo });

/** O que falta para comprar o próximo nível do tipo (texto curto para o botão e o callout). */
export function avaliarMelhoria(state: GameState, alvo: AlvoMelhoria): RecusaMelhoria {
  const maximo = nivelMaximo(alvo);
  const n = nivelDe(state, alvo);
  if (alvo.tipo === "peca") {
    if (!state.nucleo) return recusa("Núcleo bloqueado");
    if (PECAS_SEM_NIVEL.includes(alvo.id)) return recusa(`${PECA_POR_ID[alvo.id].nome}: não tem nível`);
    if (!pecaDisponivel(state, alvo.id)) return recusa("Peça de outra era ou ainda não pesquisada");
  }
  if (unidadesDe(state, alvo) === 0) return recusa(alvo.tipo === "cabos" ? "Ligue um cabo primeiro" : "Coloque um primeiro");
  if (maximo !== null && n >= maximo) {
    if (alvo.tipo === "subestacao") return recusa(`Nível máximo (${maximo}): ponha outra subestação`);
    if (alvo.tipo === "equipe") return recusa(`Nível máximo (${maximo}): ${bipesDe(state)} Bipes`);
    return recusa(`Nível máximo (${maximo}): o próximo degrau é da árvore`);
  }
  if (state.creditos < custoProximoNivel(state, alvo)) return recusa("₵ insuficientes");
  return { ok: true, motivo: null };
}

export function podeMelhorar(state: GameState, alvo: AlvoMelhoria): boolean {
  return avaliarMelhoria(state, alvo).ok;
}

/** Os níveis com o tipo do alvo no nível `nivel`. Objeto novo em todo o caminho: os caches dependem disso. */
function comNivel(m: MelhoriasState, alvo: AlvoMelhoria, nivel: number): MelhoriasState {
  switch (alvo.tipo) {
    case "usina":
      return { ...m, usinas: { ...m.usinas, [alvo.id]: nivel } };
    case "peca":
      return { ...m, pecas: { ...m.pecas, [alvo.id]: nivel } };
    case "subestacao":
      return { ...m, subestacoes: { ...m.subestacoes, [alvo.id]: nivel } };
    case "cabos":
      return { ...m, cabos: nivel };
    case "ciencia":
      return { ...m, ciencia: { ...m.ciencia, [alvo.id]: nivel } };
    case "equipe":
      return { ...m, equipe: nivel };
  }
}

/** Compra o próximo nível do tipo. Função pura: devolve `null` quando não dá. */
export function melhorar(state: GameState, alvo: AlvoMelhoria): GameState | null {
  if (!podeMelhorar(state, alvo)) return null;
  const custo = custoProximoNivel(state, alvo);
  const nivel = nivelDe(state, alvo) + 1;
  const depois: GameState = {
    ...state,
    creditos: state.creditos - custo,
    melhorias: comNivel(state.melhorias, alvo, nivel),
    eventos: [...state.eventos, { tipo: "melhoria", alvo, nivel }],
  };
  // O Bipe novo pega a fila na hora, não no próximo tick: o resultado não depende do tamanho do tick.
  return alvo.tipo === "equipe" ? iniciarRemocoesLivres(depois) : depois;
}
