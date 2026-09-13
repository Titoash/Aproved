/**
 * Motor de calor das duas eras (GDD §4.2 e Parte 2 §5). A fórmula **não muda de era**:
 *
 *   dQ/dt = entrada − dissipação − fatorTurbina · Q        Q* = (entrada − dissipação) ÷ fatorTurbina
 *   T = Q ÷ capacidade                                     potência = fatorTurbina · Q · kW por u
 *
 * O que muda é quem preenche cada número: espelhos, radiadores e turbinas a vapor na Era 1; varetas
 * com combustível finito, torres de resfriamento e turbinas de alta pressão na Era 2. Este módulo é o
 * único lugar que sabe qual das duas está em jogo.
 */
import { NUCLEO } from "../content/era1-nucleo";
import { REATOR } from "../content/era2-nucleo";
import { efeitosNeutros, type EfeitosArvore } from "./efeitos";
import { capacidadeU, contar, espelhosEfetivosDe } from "./nucleo";
import { capacidadeReatorU, contarReator, dissipacaoReatorUs, entradaReatorUs } from "./reator";
import type { NucleoState } from "./state";

export interface MotorCalor {
  /** u/s que entram no componente crítico (já com SCRAM e decaimento aplicados). */
  entradaUs: number;
  /** u/s dissipados por radiadores (Era 1) ou torres de resfriamento (Era 2). */
  dissipacaoUs: number;
  /** Fração de `Q` consumida por segundo pelo conjunto de turbinas. */
  fatorTurbina: number;
  /** kW por u consumida. */
  kwPorU: number;
  capacidadeU: number;
  turbinas: number;
  /** kW que o próprio Núcleo gasta (radiador ativo da Era 1). */
  consumoKwFixo: number;
  /** Pesquisa/s por kW do Núcleo, antes do multiplicador da faixa. */
  pesquisaPorKw: number;
}

/** Motor da Torre Solar (GDD §8.3). */
export function motorEra1(nucleo: NucleoState, efeitos: EfeitosArvore = efeitosNeutros()): MotorCalor {
  const c = contar(nucleo.grade);
  const emScram = nucleo.scramRestanteMs > 0;
  return {
    entradaUs: emScram ? 0 : efeitos.calorPorEspelho * espelhosEfetivosDe(c),
    dissipacaoUs: efeitos.dissipacaoRadiador * c.radiadoresAdjacentes,
    fatorTurbina: emScram ? 0 : NUCLEO.consumoTurbina * c.turbinas,
    kwPorU: efeitos.turbinaKwPorUnidade,
    capacidadeU: capacidadeU(nucleo.grade, nucleo.receptorCeramico, efeitos),
    turbinas: c.turbinas,
    consumoKwFixo: c.radiadoresAdjacentes * efeitos.consumoRadiadorKw,
    pesquisaPorKw: NUCLEO.pesquisaPorKw,
  };
}

/**
 * Motor do Reator PWR (GDD Parte 2 §5). Em SCRAM as turbinas param, mas o calor de decaimento
 * continua entrando: é o que faz a torre de resfriamento valer a pena.
 */
export function motorEra2(nucleo: NucleoState, efeitos: EfeitosArvore = efeitosNeutros(), tempoMs = 0): MotorCalor {
  const c = contarReator(nucleo.grade);
  const emScram = nucleo.scramRestanteMs > 0;
  return {
    entradaUs: entradaReatorUs(nucleo, efeitos, tempoMs),
    dissipacaoUs: dissipacaoReatorUs(nucleo.grade),
    fatorTurbina: emScram ? 0 : REATOR.consumoTurbina * c.turbinas,
    kwPorU: efeitos.reatorKwPorUnidade,
    capacidadeU: capacidadeReatorU(nucleo.grade),
    turbinas: c.turbinas,
    consumoKwFixo: 0,
    pesquisaPorKw: REATOR.pesquisaPorKw,
  };
}

export function motorDoNucleo(nucleo: NucleoState, efeitos: EfeitosArvore = efeitosNeutros(), tempoMs = 0): MotorCalor {
  return nucleo.era === 2 ? motorEra2(nucleo, efeitos, tempoMs) : motorEra1(nucleo, efeitos);
}

/** dQ/dt, em u/s. */
export function balancoMotor(m: MotorCalor, calorU: number): number {
  return m.entradaUs - m.dissipacaoUs - m.fatorTurbina * calorU;
}

/** `Q*`: o calor em que dQ/dt = 0. Sem turbinas o calor só sobe (ou já está no chão). */
export function equilibrioMotor(m: MotorCalor): number {
  const liquido = m.entradaUs - m.dissipacaoUs;
  if (m.fatorTurbina === 0) return liquido > 0 ? Infinity : 0;
  return Math.max(0, liquido / m.fatorTurbina);
}

/** Potência bruta do Núcleo, em kW. */
export function potenciaMotor(m: MotorCalor, calorU: number): number {
  return Math.max(0, m.fatorTurbina * Math.max(0, calorU) * m.kwPorU - m.consumoKwFixo);
}

/** Um passo de calor por Euler explícito, com o `dt` fixo do tick. O calor pode passar da capacidade. */
export function passoMotor(m: MotorCalor, calorU: number, dtS: number): number {
  return Math.max(0, calorU + balancoMotor(m, calorU) * dtS);
}

/** Capacidade do componente crítico da era: Receptor (+ tanques) ou Vaso (+ piscinas). */
export function capacidadeDoNucleo(nucleo: NucleoState, efeitos: EfeitosArvore = efeitosNeutros()): number {
  return nucleo.era === 2 ? capacidadeReatorU(nucleo.grade) : capacidadeU(nucleo.grade, nucleo.receptorCeramico, efeitos);
}
