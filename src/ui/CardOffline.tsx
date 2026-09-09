import { MODO_SEGURO } from "../content/era1-nucleo";
import { formatarCreditos, formatarDuracao, formatarNumero, formatarPorcentagem } from "../sim/formatar";
import { useGameStore } from "../store/gameStore";

export function CardOffline() {
  const relatorio = useGameStore((s) => s.relatorioOffline);
  const fechar = useGameStore((s) => s.fecharRelatorioOffline);
  if (!relatorio) return null;

  return (
    <div className="card-offline-fundo" role="dialog" aria-modal="true" aria-labelledby="card-offline-titulo">
      <article className="card card-offline">
        <div className="card-cabecalho">
          <h3 id="card-offline-titulo">Enquanto você esteve fora</h3>
          <span className="card-qtd">{formatarDuracao(relatorio.duracaoMs)}</span>
        </div>
        <ul className="card-offline-lista">
          <li>
            <span>Créditos</span>
            <strong>+{formatarCreditos(relatorio.creditos)}</strong>
          </li>
          <li>
            <span>🔬 Pesquisa</span>
            <strong>+{formatarNumero(relatorio.pesquisa, relatorio.pesquisa < 100 ? 1 : 0)}</strong>
          </li>
          <li>
            <span>🛡 Estabilidade</span>
            <strong>+{formatarNumero(relatorio.estabilidade, 1)} pontos</strong>
          </li>
        </ul>
        {relatorio.nucleoDesligado ? (
          <p className="aviso aviso--erro">
            Núcleo ficou desligado: sua configuração passaria de {formatarPorcentagem(MODO_SEGURO.limiarT)}
            {relatorio.tEquilibrio !== null && Number.isFinite(relatorio.tEquilibrio)
              ? ` (equilíbrio em ${formatarPorcentagem(relatorio.tEquilibrio)})`
              : " (sem turbinas, o calor só sobe)"}
            . Offline o modo seguro é obrigatório.
          </p>
        ) : (
          <p className="card-desc">
            Rede a 50 % e sem bateria; Núcleo em modo seguro a 70 %. Máximo de 8 h por ausência.
          </p>
        )}
        <div className="card-botoes">
          <button type="button" className="botao" onClick={fechar} autoFocus>
            <span className="botao-titulo">Fechar</span>
          </button>
        </div>
      </article>
    </div>
  );
}
