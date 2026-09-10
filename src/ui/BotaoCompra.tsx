import { formatarCreditos } from "../sim/formatar";

interface Props {
  titulo: string;
  custo: number;
  creditos: number;
  habilitado: boolean;
  variante?: "primario" | "secundario";
  /** Requisito extra mostrado junto do custo (ex.: "🔬 30"). */
  requisito?: string;
  brilho?: boolean;
  onClick: () => void;
}

/** Botão-pílula com o custo à direita. */
export function BotaoCompra({ titulo, custo, creditos, habilitado, variante = "secundario", requisito, brilho, onClick }: Props) {
  const caro = creditos < custo;
  return (
    <button
      type="button"
      className={`pilula ${variante === "primario" ? "pilula--primaria" : ""} ${brilho ? "pilula--brilho" : ""}`}
      disabled={!habilitado}
      onClick={onClick}
    >
      <span>{titulo}</span>
      <span className={`pilula-custo ${caro ? "pilula-custo--caro" : ""}`}>
        {formatarCreditos(custo)}
        {requisito ? ` · ${requisito}` : ""}
      </span>
    </button>
  );
}
