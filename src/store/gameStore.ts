/**
 * Store Zustand: guarda o snapshot do `GameState` e expõe as ações do jogador.
 * Toda a regra fica em `src/sim`; aqui só se aplica e se publica o resultado.
 * Também guarda o estado de interface que Phaser e React compartilham
 * (peça selecionada, último aviso da grade).
 */
import { create } from "zustand";
import { cardParaEvento, CARDS } from "../content/cards-era1";
import { OFFLINE } from "../content/era1";
import { OBSTACULOS, ilhaDef, type IlhaId, type TipoObstaculo } from "../content/era1-arquipelago";
import { textoDeRemocao, textoDoDiario, type ContextoDiario } from "../content/diario";
import { VIDA } from "../content/vida";
import type { NivelId } from "../content/escalas";
import * as nucleo from "../sim/acoesNucleo";
import { construirReator } from "../sim/era";
import { cardVisto, marcarCardVisto } from "../sim/cards";
import { pesquisar } from "../sim/arvore";
import { avaliarEvolucaoCidade, evoluirCidade } from "../sim/cidade";
import { arquipelagoDaEra1 } from "../sim/gerarArquipelago";
import * as mundo from "../sim/mundo";
import { avaliarMelhoria, melhorar } from "../sim/melhorias";
import { formatarCreditos } from "../sim/formatar";
import { analisar as analisarMundo, ehSubestacao, ilhaDaCasa } from "../sim/producao";
import { calcularOffline, type RelatorioOffline } from "../sim/offline";
import { carregar, exportarJson, importarJson, INTERVALO_SAVE_MS, limpar, salvar } from "../sim/save";
import { estadoInicial, type AlvoMelhoria, type EventoJogo, type GameState, type PecaId, type TipoConstrucao } from "../sim/state";
import { descreverNivel } from "../ui/niveis";
import { avancarTicks } from "../sim/tick";
import * as ocorrencias from "../sim/ocorrencias";

/** O que o clique numa casa da grade do Núcleo faz. */
export type Ferramenta = PecaId | "remover";

/** O que o clique numa casa do arquipélago faz (paleta de construção, GDD §2.1, v0.6). */
export type FerramentaMundo = TipoConstrucao | "remover" | "desmatar";

/**
 * Seleção em área (§8.5, v0.8): `a` é a casa onde o gesto começou, `b` a casa sob o ponteiro. Estado de
 * interface, não vai para o save. Ao soltar vira "confirmar" e a UI mostra o custo antes de cobrar.
 */
export interface SelecaoArea {
  a: number;
  b: number;
  fase: "arrastando" | "confirmar";
  /** O cartão de confirmação vai para a metade do tabuleiro oposta à do gesto, para não cobrir a área. */
  cartaoEmCima: boolean;
}

/** Uma linha do diário do tabuleiro (GDD §10.1): some depois de `VIDA.diarioLinhaMs` de jogo. */
export interface LinhaDiario {
  id: number;
  texto: string;
  emTempoMs: number;
}

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
  presetPedido: { nome: "ilha" | "nucleo" | "ocorrencia" | NivelId; serie: number } | null;
  /** Placa de expedição sob o ponteiro (vem do DOM; a cena só desenha o realce). */
  ilhaSobPonteiro: IlhaId | null;
  /** Casa do arquipélago sob o ponteiro (fora da plataforma). */
  casaMundoSobPonteiro: number | null;
  /** Prédio ou ferramenta selecionada na paleta de construção. */
  ferramentaMundo: FerramentaMundo;
  /** Casa do arquipélago selecionada (bairro no painel da Cidade, realce na cena). */
  casaSelecionada: number | null;
  /** Casa da grade do Núcleo selecionada (callout da peça: combustível, decaimento, "Trocar"). */
  casaNucleoSelecionada: number | null;
  /** `Date.now()` do começo da transição de era: a cena afasta a câmera 3 s e volta. */
  transicaoEraEm: number | null;
  /** Tela da árvore de pesquisa aberta. */
  arvoreAberta: boolean;
  selecaoArea: SelecaoArea | null;
  /** As últimas linhas do diário (no máximo três). Estado de interface: não vai para o save. */
  diario: LinhaDiario[];

  avancarTicks: (n: number) => void;

  // Rede e mundo
  /** Sobe o nível de um tipo inteiro (v0.8): usina, peça, subestação, cabos ou ciência. Avisa se recusado. */
  melhorar: (alvo: AlvoMelhoria) => boolean;
  /** Compra um nó da árvore de pesquisa: gasta 🔬 (e ₵, quando o nó cobra). */
  pesquisar: (id: string) => boolean;
  /** Evolui a cidade inteira: gasta ₵ + 🔬 × N bairros e sobe a densidade de todos (GDD §8.6, v0.8). */
  evoluirCidade: () => boolean;
  selecionarFerramentaMundo: (f: FerramentaMundo) => void;
  /** Aplica a ferramenta da paleta na casa do arquipélago. Devolve `false` e avisa se recusado. */
  agirNoMundo: (indice: number) => boolean;
  colocar: (indice: number, tipo: TipoConstrucao) => boolean;
  removerConstrucao: (indice: number) => boolean;
  desmatar: (indice: number) => boolean;
  /** Seleção em área: começar, estender, soltar (vira confirmação), confirmar (cobra) e cancelar. */
  iniciarArea: (casa: number) => void;
  estenderArea: (casa: number) => void;
  soltarArea: (cartaoEmCima?: boolean) => void;
  confirmarArea: () => boolean;
  cancelarArea: () => void;
  comprarIlha: (id: IlhaId) => boolean;
  ligarCabo: (id: IlhaId) => boolean;
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
  /** Constrói o Reator: desmonta a Torre e começa a Era 2 (GDD Parte 2 §2). */
  construirReator: () => boolean;
  /** Troca uma vareta gasta por uma nova (₵ 8 000). */
  trocarVareta: (indice: number) => boolean;
  /** Troca todas as gastas que já podem sair, com um débito só (Parte 2 §5.1, v0.8). */
  trocarTodasAsGastas: () => boolean;
  selecionarCasaNucleo: (indice: number | null) => void;
  setCasaSobPonteiro: (indice: number | null) => void;

  // Ocorrências (Parte 1 §4.4, v0.9)
  /** Aceita a oferta: o controle aparece e a câmera enquadra o Núcleo. Avisa se recusado. */
  aceitarOcorrencia: () => boolean;
  /** "Agora não": a oferta some sem custo. */
  recusarOcorrencia: () => boolean;
  /** Move o controle da Ocorrência (carga das turbinas ou potência das varetas), 1 = 100 %. */
  ajustarControle: (valor: number) => boolean;
  escolherRecompensa: (tipo: ocorrencias.TipoRecompensa) => boolean;
  /** Última recompensa escolhida, para o "+3" aparecer no painel do Núcleo. Estado de interface. */
  ultimaRecompensa: { tipo: ocorrencias.TipoRecompensa; valor: number; emTempoMs: number } | null;
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
/** "Um Bipe está a caminho" ou "na fila, k à frente": o jogador sabe se a remoção já começou. */
function mensagemDaFila(depois: GameState, ancora: number, nome: string): string {
  const fila = depois.mundo.remocoes;
  const r = fila.find((x) => x.indice === ancora);
  if (!r || r.fimMs > 0) return `${nome}: um Bipe está a caminho.`;
  const aFrente = fila.filter((x) => x.fimMs === 0).findIndex((x) => x.indice === ancora);
  if (aFrente === 0) return `${nome}: é a próxima da fila (os ${mundo.bipesDe(depois)} Bipes estão ocupados).`;
  return `${nome}: na fila, ${aFrente} à frente.`;
}

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
    if (id && CARDS[id] && !cardVisto(state, id) && !jaEnfileirados.includes(id) && !novos.includes(id)) novos.push(id);
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
  // Diário: cada evento entra uma vez só. As ações reaproveitam a fila do tick anterior
  // (`[...state.eventos, novo]`), então o mesmo objeto chega de novo; o WeakSet barra a repetição.
  const vistosNoDiario = new WeakSet<EventoJogo>();
  let serieDiario = 0;
  const arqDiario = arquipelagoDaEra1();
  const registrarNoDiario = (state: GameState) => {
    const novos = state.eventos.filter((e) => !vistosNoDiario.has(e));
    if (novos.length === 0) return;
    for (const e of novos) vistosNoDiario.add(e);
    const nomeIlha = (indice: number) => {
      const id = ilhaDaCasa(indice, arqDiario);
      return id ? ilhaDef(id).nome : "alto-mar";
    };
    const ctx: ContextoDiario = { nomeIlha, nomeDoNivel: (e) => descreverNivel(state, e.alvo).nome, formatarCreditos };
    // Remoções do mesmo lote agrupam por ilha ("12 obstáculos caíram em Bosque"); o resto, uma linha cada.
    const linhas: { texto: string; ilha?: string; obstaculos?: TipoObstaculo[] }[] = [];
    for (const e of novos) {
      if (e.tipo === "obstaculoRemovido") {
        const ilha = nomeIlha(e.indice);
        const grupo = linhas.find((l) => l.ilha === ilha);
        if (grupo) grupo.obstaculos!.push(e.obstaculo);
        else linhas.push({ texto: "", ilha, obstaculos: [e.obstaculo] });
        continue;
      }
      const texto = textoDoDiario(e, ctx);
      if (texto) linhas.push({ texto });
    }
    if (linhas.length === 0) return;
    const novas = linhas.map((l) => ({
      id: ++serieDiario,
      texto: l.obstaculos ? textoDeRemocao(l.obstaculos, l.ilha!) : l.texto,
      emTempoMs: state.tempoMs,
    }));
    set({ diario: [...get().diario, ...novas].slice(-VIDA.diarioLinhas) });
  };

  const processarEventos = (state: GameState) => {
    registrarNoDiario(state);
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
    set({ cardAberto: { id: primeiro, tela: 0 }, filaCards: resto, pausado: !!CARDS[primeiro].pausa });
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
    pausado: cardsIniciais.length > 0 ? !!CARDS[cardsIniciais[0]].pausa : false,
    nivel: "ilha",
    presetPedido: null,
    ilhaSobPonteiro: null,
    casaMundoSobPonteiro: null,
    ferramentaMundo: "cataVento",
    casaSelecionada: null,
    casaNucleoSelecionada: null,
    transicaoEraEm: null,
    arvoreAberta: false,
    selecaoArea: null,
    diario: [],
    ultimaRecompensa: null,

    avancarTicks(n) {
      const { state, salvoEmTempoMs, pausado } = get();
      if (pausado) return;
      const proximo = avancarTicks(state, n);
      set({ state: proximo });
      processarEventos(proximo);
      if (proximo.tempoMs - salvoEmTempoMs >= INTERVALO_SAVE_MS) salvarEstado(proximo);
    },

    melhorar(alvo) {
      const proximo = melhorar(get().state, alvo);
      if (!proximo) {
        avisar(-1, avaliarMelhoria(get().state, alvo).motivo ?? "Não dá para subir este nível.");
        return false;
      }
      return aplicar(proximo);
    },
    pesquisar: (id) => aplicar(pesquisar(get().state, id)),
    evoluirCidade() {
      const proximo = evoluirCidade(get().state);
      if (!proximo) {
        avisar(get().casaSelecionada ?? -1, avaliarEvolucaoCidade(get().state).motivo ?? "Não dá para evoluir a cidade.");
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
        const proximo = mundo.removerObstaculo(state, indice);
        const ancora = mundo.ancoraDoObstaculo(state.mundo, indice);
        // Com a ferramenta Desmatar só avisa quando a remoção fica esperando: tocar em série é o uso normal.
        if (proximo && proximo.mundo.remocoes.some((r) => r.indice === ancora && r.fimMs === 0)) {
          avisar(indice, mensagemDaFila(proximo, ancora, OBSTACULOS[mundo.obstaculoEm(state.mundo, indice)!].nome));
        }
        return aplicar(proximo);
      }
      const obstaculo = mundo.obstaculoEm(state.mundo, indice);
      if (obstaculo) {
        const v = mundo.avaliarRemocaoObstaculo(state, indice);
        if (!v.ok) {
          avisar(indice, v.motivo ?? "Não dá para remover aqui.");
          return false;
        }
        const proximo = mundo.removerObstaculo(state, indice);
        if (proximo) avisar(indice, mensagemDaFila(proximo, mundo.ancoraDoObstaculo(state.mundo, indice), OBSTACULOS[obstaculo].nome));
        return aplicar(proximo);
      }
      const construcao = mundo.construcaoEm(state.mundo, indice);
      // Tocar numa construção sempre a seleciona: o callout da cena mostra os números e as ações
      // (ajuste 5 da Sessão 7). O painel da Cidade continua como segunda via.
      if (construcao) set({ casaSelecionada: indice });
      // Tocar num bairro só seleciona: evoluir custa × N bairros e fica no botão do callout e do painel.
      if (construcao?.tipo === "bairro") return false;
      // Com o mesmo tipo de subestação na paleta, tocar numa subestação sobe o nível do **tipo** (v0.8).
      if (construcao && ehSubestacao(construcao.tipo) && ferramentaMundo === construcao.tipo) {
        const alvo: AlvoMelhoria = { tipo: "subestacao", id: construcao.tipo };
        if (aplicar(melhorar(state, alvo))) return true;
        avisar(indice, avaliarMelhoria(state, alvo).motivo ?? "₵ insuficientes para o próximo nível das subestações.");
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

    iniciarArea: (casa) => set({ selecaoArea: { a: casa, b: casa, fase: "arrastando", cartaoEmCima: false }, casaSelecionada: null }),
    estenderArea(casa) {
      const sel = get().selecaoArea;
      if (sel && sel.fase === "arrastando" && sel.b !== casa) set({ selecaoArea: { ...sel, b: casa } });
    },
    soltarArea(cartaoEmCima = false) {
      const sel = get().selecaoArea;
      if (!sel || sel.fase !== "arrastando") return;
      const orcamento = mundo.orcarArea(get().state, mundo.retanguloDaArea(sel.a, sel.b, arquipelagoDaEra1().n));
      if (orcamento.alvos.length === 0) {
        avisar(sel.b, orcamento.motivo ?? "Nada para remover nesta área.");
        set({ selecaoArea: null });
        return;
      }
      set({ selecaoArea: { ...sel, fase: "confirmar", cartaoEmCima } });
    },
    confirmarArea() {
      const { state, selecaoArea: sel } = get();
      if (!sel) return false;
      const ret = mundo.retanguloDaArea(sel.a, sel.b, arquipelagoDaEra1().n);
      const proximo = mundo.removerArea(state, ret);
      if (!proximo) {
        avisar(sel.b, mundo.orcarArea(state, ret).motivo ?? "Não dá para remover esta área.");
        return false;
      }
      set({ selecaoArea: null });
      return aplicar(proximo);
    },
    cancelarArea: () => set({ selecaoArea: null }),
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
      // Tocar numa peça já colocada seleciona: o callout mostra os números dela e o botão "Trocar".
      if (casa?.tipo === "peca" && ferramenta !== "remover") {
        set({ casaNucleoSelecionada: indice });
        return false;
      }
      if (casa?.tipo === "entulho") {
        // Entulho: limpa se já é grátis; senão reconstrói pagando metade.
        if (aplicar(nucleo.limparEntulho(state, indice))) return true;
        if (aplicar(nucleo.reconstruir(state, indice))) return true;
        avisar(indice, "Entulho: espere a limpeza grátis ou pague a reconstrução.");
        return false;
      }
      if (ferramenta === "remover") {
        if (aplicar(nucleo.removerPeca(state, indice))) {
          if (get().casaNucleoSelecionada === indice) set({ casaNucleoSelecionada: null });
          return true;
        }
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
    construirReator() {
      const proximo = construirReator(get().state);
      if (!proximo) return false;
      // A câmera afasta e volta em 3 s (GDD §10, Parte 2 §2); a cena consome o pedido.
      set({ casaNucleoSelecionada: null, casaSelecionada: null, ferramenta: "vareta", transicaoEraEm: Date.now() });
      return aplicar(proximo);
    },
    trocarVareta(indice) {
      const proximo = nucleo.trocarVareta(get().state, indice);
      if (!proximo) {
        const v = nucleo.avaliarTrocaVareta(get().state, indice);
        avisar(indice, v.motivo ?? "Não dá para trocar esta vareta.");
        return false;
      }
      return aplicar(proximo);
    },
    trocarTodasAsGastas() {
      const proximo = nucleo.trocarTodasAsGastas(get().state);
      if (!proximo) {
        avisar(-1, nucleo.avaliarTrocarTodas(get().state).motivo ?? "Nenhuma vareta pronta para trocar.");
        return false;
      }
      return aplicar(proximo);
    },
    selecionarCasaNucleo: (indice) => set({ casaNucleoSelecionada: indice }),

    aceitarOcorrencia() {
      const proximo = ocorrencias.aceitarOcorrencia(get().state);
      if (!proximo) {
        avisar(-1, ocorrencias.avaliarAceite(get().state).motivo ?? "Não dá para aceitar agora.");
        return false;
      }
      // A cena mostra a perturbação no Núcleo (sombra da nuvem, turbina a meia rotação, barras no Vaso).
      set({ nivel: "ilha", presetPedido: { nome: "ocorrencia", serie: (get().presetPedido?.serie ?? 0) + 1 } });
      return aplicar(proximo);
    },
    recusarOcorrencia: () => aplicar(ocorrencias.recusarOcorrencia(get().state)),
    ajustarControle(valor) {
      const proximo = ocorrencias.ajustarControle(get().state, valor);
      if (!proximo) return false;
      if (proximo !== get().state) set({ state: proximo });
      return true;
    },
    escolherRecompensa(tipo) {
      const antes = get().state;
      const proximo = ocorrencias.escolherRecompensa(antes, tipo);
      if (!proximo) return false;
      const valor = tipo === "estabilidade" ? (proximo.nucleo?.estabilidade ?? 0) - (antes.nucleo?.estabilidade ?? 0) : proximo.pesquisa - antes.pesquisa;
      set({ ultimaRecompensa: { tipo, valor, emTempoMs: proximo.tempoMs } });
      return aplicar(proximo);
    },
    setCasaSobPonteiro: (indice) => {
      if (get().casaSobPonteiro !== indice) set({ casaSobPonteiro: indice });
    },
    fecharRelatorioOffline: () => set({ relatorioOffline: null }),

    avancarCard() {
      const { cardAberto, filaCards, state } = get();
      if (!cardAberto) return;
      const def = CARDS[cardAberto.id];
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
        pausado: proximo ? !!CARDS[proximo]?.pausa : false,
      });
      salvarEstado(visto);
    },

    salvarAgora: () => salvarEstado(get().state),
    exportar: () => exportarJson(get().state),

    importar(json) {
      // Um save exportado há tempo também rende offline desde o carimbo.
      const agora = Date.now();
      const { state, relatorio } = calcularOffline(importarJson(json, agora), agora);
      set({ state, avisoGrade: null, relatorioOffline: relatorioVisivel(relatorio), cardAberto: null, filaCards: [], pausado: false, selecaoArea: null, diario: [], ultimaRecompensa: null });
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
        selecaoArea: null,
        diario: [],
        ultimaRecompensa: null,
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
      /** O controle que compensa a perturbação (o roteiro da Sessão 10 opera como a rota operador). */
      ocorrencias: { controleQueCompensa: typeof ocorrencias.controleQueCompensa };
    };
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__jogo = {
    store: useGameStore,
    analisar: analisarMundo,
    analise: () => analisarMundo(useGameStore.getState().state),
    ocorrencias: { controleQueCompensa: ocorrencias.controleQueCompensa },
  };
}
