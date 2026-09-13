/**
 * Cena do tabuleiro: o Phaser (modo Canvas) dá o loop, o canvas e o tamanho; o desenho é Canvas 2D puro dos
 * módulos de `scene/tabuleiro`, recortado ao retângulo do palco. Só lê o store e despacha nada: o input é do DOM.
 */
import Phaser from "phaser";
import { ILHAS, OBSTACULOS, SUBESTACAO, type IlhaId } from "../content/era1-arquipelago";
import { NIVEIS, type NivelId } from "../content/escalas";
import { NUCLEO } from "../content/era1-nucleo";
import { USINAS, VILA } from "../content/era1";
import { faixaDeCalor, temperaturaNucleo } from "../sim/calor";
import { emScram, podeLimparEntulho } from "../sim/cascata";
import { formatarCreditos, formatarPorcentagem, formatarPotencia } from "../sim/formatar";
import { arquipelagoDaEra1 } from "../sim/gerarArquipelago";
import { potenciaInstaladaW } from "../sim/kardashev";
import { avaliarCasa, avaliarRemocaoObstaculo, ancoraDoObstaculo, casasDoObstaculo, custoExpedicao, ilhaAberta, rotaDoCabo, temCabo } from "../sim/mundo";
import { anel, podeColocar, podeRemover } from "../sim/nucleo";
import { analisar, obstaculoEm } from "../sim/producao";
import type { GameState } from "../sim/state";
import { balancoDoEstado } from "../sim/tick";
import { useGameStore, type FerramentaMundo } from "../store/gameStore";
import { getPalcoRect } from "./layout";
import { PALETA, alfa, clamp01, movimentoReduzido, type Camera } from "./tabuleiro/base";
import {
  atualizarCena,
  criarCena,
  desenharCallouts,
  desenharCena,
  dispararCascata,
  tremorCena,
  type AlcanceCena,
  type CalloutCena,
  type Cena,
  type ConstrucaoCena,
  type CristalCena,
  type EntradaCena,
  type ObstaculoCena,
  type PecaCena,
  type PlacaCena,
} from "./tabuleiro/cena";
import { casaDaGrade, controleCamera, LARGURA_DESKTOP_PX, MINIMAPA, registrarCena, RESERVA_ESCADA_PX } from "./tabuleiro/controle";
import { desenharEscala, type Reserva } from "./tabuleiro/escalas";
import { desenharFundo, desenharGrao } from "./tabuleiro/fundo";
import { desenharCabos, desenharMar, type CaboCena } from "./tabuleiro/mar";
import { desenharMinimapa, desenharTerreno, liberarCacheTerreno } from "./tabuleiro/terreno";

/**
 * Medição por camada, só em desenvolvimento (`window.__perf`): a média móvel do custo de cada etapa do
 * quadro. Em produção o `marcar` chama a função e pronto.
 */
const perf: Record<string, { ms: number; n: number }> = {};
const MEDINDO = import.meta.env.DEV && typeof window !== "undefined";
function marcar(nome: string, fn: () => void): void {
  if (!MEDINDO) {
    fn();
    return;
  }
  const t0 = performance.now();
  fn();
  const e = (perf[nome] ??= { ms: 0, n: 0 });
  e.ms += performance.now() - t0;
  e.n++;
}
if (MEDINDO) {
  (window as unknown as { __perf: unknown }).__perf = {
    ler: () => Object.fromEntries(Object.entries(perf).map(([k, v]) => [k, v.n ? v.ms / v.n : 0])),
    zerar: () => {
      for (const k of Object.keys(perf)) delete perf[k];
    },
  };
}

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class TabuleiroScene extends Phaser.Scene {
  static readonly KEY = "tabuleiro";
  private arq = arquipelagoDaEra1();
  private cena: Cena | null = null;
  private chaveEstrutura = "";
  private ultimaCascataMs: number | null = null;
  private serieProcessada = 0;
  private tempoS = 0;
  private rect: { left: number; top: number; width: number; height: number } | null = null;
  private camada: OffscreenCanvas | null = null;
  private palco: OffscreenCanvas | null = null;
  private reduzido = movimentoReduzido();
  private nivelDesenhado: NivelId = "ilha";
  private chegada: Partial<Record<NivelId, number>> = {};

  constructor() {
    super(TabuleiroScene.KEY);
  }

  create() {
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.desenharTudo, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.POST_RENDER, this.desenharTudo, this);
      registrarCena(null);
      liberarCacheTerreno();
    });
  }

  update(time: number) {
    this.tempoS = time / 1000;
    const rect = getPalcoRect();
    this.rect = rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
    if (!this.rect || this.rect.width < 2 || this.rect.height < 2) return;
    const ctl = controleCamera();
    const w = Math.round(this.rect.width);
    const h = Math.round(this.rect.height);
    ctl.reservaEsquerda = window.innerWidth > LARGURA_DESKTOP_PX ? RESERVA_ESCADA_PX : 0;
    if (ctl.w !== w || ctl.h !== h) ctl.redimensionar(w, h);

    const loja = useGameStore.getState();
    if (loja.presetPedido && loja.presetPedido.serie !== this.serieProcessada) {
      this.serieProcessada = loja.presetPedido.serie;
      ctl.preset(loja.presetPedido.nome);
    }
    const passo = ctl.passo(this.tempoS);
    if (passo && passo.k >= 1) this.chegada[ctl.nivel] = this.tempoS;
    if (ctl.nivel !== this.nivelDesenhado && !ctl.transicao) {
      this.nivelDesenhado = ctl.nivel;
      if (loja.nivel !== ctl.nivel) loja.irParaNivel(ctl.nivel);
    }

    this.sincronizarCena(loja.state, loja);
  }

  /** Tudo o que a cena precisa do estado, montado uma vez por frame. */
  private entrada(state: GameState, loja: ReturnType<typeof useGameStore.getState>): EntradaCena {
    const arq = this.arq;
    const n = arq.n;
    const b = balancoDoEstado(state);
    const analise = analisar(state);
    const nucleo = state.nucleo;
    let nucleoCena: EntradaCena["nucleo"] = null;
    let realce: EntradaCena["realce"] = null;

    // --- Núcleo
    if (nucleo) {
      const pecas: PecaCena[] = [];
      nucleo.grade.forEach((casa, i) => {
        if (!casa) return;
        const [x, y] = casaDaGrade(i, nucleo.lado);
        const a = Math.max(1, anel(i, nucleo.lado)) as 1 | 2 | 3;
        if (casa.tipo === "receptor") pecas.push({ x, y, tipo: "receptor", anel: a });
        else if (casa.tipo === "peca") pecas.push({ x, y, tipo: casa.id, anel: a });
        else pecas.push({ x, y, tipo: "entulho", anel: a, gratis: podeLimparEntulho(casa, state.tempoMs), desdeMs: casa.desdeMs });
      });
      const T = temperaturaNucleo(nucleo);
      const scram = emScram(nucleo);
      nucleoCena = { lado: nucleo.lado, pecas, T, scram, consumo: scram ? 0 : clamp01(T / 0.9), rastreamento: state.melhorias.rastreamentoSolar };
      if (loja.casaSobPonteiro !== null && loja.casaSobPonteiro < nucleo.grade.length) {
        const [x, y] = casaDaGrade(loja.casaSobPonteiro, nucleo.lado);
        const valido =
          loja.ferramenta === "remover" ? podeRemover(nucleo.grade, loja.casaSobPonteiro) : podeColocar(nucleo.grade, loja.casaSobPonteiro, loja.ferramenta).ok;
        realce = { x, y, valido, texto: null };
      }
    }

    // --- realce da casa do arquipélago sob o ponteiro, com o motivo
    if (!realce && loja.casaMundoSobPonteiro !== null) {
      const i = loja.casaMundoSobPonteiro;
      realce = this.realceDoMundo(state, i, loja.ferramentaMundo);
    }

    // --- construções e obstáculos
    const construcoes: ConstrucaoCena[] = [];
    for (const chave of Object.keys(state.mundo.construcoes)) {
      const i = Number(chave);
      const c = state.mundo.construcoes[i];
      const u = analise.porCasa.get(i);
      construcoes.push({
        x: i % n,
        y: Math.floor(i / n),
        tipo: c.tipo,
        nivel: c.nivel,
        semEscoamento: !!u && u.escoadoKw < u.brutoKw - 1e-9,
      });
    }
    construcoes.sort((p, q) => p.y * n + p.x - (q.y * n + q.x));

    const emRemocao = new Map<number, number>();
    const fila = state.mundo.remocoes;
    if (fila.length > 0 && fila[0].fimMs > 0) {
      const total = OBSTACULOS[fila[0].tipo].tempoMs || 1;
      emRemocao.set(fila[0].indice, clamp01(1 - (fila[0].fimMs - state.tempoMs) / total));
    }
    for (let k = 1; k < fila.length; k++) emRemocao.set(fila[k].indice, 0);

    const obstaculos: ObstaculoCena[] = [];
    const vistos = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      const tipo = obstaculoEm(state.mundo, i, arq);
      if (!tipo || vistos.has(i)) continue;
      const ancora = ancoraDoObstaculo(state.mundo, i, arq);
      if (vistos.has(ancora)) continue;
      for (const casa of casasDoObstaculo(ancora, tipo, n)) vistos.add(casa);
      obstaculos.push({ x: ancora % n, y: Math.floor(ancora / n), tipo, progresso: emRemocao.get(ancora) });
    }

    const cristais: CristalCena[] = state.mundo.cristais.map((i) => ({ x: i % n, y: Math.floor(i / n) }));

    // --- cabos: rota de cada ilha aberta (ligada em `sun`, prevista em `muted`)
    const cabos: CaboCena[] = [];
    for (const def of ILHAS) {
      if (def.id === "principal" || !ilhaAberta(state.mundo, def.id)) continue;
      const rota = rotaDoCabo(def.id, arq);
      if (rota) cabos.push({ casas: rota.casas, de: rota.de, para: rota.para, ligado: temCabo(state.mundo, def.id) });
    }

    // --- alcance: a subestação sob o ponteiro, ou todas quando a ferramenta é a subestação
    const alcances: AlcanceCena[] = [];
    const mostrarTodas = loja.ferramentaMundo === "subestacao";
    for (const sub of analise.subestacoes) {
      const sob = loja.casaMundoSobPonteiro !== null && this.mesmaCasaOuVizinha(loja.casaMundoSobPonteiro, sub.indice);
      if (!mostrarTodas && !sob) continue;
      alcances.push({ x: sub.indice % n, y: Math.floor(sub.indice / n), alcance: SUBESTACAO.alcance, cheio: sub.usadoKw >= sub.tetoKw - 1e-9 });
    }

    // --- callouts
    const callouts: CalloutCena[] = [];
    if (nucleo) {
      const T = temperaturaNucleo(nucleo);
      callouts.push({ chave: "torre", ancora: "torre", texto: `Torre Solar · ${formatarPorcentagem(T)} · ${faixaDeCalor(T).nome.toLowerCase()}` });
      callouts.push({ chave: "grade", ancora: "grade", texto: `Grade ${nucleo.lado}×${nucleo.lado} · ${nucleo.lado * nucleo.lado} casas` });
    }
    const eolicas = analise.contagem.cataVento + analise.contagem.turbinaEolica;
    if (eolicas > 0) {
      const partes = [
        analise.contagem.cataVento > 0 ? `${analise.contagem.cataVento} ${analise.contagem.cataVento === 1 ? USINAS.cataVento.nome.toLowerCase() : USINAS.cataVento.nomePlural.toLowerCase()}` : null,
        analise.contagem.turbinaEolica > 0 ? `${analise.contagem.turbinaEolica} ${analise.contagem.turbinaEolica === 1 ? "eólica" : "eólicas"}` : null,
      ].filter(Boolean);
      callouts.push({ chave: "vento", ancora: "vento", texto: `Vento · ${partes.join(" + ")} · ${formatarPotencia(analise.brutoKw)}` });
    }
    if (analise.contagem.vila > 0) {
      callouts.push({
        chave: "vila",
        ancora: "vila",
        texto: `${VILA.nome} · ${analise.contagem.vila} ${analise.contagem.vila === 1 ? "bairro" : "bairros"} · ${formatarPotencia(b.demandaKw)} de demanda`,
      });
    }

    const placas: PlacaCena[] = ILHAS.filter((d) => !ilhaAberta(state.mundo, d.id)).map((d) => ({
      ilha: d.id,
      nome: d.nome,
      preco: formatarCreditos(custoExpedicao(d.id) ?? 0),
    }));

    const primeira = fila.length > 0 && fila[0].fimMs > 0 ? fila[0].indice : null;
    const capacidadeKwh = analise.contagem.bateria * 20;

    return {
      arq,
      semente: arq.semente,
      abertas: state.mundo.ilhasAbertas,
      construcoes,
      obstaculos,
      cristais,
      cabos,
      alcances,
      nucleo: nucleoCena,
      placas,
      callouts,
      bateriaCarga: capacidadeKwh > 0 ? Math.min(1, state.rede.bateria.kwh / capacidadeKwh) : 0,
      realce,
      remocao: primeira === null ? null : { x: primeira % n, y: Math.floor(primeira / n) },
      tempoMs: state.tempoMs,
    };
  }

  private mesmaCasaOuVizinha(a: number, b: number): boolean {
    const n = this.arq.n;
    return Math.max(Math.abs((a % n) - (b % n)), Math.abs(Math.floor(a / n) - Math.floor(b / n))) <= 1;
  }

  /** Realce de uma casa do arquipélago: válido/inválido e o motivo curto (GDD §2.4, v0.6). */
  private realceDoMundo(state: GameState, i: number, ferramenta: FerramentaMundo): EntradaCena["realce"] {
    const n = this.arq.n;
    const x = i % n;
    const y = Math.floor(i / n);
    const construcao = state.mundo.construcoes[i];
    const obstaculo = obstaculoEm(state.mundo, i, this.arq);
    if (ferramenta === "remover") {
      return { x, y, valido: !!construcao, texto: construcao ? "remover (50 % de volta)" : "nada para remover" };
    }
    if (ferramenta === "desmatar" || (obstaculo && !construcao)) {
      const v = avaliarRemocaoObstaculo(state, i, this.arq);
      const custo = obstaculo ? formatarCreditos(OBSTACULOS[obstaculo].custo) : "";
      return { x, y, valido: v.ok, texto: v.ok ? `${OBSTACULOS[obstaculo!].nome} · ${custo}` : v.motivo };
    }
    if (construcao) {
      const ilhaId = this.arq.ilhas[this.arq.ilha[i]]?.id;
      if (construcao.tipo === "subestacao" && ferramenta === "subestacao") return { x, y, valido: true, texto: "melhorar subestação" };
      return { x, y, valido: false, texto: ilhaId ? "casa ocupada" : null };
    }
    const v = avaliarCasa(state, i, ferramenta, this.arq);
    return { x, y, valido: v.ok, texto: v.ok ? v.aviso : v.motivo };
  }

  private sincronizarCena(state: GameState, loja: ReturnType<typeof useGameStore.getState>) {
    const entrada = this.entrada(state, loja);
    // A cena é montada uma vez; `atualizarCena` refaz só o grupo que mudou (colocar um prédio não
    // remonta o arquipélago inteiro). Só um mapa diferente justifica recriar.
    const chave = String(entrada.arq.semente);
    if (!this.cena || chave !== this.chaveEstrutura) {
      this.chaveEstrutura = chave;
      this.cena = criarCena(entrada);
      registrarCena(this.cena);
    } else {
      atualizarCena(this.cena, entrada);
    }
    const cascataMs = state.nucleo?.ultimaCascataMs ?? null;
    if (cascataMs !== this.ultimaCascataMs) {
      if (this.ultimaCascataMs !== null && cascataMs !== null && this.cena) dispararCascata(this.cena, this.tempoS);
      this.ultimaCascataMs = cascataMs;
    }
  }

  private camadaTransicao(wd: number, hd: number): OffscreenCanvas {
    if (!this.camada || this.camada.width !== wd || this.camada.height !== hd) this.camada = new OffscreenCanvas(wd, hd);
    return this.camada;
  }

  private reservas(w: number, h: number): Reserva[] {
    const ctl = controleCamera();
    return [
      [0, 0, ctl.reservaEsquerda, h],
      [w - 240, 0, 240, 56],
      [w - MINIMAPA.w - MINIMAPA.margem * 2, h - MINIMAPA.h - MINIMAPA.margem * 2, MINIMAPA.w + MINIMAPA.margem * 2, MINIMAPA.h + MINIMAPA.margem * 2],
    ];
  }

  /** Desenha um nível inteiro (fundo opcional + conteúdo) num contexto já com `setTransform(dpr)`. */
  private desenharNivel(ctx: CanvasRenderingContext2D, dpr: number, id: NivelId, cam: Camera, t: number, semFundo: boolean, chaoDpr: number, chaoEscalavel: boolean) {
    const w = cam.w;
    const h = cam.h;
    const state = useGameStore.getState().state;
    if (!semFundo) desenharFundo(ctx, w, h, t, cam, id, false);
    if (id === "ilha") {
      if (!this.cena) return;
      const tr = tremorCena(this.cena, t);
      const c: Camera = { zoom: cam.zoom, tx: cam.tx + tr[0], ty: cam.ty + tr[1], w, h };
      ctx.setTransform(dpr * c.zoom, 0, 0, dpr * c.zoom, dpr * c.tx, dpr * c.ty);
      marcar("mar", () => desenharMar(ctx, this.arq, c, t));
      marcar("terreno", () =>
        desenharTerreno(ctx, this.arq, c, t, { desbloqueadas: new Set(state.mundo.ilhasAbertas), ladoGrade: state.nucleo?.lado ?? NUCLEO.ladoInicial, chaoDpr, chaoEscalavel }),
      );
      // o cabo vai por cima do chão: as pontas encostam no litoral e precisam ser vistas
      marcar("cabos", () => desenharCabos(ctx, this.arq, this.cena!.cabos, c, t));
      marcar("cena", () => desenharCena(ctx, this.cena!, c, t));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      desenharCallouts(ctx, this.cena, c, this.reservas(w, h));
    } else {
      const def = NIVEIS.find((n) => n.id === id);
      if (!def) return;
      const potencia = potenciaInstaladaW(state);
      desenharEscala(id, ctx, w, h, t, cam, {
        desbloqueado: def.potenciaW === null || potencia >= def.potenciaW,
        potenciaTexto: def.potenciaTexto,
        tipo: def.tipo,
        titulo: def.titulo,
        chegada: this.chegada[id],
        reservas: this.reservas(w, h),
      });
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private canvasPalco(wd: number, hd: number): OffscreenCanvas {
    if (!this.palco || this.palco.width !== wd || this.palco.height !== hd) this.palco = new OffscreenCanvas(wd, hd);
    return this.palco;
  }

  /** Desenha o palco inteiro num canvas próprio (os módulos usam transformações absolutas) e cola no canvas do Phaser. */
  private desenharTudo() {
    const t0 = MEDINDO ? performance.now() : 0;
    this.desenharQuadro();
    if (MEDINDO) {
      const e = (perf.quadro ??= { ms: 0, n: 0 });
      e.ms += performance.now() - t0;
      e.n++;
    }
  }

  private desenharQuadro() {
    const rect = this.rect;
    if (!rect || !this.cena) return;
    const renderer = this.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer)) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const ctl = controleCamera();
    const w = ctl.w;
    const h = ctl.h;
    const t = this.tempoS;
    const wd = Math.round(w * dpr);
    const hd = Math.round(h * dpr);
    const palco = this.canvasPalco(wd, hd);
    const ctx = palco.getContext("2d") as unknown as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, wd, hd);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tr = ctl.transicao;
    if (tr) {
      const dur = this.reduzido ? 0.2 : 0.9;
      const k = clamp01((t - tr.t0) / dur);
      const e = easeInOut(k);
      const cDe = ctl.camDe(tr.de);
      const cPara = ctl.camDe(tr.para);
      const camada = this.camadaTransicao(wd, hd);
      const cctx = camada.getContext("2d") as unknown as CanvasRenderingContext2D | null;
      if (!cctx) return;
      const limpar = () => {
        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.clearRect(0, 0, wd, hd);
        cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      const compor = (alfaCamada: number) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alfaCamada;
        ctx.drawImage(camada, 0, 0);
        ctx.globalAlpha = 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      desenharFundo(ctx, w, h, t, cDe, tr.de, false);
      limpar();
      desenharFundo(cctx, w, h, t, cPara, tr.para, false);
      compor(e);
      let sDe = 1;
      let aDe = 1 - e;
      let sPara = 1;
      let aPara = e;
      if (!this.reduzido) {
        const k1 = easeInOut(clamp01(k / 0.5));
        const k2 = easeInOut(clamp01((k - 0.333) / 0.667));
        sDe = lerp(1, tr.subindo ? 0.18 : 3, k1);
        aDe = 1 - clamp01((k - 0.333) / 0.167);
        sPara = lerp(tr.subindo ? 3 : 0.18, 1, k2);
        aPara = clamp01((k - 0.333) / 0.222);
      }
      const escalar = (c: Camera, s: number): Camera => ({ zoom: c.zoom * s, tx: tr.ancora[0] + (c.tx - tr.ancora[0]) * s, ty: tr.ancora[1] + (c.ty - tr.ancora[1]) * s, w, h });
      if (aDe > 0) {
        limpar();
        this.desenharNivel(cctx, dpr, tr.de, escalar(cDe, sDe), t, true, 1, true);
        compor(aDe);
      }
      if (aPara > 0) {
        limpar();
        this.desenharNivel(cctx, dpr, tr.para, escalar(cPara, sPara), t, true, 1, true);
        compor(aPara);
      }
    } else {
      this.desenharNivel(ctx, dpr, ctl.nivel, ctl.camDe(), t, false, 0, false);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    desenharGrao(ctx, w, h, 0.035);
    if (ctl.nivel === "ilha" && !tr) this.desenharMinimapaNoCanto(ctx, w, h);

    const alvo = renderer.gameContext;
    alvo.save();
    alvo.setTransform(1, 0, 0, 1, 0, 0);
    alvo.drawImage(palco, Math.round(rect.left * dpr), Math.round(rect.top * dpr));
    alvo.restore();
  }

  private desenharMinimapaNoCanto(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const x = w - MINIMAPA.w - MINIMAPA.margem;
    const y = h - MINIMAPA.h - MINIMAPA.margem;
    ctx.save();
    ctx.fillStyle = alfa(PALETA.card, 0.85);
    ctx.strokeStyle = PALETA.cardBorda;
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 6, MINIMAPA.w + 12, MINIMAPA.h + 12, 12);
    ctx.fill();
    ctx.stroke();
    ctx.translate(x, y);
    const cam = controleCamera().camDe("ilha");
    const mundo = useGameStore.getState().state.mundo;
    desenharMinimapa(ctx, this.arq, cam, MINIMAPA.w, MINIMAPA.h, new Set(mundo.ilhasAbertas), new Set(Object.keys(mundo.cabos) as IlhaId[]));
    ctx.restore();
  }
}
