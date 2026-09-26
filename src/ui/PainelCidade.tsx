/**
 * Cidade (GDD §2.5, §8.6, v0.8): uma linha só — a densidade da cidade, 👥, a demanda, a tarifa — e um
 * botão que evolui **todos os bairros** de uma vez, ao custo da evolução × N (₵ e 🔬). É aqui que 👥 mora
 * depois que o HUD ficou com quatro números (§10.1).
 */
import { UNIVERSIDADE } from "../content/cidade-era1";
import { avaliarEvolucaoCidade, contarBairros, custoEvolucaoCidade, defDaCidade, defDaDensidade, limiteUniversidades } from "../sim/cidade";
import { formatarNumero, formatarPotencia } from "../sim/formatar";
import { analisar } from "../sim/producao";
import { useGameStore } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";

export function PainelCidade() {
  const state = useGameStore((s) => s.state);
  const evoluirCidade = useGameStore((s) => s.evoluirCidade);
  const analise = analisar(state);
  const def = defDaCidade(state);
  const bairros = contarBairros(state.mundo);
  const custo = custoEvolucaoCidade(state);
  const proxima = defDaDensidade(def.densidade + 1);
  const v = avaliarEvolucaoCidade(state);

  return (
    <>
      <h2 className="rede-subtitulo">Cidade</h2>
      <p className="rede-dica">
        {analise.universidadesAtivas}/{limiteUniversidades(analise.populacao)} universidades ativas (1 por {formatarNumero(UNIVERSIDADE.populacaoPorUnidade, 0)}{" "}
        habitantes). A cidade evolui inteira: todos os bairros sobem juntos, e o bairro novo já nasce na densidade dela.
      </p>
      <ul className="lista">
        <li className="linha" data-cidade={def.densidade}>
          <div className="linha-texto">
            <span className="linha-nome">
              {def.nome} <span className="marca-nivel">densidade {def.densidade}</span>
            </span>
            <span className="linha-meta">
              {bairros} {bairros === 1 ? "bairro" : "bairros"} · 👥 {formatarNumero(analise.populacao, 0)} · {formatarPotencia(bairros * def.demandaKw)} de demanda · tarifa ×
              {formatarNumero(analise.tarifa, 2)}
            </span>
          </div>
          <div className="linha-acoes">
            {custo ? (
              <span title={v.motivo ?? undefined}>
                <BotaoCompra
                  titulo={`Evoluir a cidade para ${proxima.nome}`}
                  custo={custo.creditos}
                  creditos={state.creditos}
                  habilitado={v.ok}
                  requisito={`🔬 ${formatarNumero(custo.pesquisa, 0)}`}
                  variante="primario"
                  onClick={() => evoluirCidade()}
                />
              </span>
            ) : (
              <span className="marca-comprado">✔ densidade máxima</span>
            )}
          </div>
        </li>
      </ul>
      {bairros === 0 ? <p className="rede-dica">Nenhum bairro ainda. Coloque um e ligue uma subestação perto.</p> : null}
    </>
  );
}
