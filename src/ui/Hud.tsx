import { useState, type CSSProperties } from "react";
import { formatarCreditos, formatarNumero, formatarPorcentagem, formatarPotencia, formatarTaxa } from "../sim/formatar";
import { progressoDoAtivo } from "../sim/capitulos";
import { balancoDoEstado } from "../sim/tick";
import { corDaRampaCss } from "../scene/rampa";
import { useGameStore } from "../store/gameStore";
import { Extrato } from "./Extrato";
import { COR_FAIXA } from "./faixas";
import { numerosDoHud } from "./hud";
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

/**
 * Tocar no 🔥 abre o painel do Núcleo no cartão da Ocorrência (§10.1, v0.9): rola até ele e põe o foco em
 * "Aceitar". Sem oferta, rola até o painel do Núcleo.
 */
function abrirPainelDoNucleo(): void {
  const cartao = document.querySelector<HTMLElement>(".ocorrencia");
  const alvo = cartao ?? document.querySelector<HTMLElement>(".barra-calor");
  alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
  cartao?.querySelector<HTMLButtonElement>("[data-acao='aceitar-ocorrencia'], [data-acao='recompensa-estabilidade']")?.focus({ preventScroll: true });
}

/** "+₵ 12/s" ou "−₵ 5/s": a taxa líquida com sinal (as térmicas cobram combustível). */
function taxaComSinal(taxa: number): string {
  return `${taxa < 0 ? "−" : "+"}${formatarTaxa(Math.abs(taxa))}`;
}

/**
 * HUD limpo (GDD §10.1, v0.8): quatro números — ₵ com a taxa líquida, ⚡ como balanço `r` com a faixa e a
 * demanda, 🔥 com a faixa e a Estabilidade num anel fino em volta da esfera, 🔬 com a taxa e o próximo nó.
 * 👥 mora no painel da Cidade e no callout do bairro; 🛡, no painel do Núcleo. O capítulo é uma linha.
 */
export function Hud() {
  const state = useGameStore((s) => s.state);
  const [extratoAberto, setExtratoAberto] = useState(false);
  const abrirArvore = useGameStore((s) => s.abrirArvore);
  const h = numerosDoHud(state);
  const balanco = balancoDoEstado(state);
  const corCalor = h.t !== null ? corDaRampaCss(Math.min(1, h.t)) : "var(--muted)";
  const capitulo = progressoDoAtivo(state);
  const estiloEsfera = {
    background: corCalor,
    boxShadow: h.t !== null && h.t >= 0.7 ? (h.t > 1 ? "var(--glow-coral)" : "var(--glow-sun)") : "none",
  } as CSSProperties;
  const estab = h.estabilidade !== null ? Math.max(0, Math.min(100, h.estabilidade)) : 0;
  const rotuloEstab = h.estabilidade !== null ? `Estabilidade ${formatarPorcentagem(estab / 100)}` : "Núcleo bloqueado";

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
              <span className="hud-valor hud-valor--grande">{formatarCreditos(h.creditos)}</span>
              <span className={`hud-rotulo ${h.taxaCreditos < 0 ? "hud-rotulo--negativo" : ""}`}>{taxaComSinal(h.taxaCreditos)}</span>
            </span>
          </button>
        </div>

        <div className="hud-item hud-item--oferta" title={`oferta ${formatarPotencia(h.ofertaKw)} · demanda ${formatarPotencia(h.demandaKw)}`}>
          <span className="hud-valor">
            ⚡ {h.r !== null ? formatarPorcentagem(h.r) : "—"}
            <span className="hud-ponto" style={{ background: COR_FAIXA[h.faixaR.id] }} aria-hidden="true" />
            <span className="hud-faixa">{h.faixaR.nome.toLowerCase()}</span>
          </span>
          {h.semEscoamentoKw > 0.001 ? <span className="hud-sem-escoamento">sem escoamento {formatarPotencia(h.semEscoamentoKw)}</span> : null}
          <span className="hud-rotulo">
            {h.r !== null ? `demanda ${formatarPotencia(h.demandaKw)}` : "sem demanda"}
            {balanco.motivoBateria
              ? ` · bateria ${balanco.motivoBateria} ${formatarPotencia(balanco.motivoBateria === "cobrindo" ? balanco.cobertoKw : balanco.absorvidoKw)}`
              : ""}
          </span>
        </div>

        <button
          type="button"
          className={`hud-item hud-item--calor${h.ofertaOcorrencia ? " hud-item--oferta-ocorrencia" : ""}`}
          title={h.ofertaOcorrencia ? "Ocorrência oferecida: toque para ver o cartão" : rotuloEstab}
          aria-label={h.ofertaOcorrencia ? "Ocorrência oferecida: abrir o cartão no painel do Núcleo" : undefined}
          data-acao="abrir-ocorrencia"
          onClick={abrirPainelDoNucleo}
        >
          <span className="hud-valor">
            🔥{" "}
            <span className="hud-anel" style={{ "--estab": `${estab}%` } as CSSProperties} role="img" aria-label={rotuloEstab}>
              <span className="hud-esfera" style={estiloEsfera} />
            </span>
            <span style={{ color: corCalor }}>{h.t !== null ? formatarPorcentagem(h.t) : "—"}</span>
          </span>
          <span className="hud-rotulo">{h.ofertaOcorrencia ? "Ocorrência!" : h.faixaCalor ? h.faixaCalor.nome.toLowerCase() : "Núcleo bloqueado"}</span>
        </button>

        <div className="hud-item hud-item--ciencia">
          <button type="button" className="hud-pesquisa" onClick={abrirArvore} title="Abrir a árvore de pesquisa: 🔬 se gasta em nós">
            <span className="hud-valor">
              🔬 <NumeroPop valor={Math.floor(h.pesquisa)}>{formatarNumero(h.pesquisa, h.pesquisa < 100 ? 1 : 0)}</NumeroPop>
            </span>
            <span className="hud-rotulo">
              +{formatarNumero(h.taxaPesquisa, 2)}/s
              {h.proximo ? ` · próximo: ${h.proximo.nome} (🔬 ${h.proximo.pesquisa})` : " · árvore completa"}
            </span>
          </button>
        </div>
      </header>
      {capitulo ? (
        <div className="capitulo" aria-label={`Capítulo: ${capitulo.capitulo.titulo}`} title={capitulo.capitulo.titulo}>
          <span className="capitulo-objetivo">{capitulo.capitulo.objetivo}</span>
          <span className="capitulo-numeros">
            {formatarNumero(Math.min(capitulo.atual, capitulo.alvo), 0)}/{formatarNumero(capitulo.alvo, 0)}
            {capitulo.capitulo.recompensa.creditos ? ` · ${formatarCreditos(capitulo.capitulo.recompensa.creditos)}` : ""}
            {capitulo.capitulo.recompensa.pesquisa ? ` · 🔬 ${capitulo.capitulo.recompensa.pesquisa}` : ""}
          </span>
          <span className="capitulo-progresso" aria-hidden="true">
            <span className="capitulo-barra" style={{ width: `${Math.min(100, (capitulo.atual / capitulo.alvo) * 100)}%` }} />
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
