import { BATERIA, MELHORIAS, ORDEM_MELHORIAS, ORDEM_USINAS, USINAS, VILA, type Desbloqueio } from "../content/era1";
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
import { fatorPotenciaUsina, podeComprarMelhoria } from "../sim/melhorias";
import { formatarCreditos, formatarEnergia, formatarNumero, formatarPotencia } from "../sim/formatar";
import { potenciaUsina } from "../sim/rede";
import type { GameState, UsinaId } from "../sim/state";
import { useGameStore } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";

function textoBloqueio(state: GameState, desbloqueio: Desbloqueio | undefined): string | null {
  if (desbloqueado(state, desbloqueio)) return null;
  const partes: string[] = [];
  if (desbloqueio?.usina) {
    const [id, n] = desbloqueio.usina;
    const nome = n === 1 ? USINAS[id].nome : USINAS[id].nomePlural;
    if (state.rede.usinas[id].quantidade < n) partes.push(`${n} ${nome.toLowerCase()} (${state.rede.usinas[id].quantidade}/${n})`);
  }
  if (desbloqueio?.pesquisa !== undefined && state.pesquisa < desbloqueio.pesquisa) {
    partes.push(`🔬 ${desbloqueio.pesquisa} (${formatarNumero(state.pesquisa, 0)}/${desbloqueio.pesquisa})`);
  }
  return `🔒 Desbloqueia com ${partes.join(" e ")}`;
}

function CardUsina({ id }: { id: UsinaId }) {
  const state = useGameStore((s) => s.state);
  const comprarUsina = useGameStore((s) => s.comprarUsina);
  const melhorarUsina = useGameStore((s) => s.melhorarUsina);

  const def = USINAS[id];
  const usina = state.rede.usinas[id];
  const bloqueio = textoBloqueio(state, def.desbloqueio);
  const potenciaCada = def.potenciaKw * fatorMelhoria(usina.nivel) * fatorPotenciaUsina(state.melhorias, id);

  return (
    <article className={`card ${bloqueio ? "card--bloqueado" : ""}`}>
      <div className="card-cabecalho">
        <h3>{def.nome}</h3>
        <span className="card-qtd">×{usina.quantidade}</span>
      </div>
      <p className="card-desc">{def.descricao}</p>
      <div className="card-stats">
        <span>⚡ {formatarPotencia(potenciaUsina(id, usina, state.melhorias))}</span>
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
  const bloqueio = textoBloqueio(state, VILA.desbloqueio);

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
  const bloqueio = textoBloqueio(state, BATERIA.desbloqueio);
  const { bateria } = state.rede;

  return (
    <article className={`card ${bloqueio ? "card--bloqueado" : ""}`}>
      <div className="card-cabecalho">
        <h3>🔋 {BATERIA.nome}</h3>
        <span className="card-qtd">×{bateria.unidades}</span>
      </div>
      <p className="card-desc">{BATERIA.descricao}</p>
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

function CardMelhoria({ id }: { id: (typeof ORDEM_MELHORIAS)[number] }) {
  const state = useGameStore((s) => s.state);
  const comprarMelhoria = useGameStore((s) => s.comprarMelhoria);
  const def = MELHORIAS[id];
  const comprada = state.melhorias[id];
  const requisito = def.pesquisa !== undefined ? ` + 🔬 ${def.pesquisa}` : "";
  return (
    <article className={`card ${comprada ? "card--comprada" : ""}`}>
      <div className="card-cabecalho">
        <h3>{def.nome}</h3>
        <span className="card-qtd">{comprada ? "✔ comprada" : "melhoria"}</span>
      </div>
      <p className="card-desc">{def.descricao}</p>
      {comprada ? null : (
        <div className="card-botoes">
          <button
            type="button"
            className="botao botao--melhoria"
            disabled={!podeComprarMelhoria(state, id)}
            onClick={() => comprarMelhoria(id)}
          >
            <span className="botao-titulo">Comprar</span>
            <span className={`botao-custo ${state.creditos < def.custo || state.pesquisa < (def.pesquisa ?? 0) ? "botao-custo--caro" : ""}`}>
              {formatarCreditos(def.custo)}
              {requisito}
            </span>
          </button>
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
      <h3 className="melhorias-titulo">Melhorias da Rede</h3>
      <div className="cards">
        {ORDEM_MELHORIAS.filter((id) => MELHORIAS[id].camada === "rede").map((id) => (
          <CardMelhoria key={id} id={id} />
        ))}
      </div>
    </section>
  );
}
