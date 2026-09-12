/** Ajudantes compartilhados pelos testes da Era 2 (Reator PWR, grade 7×7). */
import { NUCLEO_REATOR_PWR } from "../../content/era2-nucleo";
import { colocar } from "../nucleo";
import { estadoInicial, gradeVazia, nucleoInicial, type Casa, type GameState, type PecaId } from "../state";

export const DEF = NUCLEO_REATOR_PWR;

/** Índices do 7×7: centro é o 24. Anel 1 = as 8 vizinhas; anel 2 = os 16 seguintes. */
export const ANEL1 = [16, 17, 18, 23, 25, 30, 31, 32];
export const ANEL2 = [8, 9, 10, 11, 12, 15, 19, 22, 26, 29, 33, 36, 37, 38, 39, 40];

export function montar(anel1: PecaId[], anel2: PecaId[] = []): Casa[] {
  let grade = gradeVazia(DEF.ladoInicial);
  anel1.forEach((id, k) => (grade = colocar(grade, ANEL1[k], id, DEF)));
  anel2.forEach((id, k) => (grade = colocar(grade, ANEL2[k], id, DEF)));
  return grade;
}

/** O exemplo obrigatório do GDD §8.5.6: 5 varetas + 1 bomba + 2 geradores, mais 2 varetas no anel 2. */
export function gradeDeReferencia(): Casa[] {
  return montar(
    ["vareta", "vareta", "vareta", "vareta", "vareta", "bomba", "geradorDeVapor", "geradorDeVapor"],
    ["vareta", "vareta"],
  );
}

export function comReator(grade: Casa[], calorU = 0, creditos = 1_000_000): GameState {
  return {
    ...estadoInicial(),
    era: 2,
    creditos,
    nucleo: { ...nucleoInicial(), tipo: "reatorPwr", lado: DEF.ladoInicial, grade, calorU },
  };
}
