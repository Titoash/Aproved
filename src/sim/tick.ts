/**
 * Passo de simulação em timestep fixo. Ordem do tick (Sessões 1 e 2):
 *   1. potência do Núcleo, com o Q do início do tick;
 *   2. oferta da Rede = usinas + potência do Núcleo;
 *   3. venda até a demanda → bateria → receita com o multiplicador de r;
 *   4. calor: entrada dos espelhos → dissipação dos radiadores → consumo das turbinas;
 *   5. pesquisa e Estabilidade, pela faixa de T depois do passo 4;
 *   6. modo seguro, cronômetro e checagem da Cascata;
 *   7. Ocorrências: relógio, oferta, meta e fim (Parte 1 §4.4, v0.9) — a perturbação e o controle já
 *      entraram nos passos 1 e 4 como multiplicadores do motor.
 */
import { CASCATA, MODO_SEGURO, type FaixaCalor } from "../content/era1-nucleo";
import { faixaDeCalor, pesquisaPorSegundo, temperatura } from "./calor";
import { aplicarCascata, atualizarCronometro, deveCascatear, emScram, scram } from "./cascata";
import { passoEstabilidade } from "./estabilidade";
import { motorDoNucleo, MULTIPLICADORES_NEUTROS, passoMotor, potenciaMotor, type MultiplicadoresMotor } from "./motor";
import { multiplicadoresDoEstado, passoOcorrencias } from "./ocorrencias";
import { fissionando, passoVaretas } from "./reator";
import { efeitosDe, efeitosNeutros, type EfeitosArvore } from "./efeitos";
import { passoCapitulos } from "./capitulos";
import { passoRemocoes } from "./mundo";
import { analisar, derivarRede } from "./producao";
import { balancoRede, passoRede, type BalancoRede } from "./rede";
import type { EventoJogo, GameState, NucleoState } from "./state";
import { DT_ACUMULADO_MAX_MS, TICK_MS } from "./tempo";

export { DT_ACUMULADO_MAX_MS, TICK_MS };

/**
 * Potência que o Núcleo entrega à Rede: 0 em SCRAM, ×0,7 no modo seguro. `mult` são os multiplicadores da
 * Ocorrência em curso (a carga das turbinas muda a potência a cada `Q`).
 */
export function potenciaNucleoEfetivaKw(
  nucleo: NucleoState | null,
  efeitos: EfeitosArvore = efeitosNeutros(),
  tempoMs = 0,
  mult: MultiplicadoresMotor = MULTIPLICADORES_NEUTROS,
): number {
  if (!nucleo || emScram(nucleo)) return 0;
  const bruta = potenciaMotor(motorDoNucleo(nucleo, efeitos, tempoMs, mult), nucleo.calorU);
  return nucleo.modoSeguro ? bruta * MODO_SEGURO.fatorPotencia : bruta;
}

/** Atalho: a potência do Núcleo do estado, com o relógio do jogo (o decaimento da Era 2 depende dele) e a Ocorrência. */
export function potenciaNucleoDoEstado(state: GameState): number {
  return potenciaNucleoEfetivaKw(state.nucleo, efeitosDe(state), state.tempoMs, multiplicadoresDoEstado(state));
}

/**
 * Balanço da Rede do estado inteiro (usinas escoadas + Núcleo). É o que o HUD mostra.
 * A oferta e a demanda vêm do mundo (alcance das subestações, cabos); as fórmulas de §4.1 não mudam.
 */
export function balancoDoEstado(state: GameState): BalancoRede {
  const analise = analisar(state);
  const efeitos = efeitosDe(state);
  return balancoRede(derivarRede(state, analise), {
    potenciaNucleoKw: potenciaNucleoEfetivaKw(state.nucleo, efeitos, state.tempoMs, multiplicadoresDoEstado(state)),
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
 * Passos 4 a 6 do tick. `potenciaKw` é a potência efetiva calculada no passo 1; `mult` são os multiplicadores
 * da Ocorrência em curso (perturbação e controle), neutros fora dela.
 */
export function passoNucleo(
  nucleo: NucleoState,
  potenciaKw: number,
  dtMs: number,
  tempoMs: number,
  efeitos: EfeitosArvore = efeitosNeutros(),
  mult: MultiplicadoresMotor = MULTIPLICADORES_NEUTROS,
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
  const motor = motorDoNucleo(atual, efeitos, tempoMs, mult);
  const entradaUs = motor.entradaUs;
  const saidaUs = motor.dissipacaoUs + motor.fatorTurbina * atual.calorU;

  // 4. calor
  const capacidade = motor.capacidadeU;
  const tAntes = temperatura(atual.calorU, capacidade);
  const calorU = passoMotor(motor, atual.calorU, dtS);
  const t = temperatura(calorU, capacidade);
  const faixa = faixaDeCalor(t);

  // 5. pesquisa e Estabilidade (nada durante o SCRAM; Estabilidade só com o Núcleo produzindo — e, na
  //    Era 2, só com fissão: o decaimento de um reator sem combustível não conta, Parte 2 §5.2)
  const pesquisaGanha = scramAtivo ? 0 : pesquisaPorSegundo(potenciaKw, t, motor.pesquisaPorKw) * dtS;
  const operando = !scramAtivo && potenciaKw > 0 && (atual.era !== 2 || fissionando(atual));
  const porMinuto = operando ? faixa.estabilidadePorMinuto : 0;
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

  // 1. potência do Núcleo com o Q do início do tick (e a Ocorrência em curso, no instante deste tick)
  const mult = multiplicadoresDoEstado(comMundo, tempoMs);
  const potenciaNucleo = potenciaNucleoEfetivaKw(comMundo.nucleo, efeitos, tempoMs, mult);

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
  let cascatou = false;
  let pesquisaNucleoPorS = 0;
  if (nucleo) {
    const pn = passoNucleo(nucleo, potenciaNucleo, dtMs, tempoMs, efeitos, mult);
    nucleo = pn.nucleo;
    pesquisa += pn.pesquisaGanha;
    pesquisaNucleoPorS = pn.pesquisaGanha / (dtMs / 1000);
    cascatou = pn.cascatou;
    if (pn.cascatou) {
      kwh *= 1 - CASCATA.perdaBateria;
      eventos.push({ tipo: "cascata", entradaUs: pn.entradaUs, saidaUs: pn.saidaUs });
    }
    for (const indice of pn.esgotadas) eventos.push({ tipo: "varetaEsgotada", indice });
  }

  const depoisDoNucleo: GameState = {
    ...comMundo,
    creditos: comMundo.creditos + passo.receita,
    pesquisa,
    rede: { ...comMundo.rede, bateria: { kwh } },
    nucleo,
    eventos,
  };

  // 7. Ocorrências (Parte 1 §4.4): o relógio anda, a oferta sai ou expira, a meta conta e a Ocorrência fecha.
  const proximo = passoOcorrencias(depoisDoNucleo, {
    dtMs,
    cascatou,
    pesquisaPorSegundo: pesquisaNucleoPorS + analise.pesquisaPorSegundo,
  });

  // 8. capítulos: o objetivo ativo fecha e paga sozinho (GDD §12, v0.6).
  return passoCapitulos(proximo);
}

/** Aplica `n` ticks de `TICK_MS`. */
export function avancarTicks(state: GameState, n: number): GameState {
  if (n <= 1) return n === 1 ? tick(state, TICK_MS) : state;
  // Cada tick limpa a fila de eventos: com vários de uma vez (aba que volta, roteiros), os do meio se
  // perdiam e o diário e os cards não viam uma árvore cair (Sessão 9, parte F). O estado final leva todos.
  let atual = state;
  const eventos: EventoJogo[] = [];
  for (let i = 0; i < n; i++) {
    atual = tick(atual, TICK_MS);
    for (const e of atual.eventos) eventos.push(e);
  }
  return eventos.length === atual.eventos.length ? atual : { ...atual, eventos };
}
