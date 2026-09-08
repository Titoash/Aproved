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

    const jogo = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: "#0d1230",
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: "100%",
        height: "100%",
      },
      scene: [BackgroundScene, GridScene],
      audio: { noAudio: true },
      banner: false,
    });
    jogoRef.current = jogo;

    return () => {
      jogo.destroy(true);
      jogoRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" aria-hidden="true" />;
}
