/**
 * Árvore de pesquisa da Era 2 (GDD Parte 2 §6). Só dados.
 *
 * Custos na régua ×10 da Era 1: a árvore da Era 1 soma ≈ 🔬 22 mil, esta soma ≈ 🔬 193 mil, para uma era
 * em que o reator sozinho rende ≈ 🔬 10/s. Cada nó traz uma frase de física de verdade, com os números
 * conferidos — é o card de uma linha que o §9 da Parte 1 pede.
 *
 * Os nós da Era 1 continuam valendo: Lâminas de fibra e Torre mais alta seguem multiplicando as usinas
 * da Era 1, que continuam na paleta como os "kW baratos que ocupam casa".
 */
import type { NoDef, RamoDef } from "./arvore-tipos";

export const RAMOS_ERA2: readonly RamoDef[] = [
  { id: "fissao", era: 2, nome: "Fissão", descricao: "O que acontece dentro do Vaso: quanto calor, por quanto tempo, e quem segura." },
  { id: "termica", era: 2, nome: "Térmica", descricao: "Queimar gás para ter potência na hora — e o que fazer com a fumaça." },
  { id: "offshore", era: 2, nome: "Offshore", descricao: "O mar como espaço de construção: vento limpo e nenhuma sombra." },
  { id: "rede2", era: 2, nome: "Rede em MW", descricao: "Tensão, armazenamento e cabo: como mil vezes mais energia chega ao mesmo lugar." },
  { id: "cidade2", era: 2, nome: "Cidade", descricao: "De metrópole a arcologia, e a indústria que paga caro pelo kW." },
];

export const NOS_ERA2: readonly NoDef[] = [
  /* --------------------------------------------------------------- Fissão */
  {
    id: "barraDeControle",
    ramo: "fissao",
    era: 2,
    nome: "Barra de controle",
    efeitoTexto: "Libera a barra de controle: as varetas nas 8 vizinhas rendem −50 % de calor e duram o dobro.",
    fisica:
      "Um reator se sustenta quando cada fissão provoca exatamente uma outra — é o k = 1. A barra é feita de material que engole nêutrons (boro, cádmio, háfnio): enfiando-a mais fundo, k cai abaixo de 1 e a reação desacelera sem parar.",
    pesquisa: 500,
    efeitos: [{ tipo: "desbloqueiaPeca", peca: "barraControle" }],
  },
  {
    id: "piscinaDeResfriamento",
    ramo: "fissao",
    era: 2,
    nome: "Piscina de resfriamento",
    efeitoTexto: "Libera a piscina: +250 u de capacidade e troca imediata das varetas gastas nas 8 vizinhas.",
    fisica:
      "Vareta recém-retirada solta uns 7 % da potência térmica que soltava ligada, e leva anos para esfriar de verdade. Por isso ela vai para uma piscina: a água leva o calor embora e ainda serve de blindagem — cerca de 4 m de água já bastam.",
    pesquisa: 2_000,
    pre: ["barraDeControle"],
    efeitos: [{ tipo: "desbloqueiaPeca", peca: "piscina" }],
  },
  {
    id: "enriquecimento",
    ramo: "fissao",
    era: 2,
    nome: "Enriquecimento a 5 %",
    efeitoTexto: "Cada vareta injeta +25 % de calor.",
    fisica:
      "O urânio natural tem só 0,7 % de U-235, e o resto é U-238, que não fissiona com nêutron lento. Centrífugas separam os dois pela diferença de massa (235 contra 238) até chegar aos 3–5 % que um PWR usa.",
    pesquisa: 6_000,
    pre: ["piscinaDeResfriamento"],
    efeitos: [{ tipo: "varetaCalor", fator: 1.25 }],
  },
  {
    id: "combustivelMox",
    ramo: "fissao",
    era: 2,
    nome: "Combustível MOX",
    efeitoTexto: "Cada vareta dura ×1,5.",
    fisica:
      "MOX é óxido misto: urânio empobrecido misturado com o plutônio-239 que o próprio U-238 virou dentro do reator. É queimar o resíduo da rodada anterior — um terço do núcleo de vários reatores europeus é assim.",
    pesquisa: 9_000,
    pre: ["enriquecimento"],
    efeitos: [{ tipo: "varetaVida", fator: 1.5 }],
  },
  {
    id: "reator7x7",
    ramo: "fissao",
    era: 2,
    nome: "Reator 7×7",
    efeitoTexto: "Abre o anel 3: 24 casas novas na plataforma. Vareta lá injeta 5 u/s.",
    fisica:
      "Num núcleo real o fluxo de nêutrons é máximo no centro e cai para as bordas, então a vareta de fora fissiona menos pela mesma massa. Crescer para fora só compensa junto com mais capacidade de tirar calor.",
    pesquisa: 15_000,
    creditos: 150_000,
    pre: ["combustivelMox"],
    efeitos: [{ tipo: "gradeLado", lado: 7 }],
  },
  {
    id: "aguaPesada",
    ramo: "fissao",
    era: 2,
    nome: "Água pesada",
    efeitoTexto: "As varetas duram ×2 e injetam −15 % de calor.",
    fisica:
      "A água comum modera bem os nêutrons, mas engole uns quantos no caminho. A água pesada (D₂O) quase não absorve — o deutério já tem o nêutron que lhe cabe —, então sobra nêutron para queimar mais do combustível, com menos potência por vareta.",
    pesquisa: 25_000,
    pre: ["reator7x7"],
    exclui: ["altaTemperatura"],
    efeitos: [
      { tipo: "varetaVida", fator: 2 },
      { tipo: "varetaCalor", fator: 0.85 },
    ],
  },
  {
    id: "altaTemperatura",
    ramo: "fissao",
    era: 2,
    nome: "Alta temperatura",
    efeitoTexto: "Cada u consumida rende +30 % de kW, e as varetas duram ×0,7.",
    fisica:
      "O rendimento de Carnot é 1 − T_fria ÷ T_quente: subir a saída de 320 °C para 500 °C tira mais trabalho do mesmo calor. O preço é material — a essa temperatura o revestimento da vareta flui e precisa ser trocado antes.",
    pesquisa: 25_000,
    pre: ["reator7x7"],
    exclui: ["aguaPesada"],
    efeitos: [
      { tipo: "reatorKwFator", fator: 1.3 },
      { tipo: "varetaVida", fator: 0.7 },
    ],
  },

  /* -------------------------------------------------------------- Térmica */
  {
    id: "cicloCombinado",
    ramo: "termica",
    era: 2,
    nome: "Ciclo combinado",
    efeitoTexto: "Térmica a gás +30 %.",
    fisica:
      "O gás sai da turbina a uns 600 °C: jogar isso fora é desperdício. Uma caldeira de recuperação faz vapor com esse calor e move uma segunda turbina — o rendimento passa de ~40 % para ~60 % sem queimar mais gás.",
    pesquisa: 3_000,
    efeitos: [{ tipo: "potenciaUsinas", usinas: ["termicaGas"], fator: 1.3 }],
  },
  {
    id: "cogeracao",
    ramo: "termica",
    era: 2,
    nome: "Cogeração",
    efeitoTexto: "Os bairros a até 2 casas de uma térmica passam a pagar +10 % em vez de −10 %.",
    fisica:
      "Depois da segunda turbina ainda sobra calor morno, quente demais para o ar e frio demais para outra turbina. Levado por tubo até os prédios, ele aquece água e ambientes: o aproveitamento total da queima passa de 80 %.",
    pesquisa: 8_000,
    pre: ["cicloCombinado"],
    efeitos: [{ tipo: "vizinhancaTermica", delta: 0.1 }],
  },
  {
    id: "seloVerde",
    ramo: "termica",
    era: 2,
    nome: "Selo verde",
    efeitoTexto: "Tarifa média +5 %, e o combustível das térmicas custa +20 %.",
    fisica:
      "Capturar o CO₂ da chaminé com aminas e comprimi-lo para injeção custa energia da própria usina: a penalidade energética de uma captura pós-combustão fica entre 15 % e 25 % do que ela gera.",
    pesquisa: 12_000,
    pre: ["cogeracao"],
    efeitos: [
      { tipo: "tarifa", fator: 1.05 },
      { tipo: "combustivel", fator: 1.2 },
    ],
  },

  /* ------------------------------------------------------------- Offshore */
  {
    id: "subestacaoOffshore",
    ramo: "offshore",
    era: 2,
    nome: "Subestação offshore",
    efeitoTexto: "Libera a eólica offshore e a subestação offshore (mar raso, alcance 4, teto 4 000 kW).",
    fisica:
      "As torres do mar entregam em 66 kV numa plataforma coletora, que eleva a tensão antes de mandar para terra. Sem essa elevação, a corrente no cabo longo derreteria o orçamento de perdas — que vão com I²R.",
    pesquisa: 1_500,
    efeitos: [
      { tipo: "desbloqueia", construcao: "subestacaoOffshore" },
      { tipo: "desbloqueia", construcao: "eolicaOffshore" },
    ],
  },
  {
    id: "fundacaoFlutuante",
    ramo: "offshore",
    era: 2,
    nome: "Fundação flutuante",
    efeitoTexto: "A eólica offshore passa a caber também em mar fundo.",
    fisica:
      "Fincar monoestaca no fundo só compensa até uns 60 m de profundidade. Mais fundo, a torre vai sobre um flutuador ancorado por catenárias — o mesmo truque das plataformas de petróleo, com lastro embaixo para o conjunto não emborcar.",
    pesquisa: 7_000,
    pre: ["subestacaoOffshore"],
    efeitos: [{ tipo: "marFundo" }],
  },
  {
    id: "pasDeCemMetros",
    ramo: "offshore",
    era: 2,
    nome: "Pás de 100 m",
    efeitoTexto: "Eólica offshore +40 %.",
    fisica:
      "A potência do vento é ½ρAv³: cresce com a **área varrida**, e a área vai com o quadrado do raio. Passar de 70 m para 100 m de pá varre o dobro de ar — e no mar não há colina nem prédio para frear v.",
    pesquisa: 10_000,
    pre: ["fundacaoFlutuante"],
    efeitos: [{ tipo: "potenciaUsinas", usinas: ["eolicaOffshore"], fator: 1.4 }],
  },

  /* --------------------------------------------------------------- Rede */
  {
    id: "subestacaoDe138kV",
    ramo: "rede2",
    era: 2,
    nome: "Subestação de 138 kV",
    efeitoTexto: "Libera a subestação de 138 kV: alcance 4, teto 5 000 kW.",
    fisica:
      "A perda numa linha é R·I². Para a mesma potência, subir a tensão de 13,8 kV para 138 kV divide a corrente por dez e as perdas por cem — é por isso que MW só andam em alta tensão.",
    pesquisa: 1_000,
    efeitos: [{ tipo: "desbloqueia", construcao: "subestacao138" }],
  },
  {
    id: "bateriaDeRede",
    ramo: "rede2",
    era: 2,
    nome: "Bateria de rede",
    efeitoTexto: "Libera a bateria de rede: 2 000 kWh e ±1 000 kW por unidade.",
    fisica:
      "Uma bateria responde em milissegundos; uma turbina a vapor leva minutos para mudar de carga. Por isso o banco de baterias não vale pela energia que guarda, e sim pela velocidade com que entra — é ele que segura a frequência quando uma usina cai.",
    pesquisa: 4_000,
    pre: ["subestacaoDe138kV"],
    efeitos: [{ tipo: "desbloqueia", construcao: "bateriaRede" }],
  },
  {
    id: "caboHvdc",
    ramo: "rede2",
    era: 2,
    nome: "Cabo HVDC",
    efeitoTexto: "O teto de **todos** os cabos submarinos ×10 (o nível continua dobrando por cima).",
    fisica:
      "Cabo submarino em corrente alternada vira um capacitor gigante: a corrente de carga da própria isolação come a capacidade em algumas dezenas de quilômetros. Em corrente contínua isso simplesmente não existe, e o cabo leva o que couber no condutor.",
    pesquisa: 4_000,
    creditos: 100_000,
    pre: ["bateriaDeRede"],
    efeitos: [{ tipo: "tetoCabo", fator: 10 }],
  },
  {
    id: "redeInteligente",
    ramo: "rede2",
    era: 2,
    nome: "Rede inteligente",
    efeitoTexto: "A bateria de rede guarda e entrega o dobro.",
    fisica:
      "Medir e chavear em tempo real muda o que a mesma bateria consegue fazer: sabendo onde está o excedente no segundo em que ele aparece, ela carrega e descarrega no momento certo em vez de ficar esperando a média do dia.",
    pesquisa: 11_000,
    pre: ["caboHvdc"],
    efeitos: [{ tipo: "bateriaRede", fator: 2 }],
  },

  /* -------------------------------------------------------------- Cidade */
  {
    id: "megacidade",
    ramo: "cidade2",
    era: 2,
    nome: "Megacidade",
    efeitoTexto: "Libera a densidade 5: 400 kW, 25 000 habitantes, tarifa ×1,7.",
    fisica:
      "Cidade densa gasta menos energia por pessoa: parede compartilhada perde menos calor que casa isolada, e a mesma viagem que pedia um carro cabe num vagão. O total sobe, o consumo por habitante cai.",
    pesquisa: 2_500,
    efeitos: [],
  },
  {
    id: "industriaPesada",
    ramo: "cidade2",
    era: 2,
    nome: "Indústria pesada",
    efeitoTexto: "Libera o distrito industrial: 3 000 kW de demanda que paga ×2,2 por kW.",
    fisica:
      "Alumínio se faz por eletrólise: cerca de 13 MWh de eletricidade por tonelada, direto na cuba. Quem funde metal com eletricidade paga bem pelo kW — e não pode ficar sem ele no meio do processo.",
    pesquisa: 5_000,
    pre: ["megacidade"],
    efeitos: [{ tipo: "desbloqueia", construcao: "distritoIndustrial" }],
  },
  {
    id: "institutoDePesquisa",
    ramo: "cidade2",
    era: 2,
    nome: "Instituto de pesquisa",
    efeitoTexto: "Libera o instituto: 🔬 3/s consumindo 50 kW, +50 % sobre cristal.",
    fisica:
      "Laboratório de verdade come energia: aceleradores, criogenia e supercomputadores ficam ligados o ano inteiro. O conhecimento sai caro em kWh — e é a única coisa que não se gasta ao usar.",
    pesquisa: 3_500,
    pre: ["industriaPesada"],
    efeitos: [{ tipo: "desbloqueia", construcao: "institutoPesquisa" }],
  },
  {
    id: "arcologia",
    ramo: "cidade2",
    era: 2,
    nome: "Arcologia",
    efeitoTexto: "Libera a densidade 6: 1,5 MW, 100 000 habitantes, tarifa ×2.",
    fisica:
      "Uma cidade inteira num prédio só troca transporte por elevador e rua por corredor. O que ela não consegue trocar é o ar: ventilar e climatizar cem mil pessoas empilhadas é o grosso do 1,5 MW.",
    pesquisa: 14_000,
    pre: ["institutoDePesquisa"],
    efeitos: [],
  },
  {
    id: "bombasDeCalorII",
    ramo: "cidade2",
    era: 2,
    nome: "Bombas de calor II",
    efeitoTexto: "Tarifa +10 %.",
    fisica:
      "Uma bomba de calor não cria calor: ela move o que já existe lá fora, e entrega 3 a 4 kWh de aquecimento por kWh elétrico. Com fonte geotérmica rasa, o desempenho não cai no inverno — e a eletricidade substitui mais combustível.",
    pesquisa: 9_000,
    pre: ["arcologia"],
    efeitos: [{ tipo: "tarifa", fator: 1.1 }],
  },

  /* ---------------------------------------------------------- Saída da era */
  {
    id: "fusaoBasica",
    ramo: "fissao",
    era: 2,
    nome: "Fusão básica",
    efeitoTexto: "Abre a Era 3. Exige Estabilidade 100 % no reator, a Piscina e o Reator 7×7.",
    fisica:
      "Fundir dois núcleos leves rende mais energia por massa do que partir um pesado, mas eles se repelem: é preciso uns 100 milhões de graus para vencer a barreira de Coulomb. O critério de Lawson diz o resto — densidade × tempo de confinamento × temperatura acima de um limiar, ou nada se sustenta.",
    pesquisa: 40_000,
    creditos: 5_000_000,
    pre: ["piscinaDeResfriamento", "reator7x7"],
    efeitos: [],
  },
];
