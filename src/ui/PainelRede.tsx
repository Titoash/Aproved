import { BATERIA, ORDEM_USINAS, USINAS, VILA, type Desbloqueio } from "../content/era1";
import {
  custoProximaBateria,
  custoProximaMelhoria,
  custoProximaUsina,
  custoProximaVila,
  desbloqueado,
  podeComprarBateria,
  podeComprarUsina,
  podeComprarVila,
  podeMelhorarUsina,
} from "../sim/acoes";
import { fatorMelhoria } from "../sim/custos";
import { formatarEnergia, formatarPotencia } from "../sim/formatar";
import { potenciaUsina } from "../sim/rede";
import type { RedeState, UsinaId } from "../sim/state";
import { useGameStore } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";

function textoBloqueio(rede: RedeState, desbloqueio: Desbloqueio | undefined): string | null {
  if (!desbloqueio?.usina || desbloqueado(rede, desbloqueio)) return null;
  const [id, n] = desbloqueio.usina;
  const nome = n === 1 ? USINAS[id].nome : USINAS[id].nomePlural;
  return `🔒 Desbloqueia com ${n} ${nome.toLowerCase()} (${rede.usinas[id].quantidade}/${n})`;
}

/** Requisito de pesquisa do GDD; ainda sem efeito (a pesquisa chega com o Núcleo, Sessão 2). */
function NotaPesquisa({ desbloqueio }: { desbloqueio: Desbloqueio | undefined }) {
  if (desbloqueio?.pesquisa === undefined) return null;
  return <div className="card-nota">🔬 {desbloqueio.pesquisa} de pesquisa · sem efeito até o Núcleo existir</div>;
}

function CardUsina({ id }: { id: UsinaId }) {
  const state = useGameStore((s) => s.state);
  const comprarUsina = useGameStore((s) => s.comprarUsina);
  const melhorarUsina = useGameStore((s) => s.melhorarUsina);

  const def = USINAS[id];
  const usina = state.rede.usinas[id];
  const bloqueio = textoBloqueio(state.rede, def.desbloqueio);
  const potenciaCada = def.potenciaKw * fatorMelhoria(usina.nivel);

  return (
    <article className={`card ${bloqueio ? "card--bloqueado" : ""}`}>
      <div className="card-cabecalho">
        <h3>{def.nome}</h3>
        <span className="card-qtd">×{usina.quantidade}</span>
      </div>
      <p className="card-desc">{def.descricao}</p>
      <NotaPesquisa desbloqueio={def.desbloqueio} />
      <div className="card-stats">
        <span>⚡ {formatarPotencia(potenciaUsina(id, usina))}</span>
        <span>{formatarPotencia(potenciaCada)} cada</span>
        <span>nível {usina.nivel}</span>
      </div>
      {bloqueio ? (
        <div className="card-bloqueio">{bloqueio}</div>
      ) : (
        <div className="card-botoes">
          <BotaoCompra
            titulo="Comprar"
            custo={custoProximaUsina(state, id)}
            creditos={state.creditos}
            habilitado={podeComprarUsina(state, id)}
            onClick={() => comprarUsina(id)}
          />
          <BotaoCompra
            titulo={`Melhorar → nv. ${usina.nivel + 1}`}
            custo={custoProximaMelhoria(state, id)}
            creditos={state.creditos}
            habilitado={podeMelhorarUsina(state, id)}
            variante="melhoria"
            onClick={() => melhorarUsina(id)}
          />
        </div>
      )}
    </article>
  );
}

function CardVila() {
  const state = useGameStore((s) => s.state);
  const comprarVila = useGameStore((s) => s.comprarVila);
  const bloqueio = textoBloqueio(state.rede, VILA.desbloqueio);

  return (
    <article className={`card ${bloqueio ? "card--bloqueado" : ""}`}>
      <div className="card-cabecalho">
        <h3>🏙 {VILA.nome}</h3>
        <span className="card-qtd">×{state.rede.vilas}</span>
      </div>
      <p className="card-desc">{VILA.descricao}</p>
      <div className="card-stats">
        <span>+{formatarPotencia(VILA.demandaKw)} de demanda cada</span>
      </div>
      {bloqueio ? (
        <div className="card-bloqueio">{bloqueio}</div>
      ) : (
        <div className="card-botoes">
          <BotaoCompra
            titulo="Comprar"
            custo={custoProximaVila(state)}
            creditos={state.creditos}
            habilitado={podeComprarVila(state)}
            onClick={comprarVila}
          />
        </div>
      )}
    </article>
  );
}

function CardBateria() {
  const state = useGameStore((s) => s.state);
  const comprarBateria = useGameStore((s) => s.comprarBateria);
  const bloqueio = textoBloqueio(state.rede, BATERIA.desbloqueio);
  const { bateria } = state.rede;

  return (
    <article className={`card ${bloqueio ? "card--bloqueado" : ""}`}>
      <div className="card-cabecalho">
        <h3>🔋 {BATERIA.nome}</h3>
        <span className="card-qtd">×{bateria.unidades}</span>
      </div>
      <p className="card-desc">{BATERIA.descricao}</p>
      <NotaPesquisa desbloqueio={BATERIA.desbloqueio} />
      <div className="card-stats">
        <span>{formatarEnergia(bateria.capacidadeKwh)} de capacidade</span>
        <span>{formatarEnergia(BATERIA.capacidadeKwh)} cada</span>
      </div>
      {bloqueio ? (
        <div className="card-bloqueio">{bloqueio}</div>
      ) : (
        <div className="card-botoes">
          <BotaoCompra
            titulo="Comprar"
            custo={custoProximaBateria(state)}
            creditos={state.creditos}
            habilitado={podeComprarBateria(state)}
            onClick={comprarBateria}
          />
        </div>
      )}
    </article>
  );
}

export function PainelRede() {
  return (
    <section className="painel painel-rede" aria-label="Rede">
      <h2>Rede</h2>
      <div className="cards">
        {ORDEM_USINAS.map((id) => (
          <CardUsina key={id} id={id} />
        ))}
        <CardVila />
        <CardBateria />
      </div>
    </section>
  );
}
