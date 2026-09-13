/** Ícones vetoriais próprios (GDD §10: nada de terceiros, nada de emoji nos ícones). */
import type { NivelId } from "../content/era1-tabuleiro";
import type { MelhoriaId, UsinaId } from "../sim/state";

export type ItemIcone = UsinaId | "vila" | "bateria" | MelhoriaId;

export function IconeItem({ id }: { id: ItemIcone }) {
  switch (id) {
    case "cataVento":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="9" y="7" width="2" height="11" rx="1" fill="#e9edff" />
          <ellipse cx="10" cy="18" rx="3.5" ry="1.2" fill="#4f5ac8" />
          <g fill="#f7f9ff">
            <rect x="9.2" y="0.6" width="1.9" height="6.4" rx="0.95" transform="rotate(0 10 7.5)" />
            <rect x="9.2" y="0.6" width="1.9" height="6.4" rx="0.95" transform="rotate(120 10 7.5)" />
            <rect x="9.2" y="0.6" width="1.9" height="6.4" rx="0.95" transform="rotate(240 10 7.5)" />
          </g>
          <circle cx="10" cy="7.5" r="1.8" fill="#ffd23f" />
        </svg>
      );
    case "painelSolar":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="5.5" y="12" width="2" height="5" fill="#4f5ac8" />
          <rect x="13" y="10" width="2" height="7" fill="#4f5ac8" />
          <path d="M2 13 18 9V4L2 8Z" fill="#2d4bd9" />
          <path d="M2 8 18 4v1.6L2 9.6Z" fill="#8fe3ff" opacity=".8" />
          <path d="M7.4 12.6V6.7M12.6 11.3V5.4" stroke="#4cc9f0" strokeOpacity=".5" strokeWidth="1" />
        </svg>
      );
    case "turbinaEolica":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M9.2 7 8.4 18h3.6L11 7Z" fill="#e9edff" />
          <ellipse cx="10" cy="18.2" rx="3.6" ry="1.2" fill="#4f5ac8" />
          <rect x="6.6" y="4.8" width="5" height="3" rx="1.5" fill="#b9bfe8" />
          <g fill="#f7f9ff">
            <path d="M10 6.5 9.1.2h1.8Z" />
            <path d="M10 6.5 15.8 9.3l-.9 1.6Z" />
            <path d="M10 6.5 5.1 10.9l-.9-1.6Z" />
          </g>
          <circle cx="10" cy="6.5" r="1.8" fill="#ffd23f" />
        </svg>
      );
    case "vila":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 9h6v9H4Z" fill="#f3e7c9" />
          <path d="M10 9h6v9h-6Z" fill="#cdbf9e" />
          <path d="M2.5 9.5 10 3l7.5 6.5H2.5Z" fill="#ff6b6b" />
          <path d="M10 3l7.5 6.5H10Z" fill="#c95050" />
          <rect x="6" y="12" width="2.4" height="2.4" fill="#ffd23f" />
          <rect x="12" y="12" width="2.4" height="2.4" fill="#ffd23f" />
        </svg>
      );
    case "bateria":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2" y="5.5" width="13.5" height="9" rx="2" fill="#e4e8ff" />
          <rect x="2" y="9" width="13.5" height="5.5" rx="2" fill="#b9bfe8" />
          <rect x="15.5" y="8" width="2.5" height="4" rx="1" fill="#ffd23f" />
          <rect x="4" y="7" width="2.4" height="6" rx=".8" fill="#6be585" />
          <rect x="7.6" y="7" width="2.4" height="6" rx=".8" fill="#6be585" />
          <rect x="11.2" y="7" width="2.4" height="6" rx=".8" fill="#6be585" opacity=".3" />
        </svg>
      );
    case "laminasDeFibra":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="#4cc9f0" opacity=".35" />
          <path d="M3.5 17C3.5 9 8.5 3 16.5 3c0 8-5 13-13 14Z" fill="#f7f9ff" />
          <path d="M3.5 17 12 8.5" stroke="#b9bfe8" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "rastreamentoSolar":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="15" cy="5" r="3" fill="#ffd23f" />
          <rect x="9" y="12" width="2" height="6" fill="#4f5ac8" />
          <path d="M2.5 9.5 16 5.5l1.5 3.5L4 13Z" fill="#4cc9f0" />
          <path d="M2.5 9.5 16 5.5l.5 1.2L3 10.7Z" fill="#f4f6ff" opacity=".7" />
          <path d="M2.5 9.5 16 5.5l1.5 3.5L4 13Z" fill="none" stroke="#2b8fd6" strokeWidth="1" />
        </svg>
      );
    case "grade7x7":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2 18 10l-8 8-8-8Z" fill="#222a66" />
          <path d="M10 2 18 10l-8 8-8-8Z" fill="none" stroke="#4cc9f0" strokeOpacity=".6" strokeWidth="1.2" />
          <path d="M7.3 4.7 15.3 12.7M4.7 7.3l8 8M12.7 4.7 4.7 12.7M15.3 7.3l-8 8" stroke="#f4f6ff" strokeOpacity=".25" strokeWidth="1" />
        </svg>
      );
  }
}

export function IconeNivel({ id }: { id: NivelId }) {
  const comum = { className: "icone icone--nivel", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true } as const;
  switch (id) {
    case "multiverso":
      return (
        <svg {...comum}>
          <circle cx="5.5" cy="6" r="3.75" />
          <circle cx="11" cy="9.5" r="3.25" />
          <circle cx="7.5" cy="12" r="2.25" />
        </svg>
      );
    case "universo":
      return (
        <svg {...comum} strokeLinecap="round">
          <path d="M3.5 4.5 8 7l4.5-3M8 7l-1 5.5M8 7l5 4" />
          <circle cx="3.5" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="4" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="7" cy="12.5" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="13" cy="11" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="8" cy="7" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "galaxia":
      return (
        <svg {...comum} strokeLinecap="round">
          <path d="M8 8c0-1.6 1.4-2.3 2.6-1.6 1.7 1 1.5 3.6-.2 4.9-2.4 1.9-6 .6-6.9-2.3C2.4 5.6 4.9 2.4 8.4 2.3M8 8c0 1.6-1.4 2.3-2.6 1.6-1.7-1-1.5-3.6.2-4.9 2.4-1.9 6-.6 6.9 2.3 1.1 3.4-1.4 6.6-4.9 6.7" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sistema":
      return (
        <svg {...comum}>
          <circle cx="8" cy="8" r="6.5" strokeDasharray="2 2.2" />
          <circle cx="8" cy="8" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="13.2" cy="4.3" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "planeta":
      return (
        <svg {...comum}>
          <circle cx="8" cy="8" r="5.6" />
          <path d="M4.4 6.2c1.2-.6 2.8-.2 3.1 1 .3 1.3-1 1.6-.6 2.9.3 1 1.6 1.2 2.6.8" strokeLinecap="round" />
          <circle cx="8" cy="8" r="7.25" strokeOpacity=".35" />
        </svg>
      );
    case "ilha":
      return (
        <svg {...comum} strokeLinejoin="round">
          <path d="M8 3 14 6.5 8 10 2 6.5Z" />
          <path d="M2 6.5v2.4L8 12.4l6-3.5V6.5" />
          <path d="M8 10v2.4" />
        </svg>
      );
  }
}

export function IconeCadeado() {
  return (
    <svg className="icone icone--cadeado" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 7V5.5a3.5 3.5 0 0 1 7 0V7h.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm1.6 0h3.8V5.5a1.9 1.9 0 0 0-3.8 0Z" />
    </svg>
  );
}
