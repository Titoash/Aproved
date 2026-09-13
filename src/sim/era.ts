/**
 * Transição de era (GDD Parte 2 §2). TypeScript puro.
 *
 * A Torre Solar é desmontada e o Vaso do reator toma a plataforma. **O que muda:** a grade (volta a
 * 5×5, com o Vaso fixo no centro), a Estabilidade (zera — ela é da era, não do jogador) e o motor de
 * calor (varetas em vez de espelhos). **O que fica:** ilhas abertas, cabos, subestações, usinas da
 * Era 1 produzindo os mesmos kW, bairros, laboratórios, universidades, ₵, 🔬 e todos os nós da Era 1.
 *
 * Não há volta.
 */
import { PECA_POR_ID } from "../content/pecas";
import { CASCATA } from "../content/era1-nucleo";
import { REATOR } from "../content/era2-nucleo";
import { gradeVazia, type GameState, type NucleoState } from "./state";

/** O nó da árvore que abre a era (GDD §8.4). */
export const NO_SAIDA_ERA1 = "fissaoBasica";
/** O nó da árvore que abriria a Era 3 — a Sessão 9 ainda não existe (GDD Parte 2 §6). */
export const NO_SAIDA_ERA2 = "fusaoBasica";

export interface RecusaEra {
  ok: boolean;
  motivo: string | null;
}

/** Quanto a desmontagem da Torre devolve: 50 % do preço de cada peça intacta (GDD Parte 2 §2). */
export function reembolsoDaTorre(nucleo: NucleoState | null): number {
  if (!nucleo) return 0;
  let total = 0;
  for (const casa of nucleo.grade) {
    if (!casa || casa.tipo !== "peca") continue;
    total += PECA_POR_ID[casa.id].custo * CASCATA.fracaoReconstrucao;
  }
  return total;
}

/**
 * Condição da Era 2 (GDD §8.4 e Parte 2 §2): Estabilidade 100 % + o nó "Fissão básica" comprado +
 * ₵ 200 000 do Vaso. O nó já cobrou os 🔬 3 000 e os ₵ 50 000 dele.
 */
export function avaliarConstruirReator(state: GameState): RecusaEra {
  if (state.era !== 1) return { ok: false, motivo: "O reator já existe." };
  if (!state.nucleo) return { ok: false, motivo: "Desbloqueie o Núcleo primeiro." };
  if (!state.pesquisados.includes(NO_SAIDA_ERA1)) return { ok: false, motivo: 'Exige o nó "Fissão básica" da árvore.' };
  if (state.nucleo.estabilidade < 100) return { ok: false, motivo: "Exige Estabilidade 100 % no Núcleo." };
  if (state.creditos < REATOR.custoVaso) return { ok: false, motivo: "₵ insuficientes para o Vaso." };
  return { ok: true, motivo: null };
}

export function podeConstruirReator(state: GameState): boolean {
  return avaliarConstruirReator(state).ok;
}

/** Desmonta a Torre, planta o Vaso e começa a Era 2. Função pura. */
export function construirReator(state: GameState): GameState | null {
  if (!podeConstruirReator(state) || !state.nucleo) return null;
  const reembolso = reembolsoDaTorre(state.nucleo);
  const nucleo: NucleoState = {
    era: 2,
    lado: REATOR.ladoInicial,
    grade: gradeVazia(REATOR.ladoInicial),
    calorU: 0,
    tempoAcimaDoLimiteMs: 0,
    scramRestanteMs: 0,
    scramInicioMs: null,
    trocasEmFaixa: 0,
    // A Estabilidade é da era, não do jogador: começa de novo (GDD Parte 2 §2).
    estabilidade: 0,
    modoSeguro: state.nucleo.modoSeguro,
    receptorCeramico: false,
    cascatas: 0,
    ultimaCascataMs: null,
    ultimaCascata: null,
  };
  return {
    ...state,
    era: 2,
    creditos: state.creditos - REATOR.custoVaso + reembolso,
    nucleo,
    eventos: [...state.eventos, { tipo: "eraMudou", era: 2 }],
  };
}

/**
 * A saída da Era 2 (GDD Parte 2 §6): Fusão básica + Estabilidade 100 %. A Era 3 é a Sessão 9 — aqui o
 * jogo para com um aviso, e é isso que a interface mostra.
 */
export function era3Pronta(state: GameState): boolean {
  return state.era === 2 && state.pesquisados.includes(NO_SAIDA_ERA2) && (state.nucleo?.estabilidade ?? 0) >= 100;
}
