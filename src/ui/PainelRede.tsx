import { BATERIA, MELHORIAS, ORDEM_MELHORIAS, ORDEM_USINAS, VILA, type Desbloqueio } from "../content/era1";
import { USINAS_TODAS } from "../content/eras";
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
import { formatarEnergia, formatarNumero, formatarPotencia } from "../sim/formatar";
import { fatorPotenciaUsina, podeComprarMelhoria } from "../sim/melhorias";
import { potenciaUsina } from "../sim/rede";
import type { GameState, UsinaId } from "../sim/state";
import { useGameStore } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";
import { NumeroPop } from "./NumeroPop";

function textoBloqueio(state: GameState, desbloqueio: Desbloqueio | undefined): string | null {
  if (desbloqueado(state, desbloqueio)) return null;
  const partes: string[] = [];
  if (desbloqueio?.usina) {
    const [id, n] = desbloqueio.usina;
    const nome = n === 1 ? USINAS_TODAS[id].nome : USINAS_TODAS[id].nomePlural;
    if (state.rede.usinas[id].quantidade < n) partes.push(`${n} ${nome.toLowerCase()} (${state.rede.usinas[id].quantidade}/${n})`);
  }
  if (desbloqueio?.pesquisa !== undefined && state.pesquisa < desbloqueio.pesquisa) {
    partes.push(`🔬 ${desbloqueio.pesquisa} (${formatarNumero(state.pesquisa, 0)}/${desbloqueio.pesquisa})`);
  }
  return `Desbloqueia com ${partes.join(" e ")}`;
}

function LinhaUsina({ id }: { id: UsinaId }) {
  const state = useGameStore((s) => s.state);
  const comprarUsina = useGameStore((s) => s.comprarUsina);
  const melhorarUsina = useGameStore((s) => s.melhorarUsina);
  const def = USINAS_TODAS[id];
  const usina = state.rede.usinas[id];
  const bloqueio = textoBloqueio(state, def.desbloqueio);
  const potenciaCada = def.potenciaKw * fatorMelhoria(usina.nivel) * fatorPotenciaUsina(state.melhorias, id);

  return (
    <li className={`linha ${bloqueio ? "linha--bloqueada" : ""}`}>
      <div className="linha-texto">
        <span className="linha-nome">{def.nome}</span>
        <span className="linha-meta">
          {bloqueio ? (
            <span className="linha-bloqueio">🔒 {bloqueio}</span>
          ) : (
            <>
              <NumeroPop valor={usina.quantidade}>×{usina.quantidade}</NumeroPop> · {formatarPotencia(potenciaUsina(id, usina, state.melhorias))} ·{" "}
              {formatarPotencia(potenciaCada)} cada
              {usina.nivel > 0 ? ` · nível ${usina.nivel}` : ""}
            </>
          )}
        </span>
      </div>
      {bloqueio ? null : (
        <div className="linha-acoes">
          <BotaoCompra titulo="Comprar" custo={custoProximaUsina(state, id)} creditos={state.creditos} habilitado={podeComprarUsina(state, id)} variante="primario" onClick={() => comprarUsina(id)} />
          <BotaoCompra titulo={`Nível ${usina.nivel + 1}`} custo={custoProximaMelhoria(state, id)} creditos={state.creditos} habilitado={podeMelhorarUsina(state, id)} onClick={() => melhorarUsina(id)} />
        </div>
      )}
    </li>
  );
}

function LinhaVila() {
  const state = useGameStore((s) => s.state);
  const comprarVila = useGameStore((s) => s.comprarVila);
  return (
    <li className="linha">
      <div className="linha-texto">
        <span className="linha-nome">Vila</span>
        <span className="linha-meta">
          <NumeroPop valor={state.rede.vilas}>×{state.rede.vilas}</NumeroPop> · +{formatarPotencia(VILA.demandaKw)} de demanda cada
        </span>
      </div>
      <div className="linha-acoes">
        <BotaoCompra titulo="Comprar" custo={custoProximaVila(state)} creditos={state.creditos} habilitado={podeComprarVila(state)} variante="primario" onClick={comprarVila} />
      </div>
    </li>
  );
}

function LinhaBateria() {
  const state = useGameStore((s) => s.state);
  const comprarBateria = useGameStore((s) => s.comprarBateria);
  const bloqueio = textoBloqueio(state, BATERIA.desbloqueio);
  const { bateria } = state.rede;
  return (
    <li className={`linha ${bloqueio ? "linha--bloqueada" : ""}`}>
      <div className="linha-texto">
        <span className="linha-nome">Bateria</span>
        <span className="linha-meta">
          {bloqueio ? (
            <span className="linha-bloqueio">🔒 {bloqueio}</span>
          ) : (
            <>
              <NumeroPop valor={bateria.unidades}>×{bateria.unidades}</NumeroPop> · {formatarEnergia(bateria.kwh)} / {formatarEnergia(bateria.capacidadeKwh)} · ±
              {formatarPotencia(BATERIA.potenciaKw * bateria.unidades)}
            </>
          )}
        </span>
      </div>
      {bloqueio ? null : (
        <div className="linha-acoes">
          <BotaoCompra titulo="Comprar" custo={custoProximaBateria(state)} creditos={state.creditos} habilitado={podeComprarBateria(state)} variante="primario" onClick={comprarBateria} />
        </div>
      )}
    </li>
  );
}

function LinhaMelhoria({ id }: { id: (typeof ORDEM_MELHORIAS)[number] }) {
  const state = useGameStore((s) => s.state);
  const comprarMelhoria = useGameStore((s) => s.comprarMelhoria);
  const def = MELHORIAS[id];
  const comprada = state.melhorias[id];
  return (
    <li className={`linha ${comprada ? "linha--comprada" : ""}`}>
      <div className="linha-texto">
        <span className="linha-nome">
          {def.nome}
          {comprada ? <span className="marca-comprado"> ✔ comprada</span> : null}
        </span>
        <span className="linha-meta">{def.descricao}</span>
      </div>
      {comprada ? null : (
        <div className="linha-acoes">
          <BotaoCompra titulo="Comprar" custo={def.custo} creditos={state.creditos} habilitado={podeComprarMelhoria(state, id)} requisito={def.pesquisa !== undefined ? `🔬 ${def.pesquisa}` : undefined} onClick={() => comprarMelhoria(id)} />
        </div>
      )}
    </li>
  );
}

export function PainelRede() {
  return (
    <section className="rede" aria-label="Rede">
      <h2>Rede</h2>
      <ul className="lista">
        {ORDEM_USINAS.map((id) => (
          <LinhaUsina key={id} id={id} />
        ))}
        <LinhaVila />
        <LinhaBateria />
      </ul>
      <h2 className="rede-subtitulo">Melhorias</h2>
      <ul className="lista">
        {ORDEM_MELHORIAS.filter((id) => MELHORIAS[id].camada === "rede").map((id) => (
          <LinhaMelhoria key={id} id={id} />
        ))}
      </ul>
    </section>
  );
}
