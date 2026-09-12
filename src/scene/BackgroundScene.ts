/**
 * Fundo do jogo: gradiente radial e estrelas. A paleta troca com a era
 * (GDD §6): navy da colina na Era 1, azul do rio e da cidade na Era 2.
 */
import Phaser from "phaser";
import type { Era } from "../sim/state";
import { useGameStore } from "../store/gameStore";
import { GridScene } from "./GridScene";

const CHAVE_FUNDO = "fundo-era";

/** Centro e borda do gradiente radial por era (GDD §6, §10). */
const PALETA: Record<Era, { centro: string; borda: string }> = {
  1: { centro: "#241b55", borda: "#0d1230" },
  2: { centro: "#1b3a55", borda: "#0b1526" },
};

export class BackgroundScene extends Phaser.Scene {
  private fundo: Phaser.GameObjects.Image | null = null;
  private estrelas: Phaser.GameObjects.Arc[] = [];
  private era: Era = 1;
  private desinscrever: (() => void) | null = null;

  constructor() {
    super("fundo");
  }

  create() {
    this.era = useGameStore.getState().state.era;
    this.desenhar(this.scale.width, this.scale.height);
    // A grade do Núcleo roda em paralelo, por cima do fundo.
    if (!this.scene.isActive(GridScene.KEY)) this.scene.launch(GridScene.KEY);
    this.scale.on(Phaser.Scale.Events.RESIZE, (tamanho: Phaser.Structs.Size) => {
      this.desenhar(tamanho.width, tamanho.height);
    });
    // Trocar de era repinta o fundo; é a "troca de paleta" do GDD §6.
    this.desinscrever = useGameStore.subscribe((s) => {
      if (s.state.era === this.era) return;
      this.era = s.state.era;
      this.desenhar(this.scale.width, this.scale.height);
      this.cameras.main.fadeIn(this.reduzido() ? 0 : 600, 0, 0, 0);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.desinscrever?.();
      this.desinscrever = null;
    });
  }

  private reduzido(): boolean {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private desenhar(largura: number, altura: number) {
    const w = Math.max(1, Math.floor(largura));
    const h = Math.max(1, Math.floor(altura));

    this.limpar();
    this.desenharGradiente(w, h);
    this.desenharEstrelas(w, h);
  }

  private limpar() {
    this.tweens.killAll();
    for (const estrela of this.estrelas) estrela.destroy();
    this.estrelas = [];
    if (this.fundo) {
      this.fundo.destroy();
      this.fundo = null;
    }
    if (this.textures.exists(CHAVE_FUNDO)) this.textures.remove(CHAVE_FUNDO);
  }

  private desenharGradiente(w: number, h: number) {
    const textura = this.textures.createCanvas(CHAVE_FUNDO, w, h);
    if (!textura) return;
    const ctx = textura.getContext();
    const cx = w * 0.5;
    const cy = h * 0.38;
    const raio = Math.max(w, h) * 0.8;
    const gradiente = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
    const paleta = PALETA[this.era] ?? PALETA[1];
    gradiente.addColorStop(0, paleta.centro);
    gradiente.addColorStop(1, paleta.borda);
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, w, h);
    textura.refresh();
    this.fundo = this.add.image(0, 0, CHAVE_FUNDO).setOrigin(0, 0).setDepth(-10);
  }

  private desenharEstrelas(w: number, h: number) {
    const rng = new Phaser.Math.RandomDataGenerator([`aproved-era${this.era}`]);
    const quantidade = Math.min(400, Math.round((w * h) / 9000));
    for (let i = 0; i < quantidade; i++) {
      // Estrelas de 1–2 px com opacidade variada (GDD §10).
      const raio = rng.realInRange(0.5, 1);
      const alpha = rng.realInRange(0.25, 0.9);
      const estrela = this.add
        .circle(rng.between(0, w), rng.between(0, h), raio, 0xffffff, alpha)
        .setDepth(-5);
      this.estrelas.push(estrela);
      this.tweens.add({
        targets: estrela,
        alpha: alpha * 0.25,
        duration: rng.between(1500, 4500),
        delay: rng.between(0, 3000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
}
