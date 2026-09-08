/**
 * Persistência: único arquivo que toca `localStorage`.
 * Salva a cada `INTERVALO_SAVE_MS`, carrega no início, exporta/importa JSON.
 */
import { estadoInicial, VERSAO_SAVE, type GameState, type RedeState, type UsinaId } from "./state";
import { capacidadeBateriaKwh } from "./rede";

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

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

const IDS_USINA: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica"];

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
    nucleo: null,
  };
}

/** Migra saves de versões anteriores. Por enquanto só existe a versão 1. */
function migrar(bruto: Record<string, unknown>): Record<string, unknown> {
  const versao = bruto.versao;
  if (typeof versao !== "number") throw new ErroSave("Save sem campo `versao`.");
  if (versao > VERSAO_SAVE) {
    throw new ErroSave(`Save da versão ${versao} é mais novo que o jogo (versão ${VERSAO_SAVE}).`);
  }
  return bruto;
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
