/**
 * Cartão da Ocorrência (GDD Parte 1 §4.4, §10.1; Parte 2 §5.4, v0.9), sobre o pé do tabuleiro — dentro da coluna
 * do Núcleo, com a barra de calor logo abaixo e a cena à vista:
 *   oferta   → nome, duração, recompensa, a frase de física, "Aceitar" / "Agora não" e os 60 s correndo;
 *   ativa    → o controle grande (arrastar com o polegar), o tempo que falta e o tempo na meta;
 *   superada → a escolha da recompensa em dois botões.
 *
 * Só lê o sim (`resumoOcorrencia`) e despacha ações pelo store: nenhuma regra aqui.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { CONTROLE, OCORRENCIAS, OCORRENCIAS_DEF } from "../content/ocorrencias";
import { FAIXAS_CALOR } from "../content/era1-nucleo";
import { faixaDeCalor } from "../sim/calor";
import { formatarNumero, formatarPorcentagem, formatarPotencia } from "../sim/formatar";
import { resumoOcorrencia, type ResumoOcorrencia } from "../sim/ocorrencias";
import { corDaRampaCss } from "../scene/rampa";
import { useGameStore } from "../store/gameStore";

const segundos = (ms: number) => `${Math.ceil(ms / 1000)} s`;
const pct = (v: number) => `${formatarNumero(v * 100, 0)} %`;

/** "Carga das turbinas · 60 %" ou "Barras de controle · potência 70 %". */
export function rotuloDoControle(era: 1 | 2, valor: number): string {
  const c = CONTROLE[era];
  return `${c.nome} · ${c.rotuloValor ? `${c.rotuloValor} ` : ""}${pct(valor)}`;
}

/** A meta em palavras, para o cartão da oferta. */
function textoMeta(r: ResumoOcorrencia): string {
  const meta = r.def.meta;
  const quanto = `${formatarNumero(r.metaMs / 1000, 0)} s de ${r.def.duracaoS}`;
  if (meta.tipo === "potencia") return `potência entre ${pct(meta.de)} e ${pct(meta.ate)} da de agora por ${quanto}`;
  const ouro = FAIXAS_CALOR.find((f) => f.id === "ouro")!;
  const inicio = FAIXAS_CALOR[FAIXAS_CALOR.indexOf(ouro) - 1].ate;
  return `calor na zona de ouro (${pct(inicio)}–${pct(ouro.ate)}) por ${quanto}`;
}

/** As barras de controle entrando pelo topo do Vaso: potência baixa = barras mais inseridas (Parte 2 §5.4). */
function IconeBarras({ potencia }: { potencia: number }) {
  const c = CONTROLE[2];
  const insercao = (c.max - potencia) / (c.max - c.min); // 0 = retiradas, 1 = inseridas
  const topo = 6;
  const fundo = 38;
  const ponta = topo + 4 + insercao * (fundo - topo - 8);
  return (
    <svg className="controle-icone" viewBox="0 0 28 44" aria-hidden="true">
      <rect x="3" y={topo} width="22" height={fundo - topo} rx="7" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" />
      {[8, 14, 20].map((x) => (
        <line key={x} x1={x} x2={x} y1={0} y2={ponta} stroke="#9aa3c7" strokeWidth="2.4" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/**
 * O controle grande: horizontal na Torre (carga das turbinas), vertical no Reator (para cima = retirar barras =
 * mais potência). Arrasta com o dedo ou o mouse; setas, PageUp/PageDown, Home e End no teclado.
 */
function ControleGrande({ era, valor, onMudar }: { era: 1 | 2; valor: number; onMudar: (v: number) => void }) {
  const def = CONTROLE[era];
  const vertical = era === 2;
  const ref = useRef<HTMLDivElement>(null);
  const fracao = (valor - def.min) / (def.max - def.min);
  const fracaoCem = (1 - def.min) / (def.max - def.min);
  const arredondar = (v: number) => Math.min(def.max, Math.max(def.min, Math.round(v / def.passo) * def.passo));
  const valorDoPonteiro = (e: PointerEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect();
    const f = vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    return arredondar(def.min + Math.min(1, Math.max(0, f)) * (def.max - def.min));
  };
  const aoTocar = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onMudar(valorDoPonteiro(e));
  };
  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onMudar(valorDoPonteiro(e));
  };
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const passos: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
    if (e.key in passos) onMudar(arredondar(valor + passos[e.key] * def.passo));
    else if (e.key === "Home") onMudar(def.min);
    else if (e.key === "End") onMudar(def.max);
    else return;
    e.preventDefault();
  };
  const pos = (f: number) => (vertical ? { bottom: `${f * 100}%` } : { left: `${f * 100}%` });
  return (
    <div className={`controle controle--${vertical ? "vertical" : "horizontal"}`}>
      {vertical ? <IconeBarras potencia={valor} /> : null}
      <div
        ref={ref}
        className="controle-trilho"
        role="slider"
        tabIndex={0}
        aria-label={def.nome}
        aria-orientation={vertical ? "vertical" : "horizontal"}
        aria-valuemin={Math.round(def.min * 100)}
        aria-valuemax={Math.round(def.max * 100)}
        aria-valuenow={Math.round(valor * 100)}
        aria-valuetext={rotuloDoControle(era, valor)}
        data-controle={era === 2 ? "barras" : "carga"}
        onPointerDown={aoTocar}
        onPointerMove={aoMover}
        onKeyDown={aoTeclar}
      >
        <div className="controle-preenchido" style={vertical ? { height: `${fracao * 100}%` } : { width: `${fracao * 100}%` }} />
        <div className="controle-cem" style={pos(fracaoCem)} title="100 %" />
        <div className="controle-polegar" style={pos(fracao)} />
      </div>
    </div>
  );
}

/** Meta de potência (Seguimento de carga): a faixa-alvo, a potência agora e a de equilíbrio com as barras de agora. */
function BarraPotencia({ r }: { r: ResumoOcorrencia }) {
  if (r.def.meta.tipo !== "potencia" || !(r.potenciaRefKw > 0)) return null;
  const escala = 1.3;
  const pos = (razao: number) => `${Math.min(100, Math.max(0, (razao / escala) * 100))}%`;
  const agora = r.potenciaKw / r.potenciaRefKw;
  const eq = r.potenciaEquilibrioKw / r.potenciaRefKw;
  return (
    <div className="ocorrencia-potencia">
      <div className="barra-rotulo">
        <span>⚡ potência {pct(agora)} de {formatarPotencia(r.potenciaRefKw)}</span>
        <span className="barra-valor">alvo {pct(r.def.meta.de)}–{pct(r.def.meta.ate)}</span>
      </div>
      <div className="barra-calor-trilho">
        <div className="barra-calor-alvo" style={{ left: pos(r.def.meta.de), width: `calc(${pos(r.def.meta.ate)} - ${pos(r.def.meta.de)})` }} />
        <div className="barra-calor-preenchida" style={{ width: pos(agora), background: r.cumprindo ? "var(--leaf)" : "var(--sky)" }} />
        <div className="barra-calor-marca barra-calor-marca--viva" style={{ left: pos(eq) }} title={`Equilíbrio: ${pct(eq)}`} />
      </div>
    </div>
  );
}

function Oferta({ r }: { r: ResumoOcorrencia }) {
  const aceitar = useGameStore((s) => s.aceitarOcorrencia);
  const recusar = useGameStore((s) => s.recusarOcorrencia);
  return (
    <div className="ocorrencia ocorrencia--oferta" role="dialog" aria-label={`Ocorrência: ${r.def.nome}`} data-fase="oferta">
      <div className="ocorrencia-topo">
        <span className="ocorrencia-nome">
          🔥 {r.def.nome} · {r.def.duracaoS} s
        </span>
        <span className="ocorrencia-premio">
          🛡 +{OCORRENCIAS.recompensaEstabilidade} ou 🔬
        </span>
      </div>
      {r.causa ? <p className="ocorrencia-causa">{r.causa}</p> : null}
      <p className="ocorrencia-fisica">{r.def.fisica}</p>
      <p className="ocorrencia-meta">Meta: {textoMeta(r)}. Recusar não custa nada.</p>
      <div className="ocorrencia-acoes">
        <button type="button" className="pilula pilula--primaria" data-acao="aceitar-ocorrencia" onClick={aceitar}>
          Aceitar
        </button>
        <button type="button" className="pilula" data-acao="recusar-ocorrencia" onClick={recusar}>
          Agora não
        </button>
        <span className="ocorrencia-contagem" data-testid="contagem-oferta">
          expira em {segundos(r.restanteMs)}
        </span>
      </div>
      <div className="ocorrencia-relogio" aria-hidden="true">
        <span style={{ width: `${(1 - r.progresso) * 100}%` }} />
      </div>
    </div>
  );
}

function Ativa({ r, era }: { r: ResumoOcorrencia; era: 1 | 2 }) {
  const ajustar = useGameStore((s) => s.ajustarControle);
  const faixaEq = faixaDeCalor(r.tEquilibrio);
  const calor = r.def.meta.tipo === "calor";
  return (
    <div className={`ocorrencia ocorrencia--ativa ocorrencia--era${era}`} role="group" aria-label={`Ocorrência em curso: ${r.def.nome}`} data-fase="ativa">
      <div className="ocorrencia-topo">
        <span className="ocorrencia-nome">🔥 {r.def.nome}</span>
        <span className="ocorrencia-tempo" data-testid="tempo-ocorrencia">
          faltam {segundos(r.restanteMs)}
        </span>
      </div>
      <div className="ocorrencia-corpo">
        <div className="ocorrencia-controle">
          {era === 1 ? (
            <span className="ocorrencia-rotulo" data-testid="rotulo-controle">
              {rotuloDoControle(era, r.controle)}
            </span>
          ) : null}
          <ControleGrande era={era} valor={r.controle} onMudar={ajustar} />
        </div>
        <div className="ocorrencia-leituras">
          {era === 2 ? (
            <span className="ocorrencia-rotulo" data-testid="rotulo-controle">
              {rotuloDoControle(era, r.controle)}
            </span>
          ) : null}
          {calor ? (
            <span className="ocorrencia-t">
              T {formatarPorcentagem(r.t)} → equilíbrio{" "}
              <strong style={{ color: corDaRampaCss(Math.min(1, r.tEquilibrio)) }} data-testid="t-equilibrio">
                {Number.isFinite(r.tEquilibrio) ? formatarPorcentagem(r.tEquilibrio) : "∞"}
              </strong>{" "}
              {faixaEq.id === "ouro" ? "· no ouro" : `· ${faixaEq.nome.toLowerCase()}`}
            </span>
          ) : null}
          <span className={`ocorrencia-na-meta ${r.cumprindo ? "ocorrencia-na-meta--sim" : ""}`} data-testid="na-meta">
            na meta {formatarNumero(r.naMetaMs / 1000, 0)} s de {formatarNumero(r.metaMs / 1000, 0)} s
            {r.aindaDa ? "" : " · não dá mais"}
          </span>
          <span className="ocorrencia-meta-barra" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (r.naMetaMs / r.metaMs) * 100)}%` }} />
          </span>
          <span className="ocorrencia-dica">{CONTROLE[era].dica}</span>
        </div>
      </div>
      <BarraPotencia r={r} />
    </div>
  );
}

function Recompensa() {
  const pendente = useGameStore((s) => s.state.ocorrencia.recompensa);
  const escolher = useGameStore((s) => s.escolherRecompensa);
  if (!pendente) return null;
  const def = OCORRENCIAS_DEF[pendente.id];
  return (
    <div className="ocorrencia ocorrencia--superada" role="dialog" aria-label="Escolha a recompensa" data-fase="superada">
      <div className="ocorrencia-topo">
        <span className="ocorrencia-nome">✓ {def.nome}: superada</span>
      </div>
      <p className="ocorrencia-meta">Escolha a recompensa — pegue o que está travando você.</p>
      <div className="ocorrencia-acoes">
        <button type="button" className="pilula pilula--primaria" data-acao="recompensa-estabilidade" onClick={() => escolher("estabilidade")}>
          🛡 +{OCORRENCIAS.recompensaEstabilidade} Estabilidade
        </button>
        <button type="button" className="pilula pilula--primaria" data-acao="recompensa-pesquisa" onClick={() => escolher("pesquisa")}>
          🔬 +{formatarNumero(pendente.pesquisa, pendente.pesquisa < 100 ? 1 : 0)}
        </button>
      </div>
    </div>
  );
}

export function CartaoOcorrencia() {
  const state = useGameStore((s) => s.state);
  if (state.ocorrencia.recompensa) return <Recompensa />;
  const r = resumoOcorrencia(state);
  if (!r || !state.nucleo) return null;
  return r.fase === "oferta" ? <Oferta r={r} /> : <Ativa r={r} era={state.nucleo.era} />;
}
