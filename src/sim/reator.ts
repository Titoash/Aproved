/**
 * Reator PWR da Era 2 (GDD Parte 2 §5): combustível finito, calor de decaimento, barra de controle
 * sobre as 8 vizinhas, piscina, torre de resfriamento e troca de vareta. TypeScript puro.
 *
 * O motor de calor **não muda**: `T = Q ÷ capacidade`, as mesmas faixas, a mesma Cascata e a mesma
 * Estabilidade. O que muda é quem injeta calor no Vaso — e que o que injeta acaba.
 */
import { REATOR, VARETA } from "../content/era2-nucleo";
import { efeitosNeutros, type EfeitosArvore } from "./efeitos";
import { anel } from "./nucleo";
import { ladoDaGrade, type Casa, type NucleoState, type VaretaEstado } from "./state";

/* ------------------------------------------------------------------ */
/* Geometria: as 8 vizinhas                                            */
/* ------------------------------------------------------------------ */

/** As 8 casas em volta (diagonais incluídas), dentro da grade. */
export function vizinhas8(indice: number, lado: number): number[] {
  const x = indice % lado;
  const y = Math.floor(indice / lado);
  const casas: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= lado || ny >= lado) continue;
      casas.push(ny * lado + nx);
    }
  }
  return casas;
}

function temVizinha(grade: readonly Casa[], indice: number, lado: number, id: string): boolean {
  for (const j of vizinhas8(indice, lado)) {
    const c = grade[j];
    if (c && c.tipo === "peca" && c.id === id) return true;
  }
  return false;
}

/** Barra de controle numa das 8 vizinhas. Duas barras não somam: é sim ou não (GDD Parte 2 §5.1). */
export const temBarraVizinha = (grade: readonly Casa[], indice: number, lado: number): boolean =>
  temVizinha(grade, indice, lado, "barraControle");

/** Piscina numa das 8 vizinhas: troca imediata e o decaimento vai para a piscina, não para o Vaso. */
export const temPiscinaVizinha = (grade: readonly Casa[], indice: number, lado: number): boolean =>
  temVizinha(grade, indice, lado, "piscina");

/* ------------------------------------------------------------------ */
/* Vareta: calor nominal, vida e decaimento                            */
/* ------------------------------------------------------------------ */

/** Injeção de base da casa, por anel: 20 / 10 / 5 u/s (anel 0 = o Vaso, não recebe vareta). */
export function injecaoDoAnelUs(indice: number, lado: number): number {
  const a = anel(indice, lado);
  if (a === 0) return 0;
  return VARETA.injecaoPorAnelUs[a - 1] ?? 0;
}

/**
 * Calor nominal de uma vareta nesta casa, em u/s: injeção do anel × barra de controle vizinha ×
 * efeitos da árvore (enriquecimento, água pesada). É deste número que sai o 7 % do decaimento.
 */
export function calorNominalVaretaUs(
  grade: readonly Casa[],
  indice: number,
  lado: number,
  efeitos: EfeitosArvore = efeitosNeutros(),
): number {
  const base = injecaoDoAnelUs(indice, lado) * efeitos.varetaCalorFator;
  return temBarraVizinha(grade, indice, lado) ? base * VARETA.fatorBarraCalor : base;
}

/** Quantas vezes a vareta desta casa dura mais que os 600 s nominais (barra, MOX, água pesada). */
export function fatorVidaVareta(
  grade: readonly Casa[],
  indice: number,
  lado: number,
  efeitos: EfeitosArvore = efeitosNeutros(),
): number {
  const barra = temBarraVizinha(grade, indice, lado) ? VARETA.fatorBarraVida : 1;
  return barra * efeitos.varetaVidaFator;
}

/**
 * Fração do calor nominal que o decaimento ainda solta depois de `dtMs` do desligamento:
 * `7 % × 2^(−dt ÷ 60 s)`. Aos 180 s (três meias-vidas) está em 0,875 %, abaixo do limiar de troca.
 */
export function fracaoDecaimento(dtMs: number): number {
  if (!(dtMs > 0)) return VARETA.fracaoDecaimento;
  return VARETA.fracaoDecaimento * Math.pow(0.5, dtMs / (VARETA.meiaVidaS * 1000));
}

/** Uma vareta nova. */
export const varetaNova = (): VaretaEstado => ({ restanteS: VARETA.combustivelS, gastaDesdeMs: null });

export const ehVareta = (casa: Casa): boolean => !!casa && (casa.tipo === "peca" || casa.tipo === "entulho") && casa.id === "vareta";

/** A vareta já esgotou (e está só decaindo). Entulho de vareta conta como gasta. */
export function varetaGasta(casa: Casa): boolean {
  if (!ehVareta(casa)) return false;
  const v = (casa as { vareta?: VaretaEstado }).vareta;
  return !!v && v.gastaDesdeMs !== null;
}

/* ------------------------------------------------------------------ */
/* Contagem e fluxos do reator                                         */
/* ------------------------------------------------------------------ */

export interface ContagemReator {
  varetasAtivas: number;
  varetasGastas: number;
  barras: number;
  turbinas: number;
  torres: number;
  piscinas: number;
  pecas: number;
  entulhos: number;
}

export function contarReator(grade: readonly Casa[]): ContagemReator {
  const lado = ladoDaGrade(grade);
  const c: ContagemReator = { varetasAtivas: 0, varetasGastas: 0, barras: 0, turbinas: 0, torres: 0, piscinas: 0, pecas: 0, entulhos: 0 };
  grade.forEach((casa, i) => {
    if (!casa || casa.tipo === "receptor") return;
    if (casa.tipo === "entulho") {
      c.entulhos++;
      if (casa.id === "vareta") c.varetasGastas++;
      return;
    }
    c.pecas++;
    const adjacente = anel(i, lado) === 1;
    switch (casa.id) {
      case "vareta":
        if (casa.vareta?.gastaDesdeMs !== null && casa.vareta !== undefined) c.varetasGastas++;
        else c.varetasAtivas++;
        break;
      case "barraControle":
        c.barras++;
        break;
      case "turbinaAlta":
        if (adjacente) c.turbinas++;
        break;
      case "torreResfriamento":
        if (adjacente) c.torres++;
        break;
      case "piscina":
        if (adjacente) c.piscinas++;
        break;
      default:
        break;
    }
  });
  return c;
}

/** Capacidade do Vaso: 500 u + 250 u por Piscina adjacente (GDD Parte 2 §5.1). */
export function capacidadeReatorU(grade: readonly Casa[]): number {
  return REATOR.capacidadeVasoU + contarReator(grade).piscinas * REATOR.capacidadePiscinaU;
}

/** Dissipação das torres de resfriamento adjacentes, em u/s. */
export function dissipacaoReatorUs(grade: readonly Casa[]): number {
  return contarReator(grade).torres * REATOR.dissipacaoTorre;
}

/**
 * Calor que entra no Vaso, em u/s. Três situações por casa de vareta:
 *  - ligada e com combustível → o nominal inteiro;
 *  - gasta (ou entulho quente) → decaimento desde que esgotou, salvo se houver Piscina vizinha,
 *    e aí o calor vai para a piscina e não para o Vaso;
 *  - reator em SCRAM → toda vareta ainda com combustível entra em decaimento desde o SCRAM
 *    (a torre de resfriamento é o que segura `T` depois disso).
 */
export function entradaReatorUs(nucleo: NucleoState, efeitos: EfeitosArvore = efeitosNeutros(), tempoMs = 0): number {
  const lado = nucleo.lado;
  const emScram = nucleo.scramRestanteMs > 0;
  let total = 0;
  nucleo.grade.forEach((casa, i) => {
    if (!casa || casa.tipo === "receptor") return;
    if (casa.id !== "vareta") return;
    const v = casa.vareta;
    if (!v) return;
    const nominal = calorNominalVaretaUs(nucleo.grade, i, lado, efeitos);
    if (nominal <= 0) return;
    if (v.gastaDesdeMs !== null) {
      if (temPiscinaVizinha(nucleo.grade, i, lado)) return;
      total += nominal * fracaoDecaimento(tempoMs - v.gastaDesdeMs);
      return;
    }
    // Entulho de vareta ainda com combustível: a Cascata já marca `gastaDesdeMs`, mas um save
    // antigo pode chegar sem a marca — entulho nunca fissiona.
    if (casa.tipo === "entulho") return;
    if (emScram) {
      const desde = nucleo.scramInicioMs ?? tempoMs;
      total += nominal * fracaoDecaimento(tempoMs - desde);
      return;
    }
    total += nominal;
  });
  return total;
}

/* ------------------------------------------------------------------ */
/* Passo do combustível                                                */
/* ------------------------------------------------------------------ */

export interface PassoVaretas {
  grade: Casa[];
  /** Casas cujas varetas esgotaram neste passo (para o card e o extrato). */
  esgotadas: number[];
}

/**
 * Gasta combustível de cada vareta ligada. Durante o SCRAM nada se gasta (a fissão parou).
 * Devolve a mesma grade quando nada mudou: o tick não realoca à toa.
 */
export function passoVaretas(
  nucleo: NucleoState,
  dtMs: number,
  tempoMs: number,
  efeitos: EfeitosArvore = efeitosNeutros(),
): PassoVaretas {
  if (nucleo.scramRestanteMs > 0) return { grade: nucleo.grade as Casa[], esgotadas: [] };
  const lado = nucleo.lado;
  const dtS = dtMs / 1000;
  let nova: Casa[] | null = null;
  const esgotadas: number[] = [];
  nucleo.grade.forEach((casa, i) => {
    if (!casa || casa.tipo !== "peca" || casa.id !== "vareta") return;
    const v = casa.vareta;
    if (!v || v.gastaDesdeMs !== null) return;
    const restanteS = v.restanteS - dtS / fatorVidaVareta(nucleo.grade, i, lado, efeitos);
    nova ??= nucleo.grade.slice();
    if (restanteS > 0) {
      nova[i] = { ...casa, vareta: { restanteS, gastaDesdeMs: null } };
      return;
    }
    nova[i] = { ...casa, vareta: { restanteS: 0, gastaDesdeMs: tempoMs } };
    esgotadas.push(i);
  });
  return { grade: nova ?? (nucleo.grade as Casa[]), esgotadas };
}

/**
 * Avança o combustível de uma grade parada por `segundos` (offline, GDD Parte 2 §5.2): o tempo passa
 * no combustível mesmo com o jogo fechado, e cada vareta é marcada como gasta no instante exato em
 * que acabou, para o decaimento chegar certo.
 */
export function avancarVaretasOffline(
  nucleo: NucleoState,
  segundos: number,
  tempoInicialMs: number,
  efeitos: EfeitosArvore = efeitosNeutros(),
): Casa[] {
  if (segundos <= 0) return nucleo.grade as Casa[];
  const lado = nucleo.lado;
  let nova: Casa[] | null = null;
  nucleo.grade.forEach((casa, i) => {
    if (!casa || casa.tipo !== "peca" || casa.id !== "vareta") return;
    const v = casa.vareta;
    if (!v || v.gastaDesdeMs !== null) return;
    const vida = fatorVidaVareta(nucleo.grade, i, lado, efeitos);
    const duraS = v.restanteS * vida;
    nova ??= nucleo.grade.slice();
    if (duraS > segundos) {
      nova[i] = { ...casa, vareta: { restanteS: v.restanteS - segundos / vida, gastaDesdeMs: null } };
      return;
    }
    nova[i] = { ...casa, vareta: { restanteS: 0, gastaDesdeMs: tempoInicialMs + duraS * 1000 } };
  });
  return nova ?? (nucleo.grade as Casa[]);
}

/* ------------------------------------------------------------------ */
/* Troca                                                               */
/* ------------------------------------------------------------------ */

export interface RecusaTroca {
  ok: boolean;
  motivo: string | null;
  /** Quanto falta esperar, em ms, quando é só questão de tempo. */
  faltaMs: number;
}

/**
 * Trocar uma vareta gasta custa ₵ 8 000 e só é permitido quando o decaimento dela caiu abaixo de 1 %
 * do nominal (≈ 3 meias-vidas, 180 s) — **ou na hora**, se houver Piscina nas 8 vizinhas.
 */
export function avaliarTroca(nucleo: NucleoState | null, indice: number, creditos: number, tempoMs: number): RecusaTroca {
  const recusa = (motivo: string, faltaMs = 0): RecusaTroca => ({ ok: false, motivo, faltaMs });
  if (!nucleo || nucleo.era !== 2) return recusa("O reator ainda não existe.");
  const casa = nucleo.grade[indice];
  if (!casa || casa.tipo !== "peca" || casa.id !== "vareta") return recusa("Só varetas se trocam.");
  const v = casa.vareta;
  if (!v || v.gastaDesdeMs === null) return recusa("A vareta ainda tem combustível.");
  if (creditos < VARETA.custoTroca) return recusa("₵ insuficientes");
  if (temPiscinaVizinha(nucleo.grade, indice, nucleo.lado)) return { ok: true, motivo: null, faltaMs: 0 };
  const decorridoMs = tempoMs - v.gastaDesdeMs;
  const alvoMs = VARETA.meiaVidaS * 1000 * Math.log2(VARETA.fracaoDecaimento / VARETA.limiarTroca);
  if (decorridoMs < alvoMs) {
    const falta = alvoMs - decorridoMs;
    return recusa("Quente demais: espere o decaimento cair (ou ponha uma Piscina ao lado).", falta);
  }
  return { ok: true, motivo: null, faltaMs: 0 };
}
