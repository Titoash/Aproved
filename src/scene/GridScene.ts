/**
 * Grade 5×5 da Torre Solar. Só desenha e captura input; toda decisão está no sim,
 * via `useGameStore`. Vive sobre a BackgroundScene, alinhada ao elemento
 * `.grade-area` do DOM (ver `layout.ts`).
 */
import Phaser from "phaser";
import { NUCLEO, type PECAS } from "../content/era1-nucleo";
import { temperaturaNucleo } from "../sim/calor";
import { anel, podeColocar } from "../sim/nucleo";
import type { Casa, NucleoState } from "../sim/state";
import { useGameStore, type Ferramenta } from "../store/gameStore";
import { getGradeRect } from "./layout";
import { corDaRampa } from "./rampa";

const CORES = {
  celula: 0x151c44,
  celulaAnel1: 0x1c2557,
  borda: 0x2a3572,
  sombra: 0x080c22,
  heliostato: 0x4cc9f0,
  heliostatoEscuro: 0x2a8fb5,
  turbina: 0xd5dbff,
  turbinaEscuro: 0x7f8ac9,
  radiador: 0x3a6ff2,
  radiadorEscuro: 0x2a4fb0,
  tanque: 0xffb703,
  tanqueEscuro: 0xb98200,
  entulho: 0x5b6480,
  entulhoEscuro: 0x3a4160,
  valido: 0x6be585,
  invalido: 0xff6b6b,
  onda: 0xffffff,
};

const TEXTURA_PARTICULA = "particula-calor";

interface Rect {
  x: number;
  y: number;
  tamanho: number;
}

export class GridScene extends Phaser.Scene {
  static readonly KEY = "grid";

  private gFundo!: Phaser.GameObjects.Graphics;
  private gPecas!: Phaser.GameObjects.Graphics;
  private gEfeitos!: Phaser.GameObjects.Graphics;
  private particulas: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  private rect: Rect = { x: 0, y: 0, tamanho: 0 };
  private celula = 0;
  private visivel = false;
  private dirty = true;
  private hover: number | null = null;
  private ultimaCascataVista: number | null = null;
  private ultimoAvisoVisto: number | null = null;
  private flash: { indice: number; ate: number } | null = null;
  private onda: { raio: number; alpha: number } | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super(GridScene.KEY);
  }

  create() {
    this.gFundo = this.add.graphics().setDepth(1);
    this.gPecas = this.add.graphics().setDepth(2);
    this.gEfeitos = this.add.graphics().setDepth(4);
    this.criarTexturaParticula();
    this.particulas = this.add
      .particles(0, 0, TEXTURA_PARTICULA, {
        speed: { min: 18, max: 55 },
        angle: { min: 255, max: 285 },
        lifespan: { min: 700, max: 1400 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.85, end: 0 },
        frequency: 150,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(3);
    this.particulas.stop();

    const nucleo = useGameStore.getState().state.nucleo;
    this.ultimaCascataVista = nucleo?.ultimaCascataMs ?? null;
    this.ultimoAvisoVisto = useGameStore.getState().avisoGrade?.em ?? null;

    // Um listener por cena; o StrictMode destrói a cena inteira no cleanup, e este unsubscribe vai junto.
    this.unsubscribe = useGameStore.subscribe((s, anterior) => {
      if (s.state.nucleo !== anterior.state.nucleo || s.ferramenta !== anterior.ferramenta) this.dirty = true;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.encerrar, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.encerrar, this);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.aoClicar, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.aoMover, this);
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

  private centroDaCasa(indice: number): { x: number; y: number } {
    const col = indice % NUCLEO.lado;
    const lin = Math.floor(indice / NUCLEO.lado);
    return { x: this.rect.x + (col + 0.5) * this.celula, y: this.rect.y + (lin + 0.5) * this.celula };
  }

  /** Lê o retângulo do DOM na hora: um clique logo depois de rolar não pode usar o rect do frame anterior. */
  private casaEm(x: number, y: number): number | null {
    if (!this.visivel) return null;
    const dom = getGradeRect();
    if (!dom) return null;
    const tamanho = Math.min(dom.width, dom.height);
    const celula = tamanho / NUCLEO.lado;
    if (celula <= 0) return null;
    const x0 = dom.left + (dom.width - tamanho) / 2;
    const y0 = dom.top + (dom.height - tamanho) / 2;
    const col = Math.floor((x - x0) / celula);
    const lin = Math.floor((y - y0) / celula);
    if (col < 0 || lin < 0 || col >= NUCLEO.lado || lin >= NUCLEO.lado) return null;
    return lin * NUCLEO.lado + col;
  }

  /* ---------------- input ---------------- */

  private aoClicar(p: Phaser.Input.Pointer) {
    const indice = this.casaEm(p.x, p.y);
    if (indice === null) return;
    useGameStore.getState().agirNaCasa(indice);
  }

  private aoMover(p: Phaser.Input.Pointer) {
    const indice = this.casaEm(p.x, p.y);
    if (indice !== this.hover) {
      this.hover = indice;
      this.dirty = true;
    }
  }

  /* ---------------- loop ---------------- */

  update(_tempo: number, _delta: number) {
    const store = useGameStore.getState();
    const nucleo = store.state.nucleo;
    const dom = getGradeRect();

    if (!nucleo || !dom || dom.width < 20 || dom.height < 20) {
      this.esconder();
      return;
    }

    const tamanho = Math.min(dom.width, dom.height);
    const x = dom.left + (dom.width - tamanho) / 2;
    const y = dom.top + (dom.height - tamanho) / 2;
    if (!this.visivel || x !== this.rect.x || y !== this.rect.y || tamanho !== this.rect.tamanho) {
      this.rect = { x, y, tamanho };
      this.celula = tamanho / NUCLEO.lado;
      this.visivel = true;
      this.dirty = true;
    }

    if (nucleo.ultimaCascataMs !== null && nucleo.ultimaCascataMs !== this.ultimaCascataVista) {
      this.ultimaCascataVista = nucleo.ultimaCascataMs;
      this.dispararOnda();
    }

    const aviso = store.avisoGrade;
    if (aviso && aviso.em !== this.ultimoAvisoVisto) {
      this.ultimoAvisoVisto = aviso.em;
      this.flash = { indice: aviso.indice, ate: this.time.now + 400 };
    }
    if (this.flash && this.time.now > this.flash.ate) this.flash = null;

    const t = temperaturaNucleo(nucleo);
    this.atualizarParticulas(nucleo, t);

    if (this.dirty) {
      this.redesenhar(nucleo, t, store.ferramenta);
      this.dirty = false;
    }
    this.desenharEfeitos();
  }

  private esconder() {
    if (!this.visivel) return;
    this.visivel = false;
    this.gFundo.clear();
    this.gPecas.clear();
    this.gEfeitos.clear();
    this.particulas?.stop();
  }

  /* ---------------- desenho ---------------- */

  private redesenhar(nucleo: NucleoState, t: number, ferramenta: Ferramenta) {
    const g = this.gFundo;
    g.clear();
    const raio = Math.max(4, this.celula * 0.14);
    const folga = Math.max(2, this.celula * 0.06);
    const lado = this.celula - folga * 2;

    // Sombra chapada do tabuleiro inteiro.
    g.fillStyle(CORES.sombra, 0.55);
    g.fillRoundedRect(this.rect.x + 6, this.rect.y + 6, this.rect.tamanho, this.rect.tamanho, raio * 1.5);

    for (let i = 0; i < NUCLEO.lado * NUCLEO.lado; i++) {
      const { x, y } = this.centroDaCasa(i);
      const a = anel(i);
      g.fillStyle(a === 1 ? CORES.celulaAnel1 : CORES.celula, 1);
      g.fillRoundedRect(x - lado / 2, y - lado / 2, lado, lado, raio);
      g.lineStyle(1, CORES.borda, 1);
      g.strokeRoundedRect(x - lado / 2, y - lado / 2, lado, lado, raio);
    }

    const gp = this.gPecas;
    gp.clear();
    nucleo.grade.forEach((casa, i) => {
      const { x, y } = this.centroDaCasa(i);
      this.desenharCasa(gp, casa, x, y, anel(i), t);
    });

    // Realce da casa sob o ponteiro: verde se a ferramenta cabe, coral se não.
    if (this.hover !== null && this.hover !== NUCLEO.indiceReceptor) {
      const { x, y } = this.centroDaCasa(this.hover);
      const casa = nucleo.grade[this.hover];
      let ok: boolean;
      if (ferramenta === "remover") ok = !!casa && casa.tipo === "peca";
      else if (casa?.tipo === "entulho") ok = true;
      else ok = podeColocar(nucleo.grade, this.hover, ferramenta).ok;
      gp.lineStyle(2, ok ? CORES.valido : CORES.invalido, 0.9);
      gp.strokeRoundedRect(x - lado / 2, y - lado / 2, lado, lado, raio);
    }
  }

  private desenharCasa(g: Phaser.GameObjects.Graphics, casa: Casa, x: number, y: number, a: number, t: number) {
    if (!casa) return;
    const tam = this.celula;
    const deslocamento = Math.max(3, tam * 0.06);
    const r = tam * 0.3;
    switch (casa.tipo) {
      case "receptor": {
        const cor = corDaRampa(t);
        if (t >= 0.7) {
          // Brilho só no que está quente.
          g.fillStyle(cor, t >= 1 ? 0.5 : 0.25);
          g.fillCircle(x, y, r * (1.35 + Math.min(0.4, Math.max(0, t - 0.9))));
        }
        g.fillStyle(CORES.sombra, 0.7);
        g.fillCircle(x + deslocamento, y + deslocamento, r);
        g.fillStyle(cor, 1);
        g.fillCircle(x, y, r);
        g.lineStyle(2, Phaser.Display.Color.ValueToColor(cor).darken(35).color, 1);
        g.strokeCircle(x, y, r);
        break;
      }
      case "peca":
        this.desenharPeca(g, casa.id, x, y, a === 2 ? tam * 0.8 : tam, deslocamento);
        break;
      case "entulho":
        this.desenharEntulho(g, x, y, tam, deslocamento);
        break;
    }
  }

  private desenharPeca(g: Phaser.GameObjects.Graphics, id: keyof typeof PECAS, x: number, y: number, tam: number, d: number) {
    const s = tam * 0.28;
    // Sombra chapada deslocada (GDD §10): a mesma forma, escura, antes da forma.
    const comSombra = (desenho: (dx: number, dy: number, cor: number) => void, cor: number) => {
      desenho(d, d, CORES.sombra);
      desenho(0, 0, cor);
    };
    switch (id) {
      case "heliostato":
        comSombra(
          (dx, dy, cor) => {
            g.fillStyle(cor, cor === CORES.sombra ? 0.7 : 1);
            g.fillPoints(
              [
                { x: x + dx, y: y + dy - s },
                { x: x + dx + s, y: y + dy },
                { x: x + dx, y: y + dy + s },
                { x: x + dx - s, y: y + dy },
              ],
              true,
            );
          },
          CORES.heliostato,
        );
        g.lineStyle(2, CORES.heliostatoEscuro, 1);
        g.strokePoints([{ x, y: y - s }, { x: x + s, y }, { x, y: y + s }, { x: x - s, y }], true);
        g.lineStyle(2, 0xffffff, 0.7);
        g.lineBetween(x - s * 0.45, y - s * 0.15, x - s * 0.1, y - s * 0.5);
        break;
      case "turbina":
        comSombra(
          (dx, dy, cor) => {
            g.fillStyle(cor, cor === CORES.sombra ? 0.7 : 1);
            g.fillCircle(x + dx, y + dy, s);
          },
          CORES.turbina,
        );
        g.lineStyle(2, CORES.turbinaEscuro, 1);
        g.strokeCircle(x, y, s);
        g.lineStyle(3, CORES.turbinaEscuro, 1);
        for (let k = 0; k < 3; k++) {
          const ang = (k * Math.PI * 2) / 3 - Math.PI / 2;
          g.lineBetween(x, y, x + Math.cos(ang) * s * 0.8, y + Math.sin(ang) * s * 0.8);
        }
        g.fillStyle(CORES.turbinaEscuro, 1);
        g.fillCircle(x, y, s * 0.22);
        break;
      case "radiador":
        comSombra(
          (dx, dy, cor) => {
            g.fillStyle(cor, cor === CORES.sombra ? 0.7 : 1);
            g.fillRoundedRect(x + dx - s, y + dy - s * 0.8, s * 2, s * 1.6, s * 0.25);
          },
          CORES.radiador,
        );
        g.lineStyle(2, CORES.radiadorEscuro, 1);
        g.strokeRoundedRect(x - s, y - s * 0.8, s * 2, s * 1.6, s * 0.25);
        g.lineStyle(2, 0xffffff, 0.55);
        for (let k = -1; k <= 1; k++) g.lineBetween(x + k * s * 0.55, y - s * 0.5, x + k * s * 0.55, y + s * 0.5);
        break;
      case "tanque":
        comSombra(
          (dx, dy, cor) => {
            g.fillStyle(cor, cor === CORES.sombra ? 0.7 : 1);
            g.fillRoundedRect(x + dx - s * 0.7, y + dy - s, s * 1.4, s * 2, s * 0.7);
          },
          CORES.tanque,
        );
        g.lineStyle(2, CORES.tanqueEscuro, 1);
        g.strokeRoundedRect(x - s * 0.7, y - s, s * 1.4, s * 2, s * 0.7);
        g.lineStyle(2, CORES.tanqueEscuro, 0.8);
        g.lineBetween(x - s * 0.55, y, x + s * 0.55, y);
        break;
    }
  }

  private desenharEntulho(g: Phaser.GameObjects.Graphics, x: number, y: number, tam: number, d: number) {
    const s = tam * 0.26;
    const pedras = [
      [{ x: -s, y: s * 0.6 }, { x: -s * 0.3, y: -s * 0.4 }, { x: s * 0.2, y: s * 0.7 }],
      [{ x: 0, y: -s * 0.9 }, { x: s * 0.9, y: -s * 0.2 }, { x: s * 0.3, y: s * 0.4 }],
      [{ x: s * 0.2, y: s * 0.3 }, { x: s, y: s * 0.8 }, { x: -s * 0.2, y: s }],
    ];
    for (const [i, pedra] of pedras.entries()) {
      g.fillStyle(CORES.sombra, 0.7);
      g.fillPoints(pedra.map((p) => ({ x: x + p.x + d, y: y + p.y + d })), true);
      g.fillStyle(i % 2 === 0 ? CORES.entulho : CORES.entulhoEscuro, 1);
      g.fillPoints(pedra.map((p) => ({ x: x + p.x, y: y + p.y })), true);
    }
  }

  private desenharEfeitos() {
    const g = this.gEfeitos;
    g.clear();
    if (!this.visivel) return;
    if (this.flash) {
      const { x, y } = this.centroDaCasa(this.flash.indice);
      const lado = this.celula * 0.88;
      const restante = (this.flash.ate - this.time.now) / 400;
      g.fillStyle(CORES.invalido, 0.35 * Math.max(0, restante));
      g.fillRoundedRect(x - lado / 2, y - lado / 2, lado, lado, this.celula * 0.14);
    }
    if (this.onda) {
      const { x, y } = this.centroDaCasa(NUCLEO.indiceReceptor);
      g.lineStyle(Math.max(2, this.celula * 0.12), CORES.onda, this.onda.alpha);
      g.strokeCircle(x, y, this.onda.raio);
    }
  }

  private dispararOnda() {
    if (!this.visivel) return;
    this.cameras.main.shake(320, 0.006);
    const onda = { raio: this.celula * 0.4, alpha: 0.95 };
    this.onda = onda;
    this.tweens.add({
      targets: onda,
      raio: this.rect.tamanho * 0.9,
      alpha: 0,
      duration: 750,
      ease: "Cubic.easeOut",
      onComplete: () => {
        if (this.onda === onda) this.onda = null;
      },
    });
  }

  private atualizarParticulas(nucleo: NucleoState, t: number) {
    const emissor = this.particulas;
    if (!emissor) return;
    const emScram = nucleo.scramRestanteMs > 0;
    if (t < 0.15 || emScram) {
      if (emissor.emitting) emissor.stop();
      return;
    }
    const { x, y } = this.centroDaCasa(NUCLEO.indiceReceptor);
    emissor.setPosition(x, y - this.celula * 0.2);
    emissor.frequency = Math.max(25, 260 - t * 220);
    emissor.particleTint = corDaRampa(Math.min(1, t));
    const escala = this.celula / 90;
    emissor.particleScaleX = escala;
    emissor.particleScaleY = escala;
    if (!emissor.emitting) emissor.start();
  }
}
