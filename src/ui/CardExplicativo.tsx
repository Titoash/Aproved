import { CARDS_ERA1 } from "../content/cards-era1";
import { formatarNumero } from "../sim/formatar";
import { useGameStore } from "../store/gameStore";
import { Bipe } from "./bipe/Bipe";

/** Preenche `{entrada}` e `{saida}` com os fluxos registrados na última Cascata. */
function preencher(texto: string, entradaUs: number | null, saidaUs: number | null): string {
  return texto
    .replace("{entrada}", entradaUs === null ? "—" : formatarNumero(entradaUs, 1))
    .replace("{saida}", saidaUs === null ? "—" : formatarNumero(saidaUs, 1));
}

export function CardExplicativo() {
  const aberto = useGameStore((s) => s.cardAberto);
  const ultimaCascata = useGameStore((s) => s.state.nucleo?.ultimaCascata ?? null);
  const avancarCard = useGameStore((s) => s.avancarCard);
  if (!aberto) return null;
  const def = CARDS_ERA1[aberto.id];
  if (!def) return null;
  const tela = def.telas[Math.min(aberto.tela, def.telas.length - 1)];
  const ultima = aberto.tela >= def.telas.length - 1;
  const texto = preencher(tela.texto, ultimaCascata?.entradaUs ?? null, ultimaCascata?.saidaUs ?? null);

  return (
    <div className="card-fundo" role="dialog" aria-modal="true" aria-labelledby="card-explicativo-titulo">
      <article className="card-explicativo">
        <div className="card-explicativo-bipe">
          <Bipe papel={def.bipe.papel} expressao={def.bipe.expressao} tamanho={88} />
        </div>
        <div className="card-explicativo-corpo">
          {def.telas.length > 1 ? (
            <div className="card-explicativo-passo">
              {aberto.tela + 1} de {def.telas.length}
            </div>
          ) : null}
          <h3 id="card-explicativo-titulo">{tela.titulo}</h3>
          <p>{texto}</p>
          <div className="card-explicativo-acoes">
            <button type="button" className="botao botao--primario" onClick={avancarCard} autoFocus>
              {ultima ? "Entendi" : "Próximo"}
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
