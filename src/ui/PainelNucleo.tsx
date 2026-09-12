import { useEffect, useRef } from "react";
import { MELHORIAS, ORDEM_MELHORIAS } from "../content/era1";
import { CASCATA, FAIXAS_CALOR, MODO_SEGURO, NUCLEO, ORDEM_PECAS, PECAS, RECEPTOR_CERAMICO } from "../content/era1-nucleo";
import { podeComprarReceptorCeramico, podeDesbloquearNucleo } from "../sim/acoesNucleo";
import { dicaDeEquilibrio, faixaDeCalor, pesquisaPorSegundo, temperatura, temperaturaNucleo } from "../sim/calor";
import { custoReconstrucao, faltaParaLimpezaMs, podeLimparEntulho } from "../sim/cascata";
import { faltaParaAvancar } from "../sim/era";
import { formatarCalor, formatarCreditos, formatarNumero, formatarPorcentagem, formatarPotencia, formatarSegundos } from "../sim/formatar";
import { calorPorEspelho, podeComprarMelhoria } from "../sim/melhorias";
import { capacidadeU, contar, equilibrioU, aquecedoresEfetivos } from "../sim/nucleo";
import type { NucleoState } from "../sim/state";
import { potenciaNucleoEfetivaKw } from "../sim/tick";
import { indiceDaCasa, setGradeElement, setPalcoElement } from "../scene/layout";
import { corDaRampaCss } from "../scene/rampa";
import { useGameStore, type Ferramenta } from "../store/gameStore";

/** O aviso de casa recusada some sozinho; o painel re-renderiza a cada tick. */
const DURACAO_AVISO_MS = 4000;
/** Um toque que andou mais do que isto entre pointerdown e pointerup é rolagem, não clique. */
const LIMIAR_ARRASTO_PX = 8;

function Bloqueado() {
  const state = useGameStore((s) => s.state);
  const desbloquear = useGameStore((s) => s.desbloquearNucleo);
  const pode = podeDesbloquearNucleo(state);
  return (
    <section className="palco palco--bloqueado" aria-label="Núcleo">
      <h2>Núcleo · Torre Solar</h2>
      <p className="palco-texto">
        Uma torre com um Receptor no centro e espelhos em volta. Turbinas transformam o calor em potência e em 🔬 Pesquisa,
        que destrava a Bateria e a Turbina eólica. Calor demais por 5 s dispara a Cascata.
      </p>
      <button type="button" className={`pilula pilula--primaria ${pode ? "pilula--brilho" : ""}`} disabled={!pode} onClick={desbloquear}>
        <span>Desbloquear o Núcleo</span>
        <span className={`pilula-custo ${pode ? "" : "pilula-custo--caro"}`}>{formatarCreditos(NUCLEO.custoDesbloqueio)}</span>
      </button>
    </section>
  );
}

/**
 * Área da grade. O Phaser só desenha nela; o input é do DOM: `pointerup` decide a
 * casa pelo `getBoundingClientRect()` e despacha `agirNaCasa`. `touch-action: pan-y`
 * deixa o dedo rolar a página por cima da grade.
 */
function GradeArea() {
  const ref = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; y: number; id: number } | null>(null);
  const agirNaCasa = useGameStore((s) => s.agirNaCasa);
  const setCasaSobPonteiro = useGameStore((s) => s.setCasaSobPonteiro);
  const lado = useGameStore((s) => s.state.nucleo?.lado ?? NUCLEO.ladoInicial);

  useEffect(() => {
    setGradeElement(ref.current);
    return () => setGradeElement(null);
  }, []);

  const casaDoEvento = (e: React.PointerEvent<HTMLDivElement>): number | null => {
    const el = ref.current;
    if (!el) return null;
    return indiceDaCasa(e.clientX, e.clientY, el.getBoundingClientRect(), lado);
  };

  return (
    <div
      ref={ref}
      className={`grade-area grade-area--${lado}`}
      role="grid"
      aria-label="Grade do Núcleo"
      onPointerDown={(e) => {
        inicio.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      }}
      onPointerUp={(e) => {
        const i0 = inicio.current;
        inicio.current = null;
        if (!i0 || i0.id !== e.pointerId) return;
        if (Math.hypot(e.clientX - i0.x, e.clientY - i0.y) > LIMIAR_ARRASTO_PX) return;
        const indice = casaDoEvento(e);
        if (indice !== null) agirNaCasa(indice);
      }}
      onPointerCancel={() => {
        inicio.current = null;
      }}
      onPointerMove={(e) => setCasaSobPonteiro(casaDoEvento(e))}
      onPointerLeave={() => setCasaSobPonteiro(null)}
    />
  );
}

const TEXTO_DICA = {
  adicionarEspelhos: "Adicione espelhos: a marca sobe.",
  tirarEspelho: "Tire um espelho ou ponha um radiador.",
} as const;

function BarraCalor({ nucleo, calorEspelho }: { nucleo: NucleoState; calorEspelho: number }) {
  const t = temperaturaNucleo(nucleo);
  const faixa = faixaDeCalor(t);
  const capacidade = capacidadeU(nucleo.grade, nucleo.receptorCeramico);
  const qEq = equilibrioU(nucleo.grade, calorEspelho);
  const tEq = temperatura(qEq, capacidade);
  const dica = dicaDeEquilibrio(tEq);
  const escalaMax = 1.2;
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / escalaMax) * 100))}%`;
  const critico = faixa.id === "critico";
  const faltaMs = Math.max(0, CASCATA.atrasoMs - nucleo.tempoAcimaDoLimiteMs);

  return (
    <div className={`barra-calor barra-calor--${faixa.id}`}>
      <div className="barra-rotulo">
        <span>🔥 Calor · {faixa.nome.toLowerCase()}</span>
        <span className="barra-valor" style={{ color: corDaRampaCss(Math.min(1, t)) }}>
          {formatarPorcentagem(t)} · {formatarCalor(nucleo.calorU)} / {formatarCalor(capacidade)}
        </span>
      </div>
      <div className="barra-calor-trilho" role="meter" aria-valuemin={0} aria-valuemax={escalaMax} aria-valuenow={t}>
        {FAIXAS_CALOR.map((f, i) => {
          const de = i === 0 ? 0 : FAIXAS_CALOR[i - 1].ate;
          const ate = Number.isFinite(f.ate) ? f.ate : escalaMax;
          return <div key={f.id} className={`barra-calor-faixa barra-calor-faixa--${f.id}`} style={{ left: pos(de), width: `calc(${pos(ate)} - ${pos(de)})` }} title={`${f.nome}: pesquisa ×${formatarNumero(f.pesquisa, 2)}`} />;
        })}
        <div className="barra-calor-preenchida" style={{ width: pos(t), background: corDaRampaCss(Math.min(1, t)) }} />
        {Number.isFinite(tEq) && tEq > 0 ? <div className="barra-calor-marca" style={{ left: pos(tEq) }} title={`Equilíbrio: ${formatarPorcentagem(tEq)}`} /> : null}
        <div className="barra-calor-limite" style={{ left: pos(1) }} />
      </div>
      <div className="barra-legenda">
        <span className="barra-sub">
          {critico
            ? `acima de 100 %: Cascata em ${formatarSegundos(faltaMs)}`
            : Number.isFinite(qEq)
              ? `equilíbrio Q* = ${formatarCalor(qEq)} (${formatarPorcentagem(tEq)})`
              : "sem turbinas: o calor só sobe"}
        </span>
        {dica ? <span className="barra-dica">{TEXTO_DICA[dica]}</span> : null}
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

/**
 * Portão da era nova (GDD §8.4). Só aparece quando há era seguinte; enquanto o
 * portão não abre, diz o que falta em vez de só ficar desabilitado.
 */
function BotaoProximaEra() {
  const state = useGameStore((s) => s.state);
  const avancar = useGameStore((s) => s.avancarEra);
  const falta = faltaParaAvancar(state);
  if (!falta) return null;

  const pronto = falta.estabilidade === 0 && falta.pesquisa === 0 && falta.creditos === 0;
  const pendencias = [
    falta.estabilidade > 0 ? `🛡 ${formatarNumero(falta.estabilidade, 1)}` : null,
    falta.pesquisa > 0 ? `🔬 ${formatarNumero(falta.pesquisa, 0)}` : null,
    falta.creditos > 0 ? `₵ ${formatarNumero(falta.creditos, 0)}` : null,
  ].filter(Boolean);

  return (
    <div className="proxima-era">
      <button type="button" className={`pilula ${pronto ? "pilula--primaria" : ""}`} disabled={!pronto} onClick={avancar}>
        Avançar para a Era {state.era + 1}
      </button>
      {pronto ? null : <span className="proxima-era-falta">Falta {pendencias.join(" · ")}</span>}
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
        <button key={o.id} type="button" role="radio" aria-checked={ferramenta === o.id} className={`pilula ${ferramenta === o.id ? "pilula--ativa" : ""}`} title={o.descricao} onClick={() => selecionar(o.id)}>
          <span>{o.nome}</span>
          {o.custo !== null ? <span className={`pilula-custo ${state.creditos < o.custo ? "pilula-custo--caro" : ""}`}>{formatarCreditos(o.custo)}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Entulhos({ nucleo, tempoMs }: { nucleo: NucleoState; tempoMs: number }) {
  const entulhos = nucleo.grade.map((casa, i) => ({ casa, i })).filter((e): e is { casa: Extract<NonNullable<NucleoState["grade"][number]>, { tipo: "entulho" }>; i: number } => e.casa?.tipo === "entulho");
  if (entulhos.length === 0) return null;
  const gratis = entulhos.filter((e) => podeLimparEntulho(e.casa, tempoMs)).length;
  const maisProximo = Math.min(...entulhos.map((e) => faltaParaLimpezaMs(e.casa, tempoMs)));
  const custoTotal = entulhos.reduce((soma, e) => soma + custoReconstrucao(e.casa), 0);
  return (
    <p className="nucleo-entulho">
      {entulhos.length} entulho{entulhos.length > 1 ? "s" : ""}: clique para reconstruir por 50 % ({formatarCreditos(custoTotal)} no total)
      {gratis > 0 ? ` · ${gratis} já limpa${gratis > 1 ? "m" : ""} de graça` : ` · limpeza grátis em ${formatarSegundos(maisProximo)}`}
    </p>
  );
}

function Operacao({ nucleo }: { nucleo: NucleoState }) {
  const state = useGameStore((s) => s.state);
  const scramManual = useGameStore((s) => s.scramManual);
  const alternarModoSeguro = useGameStore((s) => s.alternarModoSeguro);
  const comprarReceptorCeramico = useGameStore((s) => s.comprarReceptorCeramico);
  const comprarMelhoria = useGameStore((s) => s.comprarMelhoria);
  const aviso = useGameStore((s) => s.avisoGrade);

  const potencia = potenciaNucleoEfetivaKw(nucleo);
  const t = temperaturaNucleo(nucleo);
  const emScram = nucleo.scramRestanteMs > 0;
  const c = contar(nucleo.grade);
  const calorEspelho = calorPorEspelho(state.melhorias);

  return (
    <>
      <GradeArea />
      {emScram ? (
        <p className="nucleo-scram">SCRAM · Núcleo desligado por {formatarSegundos(nucleo.scramRestanteMs)}. Espelhos e turbinas parados; radiadores esfriando.</p>
      ) : null}
      <BarraCalor nucleo={nucleo} calorEspelho={calorEspelho} />
      <p className="nucleo-status">
        <span>⚡ Núcleo {formatarPotencia(potencia)}</span>
        <span>🔬 +{formatarNumero(emScram ? 0 : pesquisaPorSegundo(potencia, t), 2)}/s</span>
        <span>
          h = {formatarNumero(aquecedoresEfetivos(nucleo.grade), 2)} · t = {c.conversores} · rad = {c.dissipadoresAdjacentes} · {formatarNumero(calorEspelho, 0)} u/s por espelho
        </span>
        {nucleo.cascatas > 0 ? <span>💥 {nucleo.cascatas} cascata{nucleo.cascatas > 1 ? "s" : ""}</span> : null}
      </p>
      <Entulhos nucleo={nucleo} tempoMs={state.tempoMs} />
      <SeletorPecas />
      {aviso && state.tempoMs - aviso.emTempoMs < DURACAO_AVISO_MS ? <p className="aviso aviso--erro nucleo-aviso">{aviso.texto}</p> : null}
      <BarraEstabilidade nucleo={nucleo} />
      <BotaoProximaEra />
      <div className="nucleo-controles">
        <button type="button" className="pilula pilula--perigo" disabled={emScram} onClick={scramManual} title={`Desliga o Núcleo por ${formatarSegundos(CASCATA.scramMs)}`}>
          SCRAM manual
        </button>
        <button type="button" className={`pilula ${nucleo.modoSeguro ? "pilula--ativa" : ""}`} role="switch" aria-checked={nucleo.modoSeguro} onClick={alternarModoSeguro} title={`SCRAM automático a ${formatarPorcentagem(MODO_SEGURO.limiarT)}, potência ×${formatarNumero(MODO_SEGURO.fatorPotencia, 1)}`}>
          Modo seguro {nucleo.modoSeguro ? "ligado" : "desligado"}
        </button>
        {ORDEM_MELHORIAS.filter((id) => MELHORIAS[id].camada === "nucleo").map((id) => {
          const def = MELHORIAS[id];
          if (state.melhorias[id]) {
            return (
              <span key={id} className="marca-comprado">
                ✔ {def.nome}
              </span>
            );
          }
          const caro = state.creditos < def.custo || state.pesquisa < (def.pesquisa ?? 0);
          return (
            <button key={id} type="button" className="pilula" disabled={!podeComprarMelhoria(state, id)} onClick={() => comprarMelhoria(id)} title={def.descricao}>
              <span>{def.nome}</span>
              <span className={`pilula-custo ${caro ? "pilula-custo--caro" : ""}`}>
                {formatarCreditos(def.custo)}
                {def.pesquisa !== undefined ? ` · 🔬 ${def.pesquisa}` : ""}
              </span>
            </button>
          );
        })}
        {nucleo.receptorCeramico ? (
          <span className="marca-comprado">✔ {RECEPTOR_CERAMICO.nome}</span>
        ) : (
          <button type="button" className="pilula" disabled={!podeComprarReceptorCeramico(state)} onClick={comprarReceptorCeramico} title={RECEPTOR_CERAMICO.descricao}>
            <span>{RECEPTOR_CERAMICO.nome}</span>
            <span className={`pilula-custo ${state.creditos < RECEPTOR_CERAMICO.custo || state.pesquisa < RECEPTOR_CERAMICO.pesquisa ? "pilula-custo--caro" : ""}`}>
              {formatarCreditos(RECEPTOR_CERAMICO.custo)} · 🔬 {RECEPTOR_CERAMICO.pesquisa}
            </span>
          </button>
        )}
      </div>
    </>
  );
}

function Palco({ nucleo }: { nucleo: NucleoState }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    setPalcoElement(ref.current);
    return () => setPalcoElement(null);
  }, []);
  return (
    <section ref={ref} className="palco" aria-label="Núcleo">
      <Operacao nucleo={nucleo} />
    </section>
  );
}

export function PainelNucleo() {
  const nucleo = useGameStore((s) => s.state.nucleo);
  if (!nucleo) return <Bloqueado />;
  return <Palco nucleo={nucleo} />;
}
