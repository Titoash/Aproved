/** Formatação PT-BR: vírgula decimal e prefixos SI. Arredonda só aqui. */

const formatadores = new Map<number, Intl.NumberFormat>();

function formatador(casas: number): Intl.NumberFormat {
  let f = formatadores.get(casas);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: casas,
    });
    formatadores.set(casas, f);
  }
  return f;
}

/** Casas decimais conforme a magnitude do valor já escalado. */
function casasPorMagnitude(valor: number): number {
  const abs = Math.abs(valor);
  if (abs < 10) return 2;
  if (abs < 100) return 1;
  return 0;
}

export function formatarNumero(valor: number, casas: number = casasPorMagnitude(valor)): string {
  if (!Number.isFinite(valor)) return valor > 0 ? "∞" : valor < 0 ? "−∞" : "—";
  // Evita "-0".
  const v = Object.is(valor, -0) ? 0 : valor;
  return formatador(casas).format(v);
}

interface Escala {
  fator: number;
  sufixo: string;
}

function escalar(valor: number, escalas: readonly Escala[]): { valor: number; sufixo: string } {
  const abs = Math.abs(valor);
  for (let i = escalas.length - 1; i >= 0; i--) {
    const e = escalas[i];
    if (abs >= e.fator) return { valor: valor / e.fator, sufixo: e.sufixo };
  }
  return { valor, sufixo: escalas[0].sufixo };
}

const ESCALAS_POTENCIA: readonly Escala[] = [
  { fator: 1, sufixo: "kW" },
  { fator: 1e3, sufixo: "MW" },
  { fator: 1e6, sufixo: "GW" },
  { fator: 1e9, sufixo: "TW" },
  { fator: 1e12, sufixo: "PW" },
];

const ESCALAS_ENERGIA: readonly Escala[] = [
  { fator: 1, sufixo: "kWh" },
  { fator: 1e3, sufixo: "MWh" },
  { fator: 1e6, sufixo: "GWh" },
  { fator: 1e9, sufixo: "TWh" },
  { fator: 1e12, sufixo: "PWh" },
];

const ESCALAS_CREDITOS: readonly Escala[] = [
  { fator: 1, sufixo: "" },
  { fator: 1e3, sufixo: "mil" },
  { fator: 1e6, sufixo: "mi" },
  { fator: 1e9, sufixo: "bi" },
  { fator: 1e12, sufixo: "tri" },
  { fator: 1e15, sufixo: "qua" },
];

/** `formatarPotencia(1200)` → "1,2 MW". Entrada em kW. */
export function formatarPotencia(kW: number): string {
  if (!Number.isFinite(kW)) return `${formatarNumero(kW)} kW`;
  const { valor, sufixo } = escalar(kW, ESCALAS_POTENCIA);
  return `${formatarNumero(valor)} ${sufixo}`;
}

/** `formatarEnergia(1500)` → "1,5 MWh". Entrada em kWh. */
export function formatarEnergia(kWh: number): string {
  if (!Number.isFinite(kWh)) return `${formatarNumero(kWh)} kWh`;
  const { valor, sufixo } = escalar(kWh, ESCALAS_ENERGIA);
  return `${formatarNumero(valor)} ${sufixo}`;
}

/** `formatarCreditos(12500)` → "₵ 12,5 mil". */
export function formatarCreditos(n: number): string {
  if (!Number.isFinite(n)) return `₵ ${formatarNumero(n)}`;
  const { valor, sufixo } = escalar(n, ESCALAS_CREDITOS);
  // Abaixo de mil mostra no máximo uma casa; acima segue a magnitude.
  const casas = sufixo === "" ? Math.min(1, casasPorMagnitude(valor)) : casasPorMagnitude(valor);
  const numero = formatarNumero(valor, casas);
  return sufixo ? `₵ ${numero} ${sufixo}` : `₵ ${numero}`;
}

/** `formatarTaxa(4)` → "₵ 4/s". */
export function formatarTaxa(creditosPorSegundo: number): string {
  return `${formatarCreditos(creditosPorSegundo)}/s`;
}

/** `formatarRazao(1.15)` → "1,15". */
export function formatarRazao(r: number): string {
  if (!Number.isFinite(r)) return "∞";
  return formatarNumero(r, 2);
}

/** `formatarMultiplicador(1.25)` → "×1,25". */
export function formatarMultiplicador(m: number): string {
  return `×${formatarNumero(m, 2)}`;
}

/** `formatarPorcentagem(0.833)` → "83 %". */
export function formatarPorcentagem(fracao: number, casas = 0): string {
  if (!Number.isFinite(fracao)) return `${formatarNumero(fracao)} %`;
  return `${formatarNumero(fracao * 100, casas)} %`;
}

/** `formatarSegundos(12300)` → "12,3 s". */
export function formatarSegundos(ms: number): string {
  return `${formatarNumero(ms / 1000, 1)} s`;
}

/** `formatarCalor(83.3)` → "83,3 u". */
export function formatarCalor(u: number): string {
  return `${formatarNumero(u, 1)} u`;
}

/** `formatarDuracao(8_000_000)` → "2 h 13 min"; "45 min"; "30 s". */
export function formatarDuracao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return min > 0 ? `${h} h ${min} min` : `${h} h`;
  if (min > 0) return `${min} min`;
  return `${s} s`;
}
