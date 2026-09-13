# KARDASHEV (codinome) — Documento de Design v0.6 · Parte 1 de 2

> Parte 1: conceito, os três sistemas, Cascata, economia, Era 1 completa, direção de arte, arquitetura e roteiro de sessões.
> Parte 2 (próximo passo): Eras 2–6 detalhadas, prestígio, roteiro dos cards explicativos.

---

## 1. Conceito em uma frase

Você começa com cata-ventos numa colina e termina cercando uma estrela. Um idle de gerenciamento de energia em duas camadas: a **Rede** (lista de usinas, números) e o **Núcleo** (grade de peças, geometria). Três balanças precisam ficar na faixa; sair dela dispara uma **Cascata**, que não encerra o jogo, mas faz você **voltar uma etapa**.

**Referências:** Reactor – Energy Sector Tycoon (usinas, calor que vira energia ou explode, pesquisa, novos locais) · estética flat-vector de infográfico científico, cores saturadas sobre fundo escuro (mascotes e identidade originais).

**Plataforma:** web (Vite + React + TypeScript + Phaser 3), desktop e mobile-first no navegador. Save local com exportação.

---

## 2. As duas camadas

### 2.1 Rede (colocada) — escala e dinheiro
Usinas, bairros, baterias, laboratórios, universidades e subestações são **colocados casa a casa** no arquipélago (§2.4). Produz **potência** (kW) de forma passiva. Aqui vive a balança **Oferta × Demanda**. Idle-friendly: roda sozinha, cresce com dinheiro — mas **onde** cada coisa fica decide quanto rende (terreno, vizinhos, alcance da subestação). A lista da interface é uma paleta de construção, não um contador.

### 2.2 Núcleo (grade) — risco e pesquisa
Uma **plataforma** no centro do tabuleiro da era com a usina crítica da época (Torre Solar → Reator de fissão → Tokamak → Anel de antimatéria → Reator de buraco negro → Enxame de Dyson). A **posição importa**: peças trocam calor com vizinhas. Aqui vivem as balanças **Calor** e, a partir da Era 3, **Contenção**. É a **única fonte de Pesquisa** e o único lugar onde a Cascata acontece.

### 2.3 Acoplamento entre camadas (o que faz o híbrido valer)
- O Núcleo gera Pesquisa; Pesquisa desbloqueia usinas da Rede e a próxima era. Sem Núcleo bem operado, a Rede estagna.
- A partir da Era 3 o Núcleo **consome potência da Rede** para a contenção. Apagão na Rede → contenção cai → Cascata. A balança "tranquila" passa a ter dentes.
- O Núcleo produz potência que também vai para a Rede (e conta para o medidor Kardashev).

---

### 2.4 Tabuleiro: arquipélago, obstáculos e escalas (v0.6)
As duas camadas moram no **mesmo tabuleiro**: um **arquipélago no mar**, com **2048 casas de terra** repartidas em oito ilhas (grade de 64×64 casas, forma orgânica por ruído, semente fixa por era). A plataforma do Núcleo (7×7) fica na ilha principal. Entre as ilhas, mar; na borda de cada uma, água rasa (litoral). O espaço só aparece nos níveis superiores da escada.

- **Tudo se coloca.** Escolhe-se um prédio na paleta e toca-se numa casa livre. Remover devolve metade do custo. Nada é alocado sozinho.
- **Espaço é conquistado.** As ilhas nascem ocupadas por floresta, arbustos, pedras, montanhas (2×2) e pântano. Cada obstáculo tem custo em ₵ (montanha também em 🔬) e um tempo de remoção, executado por um Bipe de manutenção. Picos são permanentes e dão vento aos vizinhos. Só a ilha principal está aberta no começo; as demais exigem uma **expedição** (₵) e, para vender energia na rede principal, um **cabo submarino** (₵ por casa de mar) entre dois litorais.
- **Terreno importa.** Colina: vento +25 %. Litoral: vento +50 %. Planície: sol +15 %. Água não constrói. O chão de uma casa é planície, colina, litoral ou rocha; floresta, pântano, arbusto, pedra, montanha e pico são **obstáculos em cima do chão** — e floresta e pântano nascem sempre sobre planície, então desmatar devolve planície.
- **Vizinhos importam.** Esteira: cada vizinho eólico ortogonal tira 20 % de um cata-vento ou turbina eólica (mínimo 40 %). Sombra: cada vizinho alto ortogonal (turbina eólica, árvore, montanha, torre) tira 30 % de um painel (mínimo 40 %).
- **Subestação escoa.** Uma usina só vende se estiver a até 3 casas (distância de Chebyshev) de uma subestação, e cada subestação tem um teto de kW. Usina sem escoamento produz e mostra "sem escoamento". Bairros também precisam de subestação no alcance. A bateria continua global (§4.1).
- **Escalas.** A escada ilha → planeta (Tipo I) → sistema estelar (Tipo II) → galáxia (Tipo III) → universo (Tipo IV) → multiverso (Tipo V) fica como na v0.5, com a ordem **crescente da esquerda para a direita** (ou de baixo para cima) e degraus que crescem de tamanho. O nível 0 chama-se "Arquipélago". Tipos IV e V são ficção declarada.
- **Eras × níveis.** Eras 1 e 2 no arquipélago; a Era 3 abre o planeta (outros arquipélagos); Eras 4 a 6 no sistema; galáxia em diante é prestígio (Parte 2). Uma câmera só: a transição de era é a transição da escada. Cascata acima do arquipélago perde a vaga, nunca o nível (Parte 2).

### 2.5 Cidade — bairros, evolução e ciência (v0.6)
A demanda não se compra num contador: ela mora em **bairros** colocados no tabuleiro. Cada bairro tem **densidade** de 1 a 4 (aldeia, vila, cidade, metrópole), com demanda, população e tarifa próprias (§8.6). Evoluir um bairro custa ₵ + 🔬 numa curva **quase exponencial** e nunca acontece sozinho: é uma decisão do jogador. Bairro mais denso pede mais kW e **paga mais por kW**. A população total libera **universidades** (1 por 2 000 habitantes), que geram 🔬 proporcional à raiz da população: mais gente, mais ciência. O **laboratório** dá a primeira ciência antes do Núcleo. A cidade cresce na medida da energia que você entrega e do que investe nela, não do botão que aperta.

---

## 3. Recursos## 3. Recursos

| Ícone | Recurso | Unidade | Onde vive | Papel |
|---|---|---|---|---|
| ₵ | Créditos | ₵ | global | compra tudo |
| ⚡ | Potência | kW (prefixos SI reais) | Rede + Núcleo | vendida até a demanda |
| 🔋 | Bateria | kWh (±10 kW por unidade) | Rede | amortece a balança Oferta × Demanda |
| 🏙 | Demanda | kW | bairros | quanto a cidade compra |
| 👥 | População | habitantes | bairros | soma das densidades; libera universidades (v0.6) |
| 🔥 | Calor | u (unidades) | Núcleo | produzido e dissipado por peças |
| 🔬 | Pesquisa | pontos | Núcleo, laboratórios, universidades → global | **gasta** na árvore, em desbloqueios, em evoluções de bairro e em obstáculos grandes (v0.6) |
| 🛡 | Estabilidade | 0–100 % | Núcleo | progresso da era; a Cascata derruba |
| 🧲 | Contenção | margem % | Núcleo (Era 3+) | campo × pressão |

Números em JavaScript puro (double) bastam: a Esfera de Dyson chega a ~10²⁶ W, longe do limite de 10³⁰⁸. Sem biblioteca de big numbers.

---

## 4. As três balanças

Cada balança tem uma **zona de ouro** (bônus), uma **zona neutra** e **zonas de falha**. O jogador é premiado por operar perto do limite, não longe dele.

### 4.1 Oferta × Demanda (Rede) — razão r = potência ofertada ÷ demanda
| Faixa | Efeito |
|---|---|
| r < 0,8 | **Apagão**: preço ×0,5 (multa contratual). Era 3+: contenção perde potência |
| 0,8–0,9 e 1,1–1,25 | neutro |
| **0,9–1,1** | **zona de ouro**: preço ×1,25 |
| r > 1,25 | **Saturação**: preço ×0,75; excedente vai para a bateria, o resto é desperdiçado |

A bateria carrega com excedente e descarrega em déficit, então a balança tolera oscilação curta, não desequilíbrio sustentado. Cada unidade tem **+20 kWh** e **±10 kW** de potência de carga/descarga. A faixa é decidida assim:

- `r` bruto = potência ofertada ÷ demanda, sem a bateria. Se está na zona de ouro → ouro.
- Senão, se a bateria cobre **todo** o déficit (limitada pela potência e pela energia guardada) ou absorve **todo** o excedente (limitada pela potência e pelo espaço) → faixa **neutra** do lado correspondente.
- Senão → faixa do `r` bruto (apagão ou saturação).

**A bateria transforma falha em neutro, nunca em ouro.** O multiplicador vale para toda a energia vendida no tick (direta + descarga).

### 4.2 Calor (Núcleo) — T = calor armazenado ÷ capacidade do componente crítico
| Faixa | Efeito |
|---|---|
| < 40 % | seguro e lento: pesquisa ×0,5 |
| 40–70 % | normal |
| **70–90 %** | **zona de ouro**: pesquisa ×1,3 e Estabilidade sobe mais rápido |
| 90–100 % | alerta (barra pisca, som) |
| > 100 % por 5 s | **Cascata** (o calor acumula acima da capacidade; nunca é truncado em 100 %) |

Fisicamente coerente: turbinas rendem mais com o receptor quente (Carnot), por isso a zona de ouro é quente e perto do limite. Isso também torna o sistema **auto-estabilizante**: o consumo das turbinas cresce com a temperatura, então cada configuração de peças converge para uma temperatura de equilíbrio. O jogador ajusta a proporção espelhos/turbinas para cair na faixa — não precisa "pilotar" a barra segundo a segundo.

### 4.3 Contenção (Núcleo, Era 3+) — margem = (campo − pressão) ÷ pressão
Bobinas geram campo e consomem potência da Rede; células de plasma geram pressão. Margem entre 5 % e 20 % é zona de ouro (energia ×1,2). Margem < 0 por 3 s → Cascata. Detalhes na Parte 2.

---

## 5. Cascata — o "voltar um pouco"

**Gatilhos:** Calor > 100 % por 5 s, ou Contenção < 0 por 3 s. Os 5 s de tolerância são o tempo de reagir (desligar uma peça, comprar um radiador).

**Efeitos (Era 1; as eras seguintes variam a receita):**
1. As peças sobrecarregadas e as adjacentes ao ponto crítico viram **entulho**. Reconstruir custa 50 %; limpar sem reconstruir é grátis após 30 s.
2. **Estabilidade −30 pontos.** Esse é o "voltar uma etapa": a barra que libera a próxima era regride.
3. **SCRAM**: Núcleo desligado por 20 s — sem pesquisa, sem potência do Núcleo.
4. Bateria −10 %.
5. Pesquisa acumulada **não** é perdida (não punir duas vezes).

**Apresentação:** onda de choque branca a partir do ponto crítico, tremor leve de tela, e um **card explicativo** no estilo infográfico: "O que aconteceu: o calor excedeu a dissipação por 5 s. Cada turbina extra a mais teria…". O jogo ensina em vez de só punir.

**Modo seguro (toggle):** SCRAM automático a 95 %, com potência do Núcleo ×0,7. Existe para quem quer jogar idle; quem joga ativo ganha mais operando na mão. Offline o modo seguro é sempre ligado.

---

## 6. Progressão e eras

- **Estabilidade** sobe enquanto o Núcleo opera dentro da faixa (mais rápido na zona de ouro). Chega a 100 % → habilita o botão da próxima era.
- **Próxima era** exige: Estabilidade 100 % + pesquisa específica concluída + custo em ₵.
- A era nova traz: novo cenário (a câmera afasta: colina → cidade → oceano → órbita → espaço profundo → estrela), nova grade com peças novas, novas usinas na lista, e **uma balança que muda de natureza**.

| Era | Cenário | Núcleo | O que muda na balança |
|---|---|---|---|
| 1 Vento e Sol | colina | Torre Solar (CSP) | só Calor; aprende o básico |
| 2 Fissão | cidade e rio | Reator PWR | combustível esgota; peças gastas **continuam quentes** (calor de decaimento) |
| 3 Fusão | plataforma no oceano | Tokamak | entra a **Contenção**, que consome potência da Rede |
| 4 Antimatéria | órbita / Lua | Anel acelerador | no vácuo só se dissipa por radiação: radiadores rendem menos; armadilhas precisam de energia constante |
| 5 Buraco negro | espaço profundo | Reator Hawking | balança **invertida**: massa baixa demais explode, alta demais rende pouco |
| 6 Dyson | a estrela | Enxame de coletores | balança de **luz**: cobrir demais a estrela congela as colônias (demanda colapsa) |

**Medidor Kardashev:** `P` = potência **instalada** em watts, `(ofertaUsinasKw + ofertaNucleoKw) × 1000` — instalada, não vendida. Barra em `log10` de 10³ W a 10⁵⁰ W, com marcos reais: humanidade em 2026 ≈ 2×10¹³ W, Tipo I = 10¹⁶ W, Tipo II = 10²⁶ W, Sol = 3,8×10²⁶ W, Tipo III = 10³⁶ W; e marcos especulativos, marcados como tais: Tipo IV = 10⁴⁶ W, Tipo V = 10⁵⁰ W (multiverso). Índice `K = (log10 P − 6) ÷ 10` (fórmula de Sagan), mostrado com duas casas quando `K ≥ 0` (a partir de 1 MW); antes disso, "abaixo da escala" e o próximo marco. Potência até 10²⁴ W usa prefixos SI; acima, notação científica. O jogador vê onde está de verdade. Os tipos também são os degraus da escada de escalas (§2.4).

**Prestígio** ("Nova simulação"): pós-MVP. Depois da Era 6 (ou a partir da Era 4), reiniciar por **Constantes** permanentes. Definido na Parte 2.

---

## 7. Economia — regras gerais

- **Custo da n-ésima unidade** de uma usina da lista: `custo_base × 1,15^n` (Vilas e cidades: 1,25).
- **Melhoria** (nível): `custo_base × 3^nível`, produção `× (1 + 0,5 × nível)`.
- **Peças da grade:** preço fixo por era, sem inflação por unidade (a limitação é o espaço e o calor, não o preço).
- **Receita/s** = potência vendida (kW) × preço (₵ por kW·s) × multiplicador da balança Rede.
- **Preço base** por era: Era 1 = 1,0; cada era multiplica a escala de potência por ~100 e o preço por ~0,1 (mais watts, menos ₵ por watt — reflete o custo da energia caindo). Números finos das Eras 2–6 na Parte 2.
- **Pesquisa/s** = potência do Núcleo ÷ 10 × multiplicador da zona de calor.
- **Offline:** janela `min(agora − salvoEmMs, 8 h)`; relógio andando para trás conta como 0. Nada é comprado offline. A Rede usa o balanço congelado do save, **sem bateria** (nem carrega nem descarrega) e com receita ×0,5. Núcleo em modo seguro obrigatório: calcula `T*` do equilíbrio da grade salva; se `T* ≥ 95 %`, o Núcleo fica **desligado** o tempo todo (0 kW, 0 🔬, Estabilidade parada) e o jogador é avisado do motivo; senão, potência ×0,7, pesquisa/s da faixa de `T*` ×0,7 e Estabilidade da faixa ×0,7. Ao voltar, `Q = Q*` (limitado a 95 % da capacidade), cronômetro da Cascata e SCRAM zerados. Nunca há Cascata offline. Relatório "Enquanto você esteve fora": tempo, ₵, 🔬, Estabilidade e, se for o caso, "Núcleo ficou desligado: sua configuração passaria de 95 %".
- **Nada acumula sem sumidouro (v0.6):** todo recurso tem para onde ir e todo número tem como evoluir, do consumo à produção. ₵ se gasta em colocar, evoluir, desmatar e expedir; 🔬 se gasta na árvore; potência sem subestação com folga é **desperdiçada** (aparece como "sem escoamento") até o jogador evoluir subestações ou bairros; calor dissipa ou vira Cascata; população só cresce com bairro evoluído; Estabilidade para em 100 % e vira a próxima era. Vale para a cidade e para o Núcleo: cada peça do Núcleo tem três níveis na árvore (heliostato de dois eixos, turbina de alta pressão, radiador ativo, tanque de dois sais) e o Receptor evolui pelo cerâmico e pela Grade 7×7. Um recurso que só sobe sem decisão é um defeito de design a corrigir.
- **Colocação (v0.6):** cada prédio tem custo base × 1,25ⁿ por unidade colocada do mesmo tipo (usinas mantêm 1,15ⁿ). Remover devolve 50 %. Obstáculos: custo fixo por tipo + tempo de remoção. Expedição por ilha e cabo submarino por casa de mar (§8.5). Evolução de bairro: `₵ 250 × 2,5^(densidade − 1)` + 🔬 (30, 150, 600). Tarifa por kW vendido cresce com a densidade média dos bairros atendidos (×1, ×1,15, ×1,3, ×1,5).
- **Ritmo definido:** ~60 min de jogo ativo por era. Estabilidade sobe +1,5 pontos/min na faixa normal e +2,5/min na zona de ouro (100 % em 40–65 min, contando paradas e Cascatas).

---

## 8. Era 1 — Vento e Sol (completa)

### 8.1 Estado inicial
₵ 50 · a aldeia da ilha principal = **1 bairro de densidade 1** (8 kW de demanda, §8.6) · potência 0 · Núcleo bloqueado.
A demanda não tem mais valor de base: ela é a soma dos bairros atendidos por subestação (v0.6, Sessão 6).

### 8.2 Rede
| Usina | Custo base | Potência | Desbloqueio |
|---|---|---|---|
| Cata-vento | ₵ 15 | 1 kW | início |
| Painel solar | ₵ 60 | 3 kW | 5 cata-ventos |
| Turbina eólica | ₵ 120 | 6 kW | 🔬 40 |
| Bateria | ₵ 80 | +20 kWh de capacidade | 🔬 20 |
| Vila | ₵ 40 | +8 kW de demanda | início (custo ×1,25) |

Melhorias da Rede (lista): **Lâminas de fibra** (₵ 200): cata-vento e turbina eólica +25 %. Compra única; 🔬 é requisito acumulado, não gasto.

### 8.3 Núcleo: Torre Solar (grade 5×5 na plataforma 7×7 da ilha, centro fixo)
Desbloqueio: ₵ 100 (tutorial guiado: "construa o receptor").

| Peça | Custo | Função |
|---|---|---|
| **Receptor** (centro, fixo) | — | capacidade 100 u; converte calor via turbinas adjacentes |
| Heliostato (espelho) | ₵ 30 | +4 u/s no Receptor se adjacente (anel 1); +2 u/s no anel 2 |
| Turbina a vapor | ₵ 50 | só adjacente ao Receptor; consome `0,12 × calor armazenado` u/s e gera 0,8 kW por u consumida |
| Radiador | ₵ 40 | −6 u/s no Receptor se adjacente |
| Tanque de sal fundido | ₵ 60 | adjacente ao Receptor: +150 u de capacidade compartilhada (amortece picos) |

**Anéis:** anel 1 = as 8 casas vizinhas do Receptor, diagonais incluídas; anel 2 = as 16 casas restantes do 5×5.

**A tensão de projeto:** o anel 1 tem só 8 casas. Cada casa é espelho a 100 % **ou** turbina **ou** radiador. O jogador escolhe a proporção.

**Equilíbrio (por que funciona):** com `h` espelhos efetivos (anel 1 conta 1, anel 2 conta 0,5), `t` turbinas e `rad` radiadores adjacentes, `dQ/dt = 4·h − 6·rad − 0,12·t·Q`, e o calor converge para `Q* = (4·h − 6·rad) ÷ (0,12·t)` — sem radiador, `33,3 × h ÷ t` unidades. A aproximação é assintótica: `Q` encosta em `Q*` e não passa. Exemplos com capacidade 100:
| Configuração | Q* | Resultado |
|---|---|---|
| h = 5 (4 no anel 1 + 2 no anel 2), t = 2 | 83,3 | **zona de ouro**, 16 kW (8 kW por turbina) |
| h = 5,5, t = 2 | 91,7 | alerta |
| **h = 6, t = 2** | **100,0** | **limite exato — alerta permanente, nunca cascateia** |
| **h = 6,5, t = 2** | **108,3** | **Cascata 5 s depois** de T passar de 100 % |
| h = 6,5, t = 2, **1 radiador** | 83,3 | volta para a zona de ouro |

**Tanque de sal fundido** aumenta a capacidade sem mudar Q*: com um tanque, T = 100 ÷ 250 = 40 % — sai da zona de ouro e a pesquisa cai para ×0,5. O tanque compra margem e cobra em pesquisa (precisa de card explicativo).

Melhorias do Núcleo: **Rastreamento solar** (₵ 150 + 🔬 30): cada espelho injeta 5 u/s em vez de 4 — isso muda `Q*`, e a marca do equilíbrio na barra move na hora para o jogador perceber que precisa reajustar · Receptor cerâmico (capacidade +50, ₵ 300 + 🔬 80) · **Grade 7×7** (₵ 800 + 🔬 150): o 5×5 é embutido no 7×7 com deslocamento (+1, +1), peças e entulho preservados; o anel 3 (24 casas externas) pesa 0,25 e só aceita heliostato.

**Consequência de balanço do 7×7:** com 2 turbinas e todas as casas de espelho, `h` chega a 6 + 8 + 24 × 0,25 = 20 → `Q* = 333 u`, que só cabe na zona de ouro com tanques (3 tanques → capacidade 550 → `T* ≈ 61 %`; 2 tanques + Receptor cerâmico → 450 → `T* ≈ 74 %`). A grade grande existe para ser usada **junto** com os tanques; a dica da barra de calor continua valendo.

### 8.4 Saída da Era 1
Estabilidade 100 % + pesquisa "Fissão básica" (🔬 3 000) + ₵ 50 000 → Era 2. (Com o Núcleo em ~16 kW na zona de ouro, 🔬 3 000 leva 20–30 min de operação.) Card explicativo de transição: de kW para MW.

---

### 8.5 Arquipélago da Era 1 (v0.6)

| Ilha | Casas | Terreno dominante | Expedição | Nasce com |
|---|---|---|---|---|
| Principal | 640 | planície, colinas ao norte | aberta | Núcleo, aldeia (1 bairro d1), 1 subestação, ~45 % de obstáculos |
| Ventania | 320 | colinas e picos | ₵ 600 | pinheiros esparsos, 3 picos |
| Solar | 300 | planície | ₵ 1,8 mil | arbustos, pedras |
| Costa | 260 | litoral largo | ₵ 4,5 mil | pântano, árvores |
| Bosque | 220 | floresta densa | ₵ 9 mil | 90 % de árvores |
| Pedreira | 160 | montanhas, cristais | ₵ 20 mil | 4 montanhas 2×2, cristais |
| Recife | 96 | litoral | ₵ 45 mil | pedras |
| Farol | 52 | rocha | ₵ 100 mil | pico, vazio |

Cabo submarino: ₵ 150 + **₵ 120** por casa de mar, entre os dois litorais mais próximos; sem cabo, a ilha só alimenta bairros e subestações dela mesma (a energia que sobra vira "sem escoamento"). O cabo tem **teto próprio de 30 kW**, nos dois sentidos, e **nível** (custo da rota ×3ⁿ, teto ×2ⁿ), como a subestação: ligar a ilha não basta, é preciso dimensionar o cabo. Foi assim que o cabo deixou de ser uma trava (₵ 230–270 contra ₵ 600 a ₵ 100 mil das expedições) e virou decisão contínua (v0.6, Sessão 7).
Obstáculos: arbusto ₵ 3 (1 s), árvore ₵ 8 (3 s), pedra ₵ 25 (8 s), pântano ₵ 60 (10 s), montanha 2×2 ₵ 400 + 🔬 20 (30 s) — **dinamitar devolve 🔬 40 e deixa quatro casas de rocha com cristal** (laboratório ou universidade sobre cristal rende +50 %, §8.6) —, pico permanente (vento +30 % nos vizinhos). Subestação ₵ 120 × 1,25ⁿ, alcance 3, teto 40 kW; nível: custo ×3ⁿ, teto ×2. Todos os números são valores iniciais a recalibrar com a simulação de 60 minutos.

### 8.6 Cidade, laboratório, universidade e árvore da Era 1 (v0.6)

| Densidade | Nome | Demanda | População | Tarifa | Evoluir para a próxima |
|---|---|---|---|---|---|
| 1 | Aldeia | 8 kW | 100 | ×1 | ₵ 250 + 🔬 30 |
| 2 | Vila | 20 kW | 400 | ×1,15 | ₵ 625 + 🔬 150 |
| 3 | Cidade | 48 kW | 1 600 | ×1,3 | ₵ 1 562 + 🔬 600 |
| 4 | Metrópole | 110 kW | 6 400 | ×1,5 | — |

Bairro novo: ₵ 40 × 1,25ⁿ, 1 casa, precisa de subestação no alcance. Laboratório: ₵ 60 × 1,25ⁿ, 🔬 0,2/s, consome 2 kW. Universidade: liberada com 1 000 habitantes, ₵ 400 × 1,5ⁿ, no máximo 1 por 2 000 habitantes, 🔬 0,5/s × √(população ÷ 1 000), consome 5 kW. Núcleo: 🔬 = kW ÷ 10 × faixa, como antes.

**Árvore da Era 1** (🔬 gasto; cada nó vem com um card de uma frase de física):
- Vento: Lâminas de fibra (+25 %, 🔬 25) → Torre mais alta (+40 %, 🔬 80: "a 80 m o vento é 30 % mais forte, e potência cresce com o cubo da velocidade") → Controle de passo (esteira −50 %, 🔬 200) → Rotor de três pás (+15 %, 🔬 400). Escolha exclusiva no fim: Eixo vertical (sem esteira, −20 % de potência) ou Eixo horizontal (mantém).
- Sol: Painel bifacial (+15 %, 🔬 60: "capta a luz que o chão reflete") → Antirreflexo (+8 %, 🔬 120) → Limpeza automática (+10 %, 🔬 250) → Rastreamento solar (Núcleo: 5 u/s por espelho, 🔬 30 + ₵ 150, como antes).
- Rede: Subestação de alta tensão (alcance 5, 🔬 150) → Bateria de fluxo (+50 % de kWh por unidade, 🔬 300).
- Núcleo: Tanque de sal fundido (peça), Receptor cerâmico (🔬 80 + ₵ 300), Grade 7×7 (🔬 150 + ₵ 800), como antes, mas com o 🔬 gasto; e três níveis por peça: Heliostato de dois eixos (+25 % de calor, 🔬 120), Turbina de alta pressão (+30 % de kW por u, 🔬 200), Radiador ativo (dissipa 9 u/s, consome 1 kW, 🔬 180), Tanque de dois sais (+50 % de capacidade, 🔬 220). Nível comprado vale para todas as peças do tipo.
- Cidade: Iluminação eficiente (bairros pedem 10 % menos e pagam o mesmo, 🔬 100) → Bombas de calor (tarifa +10 %, 🔬 350).
Desbloqueios de usina passam a gastar 🔬: turbina eólica 🔬 40, bateria 🔬 20. O Núcleo continua a ₵ 100.

---

## 9. O que faz o jogo surpreender## 9. O que faz o jogo surpreender

1. **Unidades reais e medidor Kardashev** com marcos de verdade (humanidade hoje, Tipo I, Tipo II, o Sol).
2. **Cards explicativos** por era (3 telas, ciência real, tom curioso e direto): Carnot, calor de decaimento, contenção magnética, radiação no vácuo, radiação Hawking, sombra de Dyson.
3. **Balanças que mudam de natureza** a cada era em vez de só crescer números — inclusive uma invertida (Era 5).
4. **Acoplamento entre camadas**: apagão na Rede derruba a contenção do Núcleo.
5. **Cascata como "voltar um pouco"** com card do que deu errado, não game over.
6. **Transição de era com zoom cósmico** e mudança de paleta.
7. **Espaço é conquistado** (v0.6): derrubar uma floresta para caber um parque eólico, ou dinamitar uma montanha e descobrir cristais, é decisão que se vê no mapa.
8. **Detalhes físicos que viram mecânica**: turbina rende mais quente; peça gasta continua quente; no vácuo não há convecção.

---

## 10. Direção de arte (flat-vector de infográfico científico)

**Princípios:** formas geométricas simples (círculo, hexágono, cápsula), sem contorno preto (contorno fino em tom mais escuro do próprio preenchimento, quando houver), **sombra chapada deslocada** 4–8 px na mesma matiz, brilho (glow) só no que está quente ou energizado, muito espaço negativo, tudo com cantos arredondados.

**Fundo:** navy profundo `#0D1230` com gradiente radial para `#241B55`; estrelas como pontos de 1–2 px com opacidade variada.

**Paleta base (tokens):**
| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#F4F6FF` | texto |
| `--muted` | `#9AA3C7` | texto secundário |
| `--card` | `#161B3D` | painéis, raio 16 px, borda `rgba(255,255,255,.08)` |
| `--sun` | `#FFD23F` | Era 1 principal |
| `--sky` | `#4CC9F0` | Era 1 secundária, água |
| `--leaf` | `#6BE585` | grama, positivo |
| `--coral` | `#FF6B6B` | alerta, calor alto |
| `--plasma` | `#FF4FD8` | Era 3 |
| `--ion` | `#7CF5FF` | Era 4 |
| `--void` | `#8A5CFF` | Era 5 |
| `--gold` | `#FFB703` | Era 6 |

**Arquipélago (v0.6):** mar em dois azuis com ondulação lenta cobrindo o palco inteiro (o mar não acaba: nada de ilha flutuando), água rasa clara no litoral, espuma na borda; o Sol aparece como **brilho quente na água** no alto à esquerda, de onde vem a luz de todos os sprites — a câmera olha de cima, então não há linha de horizonte; cabos submarinos como linhas tracejadas sob a água; obstáculos com silhueta própria (montanha 2×2 com neve, pântano com juncos). **Dinheiro** aparece como uma **nota de ₵** desenhada (retângulo arredondado com a esfera da Torre como marca-d'água) ao lado do valor, e tocar abre o extrato (receita por subestação, despesas). **Peças do Núcleo** têm tooltip de uma frase com os números ("Heliostato: +4 u/s de calor no Receptor; no anel 1 vale o dobro") e um card ao desbloquear a torre explicando as cinco peças. **Escada** crescente: o degrau do arquipélago é o menor, o do multiverso o maior.

**Ilha-tabuleiro (v0.5):** projeção isométrica 2:1 (casa de 64×32 px no zoom 1); topo em dois tons de grama por altura, penhasco de rocha roxo-azulada com veios e cristais, sombra chapada da ilha no espaço; lago em dois azuis com margem de areia; caminhos de terra clara na vila; regiões bloqueadas dessaturadas com hachura, borda tracejada e placa de preço com cadeado; contornos suavizados (nada de escadinha). Terreno: `grama #72E076`, `grama2 #55D162`, `gramaEsc #35AD60`, `rocha #5B4CB5`, `rocha2 #3E3488`, `aguaFunda #2B8FD6`, `caminho #D6C48E`, `areia #E8D9A3`. Fundo por nível: ilha com o Sol grande no canto superior-esquerdo (luz de cima-esquerda em todos os sprites), planeta azul-profundo, sistema com o Sol dominando, galáxia em `--void`, universo com filamentos `--ion`, multiverso em `--plasma` escuro. De longe (zoom < 0,45) os objetos viram silhuetas; abaixo de 0,22 viram pontos de cor-chave (modo mapa). O Receptor é o único glow forte da ilha em qualquer zoom.

**Rampa de calor** (corpo negro, física de verdade): frio `#3A6FF2` → `#FFD23F` → `#FF7A1A` → branco `#FFFFFF` em 100 %. A cor da peça diz a temperatura sem precisar ler número.

**Tipografia:** Outfit (títulos, geométrica) + Nunito (texto), números tabulares. Fontes abertas.

**Movimento:** ease-out-back nos "pops" de compra; respiração de 2 s no Núcleo; partículas de calor subindo; onda de choque radial na Cascata; transição de era = câmera afasta em 3 s com troca de paleta.

**Mascotes originais:** os **Bipes** — robôs esféricos de manutenção com uma antena e um olho único. Aparecem nos cards explicativos, no tutorial e limpando entulho depois da Cascata. Sem passarinhos, sem logo de terceiros.

---

## 11. Arquitetura

```
src/
  sim/        # TypeScript puro: estado, tick de 100 ms (timestep fixo), fórmulas,
              # balanças, Cascata, save/load com migração de versão. Sem React, sem Phaser.
              # Testável com Vitest (ex.: "6,5 espelhos efetivos e 2 turbinas cascateiam em 5 s").
  ui/         # React: HUD, lista da Rede, balanças, cards explicativos, menus, medidor Kardashev.
  scene/      # Phaser 3: GridScene (Núcleo), rampa de calor, partículas, Cascata, transição de era.
  content/    # dados das eras (peças, usinas, preços, textos dos cards) em JSON/TS.
  store/      # Zustand: snapshot do estado do sim para React e Phaser.
```
- O sim é a única fonte de verdade; React e Phaser só leem e despacham ações.
- Save: localStorage a cada 10 s + exportar/importar JSON.
- Offline: no load, calcula o tempo ausente e aplica as regras da seção 7.
- Mobile-first: grade com toque/arrastar, HUD em uma coluna.

---

## 12. Roteiro de sessões no Claude Code

| Sessão | Entrega | Pronto quando |
|---|---|---|
| 1 | Scaffold Vite + React + TS + Phaser; `sim/` com tick; Rede da Era 1; balança Oferta × Demanda; HUD mínima | comprar cata-ventos e vilas, ver o preço mudar com r |
| 2 | Grade da Torre Solar em Phaser; Calor; zona de ouro; Cascata com entulho e SCRAM; Estabilidade; save | reproduzir os exemplos da seção 8.3 |
| 3 | Bateria como amortecedor; offline; medidor Kardashev; melhorias nomeadas; input da grade pelo DOM (mobile); hi-DPI | Era 1 completa por dentro |
| 4 | Passe de arte (tokens, rampa de calor, sombras, glow); 3 cards da Era 1; Grade 7×7; Bipes | jogo bonito e completo até o fim da Era 1 |
| 5 | Ilha-tabuleiro de 2048 casas (regiões, vagas, locais compráveis), escada de escalas navegável, Kardashev I–V | a Era 1 inteira se joga na ilha |
| 6 | Mundo (v0.6): arquipélago no mar, obstáculos, colocação manual de tudo, subestações e cabos, adjacências, escada crescente, nota de dinheiro, explicação das peças | espaço é decisão |
| 7 | Cidade e árvore (v0.6): bairros com densidade e evolução, laboratório e universidades, 🔬 gasto na árvore com cards de física, capítulos | a cidade evolui e ensina |
| 8 | Era 2 (fissão: esgotamento e calor de decaimento) e transição de era | MVP: Eras 1–2 |
| 9 | Era 3 (Contenção + acoplamento com a Rede; abre o planeta) | |
| 10–12 | Eras 4–6 (sistema estelar), balanceamento, prestígio (galáxia em diante), som | jogo completo |

Cada sessão nasce de um `CLAUDE.md` do projeto (escrito no próximo passo) que carrega este documento como contrato.

---

## 13. Perguntas abertas para você

1. Idioma da interface: só PT-BR no MVP?
2. Som e música: no MVP ou só no final?
3. Nome: "Kardashev" é codinome. Trocar?

---

*v0.2 — ritmo fixado em ~1 h por era; Era 1 recalibrada.*
*v0.3 — §8.3 corrigido: 16 kW no exemplo da zona de ouro, h = 6 é assintótico (Cascata só com h = 6,5), Q* derivado das peças; anéis definidos; §4.2 diz que o calor passa de 100 %; §8.4 com 20–30 min. Ver `docs/correcoes-gdd-v0.3.md`.*
*v0.4 — bateria com ±10 kW por unidade e regra da faixa efetiva (§4.1); offline com regras exatas (§7); medidor Kardashev definido (§6); Lâminas de fibra e Rastreamento solar com efeito (§8.2, §8.3); roteiro reordenado (§12). Ver `docs/correcoes-gdd-v0.4.md`.*
*v0.5 — tabuleiro vira ilha isométrica de 2048 casas com regiões, vagas e locais compráveis (§2.4, §8.5); escada de escalas ilha → multiverso alinhada aos tipos Kardashev, com marcos até 10⁵⁰ W (§2.4, §6); direção de arte do terreno e dos níveis (§10); roteiro reordenado (§12). Ver `docs/correcoes-gdd-v0.5.md`.*
*v0.6 — a Rede passa a ser colocada; o tabuleiro vira um arquipélago no mar com obstáculos, expedições, cabos e subestações (§2.1, §2.4, §8.5); cidade em bairros com densidade, evolução quase exponencial, laboratórios e universidades (§2.5, §8.6); 🔬 passa a ser gasto numa árvore com cards de física (§3, §8.6); roteiro reordenado (§12). Ver `docs/correcoes-gdd-v0.6.md` e `docs/analises/reactor-e-volume1.md`.*
