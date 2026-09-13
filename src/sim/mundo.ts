/**
 * Ações do jogador sobre o mundo (GDD §2.1, §2.4, §7, §8.5, v0.6): colocar e remover construções, desmatar
 * obstáculos, comprar a expedição de uma ilha e ligar o cabo submarino. Funções puras: devolvem `null`
 * quando a ação não é possível. Nenhum número aqui — tudo vem de `content/`.
 */
import { BATERIA, USINAS, VILA, type Desbloqueio } from "../content/era1";
import { CABO, OBSTACULOS, SUBESTACAO, ilhaDef, type IlhaId, type TipoObstaculo } from "../content/era1-arquipelago";
import { custoUnidade } from "./custos";
import { arquipelagoDaEra1 } from "./gerarArquipelago";
import { naPlataforma, type Arquipelago } from "./arquipelago";
import { analisar, ehUsina, ilhaDaCasa, obstaculoEm, quantidadeDe, tetoCabo, tetoSubestacao } from "./producao";
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
  if (tipo === "vila") return VILA;
  if (tipo === "bateria") return BATERIA;
  return SUBESTACAO;
}

export function nomeConstrucao(tipo: TipoConstrucao): string {
  if (ehUsina(tipo)) return USINAS[tipo].nome;
  if (tipo === "vila") return VILA.nome;
  if (tipo === "bateria") return BATERIA.nome;
  return SUBESTACAO.nome;
}

export function desbloqueioDe(tipo: TipoConstrucao): Desbloqueio | undefined {
  if (ehUsina(tipo)) return USINAS[tipo].desbloqueio;
  if (tipo === "bateria") return BATERIA.desbloqueio;
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
 */
export function avaliarCasa(state: GameState, indice: number, tipo: TipoConstrucao, arq: Arquipelago = arquipelagoDaEra1()): Avaliacao {
  const n = arq.n;
  if (indice < 0 || indice >= n * n) return RECUSA("Fora do mapa");
  if (arq.terra[indice] !== 1) return RECUSA("Só se constrói em terra");
  const x = indice % n;
  const y = Math.floor(indice / n);
  if (naPlataforma(arq.plataforma, x, y)) return RECUSA("A plataforma é do Núcleo");
  if (arq.caminho[indice] === 1) return RECUSA("Caminho da aldeia");
  const ilha = ilhaDaCasa(indice, arq);
  if (!ilha || !ilhaAberta(state.mundo, ilha)) return RECUSA("Ilha fechada: faça a expedição");
  if (state.mundo.construcoes[indice]) return RECUSA("Casa ocupada");
  const obstaculo = obstaculoEm(state.mundo, indice, arq);
  if (obstaculo) return RECUSA(removendo(state.mundo, indice) ? "Removendo…" : `${OBSTACULOS[obstaculo].nome}: remova primeiro`);
  if (state.creditos < custoColocar(state, tipo)) return RECUSA("₵ insuficientes");
  return { ok: true, motivo: null, aviso: avisoDaCasa(state, indice, tipo, arq) };
}

/** Ressalva de rendimento da casa (não impede a colocação). */
export function avisoDaCasa(state: GameState, indice: number, tipo: TipoConstrucao, arq: Arquipelago = arquipelagoDaEra1()): string | null {
  const n = arq.n;
  const analise = analisar(state);
  const ilhaIndice = arq.ilha[indice];
  if (tipo === "subestacao" || tipo === "bateria") return null;

  const perto = analise.subestacoes.filter(
    (s) => arq.ilha[s.indice] === ilhaIndice && Math.max(Math.abs((s.indice % n) - (indice % n)), Math.abs(Math.floor(s.indice / n) - Math.floor(indice / n))) <= SUBESTACAO.alcance,
  );
  if (perto.length === 0) return "sem escoamento";
  if (tipo === "vila") return null;
  if (perto.every((s) => s.usadoKw >= s.tetoKw)) return "subestação no teto";

  const x = indice % n;
  const y = Math.floor(indice / n);
  const vizinhos: number[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
    vizinhos.push(ny * n + nx);
  }
  if (tipo === "painelSolar") {
    const altos = vizinhos.filter((j) => {
      const c = state.mundo.construcoes[j];
      if (c?.tipo === "turbinaEolica") return true;
      const o = obstaculoEm(state.mundo, j, arq);
      return !!o && !!OBSTACULOS[o].alto;
    }).length;
    if (altos > 0) return `sombra −${Math.round(Math.min(0.6, altos * 0.3) * 100)} %`;
    return null;
  }
  const eolicos = vizinhos.filter((j) => {
    const c = state.mundo.construcoes[j];
    return !!c && (c.tipo === "cataVento" || c.tipo === "turbinaEolica");
  }).length;
  if (eolicos > 0) return `esteira −${Math.round(Math.min(0.6, eolicos * 0.2) * 100)} %`;
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
  const eventos =
    primeira && (tipo === "bateria" || tipo === "subestacao") ? [...state.eventos, { tipo: "primeiraCompra" as const, item: tipo }] : state.eventos;
  return comMundo(state, { ...state.mundo, construcoes }, state.creditos - custo, eventos);
}

export function remover(state: GameState, indice: number): GameState | null {
  const c = construcaoEm(state.mundo, indice);
  if (!c) return null;
  const valor = valorRemocao(state, c.tipo);
  const construcoes = { ...state.mundo.construcoes };
  delete construcoes[indice];
  return comMundo(state, { ...state.mundo, construcoes }, state.creditos + valor);
}

/* --- Subestação: nível (GDD §8.5: custo ×3ⁿ, teto ×2ⁿ) --- */

export function custoNivelSubestacao(nivel: number): number {
  return SUBESTACAO.custoBase * Math.pow(SUBESTACAO.custoNivel, nivel + 1);
}

export function podeMelhorarSubestacao(state: GameState, indice: number): boolean {
  const c = construcaoEm(state.mundo, indice);
  return !!c && c.tipo === "subestacao" && state.creditos >= custoNivelSubestacao(c.nivel);
}

export function melhorarSubestacao(state: GameState, indice: number): GameState | null {
  if (!podeMelhorarSubestacao(state, indice)) return null;
  const c = state.mundo.construcoes[indice];
  const custo = custoNivelSubestacao(c.nivel);
  const construcoes = { ...state.mundo.construcoes, [indice]: { ...c, nivel: c.nivel + 1 } };
  return comMundo(state, { ...state.mundo, construcoes }, state.creditos - custo);
}

export const tetoDaSubestacao = tetoSubestacao;

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
