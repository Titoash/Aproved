/**
 * O que o mundo produz e o que a rede consegue escoar (GDD §2.4, §7, v0.6). TypeScript puro.
 *
 * Produção de uma usina = base × nível × melhorias × terreno × esteira × sombra × picos.
 * Uma usina só vende se estiver no alcance de uma subestação com folga no teto; o resto é desperdiçado e
 * aparece como "sem escoamento" (o sumidouro de §7). Um bairro só pede energia se tiver subestação no
 * alcance. Ilha sem cabo submarino só alimenta os bairros dela mesma.
 *
 * As contagens da Rede (quantas usinas, quantas vilas, quantas baterias) são **derivadas** daqui.
 * O resultado é memoizado por identidade de `mundo`/`rede`/`melhorias`: o tick não recalcula à toa.
 */
import { BATERIA, USINAS } from "../content/era1";
import { CRISTAL } from "../content/era1-arquipelago";
import { LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { CABO, OBSTACULOS, ORDEM_OBSTACULOS, SUBESTACAO, TERRENOS, VIZINHANCA, type IlhaId, type TipoObstaculo, type TipoTerreno } from "../content/era1-arquipelago";
import { densidadeDe, limiteUniversidades, pesquisaUniversidade } from "./cidade";
import { ORDEM_TERRENOS, indiceCasa, type Arquipelago } from "./arquipelago";
import { fatorMelhoria } from "./custos";
import { efeitosDe, efeitosNeutros, type EfeitosArvore } from "./efeitos";
import { arquipelagoDaEra1 } from "./gerarArquipelago";
import type { Construcao, GameState, MundoState, RedeDerivada, RedeState, TipoConstrucao, UsinaId } from "./state";

const USINAS_VENTO: readonly UsinaId[] = ["cataVento", "turbinaEolica"];
const VIZINHOS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const ehUsina = (tipo: TipoConstrucao): tipo is UsinaId => tipo in USINAS;
export const ehVento = (tipo: TipoConstrucao): boolean => USINAS_VENTO.includes(tipo as UsinaId);

/** Conjunto das casas já desmatadas, memoizado por identidade do mundo (o `includes` custa caro no tick). */
const removidosCache = new WeakMap<MundoState, Set<number>>();

export function removidosDe(mundo: MundoState): Set<number> {
  let conjunto = removidosCache.get(mundo);
  if (!conjunto) {
    conjunto = new Set(mundo.removidos);
    removidosCache.set(mundo, conjunto);
  }
  return conjunto;
}

/** Obstáculo ainda de pé nesta casa (o de nascença menos os já removidos). */
export function obstaculoEm(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): TipoObstaculo | null {
  const o = arq.obstaculos[indice];
  if (o === 255) return null;
  if (removidosDe(mundo).has(indice)) return null;
  return ORDEM_OBSTACULOS[o];
}

export function terrenoEm(indice: number, arq: Arquipelago = arquipelagoDaEra1()): TipoTerreno | null {
  const t = arq.terreno[indice];
  return t === 255 ? null : ORDEM_TERRENOS[t];
}

/** Casa de rocha com cristal, aberta por uma montanha dinamitada (GDD §8.6, §9). */
export function temCristal(mundo: MundoState, indice: number): boolean {
  return cristaisDe(mundo).has(indice);
}

/** Conjunto das casas de cristal, memoizado por identidade do mundo (o `includes` custa caro no tick). */
const cristaisCache = new WeakMap<MundoState, Set<number>>();

export function cristaisDe(mundo: MundoState): Set<number> {
  let conjunto = cristaisCache.get(mundo);
  if (!conjunto) {
    conjunto = new Set(mundo.cristais);
    cristaisCache.set(mundo, conjunto);
  }
  return conjunto;
}

/** Terreno de jogo de uma casa: a montanha dinamitada deixa **rocha** (GDD §8.5, ajuste 2). */
export function terrenoDeJogo(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): TipoTerreno | null {
  if (temCristal(mundo, indice)) return "rocha";
  return terrenoEm(indice, arq);
}

export function ilhaDaCasa(indice: number, arq: Arquipelago = arquipelagoDaEra1()): IlhaId | null {
  const q = arq.ilha[indice];
  return q < 0 ? null : arq.ilhas[q].id;
}

/* ------------------------------------------------------------------ */
/* Análise                                                            */
/* ------------------------------------------------------------------ */

export interface UsinaAnalise {
  indice: number;
  tipo: UsinaId;
  terreno: TipoTerreno;
  /** kW que a usina produz. */
  brutoKw: number;
  /** kW que chegam à rede (limitados pelo alcance e pelo teto das subestações). */
  escoadoKw: number;
  fatorTerreno: number;
  fatorEsteira: number;
  fatorSombra: number;
  fatorPico: number;
  /** Casa da subestação que a escoa; `null` = sem escoamento. */
  subestacao: number | null;
}

export interface CaboAnalise {
  ilha: IlhaId;
  nivel: number;
  tetoKw: number;
  /** kW que passam pelo cabo neste instante (exportados + importados). */
  usadoKw: number;
}

export interface SubestacaoAnalise {
  indice: number;
  nivel: number;
  tetoKw: number;
  usadoKw: number;
}

export interface AnaliseMundo {
  usinas: UsinaAnalise[];
  porCasa: Map<number, UsinaAnalise>;
  subestacoes: SubestacaoAnalise[];
  /** Quantas construções de cada tipo existem. */
  contagem: Record<TipoConstrucao, number>;
  /** kW produzidos, escoados ou não (é o que conta como potência instalada no medidor Kardashev). */
  brutoKw: number;
  /** kW que entram na balança da Rede. */
  ofertaKw: number;
  /** kW produzidos sem para onde ir (GDD §7: nada acumula sem sumidouro). */
  semEscoamentoKw: number;
  /** Demanda dos bairros atendidos por subestação. */
  demandaKw: number;
  /** Bairros sem subestação no alcance: não pedem nem pagam. */
  bairrosSemEscoamento: number;
  /** Habitantes: a soma da população da densidade de cada bairro (GDD §8.6). */
  populacao: number;
  /** Tarifa média, ponderada pela demanda dos bairros atendidos (GDD §7, §8.6). */
  tarifa: number;
  /** 🔬/s de laboratórios e universidades ligados (o Núcleo entra à parte, no tick). */
  pesquisaPorSegundo: number;
  /** Universidades que a população sustenta (1 por 2 000 habitantes). */
  limiteUniversidades: number;
  /** Universidades ligadas e dentro do limite. */
  universidadesAtivas: number;
  /** Bairros em ilha sem cabo cuja energia vem só da própria ilha. */
  ilhasIsoladas: IlhaId[];
  /** Cabos ligados e o quanto de cada teto está em uso (GDD §8.5). */
  cabos: CaboAnalise[];
}


function contagemVazia(): Record<TipoConstrucao, number> {
  return { cataVento: 0, painelSolar: 0, turbinaEolica: 0, bairro: 0, bateria: 0, subestacao: 0, laboratorio: 0, universidade: 0 };
}

export function tetoSubestacao(nivel: number): number {
  return SUBESTACAO.tetoKw * Math.pow(SUBESTACAO.tetoNivel, nivel);
}

/** Teto de escoamento do cabo submarino, em kW: 30 kW no nível 0, ×2 por nível (GDD §8.5). */
export function tetoCabo(nivel: number): number {
  return CABO.tetoKw * Math.pow(CABO.tetoNivel, nivel);
}

/** Alcance da subestação em casas (Chebyshev). */
export const alcanceSubestacao = (efeitos: EfeitosArvore = efeitosNeutros()): number => efeitos.alcanceSubestacao;

/** Análise completa do mundo. Use `analisar(state)`: esta versão não usa cache. */
export function analisarMundo(mundo: MundoState, rede: RedeState, efeitos: EfeitosArvore = efeitosNeutros(), arq: Arquipelago = arquipelagoDaEra1()): AnaliseMundo {
  const n = arq.n;
  const { demandaBairroFator: fatorDemandaBairro, tarifaFator: fatorTarifa } = efeitos;
  const contagem = contagemVazia();
  const usinas: UsinaAnalise[] = [];
  const porCasa = new Map<number, UsinaAnalise>();
  const subestacoes: SubestacaoAnalise[] = [];
  const bairros: number[] = [];
  /** Laboratórios e universidades, em ordem de casa: o limite de universidades corta as últimas. */
  const ciencia: number[] = [];
  const casas = Object.keys(mundo.construcoes)
    .map(Number)
    .sort((a, b) => a - b);

  const construcaoEm = (i: number): Construcao | undefined => mundo.construcoes[i];
  const obstaculo = (i: number): TipoObstaculo | null => obstaculoEm(mundo, i, arq);

  // 1. produção bruta por usina
  for (const i of casas) {
    const c = mundo.construcoes[i];
    contagem[c.tipo]++;
    if (c.tipo === "bairro") bairros.push(i);
    if (c.tipo === "laboratorio" || c.tipo === "universidade") ciencia.push(i);
    if (c.tipo === "subestacao") subestacoes.push({ indice: i, nivel: c.nivel, tetoKw: tetoSubestacao(c.nivel), usadoKw: 0 });
    if (!ehUsina(c.tipo)) continue;
    const x = i % n;
    const y = Math.floor(i / n);
    const terreno = terrenoDeJogo(mundo, i, arq) ?? "planicie";
    const vento = ehVento(c.tipo);
    let eolicosVizinhos = 0;
    let altosVizinhos = 0;
    let picosVizinhos = 0;
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = indiceCasa(n, nx, ny);
      const viz = construcaoEm(j);
      if (viz && ehVento(viz.tipo)) eolicosVizinhos++;
      if (viz?.tipo === "turbinaEolica") altosVizinhos++;
      const obs = obstaculo(j);
      if (obs) {
        if (OBSTACULOS[obs].alto) altosVizinhos++;
        if (obs === "pico") picosVizinhos++;
      }
    }
    const fatorTerreno = vento ? TERRENOS[terreno].vento : TERRENOS[terreno].sol;
    const fatorEsteira = vento ? Math.max(VIZINHANCA.esteiraMinima, 1 - efeitos.esteiraPorVizinho * eolicosVizinhos) : 1;
    const fatorSombra = vento ? 1 : Math.max(VIZINHANCA.sombraMinima, 1 - VIZINHANCA.sombraPorVizinho * altosVizinhos);
    const fatorPico = vento ? 1 + VIZINHANCA.ventoPorPico * picosVizinhos : 1;
    const base = USINAS[c.tipo].potenciaKw * fatorMelhoria(rede.usinas[c.tipo].nivel) * efeitos.potencia[c.tipo];
    const analise: UsinaAnalise = {
      indice: i,
      tipo: c.tipo,
      terreno,
      brutoKw: base * fatorTerreno * fatorEsteira * fatorSombra * fatorPico,
      escoadoKw: 0,
      fatorTerreno,
      fatorEsteira,
      fatorSombra,
      fatorPico,
      subestacao: null,
    };
    usinas.push(analise);
    porCasa.set(i, analise);
  }

  // 2. escoamento: cada subestação varre só as casas do próprio alcance (7×7), não a lista inteira de usinas
  const alcance = efeitos.alcanceSubestacao;
  for (const sub of subestacoes) {
    const ilhaSub = arq.ilha[sub.indice];
    const sx = sub.indice % n;
    const sy = Math.floor(sub.indice / n);
    for (let dy = -alcance; dy <= alcance && sub.usadoKw < sub.tetoKw; dy++) {
      const y = sy + dy;
      if (y < 0 || y >= n) continue;
      for (let dx = -alcance; dx <= alcance && sub.usadoKw < sub.tetoKw; dx++) {
        const x = sx + dx;
        if (x < 0 || x >= n) continue;
        const j = indiceCasa(n, x, y);
        if (arq.ilha[j] !== ilhaSub) continue;
        const u = porCasa.get(j);
        if (!u || u.escoadoKw >= u.brutoKw) continue;
        const cabe = Math.min(u.brutoKw - u.escoadoKw, sub.tetoKw - sub.usadoKw);
        if (cabe <= 0) continue;
        u.escoadoKw += cabe;
        sub.usadoKw += cabe;
        if (u.subestacao === null) u.subestacao = sub.indice;
      }
    }
  }

  // 3. quem consome: bairros (por densidade) e a ciência (laboratório, universidade).
  //    Tudo isso só entra na conta com subestação no alcance — a energia não anda sem fio (GDD §2.4).
  let bairrosSemEscoamento = 0;
  const demandaPorIlha = new Map<number, number>();
  const casasSubestacao = new Set(subestacoes.map((s) => s.indice));
  const temSubestacaoPerto = (casa: number, ilhaCasa: number): boolean => {
    const x = casa % n;
    const y = Math.floor(casa / n);
    for (let dy = -alcance; dy <= alcance; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= n) continue;
      for (let dx = -alcance; dx <= alcance; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= n) continue;
        const j = indiceCasa(n, nx, ny);
        if (casasSubestacao.has(j) && arq.ilha[j] === ilhaCasa) return true;
      }
    }
    return false;
  };
  let populacao = 0;
  let tarifaPonderada = 0;
  let demandaBairrosKw = 0;
  for (const b of bairros) {
    const def = densidadeDe(mundo.construcoes[b]);
    populacao += def.populacao;
    const ilhaB = arq.ilha[b];
    if (!temSubestacaoPerto(b, ilhaB)) {
      bairrosSemEscoamento++;
      continue;
    }
    const demanda = def.demandaKw * fatorDemandaBairro;
    demandaBairrosKw += demanda;
    tarifaPonderada += demanda * def.tarifa;
    demandaPorIlha.set(ilhaB, (demandaPorIlha.get(ilhaB) ?? 0) + demanda);
  }
  // Tarifa média ponderada pela demanda: bairro mais denso pesa mais na conta (GDD §7).
  const tarifa = (demandaBairrosKw > 0 ? tarifaPonderada / demandaBairrosKw : 1) * fatorTarifa;

  // Ciência: laboratório e universidade consomem kW e geram 🔬. A universidade precisa de gente —
  // só valem as que a população sustenta, e sobre cristal rendem +50 % (GDD §8.6, §9).
  const limite = limiteUniversidades(populacao);
  const porUniversidade = pesquisaUniversidade(populacao);
  const cristais = cristaisDe(mundo);
  let pesquisaPorSegundo = 0;
  let universidadesAtivas = 0;
  for (const i of ciencia) {
    const c = mundo.construcoes[i];
    const ilhaC = arq.ilha[i];
    if (!temSubestacaoPerto(i, ilhaC)) continue;
    const bonus = cristais.has(i) ? 1 + CRISTAL.bonusCiencia : 1;
    if (c.tipo === "laboratorio") {
      pesquisaPorSegundo += LABORATORIO.pesquisaPorSegundo * bonus;
      demandaPorIlha.set(ilhaC, (demandaPorIlha.get(ilhaC) ?? 0) + LABORATORIO.consumoKw);
      continue;
    }
    if (universidadesAtivas >= limite) continue;
    universidadesAtivas++;
    pesquisaPorSegundo += porUniversidade * bonus;
    demandaPorIlha.set(ilhaC, (demandaPorIlha.get(ilhaC) ?? 0) + UNIVERSIDADE.consumoKw);
  }

  // 4. cada ilha fora da principal é uma mini-rede: o que sobra (ou falta) só atravessa pelo cabo, e o
  //    cabo tem teto próprio (GDD §8.5). Sem cabo, o teto é zero: a ilha só alimenta os próprios bairros.
  const ilhasIsoladas: IlhaId[] = [];
  const cabos: CaboAnalise[] = [];
  let brutoKw = 0;
  const escoadoPorIlha = new Map<number, number>();
  for (const u of usinas) {
    brutoKw += u.brutoKw;
    const q = arq.ilha[u.indice];
    escoadoPorIlha.set(q, (escoadoPorIlha.get(q) ?? 0) + u.escoadoKw);
  }
  let ofertaKw = escoadoPorIlha.get(0) ?? 0;
  let demandaEfetiva = demandaPorIlha.get(0) ?? 0;
  for (let q = 1; q < arq.ilhas.length; q++) {
    const ilhaId = arq.ilhas[q].id;
    if (!mundo.ilhasAbertas.includes(ilhaId)) continue;
    const oferta = escoadoPorIlha.get(q) ?? 0;
    const demanda = demandaPorIlha.get(q) ?? 0;
    const local = Math.min(oferta, demanda);
    ofertaKw += local;
    demandaEfetiva += local;
    const nivel = mundo.cabos[ilhaId];
    if (nivel === undefined) {
      if (oferta > local || demanda > local) ilhasIsoladas.push(ilhaId);
      continue;
    }
    const teto = tetoCabo(nivel);
    const exportado = Math.min(oferta - local, teto);
    const importado = Math.min(demanda - local, teto);
    ofertaKw += exportado;
    demandaEfetiva += importado;
    cabos.push({ ilha: ilhaId, nivel, tetoKw: teto, usadoKw: exportado + importado });
  }

  return {
    usinas,
    porCasa,
    subestacoes,
    contagem,
    brutoKw,
    ofertaKw,
    semEscoamentoKw: Math.max(0, brutoKw - ofertaKw),
    demandaKw: demandaEfetiva,
    bairrosSemEscoamento,
    populacao,
    tarifa,
    pesquisaPorSegundo,
    limiteUniversidades: limite,
    universidadesAtivas,
    ilhasIsoladas,
    cabos,
  };
}

/* ------------------------------------------------------------------ */
/* Cache por identidade                                               */
/* ------------------------------------------------------------------ */

interface Entrada {
  /** Só o que muda a produção: os níveis das usinas e os efeitos da árvore. A carga da bateria não entra. */
  niveis: string;
  efeitos: EfeitosArvore;
  analise: AnaliseMundo;
}

const cache = new WeakMap<MundoState, Entrada>();

const niveisDe = (rede: RedeState): string => `${rede.usinas.cataVento.nivel}|${rede.usinas.painelSolar.nivel}|${rede.usinas.turbinaEolica.nivel}`;

/**
 * Análise do mundo do estado, memoizada enquanto o objeto `mundo`, os níveis das usinas e as melhorias não
 * mudarem. O tick troca `rede` a cada passo (a carga da bateria), então a chave não pode ser a identidade dela.
 */
export function analisar(state: GameState): AnaliseMundo {
  const pronto = cache.get(state.mundo);
  const niveis = niveisDe(state.rede);
  const efeitos = efeitosDe(state);
  if (pronto && pronto.niveis === niveis && pronto.efeitos === efeitos) return pronto.analise;
  const analise = analisarMundo(state.mundo, state.rede, efeitos);
  cache.set(state.mundo, { niveis, efeitos, analise });
  return analise;
}

/* ------------------------------------------------------------------ */
/* Contagens derivadas                                                */
/* ------------------------------------------------------------------ */

export function capacidadeBateriaKwh(unidades: number, efeitos: EfeitosArvore = efeitosNeutros()): number {
  return unidades * BATERIA.capacidadeKwh * efeitos.capacidadeBateriaFator;
}

/** Rede na forma que as fórmulas de §4.1 consomem, com as contagens vindas do mundo. */
export function derivarRede(state: GameState, analise: AnaliseMundo = analisar(state)): RedeDerivada {
  const unidades = analise.contagem.bateria;
  const capacidadeKwh = capacidadeBateriaKwh(unidades, efeitosDe(state));
  return {
    usinas: {
      cataVento: { quantidade: analise.contagem.cataVento, nivel: state.rede.usinas.cataVento.nivel },
      painelSolar: { quantidade: analise.contagem.painelSolar, nivel: state.rede.usinas.painelSolar.nivel },
      turbinaEolica: { quantidade: analise.contagem.turbinaEolica, nivel: state.rede.usinas.turbinaEolica.nivel },
    },
    bairros: analise.contagem.bairro,
    bateria: { unidades, capacidadeKwh, kwh: Math.min(state.rede.bateria.kwh, capacidadeKwh) },
  };
}

export function quantidadeDe(state: GameState, tipo: TipoConstrucao): number {
  return analisar(state).contagem[tipo];
}
