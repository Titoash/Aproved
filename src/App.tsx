import { GameCanvas } from "./scene/GameCanvas";
import { useTick } from "./store/useTick";
import { CardExplicativo } from "./ui/CardExplicativo";
import { CardOffline } from "./ui/CardOffline";
import { Hud } from "./ui/Hud";
import { PainelKardashev } from "./ui/PainelKardashev";
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
        <main className="principal">
          <PainelNucleo />
          <PainelRede />
        </main>
        <PainelKardashev />
        <PainelSave />
      </div>
      <CardOffline />
      <CardExplicativo />
    </div>
  );
}
