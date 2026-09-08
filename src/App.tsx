import { GameCanvas } from "./scene/GameCanvas";
import { useTick } from "./store/useTick";
import { Hud } from "./ui/Hud";
import { PainelNucleo } from "./ui/PainelNucleo";
import { PainelRede } from "./ui/PainelRede";
import { PainelSave } from "./ui/PainelSave";

export default function App() {
  useTick();

  return (
    <div className="app">
      <GameCanvas />
      <div className="camada-ui">
        <Hud />
        <main className="paineis">
          <PainelNucleo />
          <PainelRede />
          <PainelSave />
        </main>
      </div>
    </div>
  );
}
