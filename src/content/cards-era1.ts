/**
 * Cards explicativos da Era 1 (GDD §9). Textos finais — não reescrever o tom.
 * `{entrada}` e `{saida}` no card da Cascata são preenchidos pela UI com `nucleo.ultimaCascata`.
 */
import type { EventoJogo } from "../sim/state";

export type BipePapel = "operador" | "manutencao" | "cientista";
export type BipeExpressao = "neutro" | "apontando" | "alarmado" | "cansado";

export interface TelaCard {
  titulo: string;
  texto: string;
}

export interface CardDef {
  id: string;
  /** Descrição do gatilho, para leitura humana; a ligação real está em `cardParaEvento`. */
  gatilho: string;
  telas: readonly TelaCard[];
  bipe: { papel: BipePapel; expressao: BipeExpressao };
  /** Só o card de abertura pausa o jogo (ele ainda nem começou). */
  pausa?: boolean;
}

export const CARDS_ERA1: Record<string, CardDef> = {
  abertura: {
    id: "abertura",
    gatilho: "primeiro carregamento sem save",
    pausa: true,
    bipe: { papel: "cientista", expressao: "apontando" },
    telas: [
      {
        titulo: "Tudo começa com 1 kW",
        texto:
          "Um cata-vento de quintal gera 1 kW. A humanidade inteira, hoje, usa uns 20 trilhões de watts. O Sol despeja no espaço 19 trilhões de vezes isso, o tempo todo, sem cobrar. Este jogo é a distância entre esses dois números. O medidor Kardashev mostra onde você está. Por enquanto, no comecinho.",
      },
      {
        titulo: "Cada casa é uma decisão",
        texto:
          "Este arquipélago tem 2048 casas de terra em oito ilhas, e você coloca tudo à mão, casa a casa. Onde a coisa fica decide quanto ela rende: colina dá +25 % de vento, litoral +50 %, planície +15 % de sol. Dois cata-ventos colados um no outro se roubam vento — é a esteira, e ela é real: parques eólicos de verdade espaçam as torres por isso. Uma torre alta ao lado de um painel faz sombra. Espaço não sobra: metade da ilha principal nasce com floresta, pedra e pântano, e limpar cada casa custa ₵ e tempo.",
      },
      {
        titulo: "Energia sem fio não vai a lugar nenhum",
        texto:
          "Uma usina só vende se tiver uma subestação a até 3 casas, e cada subestação escoa no máximo 40 kW. O que passa disso é desperdiçado: o HUD chama de \"sem escoamento\". As outras ilhas precisam de uma expedição para abrir e de um cabo submarino para mandar energia à rede principal. No meio de tudo fica a plataforma da Torre Solar, o seu Núcleo — é de lá que vem a Pesquisa.",
      },
    ],
  },

  cincoPecas: {
    id: "cincoPecas",
    gatilho: "desbloqueio do Núcleo",
    bipe: { papel: "cientista", expressao: "apontando" },
    telas: [
      {
        titulo: "As cinco peças da Torre",
        texto:
          "**Receptor** (fixo no centro): guarda 100 u de calor e é o que derrete. **Heliostato** (₵ 30): espelho que injeta 4 u/s de calor — colado no Receptor vale o dobro do anel de fora. **Turbina a vapor** (₵ 50): só encostada no Receptor; consome 12 % do calor guardado por segundo e devolve 0,8 kW por unidade consumida. **Radiador** (₵ 40): tira 6 u/s, a válvula de escape. **Tanque de sal fundido** (₵ 60): +150 u de capacidade — não esfria nada, só dá espaço.",
      },
      {
        titulo: "A regra de ouro",
        texto:
          "Turbinas rendem mais quando o Receptor está quente. Física de verdade: quanto maior a diferença de temperatura, mais trabalho se tira do mesmo calor — Carnot descobriu isso em 1824. Então o melhor lugar para operar é quente, entre 70 e 90 %, perto do limite. Passou de 100 % por 5 segundos, o Receptor derrete: isso é a Cascata. A marquinha na barra mostra onde a sua configuração vai parar. Mire a marquinha na zona de ouro.",
      },
    ],
  },

  subestacao: {
    id: "subestacao",
    gatilho: "primeira subestação colocada",
    bipe: { papel: "operador", expressao: "apontando" },
    telas: [
      {
        titulo: "A subestação é a torneira.",
        texto:
          "Ela recolhe o que as usinas a até 3 casas produzem e manda para a cidade — até 40 kW. Acima disso, a energia não some no fio: ela simplesmente não é gerada, e o jogo mostra \"sem escoamento\" na usina. Redes de verdade têm o mesmo limite: a linha aguenta o que aguenta. Espalhe subestações, ou suba o nível de uma (custo ×3, teto ×2). Bairro também precisa de uma por perto para pedir energia.",
      },
    ],
  },
  tanque: {
    id: "tanque",
    gatilho: "primeira compra de tanque",
    bipe: { papel: "operador", expressao: "apontando" },
    telas: [
      {
        titulo: "O tanque não esfria nada. Ele dá espaço.",
        texto:
          "O tanque guarda calor em sal derretido. Torres reais fazem isso para gerar energia à noite, horas depois de o Sol se pôr. Aqui ele aumenta a capacidade do Receptor: o mesmo calor agora ocupa uma fatia menor da barra, e você desceu para fora da zona de ouro. Não é defeito, é espaço. Coloque mais espelhos até a marquinha voltar para o ouro. Mais capacidade, mais espelhos, mais kW.",
      },
    ],
  },
  rastreamento: {
    id: "rastreamento",
    gatilho: "compra do Rastreamento solar",
    bipe: { papel: "cientista", expressao: "alarmado" },
    telas: [
      {
        titulo: "Seus espelhos agora seguem o Sol.",
        texto:
          "Espelhos que acompanham o Sol entregam mais calor cada um: 5 em vez de 4. A marquinha do equilíbrio acabou de subir 25 %. Se você já estava perto do limite, agora está acima dele. Tire um espelho ou ponha um radiador antes que os 5 segundos acabem.",
      },
    ],
  },
  cascata: {
    id: "cascata",
    gatilho: "primeira Cascata",
    bipe: { papel: "manutencao", expressao: "alarmado" },
    telas: [
      {
        titulo: "O Receptor derreteu.",
        texto:
          "O calor entrou mais rápido do que saiu por 5 segundos: {entrada} u/s entrando, {saida} u/s saindo. Torres de verdade resolvem isso em segundos, desfocando os espelhos; aqui você tem o SCRAM e o modo seguro. O que sobrou: as peças do anel 1 viraram entulho (reconstruir custa metade; limpar é grátis em 30 s), a Estabilidade caiu 30 pontos e o Núcleo fica desligado por 20 s. A Pesquisa você não perdeu.",
      },
    ],
  },
  bateria: {
    id: "bateria",
    gatilho: "primeira compra de bateria",
    bipe: { papel: "operador", expressao: "neutro" },
    telas: [
      {
        titulo: "A bateria não gera nada. Ela segura a balança.",
        texto:
          "Ela cobre um déficit curto e absorve um excedente curto — e enquanto consegue, o preço não cai. Cada unidade guarda 20 kWh e aguenta 10 kW de fluxo. Quando o Núcleo desliga num SCRAM, é ela que evita o apagão.",
      },
    ],
  },
};

/** Liga um evento do sim ao card que ele dispara (ou a nenhum). É o único lugar com essa tabela. */
export const CARD_ILHA: CardDef = {
  id: "ilha",
  gatilho: "primeira expedição",
  bipe: { papel: "manutencao", expressao: "apontando" },
  telas: [
    {
      titulo: "Uma ilha nova",
      texto:
        "A expedição abre a ilha, mas a energia dela ainda não chega aqui: sem **cabo submarino** ela só alimenta os próprios bairros. O cabo custa ₵ 150 mais ₵ 120 por casa de mar e leva no máximo 30 kW — cabos de verdade custam assim mesmo, por quilômetro, e cada um tem a sua ampacidade. Subir o nível do cabo custa ×3 e dobra o teto. Cada ilha tem o seu terreno: Ventania é colina e pico (vento forte), Solar é planície rasa (nada faz sombra), Bosque é 90 % de árvore para derrubar. Espaço se conquista.",
    },
  ],
};
CARDS_ERA1.ilha = CARD_ILHA;

export function cardParaEvento(evento: EventoJogo): string | null {
  switch (evento.tipo) {
    case "primeiroCarregamento":
      return "abertura";
    case "primeiraCompra":
      if (evento.item === "tanque") return "tanque";
      if (evento.item === "bateria") return "bateria";
      if (evento.item === "subestacao") return "subestacao";
      return null;
    case "melhoriaComprada":
      return evento.id === "rastreamentoSolar" ? "rastreamento" : null;
    case "cascata":
      return "cascata";
    case "ilhaAberta":
      return "ilha";
    case "nucleoDesbloqueado":
      return "cincoPecas";
    case "obstaculoRemovido":
      return null;
  }
}
