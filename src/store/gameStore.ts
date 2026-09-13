/**
 * Store Zustand: guarda o snapshot do `GameState` e expõe as ações do jogador.
 * Toda a regra fica em `src/sim`; aqui só se aplica e se publica o resultado.
 * Também guarda o estado de interface que Phaser e React compartilham
 * (peça selecionada, último aviso da grade).
 */
import { create } from "zustand";
import { cardParaEvento, CARDS_ERA1 } from "../content/cards-era1";
import { OFFLINE } from "../content/era1";
import { OBSTACULOS, type IlhaId } from "../content/era1-arquipelago";
import type { NivelId } from "../content/escalas";
import * as acoes from "../sim/acoes";
import * as nucleo from "../sim/acoesNucleo";
import { cardVisto, marcarCardVisto } from "../sim/cards";
import { pesquisar } from "../sim/arvore";
import { avaliarEvolucao, evoluirBairro } from "../sim/cidade";
import * as mundo from "../sim/mundo";
import { analisar as analisarMundo } from "../sim/producao";
import { calcularOffline, type RelatorioOffline } from "../sim/offline";
import { carregar, exportarJson, importarJson, INTERVALO_SAVE_MS, limpar, salvar } from "../sim/save";
import { estadoInicial, type GameState, type PecaId, type TipoConstrucao, type UsinaId } from "../sim/state";
import { avancarTicks } from "../sim/tick";

/** O que o clique numa casa da grade do Núcleo faz. */
export type Ferramenta = PecaId | "remover";

/** O que o clique numa casa do arquipélago faz (paleta de construção, GDD §2.1, v0.6). */
export type FerramentaMundo = TipoConstrucao | "remover" | "desmatar";

export interface CardAberto {
  id: string;
  tela: number;
}

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
  /** Card explicativo em exibição e os que esperam a vez. */
  cardAberto: CardAberto | null;
  filaCards: string[];
  /** Só o card de abertura pausa o jogo. */
  pausado: boolean;
  /** Nível da escada de escalas em exibição (GDD §2.4). Estado de interface: não vai para o save. */
  nivel: NivelId;
  /** Pedido de enquadramento para a cena consumir (`null` = nenhum). */
  presetPedido: { nome: "ilha" | "nucleo" | NivelId; serie: number } | null;
  /** Placa de expedição sob o ponteiro (vem do DOM; a cena só desenha o realce). */
  ilhaSobPonteiro: IlhaId | null;
  /** Casa do arquipélago sob o ponteiro (fora da plataforma). */
  casaMundoSobPonteiro: number | null;
  /** Prédio ou ferramenta selecionada na paleta de construção. */
  ferramentaMundo: FerramentaMundo;
  /** Casa do arquipélago selecionada (bairro no painel da Cidade, realce na cena). */
  casaSelecionada: number | null;
  /** Tela da árvore de pesquisa aberta. */
  arvoreAberta: boolean;

  avancarTicks: (n: number) => void;

  // Rede e mundo
  melhorarUsina: (id: UsinaId) => boolean;
  /** Compra um nó da árvore de pesquisa: gasta 🔬 (e ₵, quando o nó cobra). */
  pesquisar: (id: string) => boolean;
  /** Evolui um bairro: gasta ₵ + 🔬 e sobe a densidade (GDD §8.6). */
  evoluirBairro: (indice: number) => boolean;
  selecionarFerramentaMundo: (f: FerramentaMundo) => void;
  /** Aplica a ferramenta da paleta na casa do arquipélago. Devolve `false` e avisa se recusado. */
  agirNoMundo: (indice: number) => boolean;
  colocar: (indice: number, tipo: TipoConstrucao) => boolean;
  removerConstrucao: (indice: number) => boolean;
  desmatar: (indice: number) => boolean;
  comprarIlha: (id: IlhaId) => boolean;
  ligarCabo: (id: IlhaId) => boolean;
  melhorarCabo: (id: IlhaId) => boolean;
  melhorarSubestacao: (indice: number) => boolean;
  setCasaMundoSobPonteiro: (indice: number | null) => void;
  selecionarCasa: (indice: number | null) => void;
  abrirArvore: () => void;
  fecharArvore: () => void;
  setIlhaSobPonteiro: (id: IlhaId | null) => void;

  // Núcleo
  desbloquearNucleo: () => boolean;
  /** Navega na escada de escalas; níveis bloqueados só avisam. */
  irParaNivel: (id: NivelId) => void;
  pedirPreset: (nome: "ilha" | "nucleo") => void;
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
  /** "Próximo" no card aberto; na última tela fecha e marca como visto. */
  avancarCard: () => void;

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

/** Ids de card disparados pelos eventos do estado, ainda não vistos nem já enfileirados. */
function cardsDosEventos(state: GameState, jaEnfileirados: readonly string[]): string[] {
  const novos: string[] = [];
  for (const evento of state.eventos) {
    const id = cardParaEvento(evento);
    if (id && CARDS_ERA1[id] && !cardVisto(state, id) && !jaEnfileirados.includes(id) && !novos.includes(id)) novos.push(id);
  }
  return novos;
}

export const useGameStore = create<GameStore>()((set, get) => {
  const carregado = estadoCarregado();
  // Sem save: o jogo começa pelo card de abertura.
  const inicial: GameState = carregado.relatorio === null && carregado.state.salvoEmMs === 0
    ? { ...carregado.state, eventos: [{ tipo: "primeiroCarregamento" }] }
    : carregado.state;
  const relatorioInicial = carregado.relatorio;
  // Cards devidos já na criação (jogo novo → abertura).
  const cardsIniciais = cardsDosEventos(inicial, []);

  /** Lê `state.eventos`, enfileira os cards devidos e abre o primeiro se nada está aberto. */
  const processarEventos = (state: GameState) => {
    const { cardAberto, filaCards } = get();
    const enfileirados = [...filaCards, ...(cardAberto ? [cardAberto.id] : [])];
    const novos = cardsDosEventos(state, enfileirados);
    if (novos.length === 0) return;
    const fila = [...filaCards, ...novos];
    if (cardAberto) {
      set({ filaCards: fila });
      return;
    }
    const [primeiro, ...resto] = fila;
    set({ cardAberto: { id: primeiro, tela: 0 }, filaCards: resto, pausado: !!CARDS_ERA1[primeiro].pausa });
  };

  const aplicar = (proximo: GameState | null): boolean => {
    if (!proximo) return false;
    set({ state: proximo });
    processarEventos(proximo);
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
    cardAberto: cardsIniciais.length > 0 ? { id: cardsIniciais[0], tela: 0 } : null,
    filaCards: cardsIniciais.slice(1),
    pausado: cardsIniciais.length > 0 ? !!CARDS_ERA1[cardsIniciais[0]].pausa : false,
    nivel: "ilha",
    presetPedido: null,
    ilhaSobPonteiro: null,
    casaMundoSobPonteiro: null,
    ferramentaMundo: "cataVento",
    casaSelecionada: null,
    arvoreAberta: false,

    avancarTicks(n) {
      const { state, salvoEmTempoMs, pausado } = get();
      if (pausado) return;
      const proximo = avancarTicks(state, n);
      set({ state: proximo });
      processarEventos(proximo);
      if (proximo.tempoMs - salvoEmTempoMs >= INTERVALO_SAVE_MS) salvarEstado(proximo);
    },

    melhorarUsina: (id) => aplicar(acoes.melhorarUsina(get().state, id)),
    pesquisar: (id) => aplicar(pesquisar(get().state, id)),
    evoluirBairro(indice) {
      const proximo = evoluirBairro(get().state, indice);
      if (!proximo) {
        const v = avaliarEvolucao(get().state, indice);
        avisar(indice, v.motivo ?? "Não dá para evoluir este bairro.");
        return false;
      }
      return aplicar(proximo);
    },

    selecionarFerramentaMundo: (f) => set({ ferramentaMundo: f }),

    /**
     * Um toque resolve o caso comum: com um prédio selecionado, uma casa com obstáculo manda o Bipe
     * desmatar (cobrando), e uma casa livre coloca o prédio. "Remover" e "Desmatar" são explícitos.
     */
    agirNoMundo(indice) {
      const { state, ferramentaMundo } = get();
      if (ferramentaMundo === "remover") {
        if (aplicar(mundo.remover(state, indice))) return true;
        avisar(indice, "Nada para remover aqui.");
        return false;
      }
      if (ferramentaMundo === "desmatar") {
        const v = mundo.avaliarRemocaoObstaculo(state, indice);
        if (!v.ok) {
          avisar(indice, v.motivo ?? "Não dá para remover aqui.");
          return false;
        }
        return aplicar(mundo.removerObstaculo(state, indice));
      }
      const obstaculo = mundo.obstaculoEm(state.mundo, indice);
      if (obstaculo) {
        const v = mundo.avaliarRemocaoObstaculo(state, indice);
        if (!v.ok) {
          avisar(indice, v.motivo ?? "Não dá para remover aqui.");
          return false;
        }
        avisar(indice, `${OBSTACULOS[obstaculo].nome}: o Bipe está a caminho.`);
        return aplicar(mundo.removerObstaculo(state, indice));
      }
      const construcao = mundo.construcaoEm(state.mundo, indice);
      // Tocar numa construção sempre a seleciona: o callout da cena mostra os números e as ações
      // (ajuste 5 da Sessão 7). O painel da Cidade continua como segunda via.
      if (construcao) set({ casaSelecionada: indice });
      if (construcao?.tipo === "bairro") {
        // Com o bairro selecionado na paleta, tocar num bairro existente evolui (₵ + 🔬).
        if (ferramentaMundo === "bairro") return get().evoluirBairro(indice);
        return false;
      }
      if (construcao?.tipo === "subestacao" && ferramentaMundo === "subestacao") {
        if (aplicar(mundo.melhorarSubestacao(state, indice))) return true;
        const v = mundo.avaliarMelhoriaSubestacao(state, indice);
        avisar(indice, v.motivo ?? "₵ insuficientes para o próximo nível da subestação.");
        return false;
      }
      if (construcao) return false;
      const v = mundo.avaliarCasa(state, indice, ferramentaMundo);
      if (!v.ok) {
        avisar(indice, v.motivo ?? "Não dá para construir aqui.");
        return false;
      }
      return aplicar(mundo.colocar(state, indice, ferramentaMundo));
    },

    colocar: (indice, tipo) => aplicar(mundo.colocar(get().state, indice, tipo)),
    removerConstrucao: (indice) => aplicar(mundo.remover(get().state, indice)),
    desmatar: (indice) => aplicar(mundo.removerObstaculo(get().state, indice)),
    comprarIlha(id) {
      const proximo = mundo.comprarIlha(get().state, id);
      if (!proximo) {
        avisar(-1, "₵ insuficientes para esta expedição.");
        return false;
      }
      return aplicar(proximo);
    },
    ligarCabo(id) {
      const proximo = mundo.ligarCabo(get().state, id);
      if (!proximo) {
        avisar(-1, "₵ insuficientes para o cabo submarino.");
        return false;
      }
      return aplicar(proximo);
    },
    melhorarCabo(id) {
      const proximo = mundo.melhorarCabo(get().state, id);
      if (!proximo) {
        avisar(-1, "₵ insuficientes para o próximo nível do cabo.");
        return false;
      }
      return aplicar(proximo);
    },
    melhorarSubestacao: (indice) => aplicar(mundo.melhorarSubestacao(get().state, indice)),
    selecionarCasa: (indice) => set({ casaSelecionada: indice }),
    abrirArvore: () => set({ arvoreAberta: true }),
    fecharArvore: () => set({ arvoreAberta: false }),
    setCasaMundoSobPonteiro(indice) {
      if (get().casaMundoSobPonteiro !== indice) set({ casaMundoSobPonteiro: indice });
    },
    setIlhaSobPonteiro(id) {
      if (get().ilhaSobPonteiro !== id) set({ ilhaSobPonteiro: id });
    },

    desbloquearNucleo: () => aplicar(nucleo.desbloquearNucleo(get().state)),
    irParaNivel(id) {
      const { nivel } = get();
      if (id === nivel) return;
      set({ nivel: id, presetPedido: { nome: id, serie: (get().presetPedido?.serie ?? 0) + 1 } });
    },
    pedirPreset: (nome) => set({ nivel: "ilha", presetPedido: { nome, serie: (get().presetPedido?.serie ?? 0) + 1 } }),
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

    avancarCard() {
      const { cardAberto, filaCards, state } = get();
      if (!cardAberto) return;
      const def = CARDS_ERA1[cardAberto.id];
      if (def && cardAberto.tela < def.telas.length - 1) {
        set({ cardAberto: { id: cardAberto.id, tela: cardAberto.tela + 1 } });
        return;
      }
      const visto = marcarCardVisto(state, cardAberto.id);
      const [proximo, ...resto] = filaCards;
      set({
        state: visto,
        cardAberto: proximo ? { id: proximo, tela: 0 } : null,
        filaCards: resto,
        pausado: proximo ? !!CARDS_ERA1[proximo]?.pausa : false,
      });
      salvarEstado(visto);
    },

    salvarAgora: () => salvarEstado(get().state),
    exportar: () => exportarJson(get().state),

    importar(json) {
      // Um save exportado há tempo também rende offline desde o carimbo.
      const agora = Date.now();
      const { state, relatorio } = calcularOffline(importarJson(json, agora), agora);
      set({ state, avisoGrade: null, relatorioOffline: relatorioVisivel(relatorio), cardAberto: null, filaCards: [], pausado: false });
      salvarEstado(state);
    },

    resetar() {
      limpar();
      const state: GameState = { ...estadoInicial(), eventos: [{ tipo: "primeiroCarregamento" }] };
      set({
        state,
        salvoEmTempoMs: state.tempoMs,
        salvoEmRelogio: null,
        avisoGrade: null,
        ferramenta: "heliostato",
        casaSobPonteiro: null,
        relatorioOffline: null,
        cardAberto: null,
        filaCards: [],
        pausado: false,
      });
      processarEventos(state);
    },
  };
});

/* ------------------------------------------------------------------ */
/* Gancho de desenvolvimento (roteiro de verificação e depuração)       */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    __jogo?: {
      store: typeof useGameStore;
      analisar: typeof analisarMundo;
      /** Atalho: análise do estado atual. */
      analise: () => ReturnType<typeof analisarMundo>;
    };
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__jogo = { store: useGameStore, analisar: analisarMundo, analise: () => analisarMundo(useGameStore.getState().state) };
}
