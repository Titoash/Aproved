/**
 * Cards explicativos da Era 2 (GDD §9). Textos finais — não reescrever o tom.
 *
 * São três, e cada um chega no momento em que a mecânica cobra: a transição, a
 * primeira vareta acabando, e a primeira vareta gasta — que é quando o jogador
 * descobre que a lição da Era 1 não vale mais.
 */
import type { CardDef } from "./cards-era1";

export const CARDS_ERA2: Record<string, CardDef> = {
  transicaoEra2: {
    id: "transicaoEra2",
    gatilho: "entrada na Era 2",
    pausa: true,
    bipe: { papel: "cientista", expressao: "apontando" },
    telas: [
      {
        titulo: "De kW para MW",
        texto:
          "A colina ficou para trás. Agora é uma cidade e um rio, e a unidade mudou: onde você lia kW, vai ler MW — mil vezes mais. O preço por watt caiu para um décimo, porque energia abundante vale menos por unidade. É assim de verdade: a eletricidade ficou cerca de dez vezes mais barata por kWh ao longo do século XX, justamente por ter ficado abundante. Você não empobreceu. Você mudou de escala.",
      },
      {
        titulo: "O que veio com você",
        texto:
          "Seus créditos, sua pesquisa, suas usinas, suas vilas e suas melhorias atravessaram. A Torre Solar não: ela ficou na colina. No lugar dela há um reator de água pressurizada, e a Estabilidade voltou a zero — não porque você perdeu alguma coisa, mas porque a balança nova ainda não foi aprendida. Esta era tem uma regra que a anterior não tinha.",
      },
      {
        titulo: "O combustível acaba",
        texto:
          "Na Torre Solar o sol nascia todo dia e a grade era um problema de geometria: acertar o arranjo uma vez e pronto. Aqui o urânio queima. Cada vareta dura alguns minutos e depois para de fissionar. Se você encher o anel de varetas iguais, elas acabam todas juntas e a usina inteira apaga de uma vez. Escalone. É o mesmo motivo pelo qual reatores reais trocam um terço do núcleo por vez, não o núcleo todo.",
      },
    ],
  },

  combustivelBaixo: {
    id: "combustivelBaixo",
    gatilho: "primeira vareta abaixo de 20 %",
    bipe: { papel: "operador", expressao: "apontando" },
    telas: [
      {
        titulo: "Essa vareta está acabando",
        texto:
          "Abaixo de 20 % e caindo. Quando chegar a zero ela para de fissionar, e o calor que ela injetava some do balanço — o Vaso esfria, os geradores rendem menos, a potência cai. Recarregar custa 60 % do preço da vareta e é o caminho normal: não é preciso remover nada. O detalhe que decide a era: recarregue **antes** de acabar, e escalone, para não ficar sem várias ao mesmo tempo.",
      },
    ],
  },

  calorDeDecaimento: {
    id: "calorDeDecaimento",
    gatilho: "primeira vareta gasta",
    bipe: { papel: "manutencao", expressao: "alarmado" },
    telas: [
      {
        titulo: "Ela parou — e continua quente",
        texto:
          "A vareta gastou o combustível e parou de fissionar. Mas ela não esfria na hora: os fragmentos da fissão continuam decaindo e ainda emitem cerca de 7 % do calor de antes, caindo pela metade a cada 90 segundos. Isso é real e é exatamente o que tornou Fukushima um acidente: os reatores desligaram corretamente, e o calor de decaimento continuou — sem bombas para tirá-lo, o núcleo derreteu de qualquer forma.",
      },
      {
        titulo: "O SCRAM não salva mais sozinho",
        texto:
          "Na Torre Solar, apertar SCRAM zerava a entrada de calor e resolvia sempre. Aqui não. O SCRAM para a fissão, mas o decaimento continua entrando — e se não houver bomba de refrigerante, o calor sobe durante o SCRAM e a Cascata acontece assim mesmo. Mantenha pelo menos uma bomba. E enquanto a vareta gasta estiver quente, ela não sai da grade: recarregue, ou espere esfriar.",
      },
    ],
  },
};
