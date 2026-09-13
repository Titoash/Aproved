/**
 * Utilidades dos testes do sim. Não é conteúdo de jogo: só monta estados previsíveis.
 * `plantar` coloca construções em casas neutras (terreno de fator 1, sem vizinho eólico, sem sombra)
 * e garante subestação no alcance, para que a potência de uma usina seja exatamente a base × nível.
 */
import { BATERIA, USINAS } from "../../content/era1";
import { CAPITULOS } from "../../content/capitulos-era1";
import { SUBESTACAO, TERRENOS, type TipoTerreno } from "../../content/era1-arquipelago";
import { ORDEM_TERRENOS, indiceCasa, naPlataforma } from "../arquipelago";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { ehVento } from "../producao";
import { estadoInicial, type Construcao, type GameState, type RedeDerivada, type TipoConstrucao, type UsinaId } from "../state";

export interface OpcoesRede {
  cataVento?: number;
  painelSolar?: number;
  turbinaEolica?: number;
  nivel?: Partial<Record<UsinaId, number>>;
  bairros?: number;
  bateria?: number;
  kwh?: number;
}

/** Rede já derivada, para testar as fórmulas de §4.1 sem passar pelo mundo. */
export function redeDeTeste(op: OpcoesRede = {}): RedeDerivada {
  const unidades = op.bateria ?? 0;
  return {
    usinas: {
      cataVento: { quantidade: op.cataVento ?? 0, nivel: op.nivel?.cataVento ?? 0 },
      painelSolar: { quantidade: op.painelSolar ?? 0, nivel: op.nivel?.painelSolar ?? 0 },
      turbinaEolica: { quantidade: op.turbinaEolica ?? 0, nivel: op.nivel?.turbinaEolica ?? 0 },
    },
    bairros: op.bairros ?? 0,
    bateria: {
      unidades,
      capacidadeKwh: unidades * BATERIA.capacidadeKwh,
      kwh: op.kwh ?? 0,
    },
  };
}

const cheb = (n: number, a: number, b: number) => Math.max(Math.abs((a % n) - (b % n)), Math.abs(Math.floor(a / n) - Math.floor(b / n)));

/**
 * Terreno neutro para o tipo: fator 1 tanto para vento quanto para sol. Só importa para usinas —
 * bairro, bateria, subestação, laboratório e universidade não olham o terreno, e prender a colina
 * deixaria casa de menos perto da plataforma.
 */
function terrenoNeutro(tipo: TipoConstrucao): TipoTerreno | null {
  if (!(tipo in USINAS)) return null;
  if (ehVento(tipo)) return "planicie";
  return "colina";
}

/**
 * Coloca `quantos` prédios do tipo, de graça, em casas neutras da ilha principal, com subestações de
 * alcance suficiente. Devolve um novo estado.
 */
export function plantar(state: GameState, tipo: TipoConstrucao, quantos: number): GameState {
  const arq = arquipelagoDaEra1();
  const n = arq.n;
  const construcoes: Record<number, Construcao> = { ...state.mundo.construcoes };
  const neutro = terrenoNeutro(tipo);
  const alvo = neutro === null ? -1 : ORDEM_TERRENOS.indexOf(neutro);
  const meio = arq.plataforma.meio;

  const ocupadas = () => Object.keys(construcoes).map(Number);
  const vizinhoOcupado = (i: number) =>
    ocupadas().some((j) => construcoes[j].tipo !== "subestacao" && cheb(n, i, j) <= 1);

  const candidatas = arq.ilhas[0].casas
    .filter((i) => {
      if (arq.obstaculos[i] !== 255 || arq.caminho[i] === 1) return false;
      if (naPlataforma(arq.plataforma, i % n, Math.floor(i / n))) return false;
      if (alvo >= 0 && arq.terreno[i] !== alvo) return false;
      // sem obstáculo alto ou caminho colado
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = (i % n) + dx;
        const y = Math.floor(i / n) + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        if (arq.obstaculos[indiceCasa(n, x, y)] !== 255) return false;
      }
      return true;
    })
    .sort((a, b) => Math.hypot((a % n) - meio, Math.floor(a / n) - meio) - Math.hypot((b % n) - meio, Math.floor(b / n) - meio) || a - b);

  let postas = 0;
  const novas: number[] = [];
  for (const i of candidatas) {
    if (postas >= quantos) break;
    if (construcoes[i] || vizinhoOcupado(i)) continue;
    construcoes[i] = { tipo, nivel: 0, colocadoEmMs: state.tempoMs };
    novas.push(i);
    postas++;
  }
  if (postas < quantos) throw new Error(`plantar: só couberam ${postas} de ${quantos} ${tipo}`);

  // subestações de apoio: cada prédio precisa de escoamento (teto alto para não limitar o teste)
  if (tipo !== "subestacao" && tipo !== "bateria") {
    for (const i of novas) {
      const cobertas = Object.keys(construcoes)
        .map(Number)
        .filter((j) => construcoes[j].tipo === "subestacao" && cheb(n, i, j) <= SUBESTACAO.alcance);
      if (cobertas.length > 0) continue;
      const vaga = candidatas.find((j) => !construcoes[j] && cheb(n, i, j) <= SUBESTACAO.alcance);
      if (vaga === undefined) throw new Error("plantar: sem casa para a subestação de apoio");
      construcoes[vaga] = { tipo: "subestacao", nivel: 6, colocadoEmMs: 0 };
    }
  }
  return { ...state, mundo: { ...state.mundo, construcoes } };
}

/**
 * Estado com créditos à vontade, sem bairros nem subestações de nascença — e com **todos os capítulos
 * já concluídos**, para que as recompensas deles não entrem nas contas de economia dos testes.
 * Quem testa capítulo usa `estadoDoZero`.
 */
export function estadoLimpo(creditos = 1e9): GameState {
  const s = estadoDoZero();
  return { ...s, creditos, capitulos: CAPITULOS.map((c) => c.id) };
}

/** Estado inicial sem construções de nascença e com os capítulos por fazer. */
export function estadoDoZero(): GameState {
  const s = estadoInicial();
  return { ...s, mundo: { ...s.mundo, construcoes: {} } };
}

/** Estado limpo com `n` bairros atendidos (demanda previsível). */
export function comBairros(state: GameState, quantos: number): GameState {
  return plantar(state, "bairro", quantos);
}

export const fatorTerreno = (t: TipoTerreno) => TERRENOS[t];
