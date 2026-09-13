/**
 * Ações do jogador sobre o mundo (GDD §2.1, §2.4, §7, §8.5, v0.6): colocar e remover construções, desmatar
 * obstáculos, comprar a expedição de uma ilha e ligar o cabo submarino. Funções puras: devolvem `null`
 * quando a ação não é possível. Nenhum número aqui — tudo vem de `content/`.
 */
import { BATERIA, type Desbloqueio } from "../content/era1";
import { USINAS } from "../content/usinas";
import { BATERIA_REDE, DISTRITO_INDUSTRIAL, INSTITUTO } from "../content/era2";
import { BAIRRO, LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { CABO, OBSTACULOS, TERRENOS, VIZINHANCA, ilhaDef, type IlhaId, type TipoObstaculo } from "../content/era1-arquipelago";
import { custoUnidade } from "./custos";
import { arquipelagoDaEra1 } from "./gerarArquipelago";
import { naPlataforma, type Arquipelago } from "./arquipelago";
import {
  ESCOAMENTO,
  analisar,
  ancoraEm,
  casasDaConstrucao,
  construcaoQueOcupa,
  ehDeAgua,
  ehMar,
  ehMarRaso,
  ehSubestacao,
  ehAlto,
  ehSolar,
  ehUsina,
  ehVento,
  ilhaDaCasa,
  terrenoDeJogo,
  ladoConstrucao,
  obstaculoEm,
  quantidadeDe,
  tetoCabo,
  tetoDeSubestacao,
  tetoSubestacao,
} from "./producao";
import { efeitosDe } from "./efeitos";
import type { Construcao, GameState, MundoState, TipoConstrucao } from "./state";

export { obstaculoEm };

/* ------------------------------------------------------------------ */
/* Consultas                                                          */
/* ------------------------------------------------------------------ */

export interface CustoDefinicao {
  custoBase: number;
  crescimento: number;
}

export function definicaoDeCusto(tipo: TipoConstrucao): CustoDefinicao {
  if (ehUsina(tipo)) return USINAS[tipo];
  if (ehSubestacao(tipo)) return ESCOAMENTO[tipo];
  if (tipo === "bairro") return BAIRRO;
  if (tipo === "bateria") return BATERIA;
  if (tipo === "bateriaRede") return BATERIA_REDE;
  if (tipo === "laboratorio") return LABORATORIO;
  if (tipo === "universidade") return UNIVERSIDADE;
  if (tipo === "distritoIndustrial") return DISTRITO_INDUSTRIAL;
  return INSTITUTO;
}

export function nomeConstrucao(tipo: TipoConstrucao): string {
  if (ehUsina(tipo)) return USINAS[tipo].nome;
  if (ehSubestacao(tipo)) return ESCOAMENTO[tipo].nome;
  if (tipo === "bairro") return BAIRRO.nome;
  if (tipo === "bateria") return BATERIA.nome;
  if (tipo === "bateriaRede") return BATERIA_REDE.nome;
  if (tipo === "laboratorio") return LABORATORIO.nome;
  if (tipo === "universidade") return UNIVERSIDADE.nome;
  if (tipo === "distritoIndustrial") return DISTRITO_INDUSTRIAL.nome;
  return INSTITUTO.nome;
}

/** Desbloqueio do tipo: por quantidade de usina já colocada ou por nó da árvore (GDD §8.6, Parte 2 §6). */
export function desbloqueioDe(tipo: TipoConstrucao): Desbloqueio | undefined {
  if (ehUsina(tipo)) return USINAS[tipo].desbloqueio;
  if (tipo === "bateria") return BATERIA.desbloqueio;
  if (tipo === "bateriaRede") return BATERIA_REDE.desbloqueio;
  if (tipo === "laboratorio") return { no: "laboratorio" };
  if (tipo === "universidade") return { no: "universidade" };
  if (tipo === "subestacao138") return { no: "subestacaoDe138kV" };
  if (tipo === "subestacaoOffshore") return { no: "subestacaoOffshore" };
  if (tipo === "distritoIndustrial") return DISTRITO_INDUSTRIAL.desbloqueio;
  if (tipo === "institutoPesquisa") return INSTITUTO.desbloqueio;
  return undefined;
}

/** Custo da próxima unidade do tipo: `custoBase × crescimento^n` (GDD §7). */
export function custoColocar(state: GameState, tipo: TipoConstrucao): number {
  return custoUnidade(definicaoDeCusto(tipo), quantidadeDe(state, tipo));
}

/** Remover devolve metade do que a última unidade custou (GDD §2.4). */
export function valorRemocao(state: GameState, tipo: TipoConstrucao): number {
  const n = Math.max(0, quantidadeDe(state, tipo) - 1);
  return custoUnidade(definicaoDeCusto(tipo), n) / 2;
}

export function construcaoEm(mundo: MundoState, indice: number): Construcao | null {
  return mundo.construcoes[indice] ?? null;
}

export { ancoraEm, casasDaConstrucao, construcaoQueOcupa, ladoConstrucao };

export function ilhaAberta(mundo: MundoState, id: IlhaId): boolean {
  return mundo.ilhasAbertas.includes(id);
}

export function temCabo(mundo: MundoState, id: IlhaId): boolean {
  return id === "principal" || mundo.cabos[id] !== undefined;
}

/** Nível do cabo da ilha (0 = recém-ligado); `null` quando não há cabo. */
export function nivelCabo(mundo: MundoState, id: IlhaId): number | null {
  return mundo.cabos[id] ?? null;
}

export { tetoCabo };

export function removendo(mundo: MundoState, indice: number): boolean {
  return mundo.remocoes.some((r) => r.indice === indice);
}

/** Casa noroeste do obstáculo que ocupa esta casa (a montanha ocupa 2×2 e sai inteira). */
export function ancoraDoObstaculo(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): number {
  const tipo = obstaculoEm(mundo, indice, arq);
  if (tipo !== "montanha") return indice;
  const n = arq.n;
  const x = indice % n;
  const y = Math.floor(indice / n);
  for (const m of arq.montanhas) {
    const mx = m % n;
    const my = Math.floor(m / n);
    if (x >= mx && x < mx + 2 && y >= my && y < my + 2) return m;
  }
  return indice;
}

/** Casas ocupadas pelo obstáculo ancorado em `ancora`. */
export function casasDoObstaculo(ancora: number, tipo: TipoObstaculo, n: number): number[] {
  const lado = OBSTACULOS[tipo].lado;
  if (lado === 1) return [ancora];
  const x = ancora % n;
  const y = Math.floor(ancora / n);
  const casas: number[] = [];
  for (let dy = 0; dy < lado; dy++) for (let dx = 0; dx < lado; dx++) casas.push((y + dy) * n + x + dx);
  return casas;
}

/* ------------------------------------------------------------------ */
/* Avaliação de uma casa                                              */
/* ------------------------------------------------------------------ */

export interface Avaliacao {
  ok: boolean;
  /** Por que não dá (quando `ok` é falso) — texto curto para o realce da cena. */
  motivo: string | null;
  /** Dá, mas com ressalva: "sem escoamento", "esteira −40 %", "sombra". */
  aviso: string | null;
}

const RECUSA = (motivo: string): Avaliacao => ({ ok: false, motivo, aviso: null });

/**
 * Pode colocar `tipo` na casa? Devolve também o aviso que a cena mostra quando dá, mas rende menos
 * (GDD §2.4: esteira, sombra, escoamento).
 *
 * A Era 2 acrescenta duas regras de espaço (GDD Parte 2 §3.1): construção **2×2** precisa das quatro
 * casas livres e na mesma ilha, e construção **offshore** vai em casa de mar raso (mar fundo só com o
 * nó "Fundação flutuante"). A casa clicada é sempre a **âncora**, o canto noroeste.
 */
export function avaliarCasa(state: GameState, indice: number, tipo: TipoConstrucao, arq: Arquipelago = arquipelagoDaEra1()): Avaliacao {
  const n = arq.n;
  if (indice < 0 || indice >= n * n) return RECUSA("Fora do mapa");
  const efeitos = efeitosDe(state);
  const agua = ehDeAgua(tipo);
  const casas = casasDaConstrucao(indice, tipo, n);
  const lado = ladoConstrucao(tipo);
  if (indice % n > n - lado || Math.floor(indice / n) > n - lado) return RECUSA("Não cabe: 2×2 precisa de quatro casas");

  // O chão da âncora antes da ilha: "só se constrói em terra" é mais útil que "ilha fechada" no mar.
  if (agua && arq.terra[indice] === 1) return RECUSA("Esta vai no mar");
  if (!agua && arq.terra[indice] !== 1) return RECUSA("Só se constrói em terra");
  const ilha = ilhaDaCasa(indice, arq);
  if (!ilha) return RECUSA("Fora de qualquer ilha");
  if (!ilhaAberta(state.mundo, ilha)) return RECUSA("Ilha fechada: faça a expedição");

  for (const casa of casas) {
    const x = casa % n;
    const y = Math.floor(casa / n);
    if (agua) {
      if (!ehMar(casa, arq)) return RECUSA("Esta vai no mar");
      if (!ehMarRaso(casa, arq) && !efeitos.marFundo) return RECUSA("Mar fundo: exige a fundação flutuante");
    } else {
      if (arq.terra[casa] !== 1) return RECUSA("Só se constrói em terra");
      if (naPlataforma(arq.plataforma, x, y)) return RECUSA("A plataforma é do Núcleo");
      if (arq.caminho[casa] === 1) return RECUSA("Caminho da aldeia");
      const terreno = terrenoDeJogo(state.mundo, casa, arq);
      if (terreno && ehUsina(tipo) && USINAS[tipo].terrenosProibidos?.includes(terreno)) {
        return RECUSA(`${USINAS[tipo].nome} não vai em ${TERRENOS[terreno].nome.toLowerCase()}`);
      }
    }
    if (ilhaDaCasa(casa, arq) !== ilha) return RECUSA("As quatro casas precisam ser da mesma ilha");
    if (ancoraEm(state.mundo, casa, arq) !== null) return RECUSA("Casa ocupada");
    const obstaculo = obstaculoEm(state.mundo, casa, arq);
    if (obstaculo) return RECUSA(removendo(state.mundo, casa) ? "Removendo…" : `${OBSTACULOS[obstaculo].nome}: remova primeiro`);
  }
  if (state.creditos < custoColocar(state, tipo)) return RECUSA("₵ insuficientes");
  return { ok: true, motivo: null, aviso: avisoDaCasa(state, indice, tipo, arq) };
}

/** Ressalva de rendimento da casa (não impede a colocação). */
export function avisoDaCasa(state: GameState, indice: number, tipo: TipoConstrucao, arq: Arquipelago = arquipelagoDaEra1()): string | null {
  const n = arq.n;
  const analise = analisar(state);
  const ilha = ilhaDaCasa(indice, arq);
  if (ehSubestacao(tipo) || tipo === "bateria" || tipo === "bateriaRede") return null;
  if (tipo === "universidade" && analise.universidadesAtivas >= analise.limiteUniversidades) return "sem população para outra";

  const casas = casasDaConstrucao(indice, tipo, n);
  const noAlcance = (s: (typeof analise.subestacoes)[number]): boolean =>
    ilhaDaCasa(s.indice, arq) === ilha &&
    casas.some((casa) => Math.max(Math.abs((s.indice % n) - (casa % n)), Math.abs(Math.floor(s.indice / n) - Math.floor(casa / n))) <= s.alcance);

  // O distrito industrial não aceita qualquer subestação: precisa de 138 kV (GDD Parte 2 §4.2).
  const exigida = tipo === "distritoIndustrial" ? "subestacao138" : null;
  const perto = analise.subestacoes.filter((s) => noAlcance(s) && (exigida === null || s.tipo === exigida));
  if (perto.length === 0) return exigida ? "sem subestação de 138 kV" : "sem escoamento";
  if (tipo === "bairro" || tipo === "laboratorio" || tipo === "universidade" || tipo === "institutoPesquisa" || tipo === "distritoIndustrial") return null;
  if (perto.every((s) => s.usadoKw >= s.tetoKw)) return "subestação no teto";

  const vizinhos: number[] = [];
  for (const casa of casas) {
    const x = casa % n;
    const y = Math.floor(casa / n);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (!casas.includes(j)) vizinhos.push(j);
    }
  }
  if (ehSolar(tipo)) {
    const altos = vizinhos.filter((j) => {
      const c = construcaoQueOcupa(state.mundo, j, arq);
      if (c && ehAlto(c.tipo)) return true;
      const o = obstaculoEm(state.mundo, j, arq);
      return !!o && !!OBSTACULOS[o].alto;
    }).length;
    if (altos > 0) return `sombra −${Math.round(Math.min(0.6, altos * VIZINHANCA.sombraPorVizinho) * 100)} %`;
    return null;
  }
  const eolicos = vizinhos.filter((j) => {
    const c = construcaoQueOcupa(state.mundo, j, arq);
    return !!c && ehVento(c.tipo);
  }).length;
  if (eolicos > 0) return `esteira −${Math.round(Math.min(0.6, eolicos * VIZINHANCA.esteiraPorVizinho) * 100)} %`;
  return null;
}

export function podeColocar(state: GameState, indice: number, tipo: TipoConstrucao): boolean {
  return avaliarCasa(state, indice, tipo).ok;
}

/* ------------------------------------------------------------------ */
/* Ações                                                              */
/* ------------------------------------------------------------------ */

function comMundo(state: GameState, mundo: MundoState, creditos: number, eventos = state.eventos): GameState {
  return { ...state, creditos, mundo, eventos };
}

export function colocar(state: GameState, indice: number, tipo: TipoConstrucao): GameState | null {
  if (!avaliarCasa(state, indice, tipo).ok) return null;
  const custo = custoColocar(state, tipo);
  const construcoes = { ...state.mundo.construcoes, [indice]: { tipo, nivel: 0, colocadoEmMs: state.tempoMs } };
  const primeira = quantidadeDe(state, tipo) === 0;
  // A primeira unidade de alguns tipos dispara o card correspondente (GDD §10, Parte 2 §7).
  const eventos = primeira ? [...state.eventos, { tipo: "primeiraCompra" as const, item: tipo }] : state.eventos;
  return comMundo(state, { ...state.mundo, construcoes }, state.creditos - custo, eventos);
}

/** Remover devolve 50 %. Tocar em qualquer das quatro casas de uma 2×2 remove a construção inteira. */
export function remover(state: GameState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): GameState | null {
  const ancora = ancoraEm(state.mundo, indice, arq);
  if (ancora === null) return null;
  const c = state.mundo.construcoes[ancora];
  const valor = valorRemocao(state, c.tipo);
  const construcoes = { ...state.mundo.construcoes };
  delete construcoes[ancora];
  return comMundo(state, { ...state.mundo, construcoes }, state.creditos + valor);
}

/* --- Subestações das duas eras: nível (custo ×3ⁿ, teto ×2ⁿ, com nível máximo) --- */

/** Custo do próximo nível de uma subestação do tipo: custo base × 3^(nível + 1) (GDD §8.5). */
export function custoNivelDe(tipo: keyof typeof ESCOAMENTO, nivel: number): number {
  const def = ESCOAMENTO[tipo];
  return def.custoBase * Math.pow(def.custoNivel, nivel + 1);
}

export function custoNivelSubestacao(nivel: number): number {
  return custoNivelDe("subestacao", nivel);
}

/** Nível máximo da subestação do tipo (ajuste 2 da Sessão 7: a da Era 1 para em 3 → teto 320 kW). */
export function nivelMaximoSubestacao(tipo: keyof typeof ESCOAMENTO = "subestacao"): number {
  return ESCOAMENTO[tipo].nivelMax;
}

export function avaliarMelhoriaSubestacao(state: GameState, indice: number): { ok: boolean; motivo: string | null } {
  const c = construcaoEm(state.mundo, indice);
  if (!c || !ehSubestacao(c.tipo)) return { ok: false, motivo: "Não é uma subestação" };
  const def = ESCOAMENTO[c.tipo];
  if (c.nivel >= def.nivelMax) return { ok: false, motivo: `Nível máximo (${def.nivelMax + 1}): ponha outra subestação` };
  if (state.creditos < custoNivelDe(c.tipo, c.nivel)) return { ok: false, motivo: "₵ insuficientes" };
  return { ok: true, motivo: null };
}

export function podeMelhorarSubestacao(state: GameState, indice: number): boolean {
  return avaliarMelhoriaSubestacao(state, indice).ok;
}

export function melhorarSubestacao(state: GameState, indice: number): GameState | null {
  if (!podeMelhorarSubestacao(state, indice)) return null;
  const c = state.mundo.construcoes[indice];
  if (!ehSubestacao(c.tipo)) return null;
  const custo = custoNivelDe(c.tipo, c.nivel);
  const construcoes = { ...state.mundo.construcoes, [indice]: { ...c, nivel: c.nivel + 1 } };
  return comMundo(state, { ...state.mundo, construcoes }, state.creditos - custo);
}

export const tetoDaSubestacao = tetoSubestacao;
export { tetoDeSubestacao };

/* --- Obstáculos --- */

export interface RecusaObstaculo {
  ok: boolean;
  motivo: string | null;
}

export function avaliarRemocaoObstaculo(state: GameState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): RecusaObstaculo {
  const tipo = obstaculoEm(state.mundo, indice, arq);
  if (!tipo) return { ok: false, motivo: "Nada para remover aqui" };
  const def = OBSTACULOS[tipo];
  if (def.permanente) return { ok: false, motivo: `${def.nome}: permanente (e dá vento aos vizinhos)` };
  const ilha = ilhaDaCasa(indice, arq);
  if (!ilha || !ilhaAberta(state.mundo, ilha)) return { ok: false, motivo: "Ilha fechada: faça a expedição" };
  if (removendo(state.mundo, ancoraDoObstaculo(state.mundo, indice, arq))) return { ok: false, motivo: "Já está na fila" };
  if (def.pesquisa !== undefined && state.pesquisa < def.pesquisa) return { ok: false, motivo: `Precisa de 🔬 ${def.pesquisa}` };
  if (state.creditos < def.custo) return { ok: false, motivo: "₵ insuficientes" };
  return { ok: true, motivo: null };
}

export function podeRemoverObstaculo(state: GameState, indice: number): boolean {
  return avaliarRemocaoObstaculo(state, indice).ok;
}

/** Cobra na hora e põe na fila; o Bipe de manutenção leva `tempoMs` para derrubar (GDD §8.5). */
export function removerObstaculo(state: GameState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): GameState | null {
  if (!avaliarRemocaoObstaculo(state, indice, arq).ok) return null;
  const ancora = ancoraDoObstaculo(state.mundo, indice, arq);
  const tipo = obstaculoEm(state.mundo, ancora, arq);
  if (!tipo) return null;
  const def = OBSTACULOS[tipo];
  const vazia = state.mundo.remocoes.length === 0;
  const remocao = {
    indice: ancora,
    tipo,
    inicioMs: vazia ? state.tempoMs : 0,
    fimMs: vazia ? state.tempoMs + def.tempoMs : 0,
  };
  return comMundo(state, { ...state.mundo, remocoes: [...state.mundo.remocoes, remocao] }, state.creditos - def.custo);
}

/** Avança a fila de remoção: conclui a da frente quando o tempo chega e começa a próxima. Chamado pelo tick. */
export function passoRemocoes(state: GameState, arq: Arquipelago = arquipelagoDaEra1()): GameState {
  const fila = state.mundo.remocoes;
  if (fila.length === 0) return state;
  const atual = fila[0];
  if (atual.fimMs === 0) {
    const remocoes = [{ ...atual, inicioMs: state.tempoMs, fimMs: state.tempoMs + OBSTACULOS[atual.tipo].tempoMs }, ...fila.slice(1)];
    return { ...state, mundo: { ...state.mundo, remocoes } };
  }
  if (state.tempoMs < atual.fimMs) return state;
  const def = OBSTACULOS[atual.tipo];
  const casas = casasDoObstaculo(atual.indice, atual.tipo, arq.n);
  const removidos = [...state.mundo.removidos, ...casas.filter((c) => !state.mundo.removidos.includes(c))];
  // Dinamitar uma montanha descobre cristais: as casas liberadas rendem +50 % em ciência (GDD §8.6, §9).
  const cristais = def.deixaCristal ? [...state.mundo.cristais, ...casas.filter((c) => !state.mundo.cristais.includes(c))] : state.mundo.cristais;
  const resto = fila.slice(1);
  const remocoes = resto.length > 0 ? [{ ...resto[0], inicioMs: state.tempoMs, fimMs: state.tempoMs + OBSTACULOS[resto[0].tipo].tempoMs }, ...resto.slice(1)] : [];
  return {
    ...state,
    pesquisa: state.pesquisa + (def.devolvePesquisa ?? 0),
    mundo: { ...state.mundo, removidos, remocoes, cristais },
    eventos: [...state.eventos, { tipo: "obstaculoRemovido", indice: atual.indice, cristal: !!def.deixaCristal }],
  };
}

/* --- Expedição e cabo --- */

export function custoExpedicao(id: IlhaId): number | null {
  return ilhaDef(id).expedicao;
}

export function podeComprarIlha(state: GameState, id: IlhaId): boolean {
  const custo = custoExpedicao(id);
  return custo !== null && !ilhaAberta(state.mundo, id) && state.creditos >= custo;
}

export function comprarIlha(state: GameState, id: IlhaId): GameState | null {
  if (!podeComprarIlha(state, id)) return null;
  const custo = custoExpedicao(id) ?? 0;
  return comMundo(state, { ...state.mundo, ilhasAbertas: [...state.mundo.ilhasAbertas, id] }, state.creditos - custo, [
    ...state.eventos,
    { tipo: "ilhaAberta", id },
  ]);
}

export function rotaDoCabo(id: IlhaId, arq: Arquipelago = arquipelagoDaEra1()) {
  const q = arq.ilhas.findIndex((i) => i.id === id);
  return q < 0 ? null : arq.rotas[q];
}

export function custoCabo(id: IlhaId, arq: Arquipelago = arquipelagoDaEra1()): number {
  const rota = rotaDoCabo(id, arq);
  return rota ? rota.custo : CABO.custoFixo;
}

export function podeLigarCabo(state: GameState, id: IlhaId): boolean {
  return ilhaAberta(state.mundo, id) && !temCabo(state.mundo, id) && state.creditos >= custoCabo(id);
}

export function ligarCabo(state: GameState, id: IlhaId): GameState | null {
  if (!podeLigarCabo(state, id)) return null;
  return comMundo(state, { ...state.mundo, cabos: { ...state.mundo.cabos, [id]: 0 } }, state.creditos - custoCabo(id));
}

/** Nível do cabo: custo da rota × 3^(nível + 1), teto × 2 (GDD §8.5). */
export function custoNivelCabo(id: IlhaId, nivel: number, arq: Arquipelago = arquipelagoDaEra1()): number {
  return custoCabo(id, arq) * Math.pow(CABO.custoNivel, nivel + 1);
}

export function podeMelhorarCabo(state: GameState, id: IlhaId): boolean {
  const nivel = nivelCabo(state.mundo, id);
  return nivel !== null && state.creditos >= custoNivelCabo(id, nivel);
}

export function melhorarCabo(state: GameState, id: IlhaId): GameState | null {
  const nivel = nivelCabo(state.mundo, id);
  if (nivel === null || !podeMelhorarCabo(state, id)) return null;
  const custo = custoNivelCabo(id, nivel);
  return comMundo(state, { ...state.mundo, cabos: { ...state.mundo.cabos, [id]: nivel + 1 } }, state.creditos - custo);
}
