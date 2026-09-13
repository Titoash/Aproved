/**
 * Capítulos: um objetivo curto por vez, medido a cada tick (GDD §12, v0.6). TypeScript puro.
 *
 * O capítulo ativo é o primeiro ainda não concluído. Quando a condição fecha, ele paga a recompensa
 * (₵ e/ou 🔬) e passa a vez — sem botão de "coletar": o jogo avisa, não cobra atenção.
 */
import { CAPITULOS, type CapituloDef, type CondicaoCapitulo } from "../content/capitulos-era1";
import { densidadeDe } from "./cidade";
import { analisar, terrenoDeJogo } from "./producao";
import { balancoDoEstado } from "./tick";
import type { GameState } from "./state";

export interface ProgressoCapitulo {
  capitulo: CapituloDef;
  /** Quanto já foi feito e quanto é preciso (para a barrinha do HUD). */
  atual: number;
  alvo: number;
  concluido: boolean;
}

export function capituloAtivo(state: GameState): CapituloDef | null {
  return CAPITULOS.find((c) => !state.capitulos.includes(c.id)) ?? null;
}

/** Quantos nós o jogador comprou de fato (os iniciais não contam). */
function nosComprados(state: GameState): number {
  return state.pesquisados.filter((id) => id !== "laboratorio").length;
}

/** Mede a condição. Devolve quanto está feito e o alvo, para a UI mostrar o progresso. */
export function medir(state: GameState, condicao: CondicaoCapitulo): { atual: number; alvo: number } {
  const analise = analisar(state);
  switch (condicao.tipo) {
    case "construcoes": {
      if (!condicao.terreno) return { atual: analise.contagem[condicao.construcao], alvo: condicao.n };
      let n = 0;
      for (const chave of Object.keys(state.mundo.construcoes)) {
        const i = Number(chave);
        if (state.mundo.construcoes[i].tipo !== condicao.construcao) continue;
        if (terrenoDeJogo(state.mundo, i) === condicao.terreno) n++;
      }
      return { atual: n, alvo: condicao.n };
    }
    case "densidade": {
      let melhor = 0;
      for (const chave of Object.keys(state.mundo.construcoes)) {
        const c = state.mundo.construcoes[Number(chave)];
        if (c.tipo === "bairro") melhor = Math.max(melhor, densidadeDe(c).densidade);
      }
      return { atual: melhor, alvo: condicao.minima };
    }
    case "populacao":
      return { atual: analise.populacao, alvo: condicao.n };
    case "pesquisados":
      return { atual: nosComprados(state), alvo: condicao.n };
    case "nucleo":
      return { atual: state.nucleo ? 1 : 0, alvo: 1 };
    case "pecas": {
      const n = state.nucleo?.grade.filter((casa) => casa?.tipo === "peca" && casa.id === condicao.peca).length ?? 0;
      return { atual: n, alvo: condicao.n };
    }
    case "zonaDeOuro":
      return { atual: balancoDoEstado(state).faixa.id === "zonaDeOuro" ? 1 : 0, alvo: 1 };
    case "estabilidade":
      return { atual: state.nucleo?.estabilidade ?? 0, alvo: condicao.valor };
    case "potenciaKw":
      return { atual: analise.brutoKw, alvo: condicao.kw };
    case "ilhaAberta":
      return { atual: state.mundo.ilhasAbertas.includes(condicao.ilha) ? 1 : 0, alvo: 1 };
    case "cabo":
      return { atual: state.mundo.cabos[condicao.ilha] !== undefined ? 1 : 0, alvo: 1 };
    case "desmatados":
      return { atual: state.mundo.removidos.length, alvo: condicao.n };
  }
}

export function progressoDoAtivo(state: GameState): ProgressoCapitulo | null {
  const capitulo = capituloAtivo(state);
  if (!capitulo) return null;
  const { atual, alvo } = medir(state, capitulo.condicao);
  return { capitulo, atual, alvo, concluido: atual >= alvo };
}

/**
 * Passo do tick: conclui o capítulo ativo quando a condição fecha e paga a recompensa.
 * Um por tick — se dois fecharem juntos, o segundo sai no tick seguinte (100 ms depois).
 */
export function passoCapitulos(state: GameState): GameState {
  const progresso = progressoDoAtivo(state);
  if (!progresso || !progresso.concluido) return state;
  const { capitulo } = progresso;
  return {
    ...state,
    creditos: state.creditos + (capitulo.recompensa.creditos ?? 0),
    pesquisa: state.pesquisa + (capitulo.recompensa.pesquisa ?? 0),
    capitulos: [...state.capitulos, capitulo.id],
    eventos: [...state.eventos, { tipo: "capituloConcluido", id: capitulo.id }],
  };
}
