/** Escada de escalas (GDD §2.4): ilha → planeta → sistema → galáxia → universo → multiverso. Navegação livre; o nível abre pela potência instalada. */
import { NIVEIS } from "../content/era1-tabuleiro";
import { potenciaInstaladaW } from "../sim/kardashev";
import { useGameStore } from "../store/gameStore";
import { IconeNivel } from "./icones";

export function Escada() {
  const nivel = useGameStore((s) => s.nivel);
  const irParaNivel = useGameStore((s) => s.irParaNivel);
  const state = useGameStore((s) => s.state);
  const w = potenciaInstaladaW(state);
  return (
    <nav className="escada" aria-label="Escalas">
      {[...NIVEIS].reverse().map((n) => {
        const bloqueado = n.potenciaW !== null && w < n.potenciaW;
        const atual = n.id === nivel;
        return (
          <button
            key={n.id}
            type="button"
            className={`degrau ${atual ? "degrau--atual" : ""} ${bloqueado ? "degrau--bloqueado" : ""}`}
            aria-current={atual ? "true" : undefined}
            title={`${n.titulo} · ${n.tipo}${bloqueado ? ` · precisa de ${n.potenciaTexto}` : ""}${n.especulativo ? " · especulativo" : ""}`}
            onClick={() => irParaNivel(n.id)}
          >
            <span className="degrau-quadro" aria-hidden="true">
              <IconeNivel id={n.id} />
            </span>
            <span className="degrau-texto">
              <span className="degrau-rotulo">{n.titulo}</span>
              <span className="degrau-tipo">{bloqueado ? n.potenciaTexto : n.tipo}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
