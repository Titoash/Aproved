import type { BipeExpressao, BipePapel } from "../../content/cards-era1";

interface Props {
  papel: BipePapel;
  expressao?: BipeExpressao;
  /** Largura em px; a altura acompanha. */
  tamanho?: number;
  className?: string;
}

const COR_PAPEL: Record<BipePapel, string> = {
  operador: "var(--sky)",
  manutencao: "var(--leaf)",
  cientista: "var(--sun)",
};

/**
 * Bipe: robô esférico de manutenção, mascote original (GDD §10).
 * Um olho, uma antena, dois braços em cápsula, sem pernas: flutua sobre uma sombra elíptica.
 * Expressões só por olho e antena. Sem contorno preto; sombra chapada de 4 px.
 */
export function Bipe({ papel, expressao = "neutro", tamanho = 96, className }: Props) {
  const cor = COR_PAPEL[papel];
  const alarmado = expressao === "alarmado";
  const apontando = expressao === "apontando";
  const cansado = expressao === "cansado";
  const raioOlho = alarmado ? 16 : 13;
  const olhoX = apontando ? 57 : 50;
  const corAntena = alarmado ? "var(--coral)" : cor;

  return (
    <svg
      className={`bipe bipe--${papel} bipe--${expressao} ${className ?? ""}`}
      viewBox="0 0 100 112"
      width={tamanho}
      height={tamanho * 1.12}
      role="img"
      aria-label={`Bipe ${papel}, ${expressao}`}
    >
      {/* sombra no chão */}
      <ellipse cx="50" cy="104" rx="24" ry="5" fill="rgba(7, 10, 30, 0.55)" />
      {/* braços (cápsulas), sombra chapada primeiro */}
      <g className="bipe-bracos">
        <rect x="16" y="60" width="12" height="26" rx="6" fill="rgba(7, 10, 30, 0.5)" transform="translate(4 4) rotate(18 22 73)" />
        <rect x="16" y="60" width="12" height="26" rx="6" fill={cor} transform="rotate(18 22 73)" />
        {apontando ? (
          <>
            <rect x="70" y="56" width="30" height="12" rx="6" fill="rgba(7, 10, 30, 0.5)" transform="translate(4 4)" />
            <rect x="70" y="56" width="30" height="12" rx="6" fill={cor} />
          </>
        ) : (
          <>
            <rect x="72" y="60" width="12" height="26" rx="6" fill="rgba(7, 10, 30, 0.5)" transform="translate(4 4) rotate(-18 78 73)" />
            <rect x="72" y="60" width="12" height="26" rx="6" fill={cor} transform="rotate(-18 78 73)" />
          </>
        )}
      </g>
      {/* antena */}
      <rect x="48" y="12" width="4" height="14" rx="2" fill={cor} />
      <circle cx="50" cy="10" r="6" fill={corAntena} className="bipe-antena" />
      {/* corpo: sombra chapada 4 px, depois o círculo */}
      <circle cx="54" cy="60" r="34" fill="rgba(7, 10, 30, 0.5)" />
      <circle cx="50" cy="56" r="34" fill={cor} />
      {/* olho */}
      <g className="bipe-olho">
        <circle cx={olhoX} cy="54" r={raioOlho} fill="var(--navy)" />
        <circle cx={olhoX - 5} cy="49" r="3.5" fill="#ffffff" />
        {cansado ? <rect x={olhoX - raioOlho} y={54 - raioOlho} width={raioOlho * 2} height={raioOlho} fill={cor} /> : null}
        <rect className="bipe-palpebra" x={olhoX - raioOlho - 1} y={54 - raioOlho - 1} width={raioOlho * 2 + 2} height={raioOlho * 2 + 2} fill={cor} />
      </g>
    </svg>
  );
}
