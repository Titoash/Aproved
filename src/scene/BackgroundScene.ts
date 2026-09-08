/** Cena vazia com o fundo da Era 1: navy com gradiente radial e estrelas. Sem grade (Sessão 2). */
import Phaser from "phaser";

const CHAVE_FUNDO = "fundo-era1";

export class BackgroundScene extends Phaser.Scene {
  private fundo: Phaser.GameObjects.Image | null = null;
  private estrelas: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super("fundo");
  }

  create() {
    this.desenhar(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, (tamanho: Phaser.Structs.Size) => {
      this.desenhar(tamanho.width, tamanho.height);
    });
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
    gradiente.addColorStop(0, "#1c2b62");
    gradiente.addColorStop(0.45, "#111a3d");
    gradiente.addColorStop(1, "#070c1d");
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, w, h);
    textura.refresh();
    this.fundo = this.add.image(0, 0, CHAVE_FUNDO).setOrigin(0, 0).setDepth(-10);
  }

  private desenharEstrelas(w: number, h: number) {
    const rng = new Phaser.Math.RandomDataGenerator(["aproved-era1"]);
    const quantidade = Math.min(400, Math.round((w * h) / 9000));
    for (let i = 0; i < quantidade; i++) {
      const raio = rng.realInRange(0.5, 1.6);
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
