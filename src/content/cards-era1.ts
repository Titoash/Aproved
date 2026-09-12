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
        titulo: "A Torre Solar",
        texto:
          "Espelhos no chão apontam para uma torre. A luz vira calor no Receptor. O calor ferve um fluido que gira uma turbina, e a turbina faz eletricidade. É só isso — e é o suficiente para existirem torres assim de verdade na Espanha e no Marrocos. Na grade: espelho injeta calor, turbina consome calor e gera kW, radiador joga calor fora. Colado na torre, cada espelho vale o dobro.",
      },
      {
        titulo: "A regra de ouro",
        texto:
          "Turbinas rendem mais quando o Receptor está quente. Física de verdade: quanto maior a diferença de temperatura, mais trabalho se tira do mesmo calor — Carnot descobriu isso em 1824. Então o melhor lugar para operar é quente, entre 70 e 90 %, perto do limite. Passou de 100 % por 5 segundos, o Receptor derrete: isso é a Cascata. A marquinha na barra mostra onde a sua configuração vai parar. Mire a marquinha na zona de ouro.",
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
export function cardParaEvento(evento: EventoJogo): string | null {
  switch (evento.tipo) {
    case "primeiroCarregamento":
      return "abertura";
    case "primeiraCompra":
      if (evento.item === "tanque") return "tanque";
      if (evento.item === "bateria") return "bateria";
      return null;
    case "melhoriaComprada":
      return evento.id === "rastreamentoSolar" ? "rastreamento" : null;
    case "cascata":
      return "cascata";
    case "eraAvancada":
      // Os cards da Era 2 entram em `cards-era2.ts`.
      return null;
  }
}
