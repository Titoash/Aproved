/**
 * Cards explicativos da Era 2 (GDD Parte 2 §7). Textos finais — não reescrever o tom.
 *
 * O card da transição tem três telas e é o que ensina o conceito da era: desligar um reator não
 * desliga o calor.
 */
import type { CardDef } from "./cards-era1";

export const CARDS_ERA2: Record<string, CardDef> = {
  calorDeDecaimento: {
    id: "calorDeDecaimento",
    gatilho: "transição para a Era 2",
    bipe: { papel: "cientista", expressao: "apontando" },
    telas: [
      {
        titulo: "O urânio que se parte",
        texto:
          "Um núcleo de urânio-235 atingido por um nêutron lento se quebra em dois pedaços menores e solta mais nêutrons — e um pouco de massa vira energia pelo caminho. Se cada fissão provoca exatamente **uma** outra, a reação se sustenta sozinha: é o k = 1 de um reator. A barra de controle é o que segura esse número, engolindo os nêutrons que sobram. Cada vareta injeta 20 u/s de calor no anel 1 — e tem 600 segundos de combustível.",
      },
      {
        titulo: "Desligar para a fissão, não o decaimento",
        texto:
          "Quando você desliga um reator, a fissão para em segundos. O calor **não**. Os pedaços que sobraram da quebra continuam decaindo e liberam cerca de **7 %** da potência térmica no primeiro instante, caindo pela metade a cada minuto — e ainda uns **1 %** depois de uma hora. Foi esse calor, e não uma explosão nuclear, que derreteu os núcleos de Fukushima depois que as bombas de resfriamento pararam.",
      },
      {
        titulo: "Por isso toda usina tem piscina e torre",
        texto:
          "A torre de resfriamento tira 30 u/s do Vaso o tempo todo — é ela que segura a temperatura depois de um SCRAM. A piscina guarda +250 u de folga e recebe o calor das varetas gastas que estiverem ao lado dela, deixando você trocá-las na hora. Sem piscina, uma vareta gasta fica quente na grade por uns três minutos antes de poder sair. É essa espera que faz a **troca escalonada** — varetas com idades diferentes — virar a rotina da era.",
      },
    ],
  },

  varetaGasta: {
    id: "varetaGasta",
    gatilho: "primeira vareta esgotada",
    bipe: { papel: "manutencao", expressao: "cansado" },
    telas: [
      {
        titulo: "Acabou o combustível — e ela continua quente.",
        texto:
          "Essa vareta queimou os 600 segundos dela e agora só decai: 7 % do calor de antes, metade a cada minuto. Trocar custa ₵ 8 000, mas só depois que o decaimento cair abaixo de 1 % (uns três minutos) — ou **na hora**, se houver uma piscina de resfriamento nas oito casas vizinhas. Dica de operação: não ponha todas as varetas ao mesmo tempo. Uma barra de controle ao lado dobra a vida de quem está perto e escalona as trocas de graça.",
      },
    ],
  },

  scramEra2: {
    id: "scramEra2",
    gatilho: "primeiro SCRAM da Era 2",
    bipe: { papel: "operador", expressao: "alarmado" },
    telas: [
      {
        titulo: "SCRAM: as barras caem, o calor não.",
        texto:
          "As barras entraram e a fissão parou. Só que **todas** as varetas passam a decair no Vaso, e as turbinas estão paradas: não há para onde o calor ir a não ser para a torre de resfriamento. São 60 segundos de parada mínima e mais 30 para religar, e o combustível não some — as varetas voltam de onde estavam. Se a temperatura subir nesse tempo, o problema é de dissipação, não de potência.",
      },
    ],
  },

  offshore: {
    id: "offshore",
    gatilho: "primeira eólica offshore",
    bipe: { papel: "operador", expressao: "apontando" },
    telas: [
      {
        titulo: "O mar é espaço de construção.",
        texto:
          "No mar não há colina, prédio nem árvore para frear o vento, e a superfície da água é lisa: a mesma turbina rende muito mais ali do que em terra. Em troca, tudo é mais caro — fundação, cabo, manutenção de barco. Cada torre entrega 400 kW e precisa de uma **subestação offshore** no alcance, que eleva a tensão antes de mandar a energia para a ilha. A esteira continua valendo: não encoste uma na outra.",
      },
    ],
  },

  produzirCusta: {
    id: "produzirCusta",
    gatilho: "primeira térmica a gás",
    bipe: { papel: "cientista", expressao: "neutro" },
    telas: [
      {
        titulo: "A partir de agora, produzir custa.",
        texto:
          "A térmica a gás dá 2 000 kW quando você quiser — mas queima ₵ 300 por segundo enquanto liga, e isso aparece no extrato como **combustível**. O que importa deixou de ser a receita e passou a ser a **receita líquida**. Ela se desliga sozinha quando fica sem escoamento (não faz sentido queimar gás para jogar energia fora), e a fumaça derruba 10 % da tarifa dos bairros a até duas casas — até você pesquisar cogeração, que transforma o calor perdido em água quente e inverte o sinal.",
      },
    ],
  },
};
