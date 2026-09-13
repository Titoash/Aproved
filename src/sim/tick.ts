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
import { motorDoNucleo, passoMotor, potenciaMotor } from "./motor";
import { passoVaretas } from "./reator";
import { efeitosDe, efeitosNeutros, type EfeitosArvore } from "./efeitos";
import { passoCapitulos } from "./capitulos";
import { passoRemocoes } from "./mundo";
import { analisar, derivarRede } from "./producao";
import { balancoRede, passoRede, type BalancoRede } from "./rede";
import type { EventoJogo, GameState, NucleoState } from "./state";
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "./tempo";

export { DT_ACUMULADO_MAX_MS, TICK_MS };

/** Potência que o Núcleo entrega à Rede: 0 em SCRAM, ×0,7 no modo seguro. */
export function potenciaNucleoEfetivaKw(nucleo: NucleoState | null, efeitos: EfeitosArvore = efeitosNeutros(), tempoMs = 0): number {
  if (!nucleo || emScram(nucleo)) return 0;
  const bruta = potenciaMotor(motorDoNucleo(nucleo, efeitos, tempoMs), nucleo.calorU);
  return nucleo.modoSeguro ? bruta * MODO_SEGURO.fatorPotencia : bruta;
}

/** Atalho: a potência do Núcleo do estado, com o relógio do jogo (o decaimento da Era 2 depende dele). */
export function potenciaNucleoDoEstado(state: GameState): number {
  return potenciaNucleoEfetivaKw(state.nucleo, efeitosDe(state), state.tempoMs);
}

/**
 * Balanço da Rede do estado inteiro (usinas escoadas + Núcleo). É o que o HUD mostra.
 * A oferta e a demanda vêm do mundo (alcance das subestações, cabos); as fórmulas de §4.1 não mudam.
 */
export function balancoDoEstado(state: GameState): BalancoRede {
  const analise = analisar(state);
  const efeitos = efeitosDe(state);
  return balancoRede(derivarRede(state, analise), {
    potenciaNucleoKw: potenciaNucleoEfetivaKw(state.nucleo, efeitos, state.tempoMs),
    dtS: TICK_MS / 1000,
    efeitos,
    ofertaUsinasKw: analise.ofertaKw,
    demandaKw: analise.demandaKw,
    tarifa: analise.tarifa,
    custoOperacaoPorSegundo: analise.custoOperacaoPorSegundo,
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
  /** Casas cujas varetas esgotaram neste passo (Era 2). */
  esgotadas: number[];
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
  efeitos: EfeitosArvore = efeitosNeutros(),
): PassoNucleo {
  const dtS = dtMs / 1000;
  const scramAtivo = emScram(nucleo);

  // 3b. combustível: as varetas gastam enquanto o reator está ligado, e a que zera vira gasta e passa
  //     a só decair (GDD Parte 2 §5.2). Na Era 1 isto não faz nada.
  let atual = nucleo;
  const esgotadas: number[] = [];
  if (nucleo.era === 2) {
    const pv = passoVaretas(nucleo, dtMs, tempoMs, efeitos);
    if (pv.grade !== nucleo.grade) atual = { ...nucleo, grade: pv.grade };
    esgotadas.push(...pv.esgotadas);
  }

  // Fluxos do início do tick (o card da Cascata mostra estes números, não os do SCRAM que vem depois).
  const motor = motorDoNucleo(atual, efeitos, tempoMs);
  const entradaUs = motor.entradaUs;
  const saidaUs = motor.dissipacaoUs + motor.fatorTurbina * atual.calorU;

  // 4. calor
  const capacidade = motor.capacidadeU;
  const tAntes = temperatura(atual.calorU, capacidade);
  const calorU = passoMotor(motor, atual.calorU, dtS);
  const t = temperatura(calorU, capacidade);
  const faixa = faixaDeCalor(t);

  // 5. pesquisa e Estabilidade (nada durante o SCRAM; Estabilidade só com o Núcleo produzindo)
  const pesquisaGanha = scramAtivo ? 0 : pesquisaPorSegundo(potenciaKw, t, motor.pesquisaPorKw) * dtS;
  const porMinuto = scramAtivo || potenciaKw <= 0 ? 0 : faixa.estabilidadePorMinuto;
  const estabilidade = passoEstabilidade(atual.estabilidade, porMinuto, dtS);

  const scramRestanteMs = Math.max(0, atual.scramRestanteMs - dtMs);
  let proximo: NucleoState = {
    ...atual,
    calorU,
    estabilidade,
    scramRestanteMs,
    scramInicioMs: scramRestanteMs > 0 ? atual.scramInicioMs : null,
  };

  // 6. modo seguro → cronômetro → Cascata
  if (proximo.modoSeguro && !scramAtivo && t >= MODO_SEGURO.limiarT) proximo = scram(proximo, tempoMs);
  proximo.tempoAcimaDoLimiteMs = atualizarCronometro(atual.tempoAcimaDoLimiteMs, tAntes, t, dtMs, emScram(proximo));
  let cascatou = false;
  if (deveCascatear(proximo.tempoAcimaDoLimiteMs)) {
    proximo = aplicarCascata(proximo, tempoMs, { entradaUs, saidaUs });
    cascatou = true;
  }

  return { nucleo: proximo, pesquisaGanha, cascatou, entradaUs, saidaUs, t, faixa, esgotadas };
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
  const efeitos = efeitosDe(comMundo);
  const eventos: EventoJogo[] = [...comMundo.eventos];

  // 1. potência do Núcleo com o Q do início do tick
  const potenciaNucleo = potenciaNucleoEfetivaKw(comMundo.nucleo, efeitos, tempoMs);

  // 2–3. Rede
  const passo = passoRede(derivarRede(comMundo, analise), dtMs, {
    potenciaNucleoKw: potenciaNucleo,
    efeitos,
    ofertaUsinasKw: analise.ofertaKw,
    demandaKw: analise.demandaKw,
    tarifa: analise.tarifa,
    custoOperacaoPorSegundo: analise.custoOperacaoPorSegundo,
  });
  let kwh = passo.rede.bateria.kwh;
  // Laboratórios e universidades rendem 🔬 junto com o Núcleo (GDD §2.5, §8.6).
  let pesquisa = comMundo.pesquisa + analise.pesquisaPorSegundo * (dtMs / 1000);
  let nucleo = comMundo.nucleo;

  // 4–6. Núcleo
  if (nucleo) {
    const pn = passoNucleo(nucleo, potenciaNucleo, dtMs, tempoMs, efeitos);
    nucleo = pn.nucleo;
    pesquisa += pn.pesquisaGanha;
    if (pn.cascatou) {
      kwh *= 1 - CASCATA.perdaBateria;
      eventos.push({ tipo: "cascata", entradaUs: pn.entradaUs, saidaUs: pn.saidaUs });
    }
    for (const indice of pn.esgotadas) eventos.push({ tipo: "varetaEsgotada", indice });
  }

  const proximo: GameState = {
    ...comMundo,
    creditos: comMundo.creditos + passo.receita,
    pesquisa,
    rede: { ...comMundo.rede, bateria: { kwh } },
    nucleo,
    eventos,
  };

  // 7. capítulos: o objetivo ativo fecha e paga sozinho (GDD §12, v0.6).
  return passoCapitulos(proximo);
}

/** Aplica `n` ticks de `TICK_MS`. */
export function avancarTicks(state: GameState, n: number): GameState {
  let atual = state;
  for (let i = 0; i < n; i++) atual = tick(atual, TICK_MS);
  return atual;
}
