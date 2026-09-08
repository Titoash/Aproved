/**
 * Persistência: único arquivo que toca `localStorage`.
 * Salva a cada `INTERVALO_SAVE_MS`, carrega no início, exporta/importa JSON,
 * migra saves de versões anteriores.
 */
import { NUCLEO, PECAS } from "../content/era1-nucleo";
import { anel } from "./nucleo";
import { capacidadeBateriaKwh } from "./rede";
import {
  estadoInicial,
  nucleoInicial,
  VERSAO_SAVE,
  type Casa,
  type GameState,
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

export function serializar(state: GameState): string {
  return JSON.stringify(state);
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

/** Preenche campos ausentes com o estado inicial e sanitiza números. */
function normalizar(bruto: Record<string, unknown>): GameState {
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
  };
}

/**
 * Migra saves de versões anteriores, uma versão por vez.
 * v1 → v2: entra o Núcleo (`nucleo: null` até ser desbloqueado). Rede e créditos ficam como estão.
 */
function migrar(bruto: Record<string, unknown>): Record<string, unknown> {
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
  return { ...atual, versao: v };
}

export function desserializar(json: string): GameState {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    throw new ErroSave("JSON inválido.");
  }
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    throw new ErroSave("O save precisa ser um objeto JSON.");
  }
  return normalizar(migrar(bruto as Record<string, unknown>));
}

/* ------------------------------------------------------------------ */
/* localStorage                                                       */
/* ------------------------------------------------------------------ */

export function salvar(state: GameState, storage: Armazenamento | null = armazenamentoPadrao()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CHAVE_SAVE, serializar(state));
    return true;
  } catch {
    return false;
  }
}

/** Devolve o estado salvo ou `null` se não houver save válido. */
export function carregar(storage: Armazenamento | null = armazenamentoPadrao()): GameState | null {
  if (!storage) return null;
  try {
    const json = storage.getItem(CHAVE_SAVE);
    if (!json) return null;
    return desserializar(json);
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

export function exportarJson(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

/** Lança `ErroSave` se o JSON for inválido. */
export function importarJson(json: string): GameState {
  return desserializar(json);
}
