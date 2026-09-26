/**
 * Efeitos acumulados da árvore de pesquisa (GDD §8.6, v0.6) e dos **níveis das peças do Núcleo** (§7.1,
 * §8.3, v0.8). TypeScript puro e **sem dependências do resto do sim** (só a folha `sim/niveis.ts`):
 * `sim/nucleo.ts` e `sim/producao.ts` leem daqui, e `sim/arvore.ts` (a compra) lê daqui também — é o que
 * evita o ciclo de imports.
 *
 * Todos os números vêm de `content/`; aqui só se dobra a lista de nós comprados numa estrutura só. Os
 * níveis das peças entram por último, multiplicando a grandeza de cada peça **por cima** dos nós de era.
 */
import { NO_POR_ID } from "../content/arvore";
import { NUCLEO } from "../content/era1-nucleo";
import { REATOR } from "../content/era2-nucleo";
import { TERMICA } from "../content/era2";
import { SUBESTACAO, VIZINHANCA } from "../content/era1-arquipelago";
import { fatorPeca } from "./niveis";
import type { GameState, PecaId, TipoConstrucao, UsinaId } from "./state";

export interface EfeitosArvore {
  /** Fator de potência por usina. */
  potencia: Record<UsinaId, number>;
  /** Perda de esteira por vizinho eólico (0 = sem esteira). */
  esteiraPorVizinho: number;
  alcanceSubestacao: number;
  capacidadeBateriaFator: number;
  demandaBairroFator: number;
  tarifaFator: number;
  /** Calor de um Heliostato do anel 1, em u/s, já com o fator dos níveis de peça. */
  calorPorEspelho: number;
  turbinaKwPorUnidade: number;
  dissipacaoRadiador: number;
  /** kW que cada radiador tira da potência do Núcleo (radiador ativo). */
  consumoRadiadorKw: number;
  capacidadeTanqueU: number;
  receptorCeramico: boolean;
  gradeLado: number;
  desbloqueados: readonly TipoConstrucao[];
  /* --- Era 2 (GDD Parte 2 §6) --- */
  /** Calor de cada vareta × este fator (enriquecimento, água pesada). */
  varetaCalorFator: number;
  /** Vida de cada vareta × este fator (MOX, água pesada, alta temperatura). */
  varetaVidaFator: number;
  /** kW por u consumida pela turbina de alta pressão. */
  reatorKwPorUnidade: number;
  /** u/s que cada torre de resfriamento adjacente dissipa (com o nível da peça). */
  dissipacaoTorreUs: number;
  /** u que cada piscina adjacente soma à capacidade do Vaso (com o nível da peça). */
  capacidadePiscinaU: number;
  /** Teto de todos os cabos submarinos × este fator (Cabo HVDC). */
  tetoCaboFator: number;
  /** Combustível das térmicas × este fator (Selo verde cobra mais). */
  combustivelFator: number;
  /** Efeito da térmica na tarifa dos bairros a ≤ 2 casas (−0,1; +0,1 com Cogeração). */
  deltaTarifaTermica: number;
  /** Energia e potência da bateria de rede × este fator (Rede inteligente). */
  bateriaRedeFator: number;
  /** Eólica offshore em mar fundo (Fundação flutuante). */
  marFundo: boolean;
  /** Peças do Núcleo liberadas por nós (barra de controle, piscina). */
  pecasLiberadas: readonly PecaId[];
  /** Tempo de remoção de obstáculos × este fator (Máquinas pesadas, Escavadeiras). */
  tempoRemocaoFator: number;
}

export function efeitosNeutros(): EfeitosArvore {
  return {
    potencia: { cataVento: 1, painelSolar: 1, turbinaEolica: 1, eolicaOffshore: 1, fazendaSolar: 1, termicaGas: 1 },
    esteiraPorVizinho: VIZINHANCA.esteiraPorVizinho,
    alcanceSubestacao: SUBESTACAO.alcance,
    capacidadeBateriaFator: 1,
    demandaBairroFator: 1,
    tarifaFator: 1,
    calorPorEspelho: NUCLEO.calorEspelhoAnel1,
    turbinaKwPorUnidade: NUCLEO.kwPorUnidade,
    dissipacaoRadiador: NUCLEO.dissipacaoRadiador,
    consumoRadiadorKw: 0,
    capacidadeTanqueU: NUCLEO.capacidadeTanqueU,
    receptorCeramico: false,
    gradeLado: NUCLEO.ladoInicial,
    desbloqueados: [],
    varetaCalorFator: 1,
    varetaVidaFator: 1,
    reatorKwPorUnidade: REATOR.kwPorUnidade,
    dissipacaoTorreUs: REATOR.dissipacaoTorre,
    capacidadePiscinaU: REATOR.capacidadePiscinaU,
    tetoCaboFator: 1,
    combustivelFator: 1,
    deltaTarifaTermica: TERMICA.deltaTarifa,
    bateriaRedeFator: 1,
    marFundo: false,
    pecasLiberadas: [],
    tempoRemocaoFator: 1,
  };
}

/** Níveis das peças do Núcleo, por tipo (0 = sem melhoria). */
export type NiveisDePecas = Partial<Record<PecaId, number>>;

/**
 * Dobra os efeitos dos nós comprados numa estrutura só. Ordem: valores absolutos antes dos fatores, e os
 * níveis das peças (`pecas`) por último: +10 % por nível na grandeza de cada peça (§8.3, Parte 2 §5.1).
 */
export function efeitosDos(pesquisados: readonly string[], pecas: NiveisDePecas = {}): EfeitosArvore {
  const e = efeitosNeutros();
  const desbloqueados: TipoConstrucao[] = [];
  const pecasLiberadas: PecaId[] = [];
  let calorFator = 1;
  let reatorKwFator = 1;
  for (const id of pesquisados) {
    const no = NO_POR_ID[id];
    if (!no) continue;
    for (const ef of no.efeitos) {
      switch (ef.tipo) {
        case "potenciaUsinas":
          for (const u of ef.usinas) e.potencia[u] *= ef.fator;
          break;
        case "esteira":
          e.esteiraPorVizinho *= ef.fator;
          break;
        case "alcanceSubestacao":
          e.alcanceSubestacao = Math.max(e.alcanceSubestacao, ef.casas);
          break;
        case "capacidadeBateria":
          e.capacidadeBateriaFator *= ef.fator;
          break;
        case "demandaBairro":
          e.demandaBairroFator *= ef.fator;
          break;
        case "tarifa":
          e.tarifaFator *= ef.fator;
          break;
        case "calorPorEspelho":
          e.calorPorEspelho = ef.valor;
          break;
        case "calorEspelhoFator":
          calorFator *= ef.fator;
          break;
        case "turbinaKwFator":
          e.turbinaKwPorUnidade *= ef.fator;
          break;
        case "radiadorAtivo":
          e.dissipacaoRadiador = ef.dissipacao;
          e.consumoRadiadorKw = ef.consomeKw;
          break;
        case "capacidadeTanque":
          e.capacidadeTanqueU *= ef.fator;
          break;
        case "receptorCeramico":
          e.receptorCeramico = true;
          break;
        case "gradeLado":
          e.gradeLado = Math.max(e.gradeLado, ef.lado);
          break;
        case "desbloqueia":
          desbloqueados.push(ef.construcao);
          break;
        case "desbloqueiaPeca":
          pecasLiberadas.push(ef.peca);
          break;
        case "varetaCalor":
          e.varetaCalorFator *= ef.fator;
          break;
        case "varetaVida":
          e.varetaVidaFator *= ef.fator;
          break;
        case "reatorKwFator":
          reatorKwFator *= ef.fator;
          break;
        case "tetoCabo":
          e.tetoCaboFator *= ef.fator;
          break;
        case "combustivel":
          e.combustivelFator *= ef.fator;
          break;
        case "vizinhancaTermica":
          e.deltaTarifaTermica = ef.delta;
          break;
        case "bateriaRede":
          e.bateriaRedeFator *= ef.fator;
          break;
        case "marFundo":
          e.marFundo = true;
          break;
        case "tempoRemocao":
          e.tempoRemocaoFator *= ef.fator;
          break;
      }
    }
  }
  e.calorPorEspelho *= calorFator;
  e.reatorKwPorUnidade *= reatorKwFator;
  e.desbloqueados = desbloqueados;
  e.pecasLiberadas = pecasLiberadas;

  // Níveis das peças: a grandeza de cada uma (Era 1: calor, kW por u, dissipação, capacidade; Era 2: calor
  // da vareta — e com ele o decaimento, que é 7 % do nominal —, kW por u, dissipação, capacidade).
  const nivel = (id: PecaId) => fatorPeca(pecas[id] ?? 0);
  e.calorPorEspelho *= nivel("heliostato");
  e.turbinaKwPorUnidade *= nivel("turbina");
  e.dissipacaoRadiador *= nivel("radiador");
  e.capacidadeTanqueU *= nivel("tanque");
  e.varetaCalorFator *= nivel("vareta");
  e.reatorKwPorUnidade *= nivel("turbinaAlta");
  e.dissipacaoTorreUs *= nivel("torreResfriamento");
  e.capacidadePiscinaU *= nivel("piscina");
  return e;
}

/**
 * Memoização em dois níveis, por identidade da lista de nós e do objeto de níveis das peças: o tick lê
 * os efeitos a cada passo, e `melhorias.pecas` só muda de identidade quando um nível de peça é comprado.
 */
const cache = new WeakMap<readonly string[], WeakMap<NiveisDePecas, EfeitosArvore>>();

export function efeitosDe(state: GameState): EfeitosArvore {
  const pecas = state.melhorias.pecas;
  let porPecas = cache.get(state.pesquisados);
  if (!porPecas) {
    porPecas = new WeakMap();
    cache.set(state.pesquisados, porPecas);
  }
  let e = porPecas.get(pecas);
  if (!e) {
    e = efeitosDos(state.pesquisados, pecas);
    porPecas.set(pecas, e);
  }
  return e;
}

