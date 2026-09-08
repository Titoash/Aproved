import { useEffect } from "react";
import { GameCanvas } from "./canvas/GameCanvas";
import { iniciarJogo } from "./store/jogo";
import { Hud } from "./ui/Hud";
import { PainelRede } from "./ui/PainelRede";
import { PainelSave } from "./ui/PainelSave";

export default function App() {
  useEffect(() => iniciarJogo(), []);

  return (
    <div className="app">
      <GameCanvas />
      <div className="camada-ui">
        <Hud />
        <main className="paineis">
          <PainelRede />
          <PainelSave />
        </main>
      </div>
    </div>
  );
}
