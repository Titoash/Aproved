import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { BackgroundScene } from "./BackgroundScene";
import { GridScene } from "./GridScene";

/**
 * Monta o Phaser em um contêiner fixo atrás da UI.
 * A instância fica em um `ref` e é destruída no cleanup: o StrictMode
 * monta duas vezes em dev e não pode deixar dois jogos vivos.
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const jogoRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent || jogoRef.current) return;

    // Hi-DPI: o canvas tem pixels do dispositivo e o CSS o encolhe de volta (zoom = 1/dpr).
    const medir = () => {
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      return { dpr, largura: Math.max(1, Math.round(parent.clientWidth * dpr)), altura: Math.max(1, Math.round(parent.clientHeight * dpr)) };
    };
    const inicial = medir();
    const jogo = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: "#0d1230",
      scale: {
        mode: Phaser.Scale.NONE,
        width: inicial.largura,
        height: inicial.altura,
        zoom: 1 / inicial.dpr,
      },
      scene: [BackgroundScene, GridScene],
      audio: { noAudio: true },
      banner: false,
    });
    jogoRef.current = jogo;

    const aoRedimensionar = () => {
      const { dpr, largura, altura } = medir();
      jogo.scale.setZoom(1 / dpr);
      jogo.scale.resize(largura, altura);
    };
    window.addEventListener("resize", aoRedimensionar);

    return () => {
      window.removeEventListener("resize", aoRedimensionar);
      jogo.destroy(true);
      jogoRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" aria-hidden="true" />;
}
