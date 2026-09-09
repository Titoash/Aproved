/**
 * Persistência: único arquivo que toca `localStorage`.
 * Salva a cada `INTERVALO_SAVE_MS`, carrega no início, exporta/importa JSON,
 * migra saves de versões anteriores.
 */
import { MELHORIAS } from "../content/era1";
import { NUCLEO, PECAS } from "../content/era1-nucleo";
import { anel } from "./nucleo";
import { calcularOffline, type RelatorioOffline } from "./offline";
import { capacidadeBateriaKwh } from "./rede";
import {
  estadoInicial,
  melhoriasIniciais,
  nucleoInicial,
  VERSAO_SAVE,
  type Casa,
  type GameState,
  type MelhoriaId,
  type Melhorias,
  type NucleoState,
  type PecaId,
  type RedeState,
  type UsinaId,
} from "./state";

export const CHAVE_SAVE = "aproved.save";
export const INTERVALO_SAVE_MS = 10_000;

/** Subconjunto de `Storage` usado aqui; permite injetar um armazenamento em testes. */
export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

function armazenamentoPadrao(): Armazenamento | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export class ErroSave extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroSave";
  }
}

/* ------------------------------------------------------------------ */
/* Serialização                                                       */
/* ------------------------------------------------------------------ */

/** Serializa carimbando `salvoEmMs` com o relógio real (base do cálculo offline). */
export function serializar(state: GameState, agoraMs: number = Date.now()): string {
  return JSON.stringify({ ...state, salvoEmMs: agoraMs });
}

function numero(valor: unknown, padrao: number, minimo = 0): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return padrao;
  return Math.max(minimo, valor);
}

function inteiro(valor: unknown, padrao: number): number {
  return Math.floor(numero(valor, padrao));
}

function booleano(valor: unknown, padrao: boolean): boolean {
  return typeof valor === "boolean" ? valor : padrao;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

const IDS_USINA: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica"];

function ehPecaId(valor: unknown): valor is PecaId {
  return typeof valor === "string" && valor in PECAS;
}

function normalizarCasa(bruto: unknown, indice: number): Casa {
  if (indice === NUCLEO.indiceReceptor) return { tipo: "receptor" };
  const c = objeto(bruto);
  if (!ehPecaId(c.id)) return null;
  const a = anel(indice);
  if (a === 0 || !PECAS[c.id].aneis.includes(a)) return null;
  if (c.tipo === "peca") return { tipo: "peca", id: c.id };
  if (c.tipo === "entulho") return { tipo: "entulho", id: c.id, desdeMs: numero(c.desdeMs, 0) };
  return null;
}

function normalizarNucleo(bruto: unknown): NucleoState | null {
  if (bruto === null || bruto === undefined || typeof bruto !== "object") return null;
  const n = objeto(bruto);
  const base = nucleoInicial();
  const gradeBruta = Array.isArray(n.grade) ? n.grade : [];
  const grade = base.grade.map((_, i) => normalizarCasa(gradeBruta[i], i));
  const scramRestanteMs = numero(n.scramRestanteMs, base.scramRestanteMs);
  const ultimaCascataMs = typeof n.ultimaCascataMs === "number" && Number.isFinite(n.ultimaCascataMs) ? n.ultimaCascataMs : null;
  return {
    grade,
    calorU: numero(n.calorU, base.calorU),
    tempoAcimaDoLimiteMs: numero(n.tempoAcimaDoLimiteMs, base.tempoAcimaDoLimiteMs),
    scramRestanteMs,
    estabilidade: Math.min(100, numero(n.estabilidade, base.estabilidade)),
    modoSeguro: booleano(n.modoSeguro, base.modoSeguro),
    receptorCeramico: booleano(n.receptorCeramico, base.receptorCeramico),
    cascatas: inteiro(n.cascatas, base.cascatas),
    ultimaCascataMs,
  };
}

function normalizarMelhorias(bruto: unknown): Melhorias {
  const base = melhoriasIniciais();
  const m = objeto(bruto);
  for (const id of Object.keys(MELHORIAS) as MelhoriaId[]) base[id] = booleano(m[id], false);
  return base;
}

/** Preenche campos ausentes com o estado inicial e sanitiza números. `agoraMs` vira o carimbo de saves sem `salvoEmMs`. */
function normalizar(bruto: Record<string, unknown>, agoraMs: number): GameState {
  const base = estadoInicial();
  const redeBruta = objeto(bruto.rede);
  const usinasBrutas = objeto(redeBruta.usinas);
  const bateriaBruta = objeto(redeBruta.bateria);

  const usinas = { ...base.rede.usinas };
  for (const id of IDS_USINA) {
    const u = objeto(usinasBrutas[id]);
    usinas[id] = {
      quantidade: inteiro(u.quantidade, base.rede.usinas[id].quantidade),
      nivel: inteiro(u.nivel, base.rede.usinas[id].nivel),
    };
  }

  const unidades = inteiro(bateriaBruta.unidades, base.rede.bateria.unidades);
  const capacidadeKwh = capacidadeBateriaKwh(unidades);
  const rede: RedeState = {
    usinas,
    vilas: inteiro(redeBruta.vilas, base.rede.vilas),
    demandaBaseKw: numero(redeBruta.demandaBaseKw, base.rede.demandaBaseKw),
    bateria: {
      unidades,
      capacidadeKwh,
      kwh: Math.min(numero(bateriaBruta.kwh, 0), capacidadeKwh),
    },
  };

  return {
    versao: VERSAO_SAVE,
    tempoMs: numero(bruto.tempoMs, base.tempoMs),
    creditos: numero(bruto.creditos, base.creditos),
    pesquisa: numero(bruto.pesquisa, base.pesquisa),
    era: 1,
    rede,
    nucleo: normalizarNucleo(bruto.nucleo),
    melhorias: normalizarMelhorias(bruto.melhorias),
    salvoEmMs: typeof bruto.salvoEmMs === "number" && bruto.salvoEmMs > 0 ? bruto.salvoEmMs : agoraMs,
  };
}

/**
 * Migra saves de versões anteriores, uma versão por vez.
 * v1 → v2: entra o Núcleo (`nucleo: null` até ser desbloqueado). Rede e créditos ficam como estão.
 * v2 → v3: entram `melhorias` (vazias) e `salvoEmMs` (= agora, sem ganho offline na primeira carga).
 */
function migrar(bruto: Record<string, unknown>, agoraMs: number): Record<string, unknown> {
  const versao = bruto.versao;
  if (typeof versao !== "number") throw new ErroSave("Save sem campo `versao`.");
  if (versao > VERSAO_SAVE) {
    throw new ErroSave(`Save da versão ${versao} é mais novo que o jogo (versão ${VERSAO_SAVE}).`);
  }
  let atual = bruto;
  let v = versao;
  if (v === 1) {
    atual = { ...atual, nucleo: null, versao: 2 };
    v = 2;
  }
  if (v === 2) {
    atual = { ...atual, melhorias: {}, salvoEmMs: agoraMs, versao: 3 };
    v = 3;
  }
  return { ...atual, versao: v };
}

export function desserializar(json: string, agoraMs: number = Date.now()): GameState {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    throw new ErroSave("JSON inválido.");
  }
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    throw new ErroSave("O save precisa ser um objeto JSON.");
  }
  return normalizar(migrar(bruto as Record<string, unknown>, agoraMs), agoraMs);
}

/* ------------------------------------------------------------------ */
/* localStorage                                                       */
/* ------------------------------------------------------------------ */

export function salvar(
  state: GameState,
  storage: Armazenamento | null = armazenamentoPadrao(),
  agoraMs: number = Date.now(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CHAVE_SAVE, serializar(state, agoraMs));
    return true;
  } catch {
    return false;
  }
}

export interface Carregado {
  state: GameState;
  relatorio: RelatorioOffline;
}

/** Devolve o estado salvo já com o cálculo offline aplicado, ou `null` se não houver save válido. */
export function carregar(
  storage: Armazenamento | null = armazenamentoPadrao(),
  agoraMs: number = Date.now(),
): Carregado | null {
  if (!storage) return null;
  try {
    const json = storage.getItem(CHAVE_SAVE);
    if (!json) return null;
    return calcularOffline(desserializar(json, agoraMs), agoraMs);
  } catch {
    return null;
  }
}

export function limpar(storage: Armazenamento | null = armazenamentoPadrao()): void {
  try {
    storage?.removeItem(CHAVE_SAVE);
  } catch {
    /* sem armazenamento disponível */
  }
}

/* ------------------------------------------------------------------ */
/* Exportar / importar                                                */
/* ------------------------------------------------------------------ */

export function exportarJson(state: GameState, agoraMs: number = Date.now()): string {
  return JSON.stringify({ ...state, salvoEmMs: agoraMs }, null, 2);
}

/** Lança `ErroSave` se o JSON for inválido. Não aplica o offline: quem importa decide. */
export function importarJson(json: string, agoraMs: number = Date.now()): GameState {
  return desserializar(json, agoraMs);
}
