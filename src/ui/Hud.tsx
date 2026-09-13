import { useState, type CSSProperties } from "react";
import { faixaDeCalor, pesquisaPorSegundo, temperaturaNucleo } from "../sim/calor";
import { formatarCreditos, formatarNumero, formatarPorcentagem, formatarPotencia, formatarTaxa } from "../sim/formatar";
import { proximoNo } from "../sim/arvore";
import { progressoDoAtivo } from "../sim/capitulos";
import { analisar } from "../sim/producao";
import { balancoDoEstado, potenciaNucleoEfetivaKw } from "../sim/tick";
import { corDaRampaCss } from "../scene/rampa";
import { useGameStore } from "../store/gameStore";
import { Extrato } from "./Extrato";
import { COR_FAIXA } from "./faixas";
import { NumeroPop } from "./NumeroPop";

/** Nota de ₵ desenhada (GDD §10, v0.6): retângulo arredondado com a esfera da Torre como marca-d'água. */
function NotaDeCreditos() {
  return (
    <svg className="nota" viewBox="0 0 44 26" aria-hidden="true">
      <rect x="0.8" y="0.8" width="42.4" height="24.4" rx="5" fill="#ffd23f" stroke="#ffb703" strokeWidth="1.5" />
      <circle cx="33" cy="13" r="7.5" fill="#fff3b0" />
      <circle cx="33" cy="13" r="4" fill="#ff7a1a" opacity=".65" />
      <path d="M6 6h10M6 20h10" stroke="#ffb703" strokeWidth="1.4" strokeLinecap="round" />
      <text x="11" y="17.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#161b3d" fontFamily="Outfit, system-ui, sans-serif">
        ₵
      </text>
    </svg>
  );
}

/** Faixa fina, sem cartões. Cor só onde significa estado: o ponto de r e o valor de 🔥. */
export function Hud() {
  const state = useGameStore((s) => s.state);
  const [extratoAberto, setExtratoAberto] = useState(false);
  const abrirArvore = useGameStore((s) => s.abrirArvore);
  const balanco = balancoDoEstado(state);
  const analise = analisar(state);
  const nucleo = state.nucleo;
  const t = nucleo ? temperaturaNucleo(nucleo) : null;
  const faixaCalor = t !== null ? faixaDeCalor(t) : null;
  const potenciaNucleo = potenciaNucleoEfetivaKw(nucleo);
  const pesquisaTaxa = nucleo && nucleo.scramRestanteMs === 0 && t !== null ? pesquisaPorSegundo(potenciaNucleo, t) : 0;
  const corCalor = t !== null ? corDaRampaCss(Math.min(1, t)) : "var(--muted)";
  const proximo = proximoNo(state);
  const capitulo = progressoDoAtivo(state);
  const estiloEsfera = {
    background: corCalor,
    boxShadow: t !== null && t >= 0.7 ? (t > 1 ? "var(--glow-coral)" : "var(--glow-sun)") : "none",
  } as CSSProperties;

  return (
    <>
      <header className="hud" aria-label="Indicadores">
      <div className="hud-item hud-item--creditos">
        <button
          type="button"
          className="hud-nota"
          aria-expanded={extratoAberto}
          title="Extrato: o que rende, o que está sem escoamento"
          onClick={() => setExtratoAberto((v) => !v)}
        >
          <NotaDeCreditos />
          <span className="hud-nota-texto">
            <span className="hud-valor hud-valor--grande">{formatarCreditos(state.creditos)}</span>
            <span className="hud-rotulo">+{formatarTaxa(balanco.receitaPorSegundo)}</span>
          </span>
        </button>
      </div>

      <div className="hud-item hud-item--oferta">
        <span className="hud-valor">
          ⚡ {formatarPotencia(balanco.ofertaKw)}
          <span className="hud-ponto" style={{ background: COR_FAIXA[balanco.faixa.id] }} aria-hidden="true" />
          <span className="hud-faixa">{balanco.faixa.nome.toLowerCase()}</span>
        </span>
        {analise.semEscoamentoKw > 0.001 ? (
          <span className="hud-sem-escoamento">sem escoamento {formatarPotencia(analise.semEscoamentoKw)}</span>
        ) : null}
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

      <div className="hud-item hud-item--ciencia">
        <button type="button" className="hud-pesquisa" onClick={abrirArvore} title="Abrir a árvore de pesquisa: 🔬 se gasta em nós">
          <span className="hud-valor">
            🔬 <NumeroPop valor={Math.floor(state.pesquisa)}>{formatarNumero(state.pesquisa, state.pesquisa < 100 ? 1 : 0)}</NumeroPop>
          </span>
          <span className="hud-rotulo">
            +{formatarNumero(pesquisaTaxa + analise.pesquisaPorSegundo, 2)}/s
            {proximo ? ` · próximo: ${proximo.nome} (🔬 ${proximo.pesquisa})` : " · árvore completa"}
          </span>
        </button>
      </div>

      <div className="hud-item hud-item--populacao">
        <span className="hud-valor">👥 {formatarNumero(analise.populacao, 0)}</span>
        <span className="hud-rotulo">habitantes</span>
      </div>

      <div className="hud-item hud-item--extra">
        <span className="hud-valor">🛡 {nucleo ? formatarPorcentagem(nucleo.estabilidade / 100) : "—"}</span>
        <span className="hud-rotulo">Estabilidade</span>
      </div>
      </header>
      {capitulo ? (
        <div className="capitulo" aria-label="Capítulo ativo">
          <span className="capitulo-titulo">{capitulo.capitulo.titulo}</span>
          <span className="capitulo-objetivo">{capitulo.capitulo.objetivo}</span>
          <span className="capitulo-progresso">
            <span className="capitulo-barra" style={{ width: `${Math.min(100, (capitulo.atual / capitulo.alvo) * 100)}%` }} />
          </span>
          <span className="capitulo-numeros">
            {formatarNumero(Math.min(capitulo.atual, capitulo.alvo), capitulo.alvo >= 100 ? 0 : 0)}/{formatarNumero(capitulo.alvo, 0)}
            {capitulo.capitulo.recompensa.creditos ? ` · ${formatarCreditos(capitulo.capitulo.recompensa.creditos)}` : ""}
            {capitulo.capitulo.recompensa.pesquisa ? ` · 🔬 ${capitulo.capitulo.recompensa.pesquisa}` : ""}
          </span>
        </div>
      ) : null}
      {/* Fora do <header>: o HUD do celular rola na horizontal e recortaria o popover. */}
      {extratoAberto ? (
        <div className="hud-extrato" role="dialog" aria-label="Extrato">
          <Extrato />
          <button type="button" className="pilula pilula--mini" onClick={() => setExtratoAberto(false)}>
            Fechar
          </button>
        </div>
      ) : null}
    </>
  );
}
