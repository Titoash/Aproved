/**
 * Passo de simulação em timestep fixo. Ordem do tick (Sessões 1 e 2):
 *   1. potência do Núcleo, com o Q do início do tick;
 *   2. oferta da Rede = usinas + potência do Núcleo;
 *   3. venda até a demanda → bateria → receita com o multiplicador de r;
 *   4. calor: entrada dos espelhos → dissipação dos radiadores → consumo das turbinas;
 *   5. pesquisa e Estabilidade, pela faixa de T depois do passo 4;
 *   6. modo seguro, cronômetro e checagem da Cascata.
 */
import { CASCATA, MODO_SEGURO, type FaixaCalor } from "../content/era1-nucleo";
import { faixaDeCalor, pesquisaPorSegundo, temperatura } from "./calor";
import { aplicarCascata, atualizarCronometro, deveCascatear, emScram, scram } from "./cascata";
import { passoEstabilidade } from "./estabilidade";
import { capacidadeU, passoCalor, potenciaNucleoKw } from "./nucleo";
import { balancoRede, passoRede, type BalancoRede } from "./rede";
import type { GameState, NucleoState } from "./state";

/** Duração de um tick, em ms. */
export const TICK_MS = 100;
/** Limite do tempo acumulado entre frames (aba em segundo plano). */
export const DT_ACUMULADO_MAX_MS = 5000;

/** Potência que o Núcleo entrega à Rede: 0 em SCRAM, ×0,7 no modo seguro. */
export function potenciaNucleoEfetivaKw(nucleo: NucleoState | null): number {
  if (!nucleo || emScram(nucleo)) return 0;
  const bruta = potenciaNucleoKw(nucleo.grade, nucleo.calorU);
  return nucleo.modoSeguro ? bruta * MODO_SEGURO.fatorPotencia : bruta;
}

/** Balanço da Rede do estado inteiro (usinas + Núcleo). É o que o HUD mostra. */
export function balancoDoEstado(state: GameState): BalancoRede {
  return balancoRede(state.rede, potenciaNucleoEfetivaKw(state.nucleo));
}

export interface PassoNucleo {
  nucleo: NucleoState;
  pesquisaGanha: number;
  cascatou: boolean;
  /** T depois do passo de calor. */
  t: number;
  faixa: FaixaCalor;
}

/** Passos 4 a 6 do tick. `potenciaKw` é a potência efetiva calculada no passo 1. */
export function passoNucleo(nucleo: NucleoState, potenciaKw: number, dtMs: number, tempoMs: number): PassoNucleo {
  const dtS = dtMs / 1000;
  const scramAtivo = emScram(nucleo);

  // 4. calor
  const capacidade = capacidadeU(nucleo.grade, nucleo.receptorCeramico);
  const tAntes = temperatura(nucleo.calorU, capacidade);
  const calorU = passoCalor(nucleo.grade, nucleo.calorU, dtS, scramAtivo);
  const t = temperatura(calorU, capacidade);
  const faixa = faixaDeCalor(t);

  // 5. pesquisa e Estabilidade (nada durante o SCRAM; Estabilidade só com o Núcleo produzindo)
  const pesquisaGanha = scramAtivo ? 0 : pesquisaPorSegundo(potenciaKw, t) * dtS;
  const porMinuto = scramAtivo || potenciaKw <= 0 ? 0 : faixa.estabilidadePorMinuto;
  const estabilidade = passoEstabilidade(nucleo.estabilidade, porMinuto, dtS);

  let proximo: NucleoState = {
    ...nucleo,
    calorU,
    estabilidade,
    scramRestanteMs: Math.max(0, nucleo.scramRestanteMs - dtMs),
  };

  // 6. modo seguro → cronômetro → Cascata
  if (proximo.modoSeguro && !scramAtivo && t >= MODO_SEGURO.limiarT) proximo = scram(proximo);
  proximo.tempoAcimaDoLimiteMs = atualizarCronometro(nucleo.tempoAcimaDoLimiteMs, tAntes, t, dtMs, emScram(proximo));
  let cascatou = false;
  if (deveCascatear(proximo.tempoAcimaDoLimiteMs)) {
    proximo = aplicarCascata(proximo, tempoMs);
    cascatou = true;
  }

  return { nucleo: proximo, pesquisaGanha, cascatou, t, faixa };
}

/** Avança o estado em um tick de `dtMs` (normalmente `TICK_MS`). Função pura. */
export function tick(state: GameState, dtMs: number = TICK_MS): GameState {
  const tempoMs = state.tempoMs + dtMs;

  // 1. potência do Núcleo com o Q do início do tick
  const potenciaNucleo = potenciaNucleoEfetivaKw(state.nucleo);

  // 2–3. Rede
  const passo = passoRede(state.rede, dtMs, potenciaNucleo);
  let rede = passo.rede;
  let pesquisa = state.pesquisa;
  let nucleo = state.nucleo;

  // 4–6. Núcleo
  if (nucleo) {
    const pn = passoNucleo(nucleo, potenciaNucleo, dtMs, tempoMs);
    nucleo = pn.nucleo;
    pesquisa += pn.pesquisaGanha;
    if (pn.cascatou) {
      rede = { ...rede, bateria: { ...rede.bateria, kwh: rede.bateria.kwh * (1 - CASCATA.perdaBateria) } };
    }
  }

  return {
    ...state,
    tempoMs,
    creditos: state.creditos + passo.receita,
    pesquisa,
    rede,
    nucleo,
  };
}

/** Aplica `n` ticks de `TICK_MS`. */
export function avancarTicks(state: GameState, n: number): GameState {
  let atual = state;
  for (let i = 0; i < n; i++) atual = tick(atual, TICK_MS);
  return atual;
}
