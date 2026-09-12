/**
 * Grade da Torre Solar (GDD §8.3, §10). Só desenha: o input é do DOM (`.grade-area`),
 * as decisões estão no sim, o estado vem do store. Vive sobre a BackgroundScene,
 * alinhada ao elemento `.grade-area` (ver `layout.ts`).
 *
 * Camadas: fundo (base elíptica e casas) → estático (espelhos, corpos, torre) →
 * dinâmico (pás, esfera, níveis, entulho, Bipes) → efeitos (realce, flash, onda).
 * O estático só redesenha quando o estado muda; o dinâmico, a cada frame.
 */
import Phaser from "phaser";
import { CASCATA, NUCLEO } from "../content/era1-nucleo";
import { podeLimparEntulho } from "../sim/cascata";
import { temperaturaNucleo } from "../sim/calor";
import { anel, contar, podeColocar } from "../sim/nucleo";
import { indiceReceptor, type NucleoState } from "../sim/state";
import { useGameStore, type Ferramenta } from "../store/gameStore";
import { getGradeRect, getPalcoRect } from "./layout";
import { corDaRampa } from "./rampa";

/** Tokens do GDD §10 (tokens.css) em número, para o canvas. */
const COR = {
  casa: 0x1c2250,
  casaAnel1: 0x232a5e,
  torre: 0x2b3270,
  turbinaCarcaca: 0xe9edff,
  tanque: 0xc9cfff,
  entulho: 0x3a3f5e,
  navy: 0x0d1230,
  sombra: 0x080c22,
  sky: 0x4cc9f0,
  leaf: 0x6be585,
  coral: 0xff6b6b,
  brasa: 0xff7a1a,
  scram: 0x6b7a9c,
  branco: 0xffffff,
  base: 0x0a0e26,
};

const TEXTURA_PARTICULA = "particula-calor";

interface Rect {
  x: number;
  y: number;
  tamanho: number;
}

function escurecer(cor: number, porcento: number): number {
  return Phaser.Display.Color.ValueToColor(cor).darken(porcento).color;
}

export class GridScene extends Phaser.Scene {
  static readonly KEY = "grid";

  private gFundo!: Phaser.GameObjects.Graphics;
  private gEstatico!: Phaser.GameObjects.Graphics;
  private gDinamico!: Phaser.GameObjects.Graphics;
  private gEfeitos!: Phaser.GameObjects.Graphics;
  private particulas: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private brasas: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Recorte ao retângulo do palco (que rola): a grade não pode vazar por cima do HUD. */
  private mascaraForma!: Phaser.GameObjects.Graphics;
  private recorte = { x: 0, y: 0, w: 0, h: 0 };

  private rect: Rect = { x: 0, y: 0, tamanho: 0 };
  private celula = 0;
  private lado: number = NUCLEO.ladoInicial;
  private visivel = false;
  private dirty = true;
  private reduzido = false;

  private anguloPas = 0;
  private ultimaCascataVista: number | null = null;
  private ultimoAvisoVisto: number | null = null;
  private flash: { indice: number; ate: number } | null = null;
  private flashEsfera = 0;
  private popEntulhoAte = 0;
  private onda: { raio: number; alpha: number } | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super(GridScene.KEY);
  }

  create() {
    this.gFundo = this.add.graphics().setDepth(1);
    this.gEstatico = this.add.graphics().setDepth(2);
    this.gDinamico = this.add.graphics().setDepth(4);
    this.gEfeitos = this.add.graphics().setDepth(6);
    this.reduzido = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    this.criarTexturaParticula();
    this.particulas = this.add
      .particles(0, 0, TEXTURA_PARTICULA, {
        speed: { min: 18, max: 55 },
        angle: { min: 255, max: 285 },
        lifespan: { min: 700, max: 1400 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.8, end: 0 },
        frequency: 300,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(3);
    this.particulas.stop();
    this.brasas = this.add
      .particles(0, 0, TEXTURA_PARTICULA, {
        speed: { min: 60, max: 160 },
        angle: { min: 200, max: 340 },
        gravityY: 260,
        lifespan: 1500,
        scale: { start: 0.7, end: 0.1 },
        alpha: { start: 1, end: 0 },
        tint: COR.brasa,
        emitting: false,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(5);

    this.mascaraForma = this.make.graphics({ x: 0, y: 0 }, false);
    const mascara = this.mascaraForma.createGeometryMask();
    for (const alvo of [this.gFundo, this.gEstatico, this.gDinamico, this.gEfeitos, this.particulas, this.brasas]) alvo?.setMask(mascara);

    const nucleo = useGameStore.getState().state.nucleo;
    this.ultimaCascataVista = nucleo?.ultimaCascataMs ?? null;
    this.ultimoAvisoVisto = useGameStore.getState().avisoGrade?.em ?? null;

    this.unsubscribe = useGameStore.subscribe((s, anterior) => {
      if (
        s.state.nucleo !== anterior.state.nucleo ||
        s.state.melhorias !== anterior.state.melhorias ||
        s.ferramenta !== anterior.ferramenta ||
        s.casaSobPonteiro !== anterior.casaSobPonteiro
      ) {
        this.dirty = true;
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.encerrar, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.encerrar, this);
  }

  private encerrar() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private criarTexturaParticula() {
    if (this.textures.exists(TEXTURA_PARTICULA)) return;
    const tam = 16;
    const tex = this.textures.createCanvas(TEXTURA_PARTICULA, tam, tam);
    if (!tex) return;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, tam, tam);
    tex.refresh();
  }

  /* ---------------- geometria ---------------- */

  /** Pixels do dispositivo por pixel CSS (o GameCanvas põe zoom = 1/dpr). */
  private escala(): number {
    const zoom = this.scale.zoom;
    return zoom > 0 ? 1 / zoom : 1;
  }

  private centroDaCasa(indice: number): { x: number; y: number } {
    const col = indice % this.lado;
    const lin = Math.floor(indice / this.lado);
    return { x: this.rect.x + (col + 0.5) * this.celula, y: this.rect.y + (lin + 0.5) * this.celula };
  }

  /** Sombra chapada: 4 px CSS para baixo e para a direita. */
  private deslocamentoSombra(): number {
    return 4 * this.escala();
  }

  /* ---------------- loop ---------------- */

  update(_tempo: number, delta: number) {
    const store = useGameStore.getState();
    const nucleo = store.state.nucleo;
    const dom = getGradeRect();

    if (!nucleo || !dom || dom.width < 20 || dom.height < 20) {
      this.esconder();
      return;
    }

    const k = this.escala();
    const tamanho = Math.min(dom.width, dom.height) * k;
    const x = (dom.left + (dom.width - tamanho / k) / 2) * k;
    const y = (dom.top + (dom.height - tamanho / k) / 2) * k;
    if (!this.visivel || x !== this.rect.x || y !== this.rect.y || tamanho !== this.rect.tamanho || nucleo.lado !== this.lado) {
      this.rect = { x, y, tamanho };
      this.lado = nucleo.lado;
      this.celula = tamanho / this.lado;
      this.visivel = true;
      this.dirty = true;
    }

    this.atualizarRecorte(k);

    const agora = this.time.now;
    if (nucleo.ultimaCascataMs !== null && nucleo.ultimaCascataMs !== this.ultimaCascataVista) {
      this.ultimaCascataVista = nucleo.ultimaCascataMs;
      this.dispararCascata(agora);
    }

    const aviso = store.avisoGrade;
    if (aviso && aviso.em !== this.ultimoAvisoVisto) {
      this.ultimoAvisoVisto = aviso.em;
      this.flash = { indice: aviso.indice, ate: agora + 400 };
    }
    if (this.flash && agora > this.flash.ate) this.flash = null;

    const t = temperaturaNucleo(nucleo);
    const emScram = nucleo.scramRestanteMs > 0;
    const c = contar(nucleo.grade);
    const consumoPorTurbina = emScram ? 0 : NUCLEO.consumoTurbina * nucleo.calorU;
    if (!this.reduzido && !emScram) this.anguloPas += 0.2 * consumoPorTurbina * (delta / 1000);

    this.atualizarParticulas(t, emScram);

    if (this.dirty) {
      this.redesenharEstatico(nucleo, store.ferramenta, store.casaSobPonteiro, !!store.state.melhorias.rastreamentoSolar);
      this.dirty = false;
    }
    this.desenharDinamico(nucleo, t, emScram, c.conversores > 0 ? consumoPorTurbina : 0, agora, store.state.tempoMs, !!store.state.melhorias.rastreamentoSolar);
    this.desenharEfeitos(agora);
  }

  /** A máscara acompanha o palco a cada frame; sem palco, recorta ao canvas inteiro. */
  private atualizarRecorte(k: number) {
    const palco = getPalcoRect();
    const r = palco
      ? { x: palco.left * k, y: palco.top * k, w: palco.width * k, h: palco.height * k }
      : { x: 0, y: 0, w: this.scale.width, h: this.scale.height };
    if (r.x === this.recorte.x && r.y === this.recorte.y && r.w === this.recorte.w && r.h === this.recorte.h) return;
    this.recorte = r;
    this.mascaraForma.clear();
    this.mascaraForma.fillStyle(0xffffff, 1);
    this.mascaraForma.fillRect(r.x, r.y, r.w, r.h);
  }

  private esconder() {
    if (!this.visivel) return;
    this.visivel = false;
    this.gFundo.clear();
    this.gEstatico.clear();
    this.gDinamico.clear();
    this.gEfeitos.clear();
    this.particulas?.stop();
  }

  /* ---------------- camada estática ---------------- */

  private redesenharEstatico(nucleo: NucleoState, ferramenta: Ferramenta, hover: number | null, rastreamento: boolean) {
    const g = this.gFundo;
    g.clear();
    const raio = Math.max(4, this.celula * 0.16);
    const folga = Math.max(2, this.celula * 0.06);
    const lado = this.celula - folga * 2;
    const d = this.deslocamentoSombra();

    // Base elíptica escura: a sombra chapada da torre; a grade fica solta sobre o fundo.
    const cx = this.rect.x + this.rect.tamanho / 2;
    const base = this.rect.y + this.rect.tamanho;
    g.fillStyle(COR.base, 0.9);
    g.fillEllipse(cx + d, base + this.celula * 0.12 + d, this.rect.tamanho * 1.06, this.celula * 0.9);
    g.fillStyle(COR.sombra, 0.6);
    g.fillEllipse(cx, base + this.celula * 0.12, this.rect.tamanho * 1.06, this.celula * 0.9);

    for (let i = 0; i < this.lado * this.lado; i++) {
      const { x, y } = this.centroDaCasa(i);
      const a = anel(i, this.lado);
      g.fillStyle(COR.sombra, 0.55);
      g.fillRoundedRect(x - lado / 2 + d, y - lado / 2 + d, lado, lado, raio);
      g.fillStyle(a === 1 ? COR.casaAnel1 : COR.casa, 1);
      g.fillRoundedRect(x - lado / 2, y - lado / 2, lado, lado, raio);
    }

    const ge = this.gEstatico;
    ge.clear();
    const receptor = this.centroDaCasa(indiceReceptor(this.lado));
    nucleo.grade.forEach((casa, i) => {
      if (!casa || casa.tipo !== "peca") return;
      const { x, y } = this.centroDaCasa(i);
      const a = anel(i, this.lado);
      switch (casa.id) {
        case "heliostato":
          this.desenharHeliostato(ge, x, y, a, receptor, rastreamento);
          break;
        case "radiador":
          this.desenharRadiadorCorpo(ge, x, y);
          break;
        case "tanque":
          this.desenharTanqueCorpo(ge, x, y);
          break;
        case "turbina":
          break; // toda dinâmica
      }
    });
    this.desenharTorre(ge, receptor.x, receptor.y);

    // Realce da casa sob o ponteiro: verde se a ferramenta cabe, coral se não.
    if (hover !== null && hover !== indiceReceptor(this.lado) && hover >= 0 && hover < nucleo.grade.length) {
      const { x, y } = this.centroDaCasa(hover);
      const casa = nucleo.grade[hover];
      let ok: boolean;
      if (ferramenta === "remover") ok = !!casa && casa.tipo === "peca";
      else if (casa?.tipo === "entulho") ok = true;
      else ok = podeColocar(nucleo.grade, hover, ferramenta).ok;
      ge.lineStyle(Math.max(2, 2 * this.escala()), ok ? COR.leaf : COR.coral, 0.95);
      ge.strokeRoundedRect(x - lado / 2, y - lado / 2, lado, lado, raio);
    }
  }

  /** Espelho girado para apontar ao Receptor; a face escurece com o anel. */
  private desenharHeliostato(g: Phaser.GameObjects.Graphics, x: number, y: number, a: number, receptor: { x: number; y: number }, rastreamento: boolean) {
    const c = this.celula;
    const w = c * 0.7;
    const h = c * 0.45;
    const r = Math.max(2, c * 0.08);
    const d = this.deslocamentoSombra();
    // A face fica perpendicular à direção da torre.
    const ang = Math.atan2(receptor.y - y, receptor.x - x) + Math.PI / 2;
    const cor = a === 1 ? COR.sky : escurecer(COR.sky, a === 2 ? 15 : 30);

    // pedestal
    g.fillStyle(COR.sombra, 0.55);
    g.fillRect(x - c * 0.04 + d, y + d, c * 0.08, c * 0.3);
    g.fillStyle(COR.torre, 1);
    g.fillRect(x - c * 0.04, y, c * 0.08, c * 0.3);

    const face = (dx: number, dy: number, corFace: number, alpha: number) => {
      g.save();
      g.translateCanvas(x + dx, y - c * 0.05 + dy);
      g.rotateCanvas(ang);
      g.fillStyle(corFace, alpha);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.restore();
    };
    face(d, d, COR.sombra, 0.55);
    face(0, 0, cor, 1);
    if (!rastreamento) {
      // faixa de brilho fixa (com Rastreamento ela varre a face na camada dinâmica)
      g.save();
      g.translateCanvas(x, y - c * 0.05);
      g.rotateCanvas(ang);
      g.fillStyle(COR.branco, 0.4);
      g.fillRoundedRect(-w / 2 + w * 0.12, -h / 2 + h * 0.18, w * 0.22, h * 0.64, r * 0.6);
      g.restore();
    }
  }

  private desenharRadiadorCorpo(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const c = this.celula;
    const w = c * 0.66;
    const h = c * 0.5;
    const d = this.deslocamentoSombra();
    g.fillStyle(COR.sombra, 0.55);
    g.fillRoundedRect(x - w / 2 + d, y - h / 2 + d, w, h, c * 0.08);
    g.fillStyle(escurecer(COR.sky, 45), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, c * 0.08);
  }

  private desenharTanqueCorpo(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const c = this.celula;
    const w = c * 0.5;
    const h = c * 0.6;
    const d = this.deslocamentoSombra();
    const topo = y - h / 2;
    g.fillStyle(COR.sombra, 0.55);
    g.fillRect(x - w / 2 + d, topo + d, w, h);
    g.fillEllipse(x + d, topo + h + d, w, w * 0.4);
    g.fillStyle(COR.tanque, 1);
    g.fillRect(x - w / 2, topo, w, h);
    g.fillEllipse(x, topo + h, w, w * 0.4);
    g.fillStyle(escurecer(COR.tanque, 12), 1);
    g.fillEllipse(x, topo, w, w * 0.4);
  }

  /** Torre: trapézio estreito; a esfera fica na camada dinâmica. */
  private desenharTorre(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const c = this.celula;
    const d = this.deslocamentoSombra();
    const pontos = (dx: number, dy: number) => [
      { x: x - c * 0.14 + dx, y: y + c * 0.42 + dy },
      { x: x + c * 0.14 + dx, y: y + c * 0.42 + dy },
      { x: x + c * 0.07 + dx, y: y - c * 0.02 + dy },
      { x: x - c * 0.07 + dx, y: y - c * 0.02 + dy },
    ];
    g.fillStyle(COR.sombra, 0.55);
    g.fillPoints(pontos(d, d), true);
    g.fillStyle(COR.torre, 1);
    g.fillPoints(pontos(0, 0), true);
  }

  /* ---------------- camada dinâmica ---------------- */

  private desenharDinamico(nucleo: NucleoState, t: number, emScram: boolean, consumoPorTurbina: number, agora: number, tempoMs: number, rastreamento: boolean) {
    const g = this.gDinamico;
    g.clear();
    if (!this.visivel) return;
    const c = this.celula;
    const d = this.deslocamentoSombra();
    const receptor = this.centroDaCasa(indiceReceptor(this.lado));
    const popEscala = agora < this.popEntulhoAte ? 1 + 0.2 * ((this.popEntulhoAte - agora) / 180) : 1;

    nucleo.grade.forEach((casa, i) => {
      if (!casa || casa.tipo === "receptor") return;
      const { x, y } = this.centroDaCasa(i);
      if (casa.tipo === "entulho") {
        this.desenharEntulho(g, x, y, popEscala, podeLimparEntulho(casa, tempoMs));
        this.desenharBipe(g, x, y - c * 0.3, agora);
        return;
      }
      const a = anel(i, this.lado);
      switch (casa.id) {
        case "turbina":
          this.desenharTurbina(g, x, y, consumoPorTurbina, emScram, agora);
          break;
        case "radiador":
          this.desenharAletas(g, x, y, a === 1 && !emScram && nucleo.calorU > 0.5, a === 1 && nucleo.calorU > 0.5);
          break;
        case "tanque":
          this.desenharNivelTanque(g, x, y, a === 1 ? t : 0);
          break;
        case "heliostato":
          if (rastreamento && !this.reduzido) this.desenharVarredura(g, x, y, a, receptor, agora);
          break;
      }
    });

    this.desenharEsfera(g, receptor.x, receptor.y - c * 0.14, t, emScram, agora, d);
  }

  private desenharTurbina(g: Phaser.GameObjects.Graphics, x: number, y: number, consumo: number, emScram: boolean, agora: number) {
    const c = this.celula;
    const r = c * 0.3;
    const d = this.deslocamentoSombra();
    g.fillStyle(COR.sombra, 0.55);
    g.fillCircle(x + d, y + d, r);
    g.fillStyle(emScram ? escurecer(COR.turbinaCarcaca, 30) : COR.turbinaCarcaca, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(COR.navy, 1);
    for (let k = 0; k < 3; k++) {
      const ang = this.anguloPas + (k * Math.PI * 2) / 3;
      const px = x + Math.cos(ang) * r * 0.8;
      const py = y + Math.sin(ang) * r * 0.8;
      g.lineStyle(Math.max(2, r * 0.22), COR.navy, 1);
      g.lineBetween(x, y, px, py);
    }
    g.fillCircle(x, y, r * 0.2);
    // fio de vapor proporcional à potência
    if (!emScram && consumo > 0 && !this.reduzido) {
      const forca = Math.min(1, consumo / 10);
      for (let k = 0; k < 2; k++) {
        const fase = ((agora / 1400 + k * 0.5) % 1);
        const vy = y - r - fase * c * 0.45;
        const vx = x + r * 0.5 + Math.sin(fase * Math.PI * 2) * c * 0.04;
        g.fillStyle(COR.branco, forca * (1 - fase) * 0.45);
        g.fillCircle(vx, vy, c * (0.03 + fase * 0.05));
      }
    }
  }

  private desenharAletas(g: Phaser.GameObjects.Graphics, x: number, y: number, dissipando: boolean, adjacente: boolean) {
    const c = this.celula;
    const h = c * 0.36;
    const cor = adjacente ? COR.sky : escurecer(COR.sky, 40);
    for (let k = -1.5; k <= 1.5; k++) {
      g.fillStyle(cor, dissipando ? 1 : 0.45);
      g.fillRoundedRect(x + k * c * 0.15 - c * 0.035, y - h / 2, c * 0.07, h, c * 0.02);
    }
  }

  private desenharNivelTanque(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number) {
    const c = this.celula;
    const w = c * 0.5;
    const h = c * 0.6;
    const nivel = Math.min(1, Math.max(0, t));
    if (nivel <= 0) return;
    const altura = h * nivel;
    const topo = y - h / 2 + (h - altura);
    g.fillStyle(corDaRampa(Math.min(1, t)), 0.9);
    g.fillRect(x - w / 2 + w * 0.12, topo, w * 0.76, altura);
    g.fillEllipse(x, topo, w * 0.76, w * 0.3);
  }

  /** Com Rastreamento, a faixa de brilho varre a face a cada 6 s. */
  private desenharVarredura(g: Phaser.GameObjects.Graphics, x: number, y: number, a: number, receptor: { x: number; y: number }, agora: number) {
    const c = this.celula;
    const w = c * 0.7;
    const h = c * 0.45;
    const ang = Math.atan2(receptor.y - y, receptor.x - x) + Math.PI / 2;
    const fase = (agora / 6000) % 1;
    const escalaAnel = a === 1 ? 1 : a === 2 ? 0.9 : 0.8;
    g.save();
    g.translateCanvas(x, y - c * 0.05);
    g.rotateCanvas(ang);
    g.fillStyle(COR.branco, 0.4);
    g.fillRoundedRect((-w / 2 + fase * w * 0.78) * escalaAnel, -h / 2 + h * 0.18, w * 0.22, h * 0.64, c * 0.04);
    g.restore();
  }

  private desenharEntulho(g: Phaser.GameObjects.Graphics, x: number, y: number, escala: number, limpezaGratis: boolean) {
    const c = this.celula;
    const s = c * 0.24 * escala;
    const d = this.deslocamentoSombra();
    const pedacos = [
      [{ x: -s, y: s * 0.7 }, { x: -s * 0.55, y: -s * 0.5 }, { x: s * 0.15, y: -s * 0.15 }, { x: 0, y: s * 0.8 }],
      [{ x: s * 0.1, y: s * 0.85 }, { x: s * 0.35, y: -s * 0.75 }, { x: s, y: -s * 0.1 }, { x: s * 0.9, y: s * 0.85 }],
    ];
    for (const pedaco of pedacos) {
      g.fillStyle(COR.sombra, 0.55);
      g.fillPoints(pedaco.map((p) => ({ x: x + p.x + d, y: y + p.y + d })), true);
      g.fillStyle(COR.entulho, 1);
      g.fillPoints(pedaco.map((p) => ({ x: x + p.x, y: y + p.y })), true);
      if (limpezaGratis) {
        g.lineStyle(Math.max(1.5, 2 * this.escala()), COR.leaf, 0.9);
        g.strokePoints(pedaco.map((p) => ({ x: x + p.x, y: y + p.y })), true);
      }
    }
  }

  /** Bipe de manutenção, versão mínima: círculo, olho, antena, sobe-e-desce de 2 s. */
  private desenharBipe(g: Phaser.GameObjects.Graphics, x: number, y: number, agora: number) {
    const c = this.celula;
    const r = c * 0.15;
    const bob = this.reduzido ? 0 : Math.sin((agora / 2000) * Math.PI * 2) * c * 0.04;
    const cy = y + bob;
    const d = this.deslocamentoSombra() * 0.6;
    g.fillStyle(COR.sombra, 0.45);
    g.fillEllipse(x, y + r * 1.5, r * 1.6, r * 0.5);
    g.fillStyle(COR.sombra, 0.5);
    g.fillCircle(x + d, cy + d, r);
    g.fillStyle(COR.leaf, 1);
    g.fillCircle(x, cy, r);
    g.lineStyle(Math.max(1, r * 0.14), COR.leaf, 1);
    g.lineBetween(x, cy - r, x, cy - r * 1.4);
    g.fillCircle(x, cy - r * 1.5, r * 0.18);
    g.fillStyle(COR.navy, 1);
    g.fillCircle(x + r * 0.05, cy - r * 0.05, r * 0.42);
    g.fillStyle(COR.branco, 1);
    g.fillCircle(x - r * 0.1, cy - r * 0.22, r * 0.12);
  }

  /** A esfera do Receptor: rampa de calor, brilho aditivo, pulso acima de 90 %, cinza em SCRAM. */
  private desenharEsfera(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number, emScram: boolean, agora: number, d: number) {
    const c = this.celula;
    const r = c * 0.3;
    if (emScram) {
      g.fillStyle(COR.sombra, 0.55);
      g.fillCircle(x + d, y + d, r);
      g.fillStyle(COR.scram, 1);
      g.fillCircle(x, y, r);
      // anel pontilhado girando devagar
      const giro = this.reduzido ? 0 : (agora / 6000) * Math.PI * 2;
      g.fillStyle(COR.scram, 0.9);
      for (let k = 0; k < 12; k++) {
        const ang = giro + (k * Math.PI * 2) / 12;
        g.fillCircle(x + Math.cos(ang) * r * 1.45, y + Math.sin(ang) * r * 1.45, r * 0.08);
      }
      return;
    }
    const cor = corDaRampa(Math.min(1, t));
    const pulso = t > 0.9 && !this.reduzido ? 0.5 + 0.5 * Math.sin((agora / 1000) * Math.PI * 2) : 0;
    const raioBrilho = r * (1.3 + Math.min(0.5, Math.max(0, t) * 0.5) + pulso * 0.15);
    if (t >= 0.4) {
      g.fillStyle(cor, 0.12 + Math.min(0.35, (t - 0.4) * 0.6) + pulso * 0.15);
      g.fillCircle(x, y, raioBrilho);
      g.fillStyle(cor, 0.1);
      g.fillCircle(x, y, raioBrilho * 1.25);
    }
    g.fillStyle(COR.sombra, 0.55);
    g.fillCircle(x + d, y + d, r);
    g.fillStyle(cor, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(COR.branco, 0.35);
    g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.25);
    if (agora < this.flashEsfera) {
      g.fillStyle(COR.branco, 0.9);
      g.fillCircle(x, y, r * 1.1);
    }
  }

  /* ---------------- efeitos ---------------- */

  private desenharEfeitos(agora: number) {
    const g = this.gEfeitos;
    g.clear();
    if (!this.visivel) return;
    if (this.flash) {
      const { x, y } = this.centroDaCasa(this.flash.indice);
      const lado = this.celula * 0.88;
      const restante = (this.flash.ate - agora) / 400;
      g.fillStyle(COR.coral, 0.35 * Math.max(0, restante));
      g.fillRoundedRect(x - lado / 2, y - lado / 2, lado, lado, this.celula * 0.16);
    }
    if (this.onda) {
      const { x, y } = this.centroDaCasa(indiceReceptor(this.lado));
      g.lineStyle(Math.max(2, this.celula * 0.12), COR.branco, this.onda.alpha);
      g.strokeCircle(x, y, this.onda.raio);
    }
  }

  private dispararCascata(agora: number) {
    if (!this.visivel) return;
    this.flashEsfera = agora + 120;
    this.popEntulhoAte = agora + 180;
    if (!this.reduzido) this.cameras.main.shake(320, 0.006);
    const receptor = this.centroDaCasa(indiceReceptor(this.lado));
    if (this.brasas && !this.reduzido) {
      this.brasas.setPosition(receptor.x, receptor.y - this.celula * 0.14);
      const escala = this.celula / 90;
      this.brasas.particleScaleX = escala;
      this.brasas.particleScaleY = escala;
      this.brasas.explode(12);
    }
    const onda = { raio: this.celula * 0.4, alpha: 0.95 };
    this.onda = onda;
    this.tweens.add({
      targets: onda,
      raio: this.rect.tamanho * 0.9,
      alpha: 0,
      duration: this.reduzido ? 1 : 750,
      ease: "Cubic.easeOut",
      onComplete: () => {
        if (this.onda === onda) this.onda = null;
      },
    });
  }

  private atualizarParticulas(t: number, emScram: boolean) {
    const emissor = this.particulas;
    if (!emissor) return;
    if (this.reduzido || t < 0.15 || emScram) {
      if (emissor.emitting) emissor.stop();
      return;
    }
    const { x, y } = this.centroDaCasa(indiceReceptor(this.lado));
    emissor.setPosition(x, y - this.celula * 0.4);
    // metade da densidade da Sessão 2
    emissor.frequency = Math.max(50, 520 - t * 440);
    emissor.particleTint = corDaRampa(Math.min(1, t));
    const escala = this.celula / 90;
    emissor.particleScaleX = escala;
    emissor.particleScaleY = escala;
    if (!emissor.emitting) emissor.start();
  }
}

/** Mantido para a UI mostrar o mesmo atraso da Cascata que a cena anima. */
export const ATRASO_CASCATA_MS = CASCATA.atrasoMs;
