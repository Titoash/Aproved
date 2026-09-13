/**
 * Cidade (GDD §2.5, §8.6, v0.6): os bairros colocados, com densidade, população, demanda e o botão de
 * evoluir (₵ + 🔬). Tocar num bairro no tabuleiro seleciona a linha correspondente.
 */
import { DENSIDADES, UNIVERSIDADE } from "../content/cidade-era1";
import { avaliarEvolucao, custoEvolucao, densidadeDe, limiteUniversidades } from "../sim/cidade";
import { formatarNumero, formatarPotencia } from "../sim/formatar";
import { analisar } from "../sim/producao";
import { useGameStore } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";

export function PainelCidade() {
  const state = useGameStore((s) => s.state);
  const selecionada = useGameStore((s) => s.casaSelecionada);
  const selecionar = useGameStore((s) => s.selecionarCasa);
  const evoluirBairro = useGameStore((s) => s.evoluirBairro);
  const analise = analisar(state);
  const bairros = Object.keys(state.mundo.construcoes)
    .map(Number)
    .filter((i) => state.mundo.construcoes[i].tipo === "bairro")
    .sort((a, b) => state.mundo.construcoes[b].nivel - state.mundo.construcoes[a].nivel || a - b);

  return (
    <>
      <h2 className="rede-subtitulo">Cidade</h2>
      <p className="rede-dica">
        👥 {formatarNumero(analise.populacao, 0)} habitantes · tarifa média ×{formatarNumero(analise.tarifa, 2)} ·{" "}
        {analise.universidadesAtivas}/{limiteUniversidades(analise.populacao)} universidades ativas (1 por{" "}
        {formatarNumero(UNIVERSIDADE.populacaoPorUnidade, 0)} habitantes). Evoluir é por gasto, nunca sozinho.
      </p>
      {bairros.length === 0 ? <p className="rede-dica">Nenhum bairro ainda. Coloque um e ligue uma subestação perto.</p> : null}
      <ul className="lista">
        {bairros.map((i) => {
          const c = state.mundo.construcoes[i];
          const def = densidadeDe(c);
          const custo = custoEvolucao(c.nivel);
          const proxima = DENSIDADES[Math.min(DENSIDADES.length - 1, c.nivel + 1)];
          const v = avaliarEvolucao(state, i);
          return (
            <li key={i} className={`linha ${selecionada === i ? "linha--selecionada" : ""}`}>
              <div className="linha-texto">
                <button type="button" className="linha-nome linha-nome--botao" onClick={() => selecionar(i)} title="Mostrar no tabuleiro">
                  {def.nome} <span className="linha-meta">· casa {i % 64}, {Math.floor(i / 64)}</span>
                </button>
                <span className="linha-meta">
                  {formatarPotencia(def.demandaKw)} de demanda · {formatarNumero(def.populacao, 0)} hab · tarifa ×{formatarNumero(def.tarifa, 2)}
                </span>
              </div>
              <div className="linha-acoes">
                {custo ? (
                  <BotaoCompra
                    titulo={`Evoluir para ${proxima.nome}`}
                    custo={custo.creditos}
                    creditos={state.creditos}
                    habilitado={v.ok}
                    requisito={`🔬 ${custo.pesquisa}`}
                    variante="primario"
                    onClick={() => evoluirBairro(i)}
                  />
                ) : (
                  <span className="marca-comprado">✔ densidade máxima</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
