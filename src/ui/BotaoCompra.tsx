import { formatarCreditos } from "../sim/formatar";

interface Props {
  titulo: string;
  custo: number;
  creditos: number;
  habilitado: boolean;
  variante?: "compra" | "melhoria";
  onClick: () => void;
}

export function BotaoCompra({ titulo, custo, creditos, habilitado, variante = "compra", onClick }: Props) {
  const caro = creditos < custo;
  return (
    <button
      type="button"
      className={`botao ${variante === "melhoria" ? "botao--melhoria" : ""}`}
      disabled={!habilitado}
      onClick={onClick}
    >
      <span className="botao-titulo">{titulo}</span>
      <span className={`botao-custo ${caro ? "botao-custo--caro" : ""}`}>{formatarCreditos(custo)}</span>
    </button>
  );
}
