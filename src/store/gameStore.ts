/**
 * Store Zustand: guarda o snapshot do `GameState` e expõe as ações do jogador.
 * Toda a regra fica em `src/sim`; aqui só se aplica e se publica o resultado.
 * Também guarda o estado de interface que Phaser e React compartilham
 * (peça selecionada, último aviso da grade).
 */
import { create } from "zustand";
import { OFFLINE } from "../content/era1";
import * as acoes from "../sim/acoes";
import * as nucleo from "../sim/acoesNucleo";
import { comprarMelhoria } from "../sim/melhorias";
import { calcularOffline, type RelatorioOffline } from "../sim/offline";
import { carregar, exportarJson, importarJson, INTERVALO_SAVE_MS, limpar, salvar } from "../sim/save";
import { estadoInicial, type GameState, type MelhoriaId, type PecaId, type UsinaId } from "../sim/state";
import { avancarTicks } from "../sim/tick";

/** O que o clique numa casa da grade faz. */
export type Ferramenta = PecaId | "remover";

export interface AvisoGrade {
  indice: number;
  texto: string;
  /** `Date.now()` do aviso, para a cena animar só o mais recente. */
  em: number;
  /** `tempoMs` do jogo no aviso, para a UI escondê-lo depois de um tempo sem relógio impuro. */
  emTempoMs: number;
}

export interface GameStore {
  state: GameState;
  /** `tempoMs` do jogo no último save automático. */
  salvoEmTempoMs: number;
  /** Relógio real (`Date.now()`) do último save, para a UI. `null` = ainda não salvou nesta sessão. */
  salvoEmRelogio: number | null;
  ferramenta: Ferramenta;
  avisoGrade: AvisoGrade | null;
  /** Casa da grade sob o ponteiro (vem do DOM; a cena só desenha o realce). */
  casaSobPonteiro: number | null;
  /** Relatório "Enquanto você esteve fora", mostrado uma vez por carregamento. */
  relatorioOffline: RelatorioOffline | null;

  avancarTicks: (n: number) => void;

  // Rede
  comprarUsina: (id: UsinaId) => boolean;
  melhorarUsina: (id: UsinaId) => boolean;
  comprarVila: () => boolean;
  comprarBateria: () => boolean;
  comprarMelhoria: (id: MelhoriaId) => boolean;

  // Núcleo
  desbloquearNucleo: () => boolean;
  selecionarFerramenta: (ferramenta: Ferramenta) => void;
  /** Aplica a ferramenta selecionada na casa. Devolve `false` e registra um aviso se recusado. */
  agirNaCasa: (indice: number) => boolean;
  colocarPeca: (indice: number, pecaId: PecaId) => boolean;
  removerPeca: (indice: number) => boolean;
  limparEntulho: (indice: number) => boolean;
  reconstruir: (indice: number) => boolean;
  alternarModoSeguro: () => boolean;
  scramManual: () => boolean;
  comprarReceptorCeramico: () => boolean;
  setCasaSobPonteiro: (indice: number | null) => void;
  fecharRelatorioOffline: () => void;

  // Save
  salvarAgora: () => boolean;
  exportar: () => string;
  /** Lança `ErroSave` se o JSON for inválido. */
  importar: (json: string) => void;
  resetar: () => void;
}

/** Só vale a pena mostrar o relatório para ausências a partir de `minimoRelatorioMs`. */
function relatorioVisivel(relatorio: RelatorioOffline | null): RelatorioOffline | null {
  return relatorio && relatorio.duracaoMs >= OFFLINE.minimoRelatorioMs ? relatorio : null;
}

function estadoCarregado(): { state: GameState; relatorio: RelatorioOffline | null } {
  const carregado = carregar();
  if (!carregado) return { state: estadoInicial(), relatorio: null };
  return { state: carregado.state, relatorio: relatorioVisivel(carregado.relatorio) };
}

export const useGameStore = create<GameStore>()((set, get) => {
  const { state: inicial, relatorio: relatorioInicial } = estadoCarregado();

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

  const avisar = (indice: number, texto: string) => {
    set({ avisoGrade: { indice, texto, em: Date.now(), emTempoMs: get().state.tempoMs } });
  };

  return {
    state: inicial,
    salvoEmTempoMs: inicial.tempoMs,
    salvoEmRelogio: null,
    ferramenta: "heliostato",
    avisoGrade: null,
    casaSobPonteiro: null,
    relatorioOffline: relatorioInicial,

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
    comprarMelhoria: (id) => aplicar(comprarMelhoria(get().state, id)),

    desbloquearNucleo: () => aplicar(nucleo.desbloquearNucleo(get().state)),
    selecionarFerramenta: (ferramenta) => set({ ferramenta }),

    agirNaCasa(indice) {
      const { state, ferramenta } = get();
      if (!state.nucleo) return false;
      const casa = state.nucleo.grade[indice];
      if (casa?.tipo === "entulho") {
        // Entulho: limpa se já é grátis; senão reconstrói pagando metade.
        if (aplicar(nucleo.limparEntulho(state, indice))) return true;
        if (aplicar(nucleo.reconstruir(state, indice))) return true;
        avisar(indice, "Entulho: espere a limpeza grátis ou pague a reconstrução.");
        return false;
      }
      if (ferramenta === "remover") {
        if (aplicar(nucleo.removerPeca(state, indice))) return true;
        avisar(indice, casa?.tipo === "receptor" ? "O Receptor é fixo." : "Nada para remover.");
        return false;
      }
      const v = nucleo.validarColocacao(state, indice, ferramenta);
      if (!v.ok) {
        avisar(indice, v.motivo);
        return false;
      }
      return aplicar(nucleo.colocarPeca(state, indice, ferramenta));
    },

    colocarPeca: (indice, pecaId) => aplicar(nucleo.colocarPeca(get().state, indice, pecaId)),
    removerPeca: (indice) => aplicar(nucleo.removerPeca(get().state, indice)),
    limparEntulho: (indice) => aplicar(nucleo.limparEntulho(get().state, indice)),
    reconstruir: (indice) => aplicar(nucleo.reconstruir(get().state, indice)),
    alternarModoSeguro: () => aplicar(nucleo.alternarModoSeguro(get().state)),
    scramManual: () => aplicar(nucleo.scramManual(get().state)),
    comprarReceptorCeramico: () => aplicar(nucleo.comprarReceptorCeramico(get().state)),
    setCasaSobPonteiro: (indice) => {
      if (get().casaSobPonteiro !== indice) set({ casaSobPonteiro: indice });
    },
    fecharRelatorioOffline: () => set({ relatorioOffline: null }),

    salvarAgora: () => salvarEstado(get().state),
    exportar: () => exportarJson(get().state),

    importar(json) {
      // Um save exportado há tempo também rende offline desde o carimbo.
      const agora = Date.now();
      const { state, relatorio } = calcularOffline(importarJson(json, agora), agora);
      set({ state, avisoGrade: null, relatorioOffline: relatorioVisivel(relatorio) });
      salvarEstado(state);
    },

    resetar() {
      limpar();
      const state = estadoInicial();
      set({
        state,
        salvoEmTempoMs: state.tempoMs,
        salvoEmRelogio: null,
        avisoGrade: null,
        ferramenta: "heliostato",
        casaSobPonteiro: null,
        relatorioOffline: null,
      });
    },
  };
});
