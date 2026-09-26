/**
 * Os quatro números do HUD (GDD §10.1, v0.8), tirados do estado sem React: ₵ com a taxa **líquida**, ⚡ como
 * balanço `r` com a faixa e a demanda, 🔥 com a faixa e a Estabilidade (o anel), 🔬 com a taxa e o próximo
 * nó. Função pura para o teste poder conferir que o HUD mostra o que o tick faz (a 🔬/s já saiu ×10 na Era 2).
 */
import { proximoNo } from "../sim/arvore";
import { faixaDeCalor, pesquisaPorSegundo, temperaturaNucleo } from "../sim/calor";
import type { FaixaCalor } from "../content/era1-nucleo";
import { efeitosDe } from "../sim/efeitos";
import { motorDoNucleo } from "../sim/motor";
import { analisar } from "../sim/producao";
import type { FaixaR } from "../content/era1";
import type { GameState } from "../sim/state";
import { balancoDoEstado, potenciaNucleoEfetivaKw } from "../sim/tick";

export interface NumerosHud {
  creditos: number;
  /** ₵/s líquido: receita menos o combustível das térmicas. */
  taxaCreditos: number;
  /** Balanço oferta ÷ demanda; `null` sem demanda. */
  r: number | null;
  faixaR: FaixaR;
  demandaKw: number;
  ofertaKw: number;
  semEscoamentoKw: number;
  /** `null` com o Núcleo bloqueado. */
  t: number | null;
  faixaCalor: FaixaCalor | null;
  /** 0–100; `null` com o Núcleo bloqueado. */
  estabilidade: number | null;
  pesquisa: number;
  /** 🔬/s do Núcleo mais a da ciência (laboratórios, universidades, institutos). */
  taxaPesquisa: number;
  proximo: { nome: string; pesquisa: number } | null;
}

export function numerosDoHud(state: GameState): NumerosHud {
  const balanco = balancoDoEstado(state);
  const analise = analisar(state);
  const nucleo = state.nucleo;
  // Os efeitos do estado entram em tudo o que o Núcleo mostra: sem eles a T, a potência e a 🔬 do HUD
  // saíam diferentes das do tick (Tanque de dois sais, turbinas de alta pressão, fator de 🔬 da Era 2).
  const efeitos = efeitosDe(state);
  const t = nucleo ? temperaturaNucleo(nucleo, efeitos) : null;
  const potenciaNucleo = potenciaNucleoEfetivaKw(nucleo, efeitos, state.tempoMs);
  const pesquisaNucleo =
    nucleo && nucleo.scramRestanteMs === 0 && t !== null ? pesquisaPorSegundo(potenciaNucleo, t, motorDoNucleo(nucleo, efeitos, state.tempoMs).pesquisaPorKw) : 0;
  const proximo = proximoNo(state);
  return {
    creditos: state.creditos,
    taxaCreditos: balanco.receitaLiquidaPorSegundo,
    r: balanco.demandaKw > 0 ? balanco.r : null,
    faixaR: balanco.faixa,
    demandaKw: balanco.demandaKw,
    ofertaKw: balanco.ofertaKw,
    semEscoamentoKw: analise.semEscoamentoKw,
    t,
    faixaCalor: t !== null ? faixaDeCalor(t) : null,
    estabilidade: nucleo ? nucleo.estabilidade : null,
    pesquisa: state.pesquisa,
    taxaPesquisa: pesquisaNucleo + analise.pesquisaPorSegundo,
    proximo: proximo ? { nome: proximo.nome, pesquisa: proximo.pesquisa } : null,
  };
}
