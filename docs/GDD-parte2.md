# KARDASHEV — GDD Parte 2: Era 2 (Fissão)

> Continuação de `docs/GDD-parte1.md`, que continua valendo inteira (balanças, Cascata, economia, arquipélago, cidade, árvore). Esta parte especifica a **Era 2** para a Sessão 8. As Eras 3–6 e o prestígio entram aqui em versões seguintes. Tudo que é número é valor inicial, a recalibrar com a simulação de 60 minutos (Parte 1, §7 e Sessão 7).

## 1. A Era 2 em uma frase
O mesmo arquipélago, cem vezes mais potência: um **reator de fissão** cujo combustível acaba e cujas peças gastas **continuam quentes**, usinas que cobram para funcionar, o mar raso virando espaço de construção, e uma cidade que passa de metrópole a arcologia.

O que a era ensina, nesta ordem: (1) potência nuclear é enorme e regular, mas o combustível é finito, então **troca escalonada** vira rotina; (2) desligar um reator não desliga o calor: **calor de decaimento**; (3) a partir daqui **produzir custa** (combustível), então a receita líquida é o que importa.

## 2. Transição da Era 1 para a Era 2

**Condição** (Parte 1, §8.4): Estabilidade 100 % + nó "Fissão básica" (🔬 3 000 + ₵ 50 000, já pago no nó). Aparece o botão **"Construir o Reator"** no painel do Núcleo.

**Custo:** ₵ 200 000 (é o Vaso do reator; a era anterior termina com ₵ 400–700 mil sobrando na simulação, e esse é o primeiro sumidouro dela).

**O que acontece, em 3 s** (§10 da Parte 1: câmera afasta e a paleta troca):
1. Card "Calor de decaimento" (3 telas, ver §7).
2. A Torre Solar é desmontada: cada peça devolve 50 % do custo; a plataforma 7×7 recebe o **Vaso** no centro. A grade volta a ser 5×5 (o nó "Reator 7×7" reabre o 7×7).
3. **Estabilidade zera.** Ela é da era, não do jogador.
4. Fica tudo o resto: ilhas abertas, cabos, subestações, usinas da Era 1 (continuam produzindo os mesmos kW), bairros, laboratórios, universidades, ₵, 🔬, nós da Era 1 e seus efeitos, e os níveis por tipo (Parte 1 §7.1).
5. Paleta "entardecer": céu e mar um tom mais escuros, luzes quentes nos bairros, o Sol baixo na água. A escada de escalas não muda (Eras 1 e 2 vivem no arquipélago, Parte 1 §2.4).
6. O capítulo "O Vaso" assume o HUD.

Não há volta. O medidor Kardashev passa a mostrar `K` com duas casas assim que a potência instalada passa de 1 MW (Parte 1, §6).

## 3. Rede da Era 2 (colocada)

Escala: a Era 1 fecha com ≈ 400 kW instalados; a Era 2 mira **≈ 40 MW** (×100), com o preço por watt ×0,1 (Parte 1, §7). Preço da energia continua ₵ 1 por kW·s × faixa de `r` × tarifa média (Parte 1, §4.1 e §8.6): a fórmula não muda, os kW é que crescem.

### 3.1 Usinas novas

| Usina | Ocupa | Potência | Custo base (×1,15ⁿ) | Regras |
|---|---|---|---|---|
| **Eólica offshore** | 1 casa de **mar raso** | 400 kW | ₵ 4 000 | esteira −20 % por vizinha eólica (piso 40 %); precisa de **Subestação offshore** no alcance; só com o nó "Subestação offshore" |
| **Fazenda solar** | 2×2 em terra | 300 kW | ₵ 6 000 | planície +15 %; sombra −30 % por vizinho alto (piso 40 %); não em colina |
| **Térmica a gás** | 2×2 em terra | 2 000 kW | ₵ 25 000 | **combustível: ₵ 300/s por unidade** enquanto liga (≈ 12 % do que ela vende na zona de ouro); bairros a ≤ 2 casas pagam tarifa −10 % (fumaça); desliga sozinha se estiver "sem escoamento" (não queima à toa) |

As três usinas da Era 1 continuam na paleta, com os mesmos números: são os "kW baratos" que ocupam casa.

**Construção 2×2** é novidade do mundo: ocupa quatro casas de terra livres, todas com a mesma ilha; os fatores de terreno usam a casa de âncora (canto superior esquerdo); esteira e sombra contam vizinhos de qualquer uma das quatro casas. Remover devolve 50 %, como tudo.

**Mar raso** (as três faixas de água rasa já desenhadas em `scene/tabuleiro/mar.ts`) passa a ser **casa colocável** para o que for "offshore". Mar fundo continua vazio até o nó "Fundação flutuante". Uma casa de mar raso pertence à ilha cujo litoral está mais perto (empate: a de menor índice).

### 3.2 Escoamento na Era 2

| Construção | Ocupa | Custo (×1,25ⁿ) | Alcance | Teto | Níveis |
|---|---|---|---|---|---|
| Subestação (Era 1) | 1 casa | ₵ 120 | 3 (5 com o nó) | 40 kW | máx. 3 (×3 custo, ×2 teto) — ajuste da Sessão 7 |
| **Subestação de 138 kV** | 1 casa | ₵ 30 000 | 4 | **5 000 kW** | máx. 3 (×3 custo, ×2 teto); nó "Subestação de 138 kV" |
| **Subestação offshore** | 1 casa de mar raso | ₵ 15 000 | 4 (no mar e na terra) | 4 000 kW | máx. 2; conta como parte da ilha mais próxima (entra no teto do cabo dela); nó "Subestação offshore" |
| **Bateria de rede** | 1 casa | ₵ 12 000 | — | 2 000 kWh, ±1 000 kW | nó "Bateria de rede" |

Cabo submarino: níveis como hoje (₵ ×3ⁿ, teto ×2ⁿ, base 30 kW). O nó **"Cabo HVDC"** multiplica o teto de todos os cabos por 10 (o nível continua ×2 por cima). Sem ele, as ilhas de fora não escoam MW: é a trava certa, porque cabo é decisão contínua (Parte 1, §8.5).

**v0.8 — níveis por tipo (Parte 1, §7.1).** Subestação de 138 kV e Subestação offshore sobem por tipo, como a subestação da Era 1: custo `base × 3ⁿ × N`, teto ×2ⁿ, máximo 3 (a offshore para no 2, como a tabela acima). Cabos: nível global (soma das rotas ligadas × 3ⁿ); o nó Cabo HVDC continua multiplicando o teto por 10. Usinas da Era 2 (eólica offshore, fazenda solar, térmica a gás) têm nível incremental como as da Era 1: custo `base × 3ⁿ`, +50 % por nível, máximo 5. Nó de era **"Escavadeiras"** (🔬 1 500, ramo Rede em MW): tempos de remoção ÷ 2 de novo.

## 4. Cidade da Era 2

### 4.1 Densidades 5 e 6

| Densidade | Nome | Demanda | População | Tarifa | Evoluir para ela (₵ + 🔬) | Exige |
|---|---|---|---|---|---|---|
| 5 | **Megacidade** | 400 kW | 25 000 | ×1,7 | ₵ 97 650 + 🔬 3 000 | nó "Megacidade" |
| 6 | **Arcologia** | 1 500 kW | 100 000 | ×2,0 | ₵ 244 000 + 🔬 15 000 | nó "Arcologia" |

A curva de ₵ continua ×2,5 por degrau e dá **um salto de escala na entrada da megacidade**: ₵ 1 562 → ₵ 97 650 é ×62,5, ou seja ×2,5 com um ×25 por cima — a era subiu ×100 em potência. Da 5 para a 6 volta ao ×2,5 (₵ 97 650 → ₵ 244 000). A de 🔬 continua ×5 em toda a escada. Bairros novos nascem na densidade da cidade e custam ₵ 40 × 1,25ⁿ mais o acumulado das evoluções por bairro, em ₵ e 🔬 (Parte 1 §8.6): na megacidade, ₵ 100 087 + 🔬 3 780 além da aldeia; na arcologia, ₵ 344 087 + 🔬 18 780. É o mesmo total de evoluir a cidade com o bairro já construído. *(Sessão 8: o texto anterior dizia "×10 fixo", que daria ₵ 39 050 e não bate com a tabela; os números da tabela são o contrato e continuam como estavam.)*

### 4.2 Consumidores e ciência novos

| Construção | Ocupa | Custo (×1,25ⁿ) | Faz | Exige |
|---|---|---|---|---|
| **Distrito industrial** | 2×2 em terra | ₵ 60 000 | demanda 3 000 kW, tarifa ×2,2, população 0; precisa de Subestação de 138 kV no alcance | nó "Indústria pesada" |
| **Instituto de pesquisa** | 2×2 em terra | ₵ 20 000 | 🔬 3/s, consome 50 kW; +50 % sobre cristal | nó "Instituto de pesquisa" |

Laboratório e universidade continuam. Universidade rende pelos **alunos** (ajuste 3 da Sessão 7): 🔬 0,5/s × √(pop ÷ n_universidades ÷ 1 000), 1 por 2 000 habitantes. Com arcologias, 1 por 2 000 habitantes vira uma pressão real de espaço: é intencional.

**Ciência com nível (v0.9, Parte 1 §7.1).** Laboratório, universidade e instituto de pesquisa têm nível incremental por tipo: +25 % de 🔬 por nível, custo `base × 3ⁿ × N` (Instituto ₵ 20 000 de base), máximo 5 no total por tipo (não por era); o nível atravessa a transição (§2), e a unidade nova paga o acumulado do nível do tipo (Parte 1 §7.1). É o destino do caixa do fim da era: na simulação da Sessão 8 o bot passa os minutos 50–61 com ₵ 3–8,5 milhões parados, esperando 🔬 para o Reator 7×7 e a Fusão básica. Como o total não depende da ordem, o exemplo vale para qualquer rota: 25 universidades no Nv 5 custam 25 × ₵ 400 × (3 + 9 + 27 + 81 + 243) ≈ ₵ 3,6 milhões (o nível 1 custa a base × 3, Parte 1 §7.1), seja o nível comprado na Era 1 com poucas universidades e as novas pagando o acumulado ao nascer, seja na Era 2 com todas; levam a ciência delas a ×2,25. Os Institutos custam ₵ 60 000 × N no Nv 1 e ₵ 7,26 milhões por instituto nos cinco. A parte G da Sessão 9 mede quanto disso a simulação compra.

## 5. Núcleo da Era 2: Reator PWR (grade 5×5 na plataforma 7×7, Vaso fixo no centro)

Mesmo motor da Torre Solar (Parte 1, §4.2, §5, §8.3): `T = Q ÷ capacidade`, faixas iguais (frio < 40 %, normal, **zona de ouro 70–90 %**, alerta, Cascata acima de 100 % por 5 s), Estabilidade com as mesmas taxas (Parte 1 §7; v0.9: +1,2/min fora do ouro, +1,8/min no ouro e +3 por Ocorrência superada com 🛡 escolhido, §5.4). Duas coisas novas: **combustível finito** e **calor de decaimento**. E uma regra nova de geometria: algumas peças agem sobre as **8 vizinhas delas**, não sobre o Vaso.

### 5.1 Peças

| Peça | Anéis | Custo | Efeito |
|---|---|---|---|
| **Vaso de pressão** | centro, fixo | (₵ 200 000 da transição) | capacidade **500 u** |
| **Vareta de combustível** | 1, 2 (3 no 7×7) | ₵ 10 000 | injeta **20 u/s** no anel 1, **10 u/s** no anel 2, 5 u/s no anel 3, por **600 s de combustível**; depois vira **vareta gasta** |
| **Barra de controle** | 1, 2, 3 | ₵ 6 000 | as varetas nas 8 vizinhas rendem **−50 %** de calor e duram **×2**; duas barras vizinhas não somam |
| **Turbina a vapor de alta pressão** | 1 | ₵ 15 000 | só adjacente ao Vaso; consome 12 % de `Q` por segundo; **8 kW por u** |
| **Torre de resfriamento** | 1 | ₵ 12 000 | dissipa **30 u/s** do Vaso |
| **Piscina de resfriamento** | 1 | ₵ 20 000 | **+250 u** de capacidade compartilhada; varetas gastas nas 8 vizinhas **trocam na hora** e o calor de decaimento delas vai para a piscina, não para o Vaso |

Pesquisa do Núcleo: 🔬/s = kW × **0,01** × multiplicador da faixa (a Era 1 usava 0,1; a potência subiu ×50, a pesquisa ×5).

**Níveis das peças (v0.8, Parte 1 §7.1).** Vareta, Turbina de alta pressão, Torre e Piscina têm nível incremental por tipo, comprado no painel do Núcleo: custo `5 × custo da peça × 2ⁿ`, **+10 % por nível** (calor da vareta, kW por u, dissipação, capacidade), máximo 5. Barra de controle e Vaso não têm nível. Subir o nível das varetas sobe `Q*` e o decaimento junto (7 % do nominal, já com o nível). O painel do Núcleo ganha **"Trocar todas as gastas"** (uma ação, cobra a soma, só as que já podem). *(Sessão 9: é tudo ou nada — sem ₵ para o lote inteiro, recusa, porque o GDD fala em cobrar a soma e não em troca parcial —, e um lote feito na zona de ouro conta **uma** troca em faixa para o capítulo "Troca escalonada": trocar tudo junto não é escalonar.)*

### 5.2 Esgotamento e calor de decaimento
- Cada vareta tem `combustivelS` (600 s; ×2 com barra vizinha; ×1,5 com o nó MOX). Consome só enquanto o reator está ligado.
- Ao zerar, a vareta vira **gasta**: continua na casa e injeta **7 % do calor nominal**, caindo pela metade a cada **60 s** (meia-vida). Física: ao parar a fissão, os produtos de fissão seguem decaindo e liberam ≈ 7 % da potência térmica no primeiro instante, ≈ 1 % depois de uma hora.
- **Trocar** uma vareta gasta custa ₵ 8 000 (o combustível) e só é permitido depois de **3 meias-vidas (180 s)**, quando o decaimento está em 0,875 % do nominal — **ou na hora, se ela está nas 8 vizinhas de uma Piscina**. Enquanto espera, ocupa a casa. *(Sessão 8: o cruzamento exato de 1 % acontece em log₂(7) = 2,81 meias-vidas, 168 s; a regra usa as 3 meias-vidas cheias porque é o número redondo que o teste obrigatório de §5.3 escreve, e já está abaixo do limiar.)*
- **SCRAM na Era 2** insere as barras: todas as varetas entram em decaimento (7 % com meia-vida de 60 s) por **no mínimo 60 s**; religar leva **30 s**, e as varetas voltam de onde estavam (combustível não some). O calor de decaimento **entra no Vaso**: a torre de resfriamento é o que segura `T` depois de um SCRAM.
- **Cascata na Era 2** é a mesma (peças sobrecarregadas e adjacentes viram entulho, reconstruir 50 %, limpar grátis após 30 s), com um agravante: varetas viram **entulho quente** (mantêm o decaimento) e o Vaso **não perde `Q`**. Se `T` passar de 100 % de novo, a Cascata repete. O card explica; a Piscina e a torre são a resposta.
- Nada é comprado offline; **varetas esgotam offline** (o tempo passa no combustível) e o reator roda em modo seguro (×0,7, Parte 1 §7). Térmicas a gás cobram combustível offline ×0,5, como a receita. *(Sessão 9: a potência, a 🔬 e a Estabilidade offline acompanham o esgotamento — a ausência é integrada em trechos até a última vareta acabar e o decaimento cair —, e o Vaso volta no equilíbrio do fim da ausência. Antes, 8 h fora rendiam 48× o que rendem 10 min com as mesmas varetas.)*
- **A Estabilidade só sobe com fissão** (Sessão 9): na Era 2 o Núcleo conta como operando para a Estabilidade só com pelo menos uma vareta com combustível e fora do SCRAM. O calor de decaimento de um reator sem combustível ainda gira as turbinas e rende um resto de kW e de 🔬, mas não faz a barra andar. Medido antes da correção: com todas as varetas gastas, a faixa fria (+1,5/min) enchia a barra em ≈ 90 min com o reator morto, online e offline.

### 5.3 Exemplos de referência (viram testes, como §8.3 da Parte 1)

`Q*` = calor de entrada ÷ (0,12 × turbinas); `T* = Q* ÷ capacidade`. Capacidade 500 u sem piscina.

| Configuração | Entrada (u/s) | `Q*` (u) | `T*` | Resultado |
|---|---|---|---|---|
| 6 varetas (4 no anel 1 + 2 no anel 2), 2 turbinas | 100 | 416,7 | **83 %** | **zona de ouro, 800 kW**, 🔬 10,4/s |
| 7 varetas (4 + 3), 2 turbinas | 110 | 458,3 | 92 % | alerta |
| 8 varetas (4 + 4), 2 turbinas | 120 | 500 | 100 % | assintótico: nunca passa, nunca cascateia |
| 8 varetas (4 + 4) + 1 no anel 3 (7×7), 2 turbinas | 125 | 520,8 | 104 % | **Cascata** 5 s depois de passar de 100 % |
| 6 varetas, 2 turbinas, 1 torre | 100 − 30 | 291,7 | 58 % | normal, 560 kW |
| 6 varetas compradas juntas, aos 600 s | 7 (decaindo) | 29 | 6 % | frio, **56 kW**: a Rede sente o buraco se o reator era parte grande da oferta |
| 3 das 6 (anel 1) com uma barra vizinha | 30 + 40 = 70 | 291,7 | 58 % | normal, 560 kW; as 3 duram 1 200 s: **troca escalonada de graça** |
| 6 varetas + Piscina (cap. 750) + 2 turbinas | 100 | 416,7 | 56 % | normal; a piscina compra margem e cobra em pesquisa, como o tanque da Era 1 |

> **Correção da Sessão 8 (produção).** A coluna "Entrada" desta tabela é o contrato e não mudou; a
> repartição por anel entre parênteses estava errada nas linhas de 7 e 8 varetas (com 20 u/s no anel 1,
> "5 + 2" daria 120 u/s, não 110). Os números só fecham com **4 varetas no anel 1** — o que o anel
> permite junto com as 2 turbinas — e o resto no anel 2. Corrigido acima; os testes são estes.

Teste obrigatório da Sessão 8, no espírito da regra 2 do `CLAUDE.md`: "6 varetas + 2 turbinas estabilizam em 83 % e não cascateiam em 120 s; a 9ª vareta dispara a Cascata 5 s depois de `T` passar de 100 %; aos 600 s as 6 esgotam e a potência cai para 56 kW; com Piscina vizinha a troca é imediata, sem ela só após 180 s."

### 5.4 Ocorrências da Era 2 (v0.9, Parte 1 §4.4)

Mesmas regras da Parte 1 §4.4 (oferta a cada 4 min de jogo ativo, 60 s para aceitar, opcionais, nunca offline, recompensa 🛡 +3 ou 🔬 igual a 60 s da produção). O controle da Era 2 são as **Barras de controle**. O jogador escolhe a **potência das varetas ativas**, de 50 % a 125 % da nominal: menos potência = barras mais inseridas, mais potência = barras retiradas. Em 100 % as barras ficam na posição de operação, parcialmente inseridas, e é isso que deixa espaço para retirar até 125 %. O MotorCalor da Era 2 separa a injeção ativa do decaimento, e o controle e o Xenônio multiplicam só a ativa. As barras não mexem no **decaimento** (varetas gastas, SCRAM): a fissão para, o decaimento continua, como §5.2 ensina. O controle multiplica por cima da peça Barra de controle (−50 % nas vizinhas).

A primeira oferta de um save que chega à v10 já na Era 2 é o Xenônio (a Nuvem exige heliostato, que o Reator não tem), e depois de um SCRAM a próxima oferta também é o Xenônio: é o poço de iodo de verdade, e a causa fica à vista. Fora disso o cartão da oferta diz a causa ("Xenônio · o reator passou a noite em potência baixa"). A coluna do meio usa a primeira linha de §5.3: 6 varetas (4 + 2), 2 turbinas, entrada 100 u/s, `Q*` = 416,7 u, `T*` = 83 %, 800 kW.

| Ocorrência | Perturbação | Duração | Exige | Sem mexer no controle | Resposta |
|---|---|---|---|---|---|
| **Seguimento de carga** | meta de potência: o Núcleo entre **65 % e 75 %** da potência de antes | 60 s | 1 vareta ativa | fica em 100 %: não supera (sem risco) | barras: potência 70 %, 560 kW, `T` = 58 % |
| **Xenônio** | injeção das varetas ativas ×0,8, o decaimento não muda (desce em 15 s, fica 30 s, volta em 15 s: exceção às rampas de 5 s) | 60 s | 1 vareta ativa | `Q*` = 333,3, `T` = 67 %: sai do ouro | barras: potência 110–120 % devolve o ouro (paradas em 125 % desde o aceite, passam de 90 % nas rampas e ficam só 69 % no ouro; para segurar 125 % é preciso acompanhar a rampa) |
| **Turbina em meia carga** | uma turbina a 50 % | 30 s | 2 turbinas | `Q*` = 555,6, `T` = 111 %: Cascata | barras: potência 75 % devolve 83 % |

Frases de física:
- Seguimento de carga: "Reatores na França baixam e sobem a potência todos os dias para acompanhar o consumo, movendo barras de controle."
- Xenônio: "Horas depois de um reator baixar a potência ou desligar, o iodo-135 acumulado ainda vira xenônio-135, que engole nêutrons: o reator perde reatividade e o operador retira barras para compensar. No jogo, as horas viram segundos."
- Turbina em meia carga: "Quando a turbina perde carga de repente, o vapor que sobra é desviado direto para o condensador e as barras entram para baixar a potência. Em alguns reatores, como os de Palo Verde, um grupo inteiro de barras cai de uma vez."

*(v0.9)* A "Onda de calor" (torres rendendo menos com ar quente e úmido), citada na proposta, ficou de fora por ora: a torre dissipa um valor fixo (30 u/s), e pela metade ela sobe `T` 12,5 pontos (capacidade 500, 2 turbinas). Isso só tira do ouro grades com `T*` acima de 77,5 %, por exemplo 8 varetas (5 + 3) com 2 turbinas e 1 torre, que vão de 83 % a 96 %; com 4 + 4 fica em 75 % → 87,5 %. É a mesma ordem do Xenônio (16,7 pontos). Volta se a simulação da Sessão 10 mostrar grades com torre acima de 77 % ou com várias torres.

## 6. Árvore da Era 2 (🔬 gasto; cada nó com uma frase de física de verdade)

Custos na régua ×10 da Era 1 (a árvore da Era 1 somou ≈ 🔬 22 mil; esta soma **🔬 193 mil**, 194,5 mil com as Escavadeiras da v0.8). A produção escreveu as frases e conferiu os números.

*(Sessão 8, medido.)* O reator sozinho rende 🔬 10,4/s na zona de ouro — 37 mil por hora, um quinto da árvore. **Quem paga a árvore da Era 2 é a cidade:** com 25 universidades e a população da era, a simulação mede ≈ 🔬 73/s, e o bot compra o caminho todo até a saída em 61 minutos. O reator é a fonte que **não depende de espaço**; as universidades são a que escala.

- **Fissão:** Barra de controle (🔬 500) → Piscina de resfriamento (🔬 2 000) → Enriquecimento a 5 % (varetas +25 % de calor, 🔬 6 000) → Combustível MOX (vida ×1,5, 🔬 9 000) → **Reator 7×7** (🔬 15 000 + ₵ 150 000). Escolha exclusiva no fim (🔬 25 000 cada): Água pesada (varetas duram ×2, −15 % de calor) × Alta temperatura (+30 % de kW por u, vida ×0,7).
- **Térmica:** Ciclo combinado (térmica +30 %, 🔬 3 000) → Cogeração (bairros a ≤ 2 casas: tarifa +10 % em vez de −10 %, 🔬 8 000) → Selo verde (captura de carbono: tarifa média +5 %, combustível +20 %, 🔬 12 000).
- **Offshore:** Subestação offshore (🔬 1 500) → Fundação flutuante (eólica em mar fundo, 🔬 7 000) → Pás de 100 m (offshore +40 %, 🔬 10 000).
- **Rede:** Subestação de 138 kV (🔬 1 000) → Bateria de rede (🔬 4 000) → Cabo HVDC (🔬 4 000 + ₵ 100 000) → Rede inteligente (bateria de rede ±×2, 🔬 11 000); Escavadeiras (tempos de remoção ÷ 2 de novo, 🔬 1 500, exige Máquinas pesadas da Era 1; v0.8, §3.2).
- **Cidade:** Megacidade (🔬 2 500) → Indústria pesada (🔬 5 000) → Instituto de pesquisa (🔬 3 500); Megacidade → Arcologia (🔬 14 000) → Bombas de calor II (tarifa +10 %, 🔬 9 000). *(Ajuste 4 da Sessão 8: a Arcologia exige só a Megacidade; o instituto é ciência, a arcologia é cidade. O código muda na parte 0 da Sessão 9.)*
- **Saída da era:** **Fusão básica** (🔬 40 000 + ₵ 5 000 000, exige Piscina e Reator 7×7) + Estabilidade 100 % → Era 3 (Sessão 11). Aqui o jogo para com um aviso até a Era 3 existir.

Os nós da Era 1 continuam valendo (Lâminas, Torre mais alta etc. seguem multiplicando as usinas da Era 1).

## 7. Capítulos e cards da Era 2

**Capítulos** (um ativo por vez no HUD; recompensas em ₵ ou 🔬 na régua da era): O Vaso (construir o reator) → Primeira vareta → Zona de ouro a 800 kW → Uma torre de resfriamento → Troca escalonada (trocar uma vareta sem sair da faixa) → 138 kV → Cinco offshore → Uma térmica → 10 MW instalados → Megacidade → Indústria → Estabilidade 100 %.

**Card "Calor de decaimento"** (transição, 3 telas): (1) o urânio que se parte solta calor e nêutrons; (2) desligar para a fissão, não o decaimento: 7 % do calor continua, e cai devagar; (3) por isso todo reator tem piscina e torre, e por isso as varetas gastas ficam quentes na grade. Cards curtos ao primeiro esgotamento, ao primeiro SCRAM da era, à primeira offshore e à primeira térmica ("produzir agora custa").

## 8. Arte da Era 2 (complementa §10 da Parte 1)
- Paleta **entardecer**: mesmos tokens com o céu e o mar um passo mais escuros, luzes quentes nos bairros, brilho do Sol baixo na água.
- **Reator**: cilindro com cúpula sobre a plataforma, duas torres hiperbólicas quando há torre de resfriamento, vapor branco chapado.
- **Vareta**: barra vertical com gradiente de calor que **apaga de cima para baixo** conforme o combustível acaba; gasta = cinza com brilho residual que esmaece com o decaimento (o jogador vê o 7 % sumindo).
- **Barra de controle** = barra escura que "abraça" as vizinhas (halo tênue sobre as 8 casas). **Piscina** = quadrado azul-claro com ondulação.
- Construções 2×2 com base única (fazenda solar em fileiras, térmica com chaminé, distrito com galpões, instituto com cúpula).
- Bipe de troca de vareta (o Bipe de manutenção da Era 1 com luvas grossas).

## 9. Sumidouros da Era 2 (Parte 1, §7: nada acumula sem sumidouro)
- **₵**: entrada da era (₵ 200 mil), Vaso e peças, combustível das varetas (₵ 8 mil a cada 10 min por vareta), combustível das térmicas (₵ 300/s cada), evoluções ×10, Reator 7×7, HVDC, Fusão básica (₵ 5 milhões).
- **🔬**: árvore de ≈ 🔬 190 mil, evoluções 5 e 6, saída da era.
- **Espaço**: 2×2 em terra, mar raso finito, universidades a 1 por 2 000 habitantes.
- **Calor**: combustível finito e decaimento fazem o reator pedir atenção periódica, não só na montagem.
- **Melhorias incrementais** (v0.8): níveis de usina, de peça, de subestação e de cabo, e a evolução da cidade inteira, com custos que crescem ×3 por degrau — o ₵ do fim da era tem onde ir antes da Era 3. **Ciência com nível** (v0.9, §4.2): o ₵ parado vira 🔬, que é o que trava o fim da era.
- **Tempo de espera** (v0.9): as Ocorrências (§5.4) trocam a espera por 🔬 e por 🛡 por operação do reator.

---

*v0.7 — Parte 2 criada com a Era 2 completa (transição, Rede, cidade, Reator PWR, árvore, capítulos, arte, sumidouros) para a Sessão 8.*
*v0.7.1 — correções da produção da Sessão 8, medidas na simulação das duas eras: repartição por anel da tabela de §5.3 (a coluna "Entrada" não mudou); troca de vareta em 3 meias-vidas cheias (§5.2); curva de ₵ da densidade 5 (§4.1); quem paga a árvore da Era 2 (§6). **Ritmo medido: a Era 2 fecha em 60,9 min** (alvo 50–70), com a receita líquida do bot nunca negativa. Detalhes em `docs/sessoes/sessao-8-relatorio.md`.*
*v0.8 — níveis por tipo nas usinas, subestações, cabos e peças da Era 2; "Trocar todas as gastas"; nó Escavadeiras; sumidouro das incrementais (§3.2, §5.1, §9). A Era 3 passa para a Sessão 10.*
*v0.9 — Ocorrências da Era 2 com as Barras de controle (§5.4); Estabilidade 1,8/1,2 + Ocorrências (§5); ciência com nível e o Instituto nela (§4.2, §9); Arcologia exigindo só a Megacidade, registrada (§6, ajuste 4 da Sessão 8); a Era 3 passa para a Sessão 11. Ver `docs/correcoes-gdd-v0.9.md`.*
