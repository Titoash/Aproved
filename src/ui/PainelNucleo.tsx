import { useEffect, useRef } from "react";
import { CASCATA, FAIXAS_CALOR, MODO_SEGURO, NUCLEO } from "../content/era1-nucleo";
import { REATOR, SCRAM_ERA2, VARETA } from "../content/era2-nucleo";
import { PECA_POR_ID, ordemDasPecas } from "../content/pecas";
import { pecaDisponivel, podeDesbloquearNucleo } from "../sim/acoesNucleo";
import { avaliarConstruirReator, era3Pronta } from "../sim/era";
import { contarReator, esperaParaTrocaMs } from "../sim/reator";
import { equilibrioMotor, motorDoNucleo } from "../sim/motor";
import { dicaDeEquilibrio, faixaDeCalor, pesquisaPorSegundo, temperatura, temperaturaNucleo } from "../sim/calor";
import { custoReconstrucao, faltaParaLimpezaMs, podeLimparEntulho } from "../sim/cascata";
import { formatarCalor, formatarCreditos, formatarNumero, formatarPorcentagem, formatarPotencia, formatarSegundos } from "../sim/formatar";
import { efeitosDe, type EfeitosArvore } from "../sim/arvore";
import { contar, espelhosEfetivos } from "../sim/nucleo";
import type { NucleoState } from "../sim/state";
import { potenciaNucleoEfetivaKw } from "../sim/tick";
import { setPalcoElement } from "../scene/layout";
import { anexarPalco } from "../scene/tabuleiro/controle";
import { CalloutCasa } from "./CalloutCasa";
import { CalloutPeca } from "./CalloutPeca";
import { Escada } from "./Escada";
import { corDaRampaCss } from "../scene/rampa";
import { useGameStore, type Ferramenta } from "../store/gameStore";

/** O aviso de casa recusada some sozinho; o painel re-renderiza a cada tick. */
const DURACAO_AVISO_MS = 4000;

function Bloqueado() {
  const state = useGameStore((s) => s.state);
  const desbloquear = useGameStore((s) => s.desbloquearNucleo);
  const pode = podeDesbloquearNucleo(state);
  return (
    <div className="palco palco--bloqueado">
      <h2>Núcleo · Torre Solar</h2>
      <p className="palco-texto">
        Uma torre com um Receptor no centro e espelhos em volta. Turbinas transformam o calor em potência e em 🔬 Pesquisa,
        que destrava a Bateria e a Turbina eólica. Calor demais por 5 s dispara a Cascata.
      </p>
      <button type="button" className={`pilula pilula--primaria ${pode ? "pilula--brilho" : ""}`} disabled={!pode} onClick={desbloquear}>
        <span>Desbloquear o Núcleo</span>
        <span className={`pilula-custo ${pode ? "" : "pilula-custo--caro"}`}>{formatarCreditos(NUCLEO.custoDesbloqueio)}</span>
      </button>
    </div>
  );
}

/**
 * Superfície do tabuleiro. O Phaser desenha atrás, recortado a este retângulo; o input é do DOM:
 * o controle de câmera trata pan, zoom, pinch e toque, e despacha para o store.
 */
function TabuleiroArea() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPalcoElement(el);
    const soltar = anexarPalco(el);
    return () => {
      soltar();
      setPalcoElement(null);
    };
  }, []);
  return <div ref={ref} className="tabuleiro-area" role="application" aria-label="Ilha-tabuleiro: arraste para mover, role ou pince para aproximar" />;
}

function ControlesTabuleiro() {
  const nivel = useGameStore((s) => s.nivel);
  const pedirPreset = useGameStore((s) => s.pedirPreset);
  const temNucleo = useGameStore((s) => s.state.nucleo !== null);
  return (
    <div className="tabuleiro-controles" role="group" aria-label="Enquadramento">
      <button type="button" className={`pilula pilula--mini ${nivel === "ilha" ? "pilula--ativa" : ""}`} onClick={() => pedirPreset("ilha")}>
        Ilha
      </button>
      <button type="button" className="pilula pilula--mini" disabled={!temNucleo} onClick={() => pedirPreset("nucleo")}>
        Núcleo
      </button>
    </div>
  );
}

/** O palco da ilha: escada de escalas à esquerda, superfície do tabuleiro, controles no canto. */
function Tabuleiro() {
  return (
    <div className="tabuleiro">
      <Escada />
      <TabuleiroArea />
      <ControlesTabuleiro />
      <CalloutCasa />
      <CalloutPeca />
    </div>
  );
}

/** A dica da barra de calor fala a língua da era: espelhos e radiador na 1, varetas e torre na 2. */
const TEXTO_DICA: Record<1 | 2, Record<"adicionarEspelhos" | "tirarEspelho", string>> = {
  1: {
    adicionarEspelhos: "Adicione espelhos: a marca sobe.",
    tirarEspelho: "Tire um espelho ou ponha um radiador.",
  },
  2: {
    adicionarEspelhos: "Adicione varetas: a marca sobe.",
    tirarEspelho: "Tire uma vareta ou ponha uma torre de resfriamento.",
  },
};

function BarraCalor({ nucleo, efeitos, tempoMs }: { nucleo: NucleoState; efeitos: EfeitosArvore; tempoMs: number }) {
  const t = temperaturaNucleo(nucleo);
  const faixa = faixaDeCalor(t);
  const motor = motorDoNucleo(nucleo, efeitos, tempoMs);
  const capacidade = motor.capacidadeU;
  const qEq = equilibrioMotor(motor);
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
              : nucleo.era === 2
                ? "sem turbinas: o calor só sobe"
                : "sem turbinas: o calor só sobe"}
        </span>
        {dica ? <span className="barra-dica">{TEXTO_DICA[nucleo.era][dica]}</span> : null}
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

function SeletorPecas({ era }: { era: 1 | 2 }) {
  const state = useGameStore((s) => s.state);
  const ferramenta = useGameStore((s) => s.ferramenta);
  const selecionar = useGameStore((s) => s.selecionarFerramenta);
  const opcoes: { id: Ferramenta; nome: string; custo: number | null; descricao: string; bloqueada?: boolean }[] = [
    ...ordemDasPecas(era).map((id) => ({
      id,
      nome: PECA_POR_ID[id].nome,
      custo: PECA_POR_ID[id].custo,
      descricao: PECA_POR_ID[id].descricao,
      bloqueada: !pecaDisponivel(state, id),
    })),
    { id: "remover" as Ferramenta, nome: "Remover", custo: null, descricao: "Tira a peça da casa (sem reembolso)." },
  ];
  const atual = opcoes.find((o) => o.id === ferramenta);
  return (
    <>
      <div className="seletor-pecas" role="radiogroup" aria-label="Peça para colocar">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ferramenta === o.id}
            disabled={o.bloqueada}
            className={`pilula ${ferramenta === o.id ? "pilula--ativa" : ""}`}
            title={o.bloqueada ? `${o.descricao} · pesquise o nó da árvore para liberar` : o.descricao}
            onClick={() => selecionar(o.id)}
          >
            <span>{o.nome}</span>
            {o.custo !== null ? <span className={`pilula-custo ${state.creditos < o.custo ? "pilula-custo--caro" : ""}`}>{formatarCreditos(o.custo)}</span> : null}
          </button>
        ))}
      </div>
      {/* Tooltip de uma frase com os números da peça selecionada (GDD §10, v0.6). */}
      {atual ? <p className="seletor-dica">{atual.descricao}</p> : null}
    </>
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

/** Botão da transição de era: aparece com Estabilidade 100 % + "Fissão básica" (GDD Parte 2 §2). */
function ConstruirReator() {
  const state = useGameStore((s) => s.state);
  const construir = useGameStore((s) => s.construirReator);
  if (state.era !== 1 || !state.pesquisados.includes("fissaoBasica")) return null;
  const v = avaliarConstruirReator(state);
  return (
    <div className="nucleo-transicao">
      <p className="nucleo-transicao-texto">
        A Torre chegou ao fim. O próximo passo é <strong>fissão</strong>: um Vaso de pressão no lugar do Receptor, cem vezes
        mais potência — e combustível que acaba. As peças da Torre são desmontadas e devolvem 50 %.
      </p>
      <button type="button" className={`pilula pilula--primaria ${v.ok ? "pilula--brilho" : ""}`} disabled={!v.ok} onClick={construir}>
        <span>Construir o Reator</span>
        <span className={`pilula-custo ${v.ok ? "" : "pilula-custo--caro"}`}>{formatarCreditos(REATOR.custoVaso)}</span>
      </button>
      {v.motivo ? <span className="nucleo-transicao-motivo">{v.motivo}</span> : null}
    </div>
  );
}

/** O aviso de fim de conteúdo: a Era 3 é a Sessão 9 (GDD Parte 2 §6). */
function FimDaEra2() {
  const state = useGameStore((s) => s.state);
  if (!era3Pronta(state)) return null;
  return (
    <p className="nucleo-transicao-texto nucleo-transicao--fim">
      <strong>Fusão básica pronta e Estabilidade em 100 %.</strong> A Era 3 (Tokamak, contenção magnética e o planeta
      inteiro como tabuleiro) está em produção — o MVP termina aqui. O seu save continua valendo.
    </p>
  );
}

function Operacao({ nucleo }: { nucleo: NucleoState }) {
  const state = useGameStore((s) => s.state);
  const scramManual = useGameStore((s) => s.scramManual);
  const alternarModoSeguro = useGameStore((s) => s.alternarModoSeguro);
  const aviso = useGameStore((s) => s.avisoGrade);

  const efeitos = efeitosDe(state);
  const potencia = potenciaNucleoEfetivaKw(nucleo, efeitos, state.tempoMs);
  const t = temperaturaNucleo(nucleo);
  const emScram = nucleo.scramRestanteMs > 0;
  const era2 = nucleo.era === 2;
  const motor = motorDoNucleo(nucleo, efeitos, state.tempoMs);
  const c = contar(nucleo.grade);
  const cr = contarReator(nucleo.grade);
  const calorEspelho = efeitos.calorPorEspelho;

  return (
    <div className="palco">
      {emScram ? (
        <p className="nucleo-scram">
          SCRAM · Núcleo desligado por {formatarSegundos(nucleo.scramRestanteMs)}.{" "}
          {era2
            ? "A fissão parou, mas as varetas continuam decaindo no Vaso: quem segura o calor agora é a torre de resfriamento."
            : "Espelhos e turbinas parados; radiadores esfriando."}
        </p>
      ) : null}
      <BarraCalor nucleo={nucleo} efeitos={efeitos} tempoMs={state.tempoMs} />
      <p className="nucleo-status">
        <span>⚡ {era2 ? "Reator" : "Núcleo"} {formatarPotencia(potencia)}</span>
        <span>🔬 +{formatarNumero(emScram ? 0 : pesquisaPorSegundo(potencia, t, motor.pesquisaPorKw), 2)}/s</span>
        {era2 ? (
          <span>
            varetas {cr.varetasAtivas} ativas · {cr.varetasGastas} gastas · turbinas {cr.turbinas} · torres {cr.torres} ·{" "}
            {formatarCalor(motor.entradaUs)}/s entrando
          </span>
        ) : (
          <span>
            h = {formatarNumero(espelhosEfetivos(nucleo.grade), 2)} · t = {c.turbinas} · rad = {c.radiadoresAdjacentes} ·{" "}
            {formatarNumero(calorEspelho, 0)} u/s por espelho
          </span>
        )}
        {nucleo.cascatas > 0 ? <span>💥 {nucleo.cascatas} cascata{nucleo.cascatas > 1 ? "s" : ""}</span> : null}
      </p>
      <Entulhos nucleo={nucleo} tempoMs={state.tempoMs} />
      <SeletorPecas era={nucleo.era} />
      {aviso && state.tempoMs - aviso.emTempoMs < DURACAO_AVISO_MS ? <p className="aviso aviso--erro nucleo-aviso">{aviso.texto}</p> : null}
      <BarraEstabilidade nucleo={nucleo} />
      <ConstruirReator />
      <FimDaEra2 />
      <div className="nucleo-controles">
        <button
          type="button"
          className="pilula pilula--perigo"
          disabled={emScram}
          onClick={scramManual}
          title={`Desliga o Núcleo por ${formatarSegundos(era2 ? SCRAM_ERA2.totalMs : CASCATA.scramMs)}`}
        >
          SCRAM manual
        </button>
        <button type="button" className={`pilula ${nucleo.modoSeguro ? "pilula--ativa" : ""}`} role="switch" aria-checked={nucleo.modoSeguro} onClick={alternarModoSeguro} title={`SCRAM automático a ${formatarPorcentagem(MODO_SEGURO.limiarT)}, potência ×${formatarNumero(MODO_SEGURO.fatorPotencia, 1)}`}>
          Modo seguro {nucleo.modoSeguro ? "ligado" : "desligado"}
        </button>
        <p className="nucleo-dica-arvore">
          {era2
            ? `Cada vareta vale ${VARETA.combustivelS} s de combustível e depois fica quente: trocar custa ${formatarCreditos(VARETA.custoTroca)} e só depois de ${formatarSegundos(esperaParaTrocaMs())} — ou na hora, com uma piscina ao lado.`
            : "As melhorias do Núcleo (Receptor cerâmico, Grade 7×7, níveis de peça) vivem na árvore de pesquisa, e agora custam 🔬 de verdade."}
        </p>
      </div>
    </div>
  );
}

export function PainelNucleo() {
  const nucleo = useGameStore((s) => s.state.nucleo);
  return (
    <section className="coluna-nucleo" aria-label="Núcleo">
      <Tabuleiro />
      {nucleo ? <Operacao nucleo={nucleo} /> : <Bloqueado />}
    </section>
  );
}
