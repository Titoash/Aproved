import type { CSSProperties } from "react";
import { pesquisaPorSegundo, temperaturaNucleo } from "../sim/calor";
import {
  formatarCreditos,
  formatarEnergia,
  formatarMultiplicador,
  formatarNumero,
  formatarPotencia,
  formatarRazao,
  formatarTaxa,
} from "../sim/formatar";
import { balancoDoEstado, potenciaNucleoEfetivaKw } from "../sim/tick";
import { useGameStore } from "../store/gameStore";
import { COR_FAIXA } from "./faixas";

export function Hud() {
  const state = useGameStore((s) => s.state);
  const balanco = balancoDoEstado(state);
  const { bateria } = state.rede;
  const corFaixa = { "--faixa-cor": COR_FAIXA[balanco.faixa.id] } as CSSProperties;

  const fracaoBateria = bateria.capacidadeKwh > 0 ? bateria.kwh / bateria.capacidadeKwh : 0;
  const fluxo = balanco.fluxoBateriaKw;
  const classeFluxo =
    fluxo > 0 ? "fluxo-bateria--carregando" : fluxo < 0 ? "fluxo-bateria--descarregando" : "fluxo-bateria--parada";
  const textoFluxo =
    fluxo > 0
      ? `▲ carregando ${formatarPotencia(fluxo)}`
      : fluxo < 0
        ? `▼ descarregando ${formatarPotencia(-fluxo)}`
        : bateria.capacidadeKwh > 0
          ? "— parada"
          : "sem bateria";

  const nucleo = state.nucleo;
  const potenciaNucleo = potenciaNucleoEfetivaKw(nucleo);
  const pesquisaTaxa = nucleo && nucleo.scramRestanteMs === 0 ? pesquisaPorSegundo(potenciaNucleo, temperaturaNucleo(nucleo)) : 0;

  return (
    <header className="hud" aria-label="Indicadores">
      <div className="hud-item">
        <div className="hud-rotulo">Créditos</div>
        <div className="hud-valor hud-valor--grande">{formatarCreditos(state.creditos)}</div>
        <div className="hud-sub">+{formatarTaxa(balanco.receitaPorSegundo)}</div>
      </div>

      <div className="hud-item">
        <div className="hud-rotulo">⚡ Ofertada</div>
        <div className="hud-valor">{formatarPotencia(balanco.ofertaKw)}</div>
        <div className="hud-sub">
          {nucleo
            ? `usinas ${formatarPotencia(balanco.ofertaUsinasKw)} + núcleo ${formatarPotencia(balanco.ofertaNucleoKw)}`
            : `vendendo ${formatarPotencia(balanco.vendaDiretaKw + Math.max(0, -fluxo))}`}
        </div>
      </div>

      <div className="hud-item">
        <div className="hud-rotulo">🏙 Demanda</div>
        <div className="hud-valor">{formatarPotencia(balanco.demandaKw)}</div>
        <div className="hud-sub">
          {state.rede.vilas === 0 ? "vila inicial" : `${state.rede.vilas} vila${state.rede.vilas > 1 ? "s" : ""} extra`}
        </div>
      </div>

      <div className="hud-item hud-item--r" style={corFaixa}>
        <div className="hud-rotulo">r = oferta ÷ demanda</div>
        <div className="hud-valor">{formatarRazao(balanco.r)}</div>
        <span className={`faixa-chip ${balanco.faixa.id === "zonaDeOuro" ? "faixa-chip--ouro" : ""}`}>
          {balanco.faixa.nome} {formatarMultiplicador(balanco.multiplicador)}
        </span>
        {balanco.motivoBateria ? (
          <div className="hud-sub hud-sub--bateria">
            🔋 bateria {balanco.motivoBateria === "cobrindo" ? "cobrindo" : "absorvendo"}{" "}
            {formatarPotencia(balanco.motivoBateria === "cobrindo" ? balanco.cobertoKw : balanco.absorvidoKw)}
          </div>
        ) : null}
      </div>

      <div className="hud-item">
        <div className="hud-rotulo">🔋 Bateria</div>
        <div className="hud-valor">
          {formatarEnergia(bateria.kwh)} <span className="hud-sub">/ {formatarEnergia(bateria.capacidadeKwh)}</span>
        </div>
        <div className="barra" role="progressbar" aria-valuemin={0} aria-valuemax={1} aria-valuenow={fracaoBateria}>
          <div className="barra-preenchida" style={{ width: `${Math.round(fracaoBateria * 100)}%` }} />
        </div>
        <div className={`fluxo-bateria ${classeFluxo}`}>{textoFluxo}</div>
      </div>

      <div className="hud-item">
        <div className="hud-rotulo">🔬 Pesquisa</div>
        <div className="hud-valor">{formatarNumero(state.pesquisa, state.pesquisa < 100 ? 1 : 0)}</div>
        <div className="hud-sub">{nucleo ? `+${formatarNumero(pesquisaTaxa, 2)}/s` : "nasce no Núcleo"}</div>
      </div>
    </header>
  );
}
