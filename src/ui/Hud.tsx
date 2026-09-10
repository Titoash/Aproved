import type { CSSProperties } from "react";
import { faixaDeCalor, pesquisaPorSegundo, temperaturaNucleo } from "../sim/calor";
import { formatarCreditos, formatarNumero, formatarPorcentagem, formatarPotencia, formatarTaxa } from "../sim/formatar";
import { balancoDoEstado, potenciaNucleoEfetivaKw } from "../sim/tick";
import { corDaRampaCss } from "../scene/rampa";
import { useGameStore } from "../store/gameStore";
import { COR_FAIXA } from "./faixas";
import { NumeroPop } from "./NumeroPop";

/** Faixa fina, sem cartões. Cor só onde significa estado: o ponto de r e o valor de 🔥. */
export function Hud() {
  const state = useGameStore((s) => s.state);
  const balanco = balancoDoEstado(state);
  const nucleo = state.nucleo;
  const t = nucleo ? temperaturaNucleo(nucleo) : null;
  const faixaCalor = t !== null ? faixaDeCalor(t) : null;
  const potenciaNucleo = potenciaNucleoEfetivaKw(nucleo);
  const pesquisaTaxa = nucleo && nucleo.scramRestanteMs === 0 && t !== null ? pesquisaPorSegundo(potenciaNucleo, t) : 0;
  const corCalor = t !== null ? corDaRampaCss(Math.min(1, t)) : "var(--muted)";
  const estiloEsfera = {
    background: corCalor,
    boxShadow: t !== null && t >= 0.7 ? (t > 1 ? "var(--glow-coral)" : "var(--glow-sun)") : "none",
  } as CSSProperties;

  return (
    <header className="hud" aria-label="Indicadores">
      <div className="hud-item hud-item--creditos">
        <span className="hud-valor hud-valor--grande">{formatarCreditos(state.creditos)}</span>
        <span className="hud-rotulo">+{formatarTaxa(balanco.receitaPorSegundo)}</span>
      </div>

      <div className="hud-item hud-item--oferta">
        <span className="hud-valor">
          ⚡ {formatarPotencia(balanco.ofertaKw)}
          <span className="hud-ponto" style={{ background: COR_FAIXA[balanco.faixa.id] }} aria-hidden="true" />
          <span className="hud-faixa">{balanco.faixa.nome.toLowerCase()}</span>
        </span>
        <span className="hud-rotulo">
          demanda {formatarPotencia(balanco.demandaKw)}
          {balanco.motivoBateria
            ? ` · bateria ${balanco.motivoBateria} ${formatarPotencia(balanco.motivoBateria === "cobrindo" ? balanco.cobertoKw : balanco.absorvidoKw)}`
            : nucleo
              ? ` · núcleo ${formatarPotencia(balanco.ofertaNucleoKw)}`
              : ""}
        </span>
      </div>

      <div className="hud-item hud-item--calor">
        <span className="hud-valor">
          🔥 <span className="hud-esfera" style={estiloEsfera} aria-hidden="true" />
          <span style={{ color: corCalor }}>{t !== null ? formatarPorcentagem(t) : "—"}</span>
        </span>
        <span className="hud-rotulo">{faixaCalor ? faixaCalor.nome.toLowerCase() : "Núcleo bloqueado"}</span>
      </div>

      <div className="hud-item hud-item--extra">
        <span className="hud-valor">
          🔬 <NumeroPop valor={Math.floor(state.pesquisa)}>{formatarNumero(state.pesquisa, state.pesquisa < 100 ? 1 : 0)}</NumeroPop>
        </span>
        <span className="hud-rotulo">{nucleo ? `+${formatarNumero(pesquisaTaxa, 2)}/s` : "nasce no Núcleo"}</span>
      </div>

      <div className="hud-item hud-item--extra">
        <span className="hud-valor">🛡 {nucleo ? formatarPorcentagem(nucleo.estabilidade / 100) : "—"}</span>
        <span className="hud-rotulo">Estabilidade</span>
      </div>
    </header>
  );
}
