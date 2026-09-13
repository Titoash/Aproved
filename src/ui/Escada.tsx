/**
 * Escada de escalas (GDD §2.4, §10, v0.6): arquipélago → planeta → sistema → galáxia → universo → multiverso,
 * **crescente** da esquerda para a direita no celular e de baixo para cima no desktop, com degraus que crescem
 * de tamanho. Navegação livre; o nível abre pela potência instalada.
 */
import { NIVEIS } from "../content/escalas";
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
      {NIVEIS.map((n, i) => {
        const bloqueado = n.potenciaW !== null && w < n.potenciaW;
        const atual = n.id === nivel;
        // o degrau cresce 12 % por escala: o arquipélago é o menor, o multiverso o maior (GDD §10)
        const escala = 1 + i * 0.12;
        return (
          <button
            key={n.id}
            type="button"
            className={`degrau ${atual ? "degrau--atual" : ""} ${bloqueado ? "degrau--bloqueado" : ""}`}
            style={{ "--degrau-escala": escala } as React.CSSProperties}
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
