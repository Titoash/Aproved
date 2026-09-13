/**
 * Cena do tabuleiro: o Phaser (modo Canvas) dá o loop, o canvas e o tamanho; o desenho é Canvas 2D puro dos
 * módulos de `scene/tabuleiro`, recortado ao retângulo do palco. Só lê o store e despacha nada: o input é do DOM.
 */
import Phaser from "phaser";
import { NIVEIS, regiaoDef, type NivelId } from "../content/era1-tabuleiro";
import { NUCLEO } from "../content/era1-nucleo";
import { USINAS, VILA } from "../content/era1";
import { faixaDeCalor, temperaturaNucleo } from "../sim/calor";
import { emScram, podeLimparEntulho } from "../sim/cascata";
import { formatarCreditos, formatarPorcentagem, formatarPotencia } from "../sim/formatar";
import { ilhaDaEra1 } from "../sim/gerarIlha";
import { potenciaInstaladaW } from "../sim/kardashev";
import { anel, podeColocar, podeRemover } from "../sim/nucleo";
import type { GameState } from "../sim/state";
import { alocacao, custoRegiao, regioesBloqueadas } from "../sim/tabuleiro";
import { potenciaUsina } from "../sim/rede";
import { balancoDoEstado } from "../sim/tick";
import { useGameStore, type Ferramenta } from "../store/gameStore";
import { getPalcoRect } from "./layout";
import { PALETA, alfa, clamp01, movimentoReduzido, type Camera } from "./tabuleiro/base";
import { atualizarCena, criarCena, desenharCallouts, desenharCena, dispararCascata, tremorCena, type CalloutCena, type Cena, type EntradaCena, type PecaCena } from "./tabuleiro/cena";
import { casaDaGrade, controleCamera, LARGURA_DESKTOP_PX, MINIMAPA, registrarCena, RESERVA_ESCADA_PX } from "./tabuleiro/controle";
import { desenharEscala, type Reserva } from "./tabuleiro/escalas";
import { desenharFundo, desenharGrao } from "./tabuleiro/fundo";
import { desenharMinimapa, desenharTerreno, liberarCacheTerreno } from "./tabuleiro/terreno";

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class TabuleiroScene extends Phaser.Scene {
  static readonly KEY = "tabuleiro";
  private ilha = ilhaDaEra1();
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

    this.sincronizarCena(loja.state, loja.casaSobPonteiro, loja.ferramenta);
  }

  private entrada(state: GameState, casaSobPonteiro: number | null, ferramenta: Ferramenta): EntradaCena {
    const ilha = this.ilha;
    const b = balancoDoEstado(state);
    const nucleo = state.nucleo;
    let nucleoCena: EntradaCena["nucleo"] = null;
    let realce: EntradaCena["realce"] = null;
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
      if (casaSobPonteiro !== null && casaSobPonteiro < nucleo.grade.length) {
        const [x, y] = casaDaGrade(casaSobPonteiro, nucleo.lado);
        const valido = ferramenta === "remover" ? podeRemover(nucleo.grade, casaSobPonteiro) : podeColocar(nucleo.grade, casaSobPonteiro, ferramenta).ok;
        realce = { x, y, valido };
      }
    }
    const callouts: CalloutCena[] = [];
    if (nucleo) {
      const T = temperaturaNucleo(nucleo);
      callouts.push({ chave: "torre", ancora: "torre", texto: `Torre Solar · ${formatarPorcentagem(T)} · ${faixaDeCalor(T).nome.toLowerCase()}` });
      callouts.push({ chave: "grade", ancora: "grade", texto: `Grade ${nucleo.lado}×${nucleo.lado} · ${nucleo.lado * nucleo.lado} casas` });
    }
    const cv = state.rede.usinas.cataVento;
    const te = state.rede.usinas.turbinaEolica;
    if (cv.quantidade + te.quantidade > 0) {
      const kw = potenciaUsina("cataVento", cv, state.melhorias) + potenciaUsina("turbinaEolica", te, state.melhorias);
      const partes = [cv.quantidade > 0 ? `${cv.quantidade} ${cv.quantidade === 1 ? USINAS.cataVento.nome.toLowerCase() : USINAS.cataVento.nomePlural.toLowerCase()}` : null, te.quantidade > 0 ? `${te.quantidade} ${te.quantidade === 1 ? "eólica" : "eólicas"}` : null].filter(Boolean);
      callouts.push({ chave: "vento", ancora: "vento", texto: `Vento · ${partes.join(" + ")} · ${formatarPotencia(kw)}` });
    }
    if (state.rede.vilas > 0) {
      callouts.push({ chave: "vila", ancora: "vila", texto: `${VILA.nome} · ${state.rede.vilas} ${state.rede.vilas === 1 ? "casa" : "casas"} · ${formatarPotencia(b.demandaKw)} de demanda` });
    }
    return {
      ilha,
      semente: ilha.semente,
      desbloqueadas: state.tabuleiro.regioesDesbloqueadas,
      colocacoes: alocacao(ilha, state.tabuleiro.regioesDesbloqueadas, state.rede),
      nucleo: nucleoCena,
      placas: regioesBloqueadas(state).map((id) => ({ regiao: id, nome: regiaoDef(id).nome, preco: formatarCreditos(custoRegiao(id) ?? 0) })),
      callouts,
      bateriaCarga: state.rede.bateria.capacidadeKwh > 0 ? state.rede.bateria.kwh / state.rede.bateria.capacidadeKwh : 0,
      realce,
      tempoMs: state.tempoMs,
    };
  }

  private sincronizarCena(state: GameState, casaSobPonteiro: number | null, ferramenta: Ferramenta) {
    const entrada = this.entrada(state, casaSobPonteiro, ferramenta);
    const chave = [
      state.tabuleiro.regioesDesbloqueadas.join(","),
      state.rede.usinas.cataVento.quantidade,
      state.rede.usinas.painelSolar.quantidade,
      state.rede.usinas.turbinaEolica.quantidade,
      state.rede.vilas,
      state.rede.bateria.unidades,
      state.nucleo ? state.nucleo.lado : "x",
      state.nucleo ? state.nucleo.grade.map((c) => (c ? c.tipo[0] + ("id" in c ? c.id[0] : "") : "_")).join("") : "",
    ].join("|");
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
      desenharTerreno(ctx, this.ilha, c, t, { desbloqueadas: new Set(state.tabuleiro.regioesDesbloqueadas), ladoGrade: state.nucleo?.lado ?? NUCLEO.ladoInicial, chaoDpr, chaoEscalavel });
      desenharCena(ctx, this.cena, c, t);
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
    desenharMinimapa(ctx, this.ilha, cam, MINIMAPA.w, MINIMAPA.h, new Set(useGameStore.getState().state.tabuleiro.regioesDesbloqueadas));
    ctx.restore();
  }
}
