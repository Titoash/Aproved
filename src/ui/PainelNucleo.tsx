import { useEffect, useRef } from "react";
import { CASCATA, FAIXAS_CALOR, MODO_SEGURO, NUCLEO, ORDEM_PECAS, PECAS, RECEPTOR_CERAMICO } from "../content/era1-nucleo";
import { custoReconstrucao, faltaParaLimpezaMs, podeLimparEntulho } from "../sim/cascata";
import {
  formatarCalor,
  formatarCreditos,
  formatarNumero,
  formatarPorcentagem,
  formatarPotencia,
  formatarSegundos,
} from "../sim/formatar";
import { faixaDeCalor, pesquisaPorSegundo, temperatura, temperaturaNucleo } from "../sim/calor";
import { podeComprarReceptorCeramico, podeDesbloquearNucleo } from "../sim/acoesNucleo";
import { capacidadeU, contar, equilibrioU, espelhosEfetivos } from "../sim/nucleo";
import type { NucleoState } from "../sim/state";
import { potenciaNucleoEfetivaKw } from "../sim/tick";
import { setGradeElement } from "../scene/layout";
import { corDaRampaCss } from "../scene/rampa";
import { useGameStore, type Ferramenta } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";

function CardDesbloqueio() {
  const state = useGameStore((s) => s.state);
  const desbloquear = useGameStore((s) => s.desbloquearNucleo);
  return (
    <section className="painel painel-nucleo" aria-label="Núcleo">
      <h2>Núcleo · Torre Solar</h2>
      <article className="card">
        <div className="card-cabecalho">
          <h3>🔒 Torre Solar</h3>
        </div>
        <p className="card-desc">
          Uma torre com um Receptor no centro e espelhos em volta. Turbinas transformam o calor em potência e em
          🔬 Pesquisa, que destrava a Bateria e a Turbina eólica. Calor demais por 5 s dispara a Cascata.
        </p>
        <div className="card-botoes">
          <BotaoCompra
            titulo="Desbloquear o Núcleo"
            custo={NUCLEO.custoDesbloqueio}
            creditos={state.creditos}
            habilitado={podeDesbloquearNucleo(state)}
            onClick={desbloquear}
          />
        </div>
      </article>
    </section>
  );
}

function GradeArea() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setGradeElement(ref.current);
    return () => setGradeElement(null);
  }, []);
  return <div ref={ref} className="grade-area" aria-label="Grade do Núcleo (desenhada no canvas)" />;
}

function BarraCalor({ nucleo }: { nucleo: NucleoState }) {
  const t = temperaturaNucleo(nucleo);
  const faixa = faixaDeCalor(t);
  const capacidade = capacidadeU(nucleo.grade, nucleo.receptorCeramico);
  const qEq = equilibrioU(nucleo.grade);
  const tEq = temperatura(qEq, capacidade);
  const escalaMax = 1.2;
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / escalaMax) * 100))}%`;
  const critico = faixa.id === "critico";
  const faltaMs = Math.max(0, CASCATA.atrasoMs - nucleo.tempoAcimaDoLimiteMs);

  return (
    <div className={`barra-calor barra-calor--${faixa.id}`}>
      <div className="barra-rotulo">
        <span>🔥 Calor</span>
        <span className="barra-valor" style={{ color: corDaRampaCss(Math.min(1, t)) }}>
          {formatarPorcentagem(t)} · {formatarCalor(nucleo.calorU)} / {formatarCalor(capacidade)}
        </span>
      </div>
      <div className="barra-calor-trilho" role="meter" aria-valuemin={0} aria-valuemax={escalaMax} aria-valuenow={t}>
        {FAIXAS_CALOR.map((f, i) => {
          const de = i === 0 ? 0 : FAIXAS_CALOR[i - 1].ate;
          const ate = Number.isFinite(f.ate) ? f.ate : escalaMax;
          return (
            <div
              key={f.id}
              className={`barra-calor-faixa barra-calor-faixa--${f.id}`}
              style={{ left: pos(de), width: `calc(${pos(ate)} - ${pos(de)})` }}
              title={`${f.nome}: pesquisa ×${formatarNumero(f.pesquisa, 2)}`}
            />
          );
        })}
        <div className="barra-calor-preenchida" style={{ width: pos(t), background: corDaRampaCss(Math.min(1, t)) }} />
        {Number.isFinite(tEq) && tEq > 0 ? (
          <div className="barra-calor-marca" style={{ left: pos(tEq) }} title={`Equilíbrio: ${formatarPorcentagem(tEq)}`} />
        ) : null}
        <div className="barra-calor-limite" style={{ left: pos(1) }} />
      </div>
      <div className="barra-legenda">
        <span className={`faixa-chip faixa-chip--calor-${faixa.id}`}>
          {faixa.nome} · 🔬 ×{formatarNumero(faixa.pesquisa, 2)}
        </span>
        <span className="barra-sub">
          {critico
            ? `⚠ acima de 100 %: Cascata em ${formatarSegundos(faltaMs)}`
            : Number.isFinite(qEq)
              ? `equilíbrio Q* = ${formatarCalor(qEq)} (${formatarPorcentagem(tEq)})`
              : "sem turbinas: o calor só sobe"}
        </span>
      </div>
    </div>
  );
}

function BarraEstabilidade({ nucleo }: { nucleo: NucleoState }) {
  return (
    <div className="barra-estabilidade">
      <div className="barra-rotulo">
        <span>🛡 Estabilidade</span>
        <span className="barra-valor">{formatarPorcentagem(nucleo.estabilidade / 100, 1)}</span>
      </div>
      <div className="barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nucleo.estabilidade}>
        <div className="barra-preenchida barra-preenchida--estabilidade" style={{ width: `${nucleo.estabilidade}%` }} />
      </div>
    </div>
  );
}

function SeletorPecas() {
  const state = useGameStore((s) => s.state);
  const ferramenta = useGameStore((s) => s.ferramenta);
  const selecionar = useGameStore((s) => s.selecionarFerramenta);
  const opcoes: { id: Ferramenta; nome: string; custo: number | null; descricao: string }[] = [
    ...ORDEM_PECAS.map((id) => ({ id, nome: PECAS[id].nome, custo: PECAS[id].custo, descricao: PECAS[id].descricao })),
    { id: "remover", nome: "Remover", custo: null, descricao: "Tira a peça da casa (sem reembolso)." },
  ];
  return (
    <div className="seletor-pecas" role="radiogroup" aria-label="Peça para colocar">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={ferramenta === o.id}
          className={`botao botao--peca ${ferramenta === o.id ? "botao--ativo" : ""} ${o.custo !== null && state.creditos < o.custo ? "botao--caro" : ""}`}
          title={o.descricao}
          onClick={() => selecionar(o.id)}
        >
          <span className="botao-titulo">{o.nome}</span>
          <span className="botao-custo">{o.custo === null ? "—" : formatarCreditos(o.custo)}</span>
        </button>
      ))}
    </div>
  );
}

function Entulhos({ nucleo, tempoMs }: { nucleo: NucleoState; tempoMs: number }) {
  const entulhos = nucleo.grade
    .map((casa, i) => ({ casa, i }))
    .filter((e): e is { casa: Extract<NonNullable<NucleoState["grade"][number]>, { tipo: "entulho" }>; i: number } => e.casa?.tipo === "entulho");
  if (entulhos.length === 0) return null;
  const gratis = entulhos.filter((e) => podeLimparEntulho(e.casa, tempoMs)).length;
  const maisProximo = Math.min(...entulhos.map((e) => faltaParaLimpezaMs(e.casa, tempoMs)));
  const custoTotal = entulhos.reduce((soma, e) => soma + custoReconstrucao(e.casa), 0);
  return (
    <div className="nucleo-entulho">
      🪨 {entulhos.length} entulho{entulhos.length > 1 ? "s" : ""}: clique para reconstruir por 50 % (
      {formatarCreditos(custoTotal)} no total)
      {gratis > 0 ? ` · ${gratis} já limpa${gratis > 1 ? "m" : ""} de graça` : ` · limpeza grátis em ${formatarSegundos(maisProximo)}`}
    </div>
  );
}

function PainelOperacao({ nucleo }: { nucleo: NucleoState }) {
  const state = useGameStore((s) => s.state);
  const scramManual = useGameStore((s) => s.scramManual);
  const alternarModoSeguro = useGameStore((s) => s.alternarModoSeguro);
  const comprarReceptorCeramico = useGameStore((s) => s.comprarReceptorCeramico);
  const aviso = useGameStore((s) => s.avisoGrade);

  const potencia = potenciaNucleoEfetivaKw(nucleo);
  const t = temperaturaNucleo(nucleo);
  const emScram = nucleo.scramRestanteMs > 0;
  const c = contar(nucleo.grade);

  return (
    <>
      <div className="nucleo-status">
        <span>⚡ Núcleo {formatarPotencia(potencia)}</span>
        <span>🔬 +{formatarNumero(emScram ? 0 : pesquisaPorSegundo(potencia, t), 2)}/s</span>
        <span>
          h = {formatarNumero(espelhosEfetivos(nucleo.grade), 1)} · t = {c.turbinas} · rad = {c.radiadoresAdjacentes}
        </span>
        {nucleo.cascatas > 0 ? <span>💥 {nucleo.cascatas} cascata{nucleo.cascatas > 1 ? "s" : ""}</span> : null}
      </div>
      {emScram ? (
        <div className="nucleo-scram">
          ⛔ SCRAM · Núcleo desligado por {formatarSegundos(nucleo.scramRestanteMs)} — espelhos e turbinas parados, radiadores
          esfriando.
        </div>
      ) : null}
      <BarraCalor nucleo={nucleo} />
      <BarraEstabilidade nucleo={nucleo} />
      <Entulhos nucleo={nucleo} tempoMs={state.tempoMs} />
      <h3 className="nucleo-subtitulo">Peças · clique na grade para colocar</h3>
      <SeletorPecas />
      {aviso ? <div className="aviso aviso--erro">{aviso.texto}</div> : null}
      <div className="card-botoes nucleo-controles">
        <button type="button" className="botao botao--perigo" disabled={emScram} onClick={scramManual}>
          <span className="botao-titulo">SCRAM manual</span>
          <span className="botao-custo">desliga por {formatarSegundos(CASCATA.scramMs)}</span>
        </button>
        <button
          type="button"
          className={`botao botao--secundario ${nucleo.modoSeguro ? "botao--ativo" : ""}`}
          role="switch"
          aria-checked={nucleo.modoSeguro}
          onClick={alternarModoSeguro}
        >
          <span className="botao-titulo">Modo seguro {nucleo.modoSeguro ? "ligado" : "desligado"}</span>
          <span className="botao-custo">
            SCRAM a {formatarPorcentagem(MODO_SEGURO.limiarT)} · potência ×{formatarNumero(MODO_SEGURO.fatorPotencia, 1)}
          </span>
        </button>
        {nucleo.receptorCeramico ? (
          <div className="card-nota">✔ {RECEPTOR_CERAMICO.nome}: +{RECEPTOR_CERAMICO.capacidadeExtraU} u</div>
        ) : (
          <button
            type="button"
            className="botao botao--melhoria"
            disabled={!podeComprarReceptorCeramico(state)}
            onClick={comprarReceptorCeramico}
            title={RECEPTOR_CERAMICO.descricao}
          >
            <span className="botao-titulo">{RECEPTOR_CERAMICO.nome}</span>
            <span className={`botao-custo ${state.creditos < RECEPTOR_CERAMICO.custo || state.pesquisa < RECEPTOR_CERAMICO.pesquisa ? "botao-custo--caro" : ""}`}>
              {formatarCreditos(RECEPTOR_CERAMICO.custo)} + 🔬 {RECEPTOR_CERAMICO.pesquisa}
            </span>
          </button>
        )}
      </div>
    </>
  );
}

export function PainelNucleo() {
  const nucleo = useGameStore((s) => s.state.nucleo);
  if (!nucleo) return <CardDesbloqueio />;
  return (
    <div className="coluna-nucleo">
      <GradeArea />
      <section className="painel painel-nucleo" aria-label="Núcleo">
        <h2>Núcleo · Torre Solar</h2>
        <PainelOperacao nucleo={nucleo} />
      </section>
    </div>
  );
}
