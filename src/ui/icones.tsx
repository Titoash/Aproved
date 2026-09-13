/** Ícones vetoriais próprios (GDD §10: nada de terceiros, nada de emoji nos ícones). */
import type { NivelId } from "../content/escalas";
import type { TipoObstaculo } from "../content/era1-arquipelago";
import type { TipoConstrucao } from "../sim/state";

export type ItemIcone = TipoConstrucao | TipoObstaculo | "remover" | "pesquisa";

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
    case "bairro":
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
    case "subestacao":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.5" y="13.5" width="15" height="4.5" rx="1.5" fill="#c9cfff" />
          <rect x="4.5" y="3" width="1.8" height="11" fill="#e9edff" />
          <rect x="13.7" y="3" width="1.8" height="11" fill="#e9edff" />
          <rect x="4.5" y="2" width="11" height="1.8" rx="0.9" fill="#e9edff" />
          <path d="M5.4 5.5h9.2M5.4 8.5h9.2" stroke="#4f5ac8" strokeWidth="0.9" />
          <circle cx="7" cy="1.6" r="1.1" fill="#ffd23f" />
          <circle cx="13" cy="1.6" r="1.1" fill="#ffd23f" />
          <path d="M10 6.5 8.4 10h1.6l-1 3 3-4h-1.7l1-2.5Z" fill="#ffb703" />
        </svg>
      );
    case "arvore":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="9" y="11" width="2" height="7" fill="#3e3488" />
          <circle cx="10" cy="8" r="6" fill="#2f9c60" />
          <circle cx="8.5" cy="6.5" r="4.5" fill="#3fb36a" />
          <circle cx="7" cy="5" r="1.8" fill="#6be585" />
        </svg>
      );
    case "arbusto":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <ellipse cx="10" cy="15" rx="7" ry="4" fill="#2f9c60" />
          <ellipse cx="8.5" cy="13" rx="5.5" ry="3.4" fill="#55d162" />
          <circle cx="6.5" cy="11.5" r="1.5" fill="#6be585" />
        </svg>
      );
    case "pedra":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 15 6 7l6-2 5 5-2 5Z" fill="#5b4cb5" />
          <path d="M6 7l6-2 5 5-6 1Z" fill="#7a6ad6" />
          <path d="M11 11l6-1-2 5-4 1Z" fill="#3e3488" />
        </svg>
      );
    case "pantano":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <ellipse cx="10" cy="14" rx="8" ry="4.5" fill="#2d5f55" />
          <ellipse cx="9.5" cy="13.2" rx="6" ry="3.2" fill="#3c7a6a" />
          <path d="M5 12c0-3 1-5 1-7M9 11c0-4 1-6 1.5-8M13 12c0-3 .6-4.5 1-6" stroke="#5ec975" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "montanha":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M1 17 10 3l9 14Z" fill="#5b4cb5" />
          <path d="M10 3l9 14h-9Z" fill="#3e3488" />
          <path d="M10 3l3 4.6-1.5-.5L10 8.4 8.5 7.1 7 7.6Z" fill="#eef3ff" />
        </svg>
      );
    case "pico":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 18 10 1l6 17Z" fill="#5b4cb5" />
          <path d="M10 1l6 17h-6Z" fill="#3e3488" />
          <path d="M10 1l2.2 6-2.2-1-2.2 1Z" fill="#eef3ff" />
        </svg>
      );
    case "remover":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 6h12l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 5 17.5Z" fill="#9aa3c7" />
          <path d="M8 3.2h4a1 1 0 0 1 1 1V6H7V4.2a1 1 0 0 1 1-1Z" fill="#ff6b6b" />
          <rect x="2.5" y="5.2" width="15" height="1.9" rx="0.95" fill="#f4f6ff" />
          <path d="M8.4 9v7M11.6 9v7" stroke="#161b3d" strokeWidth="1.4" strokeLinecap="round" />
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
    case "laboratorio":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="8" width="14" height="10" rx="1.5" fill="#e7ecff" />
          <path d="M3 8a7 4 0 0 1 14 0Z" fill="#c9cfff" />
          <rect x="5.5" y="11" width="3" height="3" fill="#4cc9f0" />
          <rect x="11.5" y="11" width="3" height="3" fill="#ffd23f" />
          <path d="M9.2 2.2h1.6v4l-1.6-.6Z" fill="#4cc9f0" />
        </svg>
      );
    case "universidade":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2" y="9" width="16" height="9" rx="1" fill="#e7ecff" />
          <g fill="#241b55">
            <rect x="4" y="11" width="1.8" height="6" />
            <rect x="7.6" y="11" width="1.8" height="6" />
            <rect x="11.2" y="11" width="1.8" height="6" />
            <rect x="14.8" y="11" width="1.8" height="6" />
          </g>
          <path d="M4 9a6 5 0 0 1 12 0Z" fill="#ffb703" />
          <circle cx="10" cy="2.6" r="1.4" fill="#ffd23f" />
        </svg>
      );
    case "pesquisa":
      return (
        <svg className="icone icone--item" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="2.4" fill="#ffd23f" />
          <g fill="none" stroke="#4cc9f0" strokeWidth="1.3">
            <ellipse cx="10" cy="10" rx="8.6" ry="3.6" />
            <ellipse cx="10" cy="10" rx="8.6" ry="3.6" transform="rotate(60 10 10)" />
            <ellipse cx="10" cy="10" rx="8.6" ry="3.6" transform="rotate(120 10 10)" />
          </g>
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
