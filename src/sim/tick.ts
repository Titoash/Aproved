/**
 * Passo de simulação em timestep fixo. Ordem do tick (Sessões 1 e 2):
 *   1. potência do Núcleo, com o Q do início do tick;
 *   2. oferta da Rede = usinas + potência do Núcleo;
 *   3. venda até a demanda → bateria → receita com o multiplicador de r;
 *   4. calor: entrada dos espelhos → dissipação dos radiadores → consumo das turbinas;
 *   5. pesquisa e Estabilidade, pela faixa de T depois do passo 4;
 *   6. modo seguro, cronômetro e checagem da Cascata.
 */
import { CASCATA, MODO_SEGURO, type FaixaCalor } from "../content/regras";
import { defDoNucleo } from "../content/eras";
import { faixaDeCalor, pesquisaPorSegundo, temperatura } from "./calor";
import { aplicarCascata, atualizarCronometro, deveCascatear, emScram, scram } from "./cascata";
import { passoEstabilidade } from "./estabilidade";
import { aquecedoresEfetivosDe, calorBasePorAquecedor, capacidadeU, contar, passoCalor, potenciaNucleoKw } from "./nucleo";
import { queimarGrade } from "./combustivel";
import { calorPorEspelho } from "./melhorias";
import { balancoRede, passoRede, type BalancoRede } from "./rede";
import type { EventoJogo, GameState, NucleoState } from "./state";
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "./tempo";

export { DT_ACUMULADO_MAX_MS, TICK_MS };

/** Potência que o Núcleo entrega à Rede: 0 em SCRAM, ×0,7 no modo seguro. */
export function potenciaNucleoEfetivaKw(nucleo: NucleoState | null): number {
  if (!nucleo || emScram(nucleo)) return 0;
  const bruta = potenciaNucleoKw(nucleo.grade, nucleo.calorU, defDoNucleo(nucleo));
  return nucleo.modoSeguro ? bruta * MODO_SEGURO.fatorPotencia : bruta;
}

/** Balanço da Rede do estado inteiro (usinas + Núcleo). É o que o HUD mostra. */
export function balancoDoEstado(state: GameState): BalancoRede {
  return balancoRede(state.rede, {
    potenciaNucleoKw: potenciaNucleoEfetivaKw(state.nucleo),
    dtS: TICK_MS / 1000,
    melhorias: state.melhorias,
    era: state.era,
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
 * Passos 4a a 6 do tick. `potenciaKw` é a potência efetiva calculada no passo 1;
 * `calorEspelho` é o calor por espelho já com as melhorias (Rastreamento solar).
 */
export function passoNucleo(
  nucleo: NucleoState,
  potenciaKw: number,
  dtMs: number,
  tempoMs: number,
  calorAquecedor?: number,
): PassoNucleo {
  const dtS = dtMs / 1000;
  const scramAtivo = emScram(nucleo);
  const def = defDoNucleo(nucleo);
  const calorPorAquecedor = calorAquecedor ?? calorBasePorAquecedor(def);

  // 4a. combustível (GDD §8.5.4): queima antes do balanço, então a vareta que
  // esgota neste tick já não injeta calor neste tick. Em SCRAM não queima.
  const grade = queimarGrade(nucleo.grade, dtS, tempoMs, def, scramAtivo);

  // Fluxos do início do tick (o card da Cascata mostra estes números, não os do SCRAM que vem depois).
  const c = contar(grade, def);
  const entradaUs = scramAtivo ? 0 : calorPorAquecedor * aquecedoresEfetivosDe(c, def);
  const saidaUs = c.dissipacaoUs + (scramAtivo ? 0 : def.consumoConversor * c.conversores * nucleo.calorU);

  // 4. calor
  const capacidade = capacidadeU(grade, nucleo.receptorCeramico, def);
  const tAntes = temperatura(nucleo.calorU, capacidade);
  const calorU = passoCalor(grade, nucleo.calorU, dtS, scramAtivo, calorPorAquecedor, def);
  const t = temperatura(calorU, capacidade);
  const faixa = faixaDeCalor(t);

  // 5. pesquisa e Estabilidade (nada durante o SCRAM; Estabilidade só com o Núcleo produzindo)
  const pesquisaGanha = scramAtivo ? 0 : pesquisaPorSegundo(potenciaKw, t, def) * dtS;
  const porMinuto = scramAtivo || potenciaKw <= 0 ? 0 : faixa.estabilidadePorMinuto;
  const estabilidade = passoEstabilidade(nucleo.estabilidade, porMinuto, dtS);

  let proximo: NucleoState = {
    ...nucleo,
    grade: grade === nucleo.grade ? nucleo.grade : [...grade],
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

/** Avança o estado em um tick de `dtMs` (normalmente `TICK_MS`). Função pura. */
export function tick(state: GameState, dtMs: number = TICK_MS): GameState {
  const tempoMs = state.tempoMs + dtMs;

  // 1. potência do Núcleo com o Q do início do tick
  const potenciaNucleo = potenciaNucleoEfetivaKw(state.nucleo);

  // 2–3. Rede
  const passo = passoRede(state.rede, dtMs, { potenciaNucleoKw: potenciaNucleo, melhorias: state.melhorias });
  let rede = passo.rede;
  let pesquisa = state.pesquisa;
  let nucleo = state.nucleo;
  // A fila de eventos é limpa a cada tick; só o próprio tick adiciona aqui.
  const eventos: EventoJogo[] = [];

  // 4–6. Núcleo
  if (nucleo) {
    const pn = passoNucleo(nucleo, potenciaNucleo, dtMs, tempoMs, calorPorEspelho(state.melhorias));
    nucleo = pn.nucleo;
    pesquisa += pn.pesquisaGanha;
    if (pn.cascatou) {
      rede = { ...rede, bateria: { ...rede.bateria, kwh: rede.bateria.kwh * (1 - CASCATA.perdaBateria) } };
      eventos.push({ tipo: "cascata", entradaUs: pn.entradaUs, saidaUs: pn.saidaUs });
    }
  }

  return {
    ...state,
    tempoMs,
    creditos: state.creditos + passo.receita,
    pesquisa,
    rede,
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
