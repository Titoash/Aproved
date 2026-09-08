/**
 * Store Zustand: guarda o snapshot do `GameState` e expõe as ações do jogador.
 * Toda a regra fica em `src/sim`; aqui só se aplica e se publica o resultado.
 */
import { create } from "zustand";
import * as acoes from "../sim/acoes";
import { carregar, exportarJson, importarJson, INTERVALO_SAVE_MS, limpar, salvar } from "../sim/save";
import { estadoInicial, type GameState, type UsinaId } from "../sim/state";
import { avancarTicks } from "../sim/tick";

export interface GameStore {
  state: GameState;
  /** `tempoMs` do jogo no último save automático. */
  salvoEmTempoMs: number;
  /** Relógio real (`Date.now()`) do último save, para a UI. `null` = ainda não salvou nesta sessão. */
  salvoEmRelogio: number | null;

  avancarTicks: (n: number) => void;
  comprarUsina: (id: UsinaId) => boolean;
  melhorarUsina: (id: UsinaId) => boolean;
  comprarVila: () => boolean;
  comprarBateria: () => boolean;
  salvarAgora: () => boolean;
  exportar: () => string;
  /** Lança `ErroSave` se o JSON for inválido. */
  importar: (json: string) => void;
  resetar: () => void;
}

function estadoCarregado(): GameState {
  return carregar() ?? estadoInicial();
}

export const useGameStore = create<GameStore>()((set, get) => {
  const inicial = estadoCarregado();

  const aplicar = (proximo: GameState | null): boolean => {
    if (!proximo) return false;
    set({ state: proximo });
    return true;
  };

  const salvarEstado = (state: GameState): boolean => {
    const ok = salvar(state);
    if (ok) set({ salvoEmTempoMs: state.tempoMs, salvoEmRelogio: Date.now() });
    return ok;
  };

  return {
    state: inicial,
    salvoEmTempoMs: inicial.tempoMs,
    salvoEmRelogio: null,

    avancarTicks(n) {
      const { state, salvoEmTempoMs } = get();
      const proximo = avancarTicks(state, n);
      set({ state: proximo });
      if (proximo.tempoMs - salvoEmTempoMs >= INTERVALO_SAVE_MS) salvarEstado(proximo);
    },

    comprarUsina: (id) => aplicar(acoes.comprarUsina(get().state, id)),
    melhorarUsina: (id) => aplicar(acoes.melhorarUsina(get().state, id)),
    comprarVila: () => aplicar(acoes.comprarVila(get().state)),
    comprarBateria: () => aplicar(acoes.comprarBateria(get().state)),

    salvarAgora: () => salvarEstado(get().state),
    exportar: () => exportarJson(get().state),

    importar(json) {
      const state = importarJson(json);
      set({ state });
      salvarEstado(state);
    },

    resetar() {
      limpar();
      const state = estadoInicial();
      set({ state, salvoEmTempoMs: state.tempoMs, salvoEmRelogio: null });
    },
  };
});
