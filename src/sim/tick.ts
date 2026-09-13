/**
 * Passo de simulação em timestep fixo. Ordem do tick (Sessões 1 e 2):
 *   1. potência do Núcleo, com o Q do início do tick;
 *   2. oferta da Rede = usinas + potência do Núcleo;
 *   3. venda até a demanda → bateria → receita com o multiplicador de r;
 *   4. calor: entrada dos espelhos → dissipação dos radiadores → consumo das turbinas;
 *   5. pesquisa e Estabilidade, pela faixa de T depois do passo 4;
 *   6. modo seguro, cronômetro e checagem da Cascata.
 */
import { CASCATA, MODO_SEGURO, NUCLEO, type FaixaCalor } from "../content/era1-nucleo";
import { faixaDeCalor, pesquisaPorSegundo, temperatura } from "./calor";
import { aplicarCascata, atualizarCronometro, deveCascatear, emScram, scram } from "./cascata";
import { passoEstabilidade } from "./estabilidade";
import { capacidadeU, contar, espelhosEfetivosDe, passoCalor, potenciaNucleoKw } from "./nucleo";
import { calorPorEspelho } from "./melhorias";
import { passoRemocoes } from "./mundo";
import { analisar, derivarRede } from "./producao";
import { balancoRede, passoRede, type BalancoRede } from "./rede";
import type { EventoJogo, GameState, NucleoState } from "./state";
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "./tempo";

export { DT_ACUMULADO_MAX_MS, TICK_MS };

/** Potência que o Núcleo entrega à Rede: 0 em SCRAM, ×0,7 no modo seguro. */
export function potenciaNucleoEfetivaKw(nucleo: NucleoState | null): number {
  if (!nucleo || emScram(nucleo)) return 0;
  const bruta = potenciaNucleoKw(nucleo.grade, nucleo.calorU);
  return nucleo.modoSeguro ? bruta * MODO_SEGURO.fatorPotencia : bruta;
}

/**
 * Balanço da Rede do estado inteiro (usinas escoadas + Núcleo). É o que o HUD mostra.
 * A oferta e a demanda vêm do mundo (alcance das subestações, cabos); as fórmulas de §4.1 não mudam.
 */
export function balancoDoEstado(state: GameState): BalancoRede {
  const analise = analisar(state);
  return balancoRede(derivarRede(state, analise), {
    potenciaNucleoKw: potenciaNucleoEfetivaKw(state.nucleo),
    dtS: TICK_MS / 1000,
    melhorias: state.melhorias,
    ofertaUsinasKw: analise.ofertaKw,
    demandaKw: analise.demandaKw,
  });
}

export interface PassoNucleo {
  nucleo: NucleoState;
  pesquisaGanha: number;
  cascatou: boolean;
  /** Fluxos de calor no início do tick (u/s), para o card da Cascata. */
  entradaUs: number;
  saidaUs: number;
  /** T depois do passo de calor. */
  t: number;
  faixa: FaixaCalor;
}

/**
 * Passos 4 a 6 do tick. `potenciaKw` é a potência efetiva calculada no passo 1;
 * `calorEspelho` é o calor por espelho já com as melhorias (Rastreamento solar).
 */
export function passoNucleo(
  nucleo: NucleoState,
  potenciaKw: number,
  dtMs: number,
  tempoMs: number,
  calorEspelho: number = calorPorEspelho(undefined),
): PassoNucleo {
  const dtS = dtMs / 1000;
  const scramAtivo = emScram(nucleo);

  // Fluxos do início do tick (o card da Cascata mostra estes números, não os do SCRAM que vem depois).
  const c = contar(nucleo.grade);
  const entradaUs = scramAtivo ? 0 : calorEspelho * espelhosEfetivosDe(c);
  const saidaUs = NUCLEO.dissipacaoRadiador * c.radiadoresAdjacentes + (scramAtivo ? 0 : NUCLEO.consumoTurbina * c.turbinas * nucleo.calorU);

  // 4. calor
  const capacidade = capacidadeU(nucleo.grade, nucleo.receptorCeramico);
  const tAntes = temperatura(nucleo.calorU, capacidade);
  const calorU = passoCalor(nucleo.grade, nucleo.calorU, dtS, scramAtivo, calorEspelho);
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
    proximo = aplicarCascata(proximo, tempoMs, { entradaUs, saidaUs });
    cascatou = true;
  }

  return { nucleo: proximo, pesquisaGanha, cascatou, entradaUs, saidaUs, t, faixa };
}

/**
 * Avança o estado em um tick de `dtMs` (normalmente `TICK_MS`). Função pura.
 * Passo 0: a fila de remoção de obstáculos (GDD §2.4) — muda o mundo antes de medir a produção.
 */
export function tick(state: GameState, dtMs: number = TICK_MS): GameState {
  const tempoMs = state.tempoMs + dtMs;

  // A fila de eventos é limpa a cada tick; só o próprio tick adiciona aqui.
  const base: GameState = { ...state, tempoMs, eventos: [] };

  // 0. obstáculos em remoção
  const comMundo = passoRemocoes(base);
  const analise = analisar(comMundo);
  const eventos: EventoJogo[] = [...comMundo.eventos];

  // 1. potência do Núcleo com o Q do início do tick
  const potenciaNucleo = potenciaNucleoEfetivaKw(comMundo.nucleo);

  // 2–3. Rede
  const passo = passoRede(derivarRede(comMundo, analise), dtMs, {
    potenciaNucleoKw: potenciaNucleo,
    melhorias: comMundo.melhorias,
    ofertaUsinasKw: analise.ofertaKw,
    demandaKw: analise.demandaKw,
  });
  let kwh = passo.rede.bateria.kwh;
  let pesquisa = comMundo.pesquisa;
  let nucleo = comMundo.nucleo;

  // 4–6. Núcleo
  if (nucleo) {
    const pn = passoNucleo(nucleo, potenciaNucleo, dtMs, tempoMs, calorPorEspelho(comMundo.melhorias));
    nucleo = pn.nucleo;
    pesquisa += pn.pesquisaGanha;
    if (pn.cascatou) {
      kwh *= 1 - CASCATA.perdaBateria;
      eventos.push({ tipo: "cascata", entradaUs: pn.entradaUs, saidaUs: pn.saidaUs });
    }
  }

  return {
    ...comMundo,
    creditos: comMundo.creditos + passo.receita,
    pesquisa,
    rede: { ...comMundo.rede, bateria: { kwh } },
    nucleo,
    eventos,
  };
}

/** Aplica `n` ticks de `TICK_MS`. */
export function avancarTicks(state: GameState, n: number): GameState {
  let atual = state;
  for (let i = 0; i < n; i++) atual = tick(atual, TICK_MS);
  return atual;
}
