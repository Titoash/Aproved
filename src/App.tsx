import { GameCanvas } from "./scene/GameCanvas";
import { useGameStore } from "./store/gameStore";
import { useTick } from "./store/useTick";
import { CardExplicativo } from "./ui/CardExplicativo";
import { CardOffline } from "./ui/CardOffline";
import { Hud } from "./ui/Hud";
import { PainelArvore } from "./ui/PainelArvore";
import { PainelKardashev } from "./ui/PainelKardashev";
import { PainelNucleo } from "./ui/PainelNucleo";
import { PainelRede } from "./ui/PainelRede";
import { PainelSave } from "./ui/PainelSave";

export default function App() {
  useTick();
  // A Era 2 troca a paleta para "entardecer" (GDD Parte 2 §8); os tokens vivem em app.css.
  const era = useGameStore((s) => s.state.era);

  return (
    <div className="app" data-era={era}>
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
      <PainelArvore />
      <CardOffline />
      <CardExplicativo />
    </div>
  );
}
