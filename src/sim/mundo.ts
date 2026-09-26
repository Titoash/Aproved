/**
 * Ações do jogador sobre o mundo (GDD §2.1, §2.4, §7, §8.5, v0.6): colocar e remover construções, desmatar
 * obstáculos, comprar a expedição de uma ilha e ligar o cabo submarino. Funções puras: devolvem `null`
 * quando a ação não é possível. Nenhum número aqui — tudo vem de `content/`.
 */
import { BATERIA, type Desbloqueio } from "../content/era1";
import { USINAS } from "../content/usinas";
import { BATERIA_REDE, DISTRITO_INDUSTRIAL, INSTITUTO } from "../content/era2";
import { BAIRRO, LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { NIVEL_CIENCIA, TIPOS_CIENCIA, type TipoCiencia } from "../content/melhorias";
import { CABO, OBSTACULOS, SELECAO_AREA, TERRENOS, VIZINHANCA, ilhaDef, type IlhaId, type TipoObstaculo } from "../content/era1-arquipelago";
import { custoUnidade } from "./custos";
import { custoAcumuladoPorBairro } from "./cidade";
import { bipesNoNivel, custoAcumuladoTriplo } from "./niveis";
import { formatarNumero } from "./formatar";
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
import { efeitosDe, type EfeitosArvore } from "./efeitos";
import type { Construcao, GameState, MundoState, RemocaoEmCurso, TipoConstrucao } from "./state";

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

const ehCiencia = (tipo: TipoConstrucao): tipo is TipoCiencia => (TIPOS_CIENCIA as readonly TipoConstrucao[]).includes(tipo);

/**
 * ₵ que a unidade nova paga pelo que o tipo já tem: o bairro, o que a cidade pagou por bairro para chegar à
 * densidade (§8.6); subestação e ciência, o que o tipo pagou por unidade para chegar ao nível (§7.1,
 * revisão da v0.9). Nos três o custo de evoluir multiplica por N, e sem o acumulado valeria evoluir com
 * uma unidade e construir o resto depois.
 */
export function acumuladoDaUnidade(state: GameState, tipo: TipoConstrucao): number {
  if (tipo === "bairro") return custoAcumuladoPorBairro(state.cidade.densidade).creditos;
  if (ehSubestacao(tipo)) {
    const def = ESCOAMENTO[tipo];
    return custoAcumuladoTriplo(def.custoBase, state.melhorias.subestacoes[tipo], def.custoNivel);
  }
  if (ehCiencia(tipo)) return custoAcumuladoTriplo(definicaoDeCusto(tipo).custoBase, state.melhorias.ciencia[tipo], NIVEL_CIENCIA.crescimento);
  return 0;
}

/**
 * Custo em ₵ da próxima unidade do tipo: `custoBase × crescimento^n` (GDD §7), mais o acumulado da
 * densidade (bairro) ou do nível do tipo (subestação e ciência).
 */
export function custoColocar(state: GameState, tipo: TipoConstrucao): number {
  return custoUnidade(definicaoDeCusto(tipo), quantidadeDe(state, tipo)) + acumuladoDaUnidade(state, tipo);
}

/** 🔬 que a colocação cobra: só o bairro, a parte em 🔬 das evoluções que ele já nasce tendo. */
export function pesquisaColocar(state: GameState, tipo: TipoConstrucao): number {
  return tipo === "bairro" ? custoAcumuladoPorBairro(state.cidade.densidade).pesquisa : 0;
}

/** Remover devolve metade dos ₵ que a última unidade custou, acumulado incluído (GDD §2.4). A 🔬 não volta. */
export function valorRemocao(state: GameState, tipo: TipoConstrucao): number {
  const n = Math.max(0, quantidadeDe(state, tipo) - 1);
  return (custoUnidade(definicaoDeCusto(tipo), n) + acumuladoDaUnidade(state, tipo)) / 2;
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

export { tetoCabo };

/** O obstáculo desta casa está na fila (em curso ou esperando)? A montanha ocupa 2×2: vale qualquer das quatro. */
export function removendo(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): boolean {
  const ancora = ancoraDoObstaculo(mundo, indice, arq);
  return mundo.remocoes.some((r) => r.indice === ancora);
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
    if (obstaculo) return RECUSA(removendo(state.mundo, casa, arq) ? "Removendo…" : `${OBSTACULOS[obstaculo].nome}: remova primeiro`);
  }
  if (state.creditos < custoColocar(state, tipo)) return RECUSA("₵ insuficientes");
  const pesquisa = pesquisaColocar(state, tipo);
  if (state.pesquisa < pesquisa) return RECUSA(`Precisa de 🔬 ${pesquisa}`);
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
  const pesquisa = pesquisaColocar(state, tipo);
  const construcoes = { ...state.mundo.construcoes, [indice]: { tipo, nivel: 0, colocadoEmMs: state.tempoMs } };
  const primeira = quantidadeDe(state, tipo) === 0;
  // A primeira unidade de alguns tipos dispara o card correspondente (GDD §10, Parte 2 §7).
  const eventos = primeira ? [...state.eventos, { tipo: "primeiraCompra" as const, item: tipo }] : state.eventos;
  const proximo = comMundo(state, { ...state.mundo, construcoes }, state.creditos - custo, eventos);
  return pesquisa > 0 ? { ...proximo, pesquisa: state.pesquisa - pesquisa } : proximo;
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

/* --- Subestações: o nível é do tipo (v0.8), em `sim/melhorias.ts`; aqui só os tetos --- */

export const tetoDaSubestacao = tetoSubestacao;
export { tetoDeSubestacao };

/* --- Obstáculos --- */

export interface RecusaObstaculo {
  ok: boolean;
  motivo: string | null;
}

/** Bipes de manutenção trabalhando em paralelo: dois de nascença e um por nível da Equipe (§8.5, v0.8). */
export function bipesDe(state: GameState): number {
  return bipesNoNivel(state.melhorias.equipe);
}

/** Tempo de remoção do tipo, com Máquinas pesadas e Escavadeiras (÷ 2 cada, §8.5 e Parte 2 §3.2). */
export function tempoRemocaoMs(tipo: TipoObstaculo, efeitos: EfeitosArvore): number {
  return OBSTACULOS[tipo].tempoMs * efeitos.tempoRemocaoFator;
}

/**
 * Põe os Bipes livres nas remoções que esperam, na ordem da fila, começando em `desdeMs`. Um Bipe está
 * livre quando nenhuma remoção em curso é dele. Devolve `null` quando nada muda (os caches dependem disso).
 */
function iniciarLivres(fila: readonly RemocaoEmCurso[], desdeMs: number, bipes: number, efeitos: EfeitosArvore): RemocaoEmCurso[] | null {
  const ocupados = new Set<number>();
  for (const r of fila) if (r.fimMs > 0 && r.bipe !== undefined) ocupados.add(r.bipe);
  let proxima: RemocaoEmCurso[] | null = null;
  for (let i = 0; i < fila.length; i++) {
    if (fila[i].fimMs > 0) continue;
    let bipe = 0;
    while (bipe < bipes && ocupados.has(bipe)) bipe++;
    if (bipe >= bipes) break;
    ocupados.add(bipe);
    proxima ??= [...fila];
    proxima[i] = { ...fila[i], inicioMs: desdeMs, fimMs: desdeMs + tempoRemocaoMs(fila[i].tipo, efeitos), bipe };
  }
  return proxima;
}

/** O estado com os Bipes livres já trabalhando (depois de comprar um nível da Equipe). */
export function iniciarRemocoesLivres(state: GameState): GameState {
  const fila = iniciarLivres(state.mundo.remocoes, state.tempoMs, bipesDe(state), efeitosDe(state));
  return fila ? { ...state, mundo: { ...state.mundo, remocoes: fila } } : state;
}

/** Se o obstáculo desta casa pode entrar na fila, sem olhar o saldo (a área soma o saldo uma vez só). */
export function elegivelRemocao(state: GameState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): RecusaObstaculo {
  const tipo = obstaculoEm(state.mundo, indice, arq);
  if (!tipo) return { ok: false, motivo: "Nada para remover aqui" };
  const def = OBSTACULOS[tipo];
  if (def.permanente) return { ok: false, motivo: `${def.nome}: permanente (e dá vento aos vizinhos)` };
  const ilha = ilhaDaCasa(indice, arq);
  if (!ilha || !ilhaAberta(state.mundo, ilha)) return { ok: false, motivo: "Ilha fechada: faça a expedição" };
  if (removendo(state.mundo, indice, arq)) return { ok: false, motivo: "Já está na fila" };
  return { ok: true, motivo: null };
}

export function avaliarRemocaoObstaculo(state: GameState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): RecusaObstaculo {
  const elegivel = elegivelRemocao(state, indice, arq);
  if (!elegivel.ok) return elegivel;
  const def = OBSTACULOS[obstaculoEm(state.mundo, indice, arq)!];
  if (def.pesquisa !== undefined && state.pesquisa < def.pesquisa) return { ok: false, motivo: `Precisa de 🔬 ${def.pesquisa}` };
  if (state.creditos < def.custo) return { ok: false, motivo: "₵ insuficientes" };
  return { ok: true, motivo: null };
}

export function podeRemoverObstaculo(state: GameState, indice: number): boolean {
  return avaliarRemocaoObstaculo(state, indice).ok;
}

/** Cobra ₵ e 🔬 numa transição só, põe os alvos no fim da fila e acorda os Bipes livres. */
function enfileirar(state: GameState, alvos: readonly { indice: number; tipo: TipoObstaculo }[], custo: number, pesquisa: number): GameState {
  const fila = [...state.mundo.remocoes, ...alvos.map((a) => ({ indice: a.indice, tipo: a.tipo, inicioMs: 0, fimMs: 0 }))];
  const iniciada = iniciarLivres(fila, state.tempoMs, bipesDe(state), efeitosDe(state)) ?? fila;
  return { ...comMundo(state, { ...state.mundo, remocoes: iniciada }, state.creditos - custo), pesquisa: state.pesquisa - pesquisa };
}

/**
 * Cobra na hora e põe na fila; um Bipe livre começa já, e leva o tempo do tipo para derrubar (GDD §8.5).
 * A montanha gasta 🔬 20 ao entrar na fila e devolve 🔬 40 quando sai.
 */
export function removerObstaculo(state: GameState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): GameState | null {
  if (!avaliarRemocaoObstaculo(state, indice, arq).ok) return null;
  const ancora = ancoraDoObstaculo(state.mundo, indice, arq);
  const tipo = obstaculoEm(state.mundo, ancora, arq);
  if (!tipo) return null;
  const def = OBSTACULOS[tipo];
  return enfileirar(state, [{ indice: ancora, tipo }], def.custo, def.pesquisa ?? 0);
}

/**
 * Avança a fila de remoção. Conclui as remoções cujo `fimMs` chegou, em ordem de `(fimMs, casa)`, e o Bipe
 * que terminou pega a próxima que espera **no instante em que terminou** — assim o resultado não depende
 * do tamanho do tick (nem do offline). Todas as conclusões do tick saem num mundo novo só. Chamado pelo tick.
 */
export function passoRemocoes(state: GameState, arq: Arquipelago = arquipelagoDaEra1()): GameState {
  const inicial = state.mundo.remocoes;
  if (inicial.length === 0) return state;
  const efeitos = efeitosDe(state);
  let fila = iniciarLivres(inicial, state.tempoMs, bipesDe(state), efeitos) ?? inicial;
  const concluidas: RemocaoEmCurso[] = [];
  for (;;) {
    let k = -1;
    for (let i = 0; i < fila.length; i++) {
      const r = fila[i];
      if (r.fimMs === 0 || r.fimMs > state.tempoMs) continue;
      if (k < 0 || r.fimMs < fila[k].fimMs || (r.fimMs === fila[k].fimMs && r.indice < fila[k].indice)) k = i;
    }
    if (k < 0) break;
    const feita = fila[k];
    concluidas.push(feita);
    fila = [...fila.slice(0, k), ...fila.slice(k + 1)];
    const j = fila.findIndex((r) => r.fimMs === 0);
    if (j >= 0) fila[j] = { ...fila[j], inicioMs: feita.fimMs, fimMs: feita.fimMs + tempoRemocaoMs(fila[j].tipo, efeitos), bipe: feita.bipe };
  }
  if (concluidas.length === 0) return fila === inicial ? state : { ...state, mundo: { ...state.mundo, remocoes: fila } };

  const vistos = new Set(state.mundo.removidos);
  const removidos = [...state.mundo.removidos];
  const comCristal = new Set(state.mundo.cristais);
  const cristais = [...state.mundo.cristais];
  const eventos = [...state.eventos];
  let pesquisa = state.pesquisa;
  for (const r of concluidas) {
    const def = OBSTACULOS[r.tipo];
    const casas = casasDoObstaculo(r.indice, r.tipo, arq.n);
    for (const c of casas) {
      if (!vistos.has(c)) {
        vistos.add(c);
        removidos.push(c);
      }
      // Dinamitar uma montanha descobre cristais: as casas liberadas rendem +50 % em ciência (GDD §8.6, §9).
      if (def.deixaCristal && !comCristal.has(c)) {
        comCristal.add(c);
        cristais.push(c);
      }
    }
    pesquisa += def.devolvePesquisa ?? 0;
    eventos.push({ tipo: "obstaculoRemovido", indice: r.indice, obstaculo: r.tipo, cristal: !!def.deixaCristal });
  }
  return { ...state, pesquisa, mundo: { ...state.mundo, removidos, remocoes: fila, cristais }, eventos };
}

/* --- Seleção em área (§8.5, v0.8) --- */

export interface RetanguloArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Retângulo de `a` até `b`, cortado em 8 casas por eixo a partir de `a` (a casa onde o gesto começou). */
export function retanguloDaArea(a: number, b: number, n: number): RetanguloArea {
  const lim = SELECAO_AREA.ladoMax - 1;
  const ax = a % n;
  const ay = Math.floor(a / n);
  const bx = Math.min(ax + lim, Math.max(ax - lim, b % n));
  const by = Math.min(ay + lim, Math.max(ay - lim, Math.floor(b / n)));
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
}

export interface OrcamentoArea {
  /** Âncoras dos obstáculos que entram, linha a linha, sem repetição (a montanha entra uma vez). */
  alvos: number[];
  custo: number;
  /** 🔬 gasta (montanhas). */
  pesquisa: number;
  /** Quanto a área leva com os Bipes de agora, contando o que já está na fila. */
  duracaoMs: number;
  /** Obstáculos na área que não entram: pico, ilha fechada, já na fila. */
  ignorados: number;
  ok: boolean;
  motivo: string | null;
}

/** Com os Bipes de agora, quando termina a última das remoções novas (fila existente primeiro). */
function duracaoComBipes(state: GameState, novos: readonly TipoObstaculo[], efeitos: EfeitosArvore): number {
  const livres = Array.from({ length: bipesDe(state) }, () => 0);
  for (const r of state.mundo.remocoes) {
    if (r.fimMs > 0 && r.bipe !== undefined && r.bipe < livres.length) livres[r.bipe] = Math.max(0, r.fimMs - state.tempoMs);
  }
  const pegar = (tipo: TipoObstaculo) => {
    let k = 0;
    for (let i = 1; i < livres.length; i++) if (livres[i] < livres[k]) k = i;
    livres[k] += tempoRemocaoMs(tipo, efeitos);
    return livres[k];
  };
  for (const r of state.mundo.remocoes) if (r.fimMs === 0) pegar(r.tipo);
  let fim = 0;
  for (const tipo of novos) fim = Math.max(fim, pegar(tipo));
  return fim;
}

/** O que a área remove, quanto custa e quanto leva — mostrado antes de confirmar. Nada muda no estado. */
export function orcarArea(state: GameState, ret: RetanguloArea, arq: Arquipelago = arquipelagoDaEra1()): OrcamentoArea {
  const n = arq.n;
  const vistos = new Set<number>();
  const alvos: number[] = [];
  const tipos: TipoObstaculo[] = [];
  let custo = 0;
  let pesquisa = 0;
  let ignorados = 0;
  for (let y = ret.y0; y <= ret.y1; y++) {
    for (let x = ret.x0; x <= ret.x1; x++) {
      const i = y * n + x;
      const tipo = obstaculoEm(state.mundo, i, arq);
      if (!tipo) continue;
      const ancora = ancoraDoObstaculo(state.mundo, i, arq);
      if (vistos.has(ancora)) continue;
      vistos.add(ancora);
      if (!elegivelRemocao(state, ancora, arq).ok) {
        ignorados++;
        continue;
      }
      alvos.push(ancora);
      tipos.push(tipo);
      custo += OBSTACULOS[tipo].custo;
      pesquisa += OBSTACULOS[tipo].pesquisa ?? 0;
    }
  }
  const duracaoMs = alvos.length > 0 ? duracaoComBipes(state, tipos, efeitosDe(state)) : 0;
  let motivo: string | null = null;
  if (alvos.length === 0) motivo = "Nada para remover nesta área";
  else if (state.pesquisa < pesquisa) motivo = `Precisa de 🔬 ${formatarNumero(pesquisa, 0)}`;
  else if (state.creditos < custo) motivo = "₵ insuficientes";
  return { alvos, custo, pesquisa, duracaoMs, ignorados, ok: motivo === null, motivo };
}

/** Remove a área inteira ou nada (§8.5): cobra a soma numa transição só e reparte a fila entre os Bipes. */
export function removerArea(state: GameState, ret: RetanguloArea, arq: Arquipelago = arquipelagoDaEra1()): GameState | null {
  const orcamento = orcarArea(state, ret, arq);
  if (!orcamento.ok) return null;
  const alvos = orcamento.alvos.map((indice) => ({ indice, tipo: obstaculoEm(state.mundo, indice, arq)! }));
  return enfileirar(state, alvos, orcamento.custo, orcamento.pesquisa);
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

/** Liga a ilha à rede principal. O cabo nasce no nível global dos cabos (v0.8, `melhorias.cabos`). */
export function ligarCabo(state: GameState, id: IlhaId): GameState | null {
  if (!podeLigarCabo(state, id)) return null;
  return comMundo(state, { ...state.mundo, cabos: { ...state.mundo.cabos, [id]: 0 } }, state.creditos - custoCabo(id));
}

