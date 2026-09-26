# KARDASHEV (codinome) — Documento de Design v0.9 · Parte 1 de 2

> Parte 1: conceito, os três sistemas, Ocorrências, Cascata, economia, Era 1 completa, direção de arte, arquitetura e roteiro de sessões.
> Parte 2 (`docs/GDD-parte2.md`): Era 2 completa (v0.7); Eras 3–6, prestígio e o roteiro dos cards entram lá nas versões seguintes.

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
Uma **plataforma** no centro do tabuleiro da era com a usina crítica da época (Torre Solar → Reator de fissão → Tokamak → Anel de antimatéria → Reator de buraco negro → Enxame de Dyson). A **posição importa**: peças trocam calor com vizinhas. Aqui vivem as balanças **Calor** e, a partir da Era 3, **Contenção**. É a fonte de Pesquisa que não depende de espaço (laboratórios e universidades são as outras, §2.5 e §8.6; o instituto entra na Era 2, Parte 2 §4.2) e o único lugar onde a Cascata acontece.

### 2.3 Acoplamento entre camadas (o que faz o híbrido valer)
- O Núcleo gera Pesquisa; Pesquisa desbloqueia usinas da Rede e a próxima era. Sem Núcleo bem operado, a Rede estagna.
- A partir da Era 3 o Núcleo **consome potência da Rede** para a contenção. Apagão na Rede → contenção cai → Cascata. A balança "tranquila" passa a ter dentes.
- O Núcleo produz potência que também vai para a Rede (e conta para o medidor Kardashev).

---

### 2.4 Tabuleiro: arquipélago, obstáculos e escalas (v0.6)
As duas camadas moram no **mesmo tabuleiro**: um **arquipélago no mar**, com **2048 casas de terra** repartidas em oito ilhas (grade de 64×64 casas, forma orgânica por ruído, semente fixa por era). A plataforma do Núcleo (7×7) fica na ilha principal. Entre as ilhas, mar; na borda de cada uma, água rasa (litoral). O espaço só aparece nos níveis superiores da escada.

- **Tudo se coloca.** Escolhe-se um prédio na paleta e toca-se numa casa livre. Remover devolve metade do custo. Nada é alocado sozinho.
- **Espaço é conquistado.** As ilhas nascem ocupadas por floresta, arbustos, pedras, montanhas (2×2) e pântano. Cada obstáculo tem custo em ₵ (montanha também em 🔬) e um tempo de remoção, executado pelos Bipes de manutenção (dois de nascença, §8.5). Picos são permanentes e dão vento aos vizinhos. Só a ilha principal está aberta no começo; as demais exigem uma **expedição** (₵) e, para vender energia na rede principal, um **cabo submarino** (₵ por casa de mar) entre dois litorais.
- **Terreno importa.** Colina: vento +25 %. Litoral: vento +50 %. Planície: sol +15 %. Água não constrói. O chão de uma casa é planície, colina, litoral ou rocha; floresta, pântano, arbusto, pedra, montanha e pico são **obstáculos em cima do chão** — e floresta e pântano nascem sempre sobre planície, então desmatar devolve planície.
- **Vizinhos importam.** Esteira: cada vizinho eólico ortogonal tira 20 % de um cata-vento ou turbina eólica (mínimo 40 %). Sombra: cada vizinho alto ortogonal (turbina eólica, árvore, montanha, torre) tira 30 % de um painel (mínimo 40 %).
- **Subestação escoa.** Uma usina só vende se estiver a até 3 casas (distância de Chebyshev) de uma subestação, e cada subestação tem um teto de kW. Usina sem escoamento produz e mostra "sem escoamento". Bairros também precisam de subestação no alcance. A bateria continua global (§4.1).
- **Escalas.** A escada ilha → planeta (Tipo I) → sistema estelar (Tipo II) → galáxia (Tipo III) → universo (Tipo IV) → multiverso (Tipo V) fica como na v0.5, com a ordem **crescente da esquerda para a direita** (ou de baixo para cima) e degraus que crescem de tamanho. O nível 0 chama-se "Arquipélago". Tipos IV e V são ficção declarada.
- **Eras × níveis.** Eras 1 e 2 no arquipélago; a Era 3 abre o planeta (outros arquipélagos); Eras 4 a 6 no sistema; galáxia em diante é prestígio (Parte 2). Uma câmera só: a transição de era é a transição da escada. Cascata acima do arquipélago perde a vaga, nunca o nível (Parte 2).

### 2.5 Cidade — bairros, evolução e ciência (v0.6)
A demanda não se compra num contador: ela mora em **bairros** colocados no tabuleiro. A **cidade** tem uma **densidade** de 1 a 4 (aldeia, vila, cidade, metrópole) que vale para todos os bairros, cada um com a demanda, a população e a tarifa dessa densidade (§8.6). Evoluir a cidade custa ₵ + 🔬 por bairro numa curva **quase exponencial** e nunca acontece sozinho: é uma decisão do jogador (v0.8: a densidade é da cidade, não de cada bairro). Bairro mais denso pede mais kW e **paga mais por kW**. A população total libera **universidades** (1 por 2 000 habitantes), que geram 🔬 proporcional à raiz da população: mais gente, mais ciência. O **laboratório** dá a primeira ciência antes do Núcleo. A cidade cresce na medida da energia que você entrega e do que investe nela, não do botão que aperta.

---

## 3. Recursos

| Ícone | Recurso | Unidade | Onde vive | Papel |
|---|---|---|---|---|
| ₵ | Créditos | ₵ | global | compra tudo |
| ⚡ | Potência | kW (prefixos SI reais) | Rede + Núcleo | vendida até a demanda |
| 🔋 | Bateria | kWh (±10 kW por unidade) | Rede | amortece a balança Oferta × Demanda |
| 🏙 | Demanda | kW | bairros | quanto a cidade compra |
| 👥 | População | habitantes | bairros | soma das densidades; libera universidades (v0.6) |
| 🔥 | Calor | u (unidades) | Núcleo | produzido e dissipado por peças |
| 🔬 | Pesquisa | pontos | Núcleo, laboratórios, universidades, institutos → global | **gasta** na árvore, em desbloqueios, na evolução da cidade e em obstáculos grandes (v0.6) |
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

Fisicamente coerente: turbinas rendem mais com o receptor quente (Carnot), por isso a zona de ouro é quente e perto do limite. Isso também torna o sistema **auto-estabilizante**: o consumo das turbinas cresce com a temperatura, então cada configuração de peças converge para uma temperatura de equilíbrio. O jogador ajusta a proporção espelhos/turbinas para cair na faixa — não precisa "pilotar" a barra segundo a segundo. A única exceção são as **Ocorrências** (§4.4), que são opcionais.

### 4.3 Contenção (Núcleo, Era 3+) — margem = (campo − pressão) ÷ pressão
Bobinas geram campo e consomem potência da Rede; células de plasma geram pressão. Margem entre 5 % e 20 % é zona de ouro (energia ×1,2). Margem < 0 por 3 s → Cascata. Detalhes na Parte 2.

### 4.4 Ocorrências — o sub-jogo de operação (v0.9)

A simulação da Sessão 8 (código da v0.7.1, ainda sem as melhorias da v0.8) mostrou o jogo parado ≈ 36 de ≈ 105 minutos, esperando 🔬, ₵ ou a barra de 🛡 subir (`docs/correcoes-gdd-v0.9.md`); a parte G da Sessão 9 mede de novo com os sumidouros da v0.8. As Ocorrências trocam essa espera por operação. São curtas e opcionais, e usam o mesmo motor de calor: nenhuma fórmula muda.

- **Oferta.** A cada **4 min de jogo ativo** (tempo de tick com o jogo aberto; o offline não conta), o sim sorteia uma Ocorrência entre as que se aplicam à grade atual e a oferece por **60 s**. O ícone 🔥 do HUD pulsa e o painel do Núcleo mostra o cartão ("Nuvem sobre o campo · 45 s · 🛡 +3 ou 🔬"). Uma por vez. Não há oferta com o Núcleo bloqueado, desligado, em SCRAM ou sem turbina. Recusar ou deixar expirar não custa nada. O relógio dos 4 min é um acumulador de tempo de tick (não um carimbo de `tempoMs`, que o offline avança): só anda sem oferta e sem Ocorrência em curso, e recomeça do zero quando a Ocorrência acaba (superada ou não) ou quando a oferta é recusada ou expira. Oferta ou Ocorrência pendente ao fechar o jogo é descartada sem recompensa. **Só se oferece o que se pode ganhar:** o sorteio só entra com uma Ocorrência se existe valor do controle, dentro dos limites, que põe o `Q*` perturbado perto do meio da zona de ouro (≈ 80 %). A coluna "Exige" das tabelas é o mínimo e não basta sozinha: a Nuvem, por exemplo, fica fora de grades cujos radiadores dissipam muito, porque a carga não desce de 50 %. O sorteio usa o gerador determinístico (`sim/aleatorio.ts`) com a semente no estado.
- **Controle.** Aceitar abre **um controle só**, grande, que existe apenas durante a Ocorrência e volta a 100 % quando ela acaba:
  - Era 1 — **Carga das turbinas**, de 50 % a 150 %: multiplica o consumo das turbinas (`0,12 × Q × carga`), então `Q* = entrada ÷ (0,12 × t × carga)`. Carga baixa esquenta, carga alta esfria. Em equilíbrio a potência não muda (continua 0,8 kW por u que entra); o que muda é onde `T` para, e com ele a faixa, a pesquisa e a Estabilidade. A "carga" é uma abstração do jogo (quanto calor as turbinas tiram do receptor), não a fração da potência nominal: turbinas de verdade aguentam poucos por cento acima do nominal.
  - Era 2 — **Barras de controle**: o jogador escolhe a **potência das varetas ativas**, de 50 % a 125 % da nominal (menos potência = barras mais inseridas); o decaimento não muda (Parte 2 §5.4).
  - A marca de `Q*` na barra de calor anda ao vivo com o controle: o jogador vê para onde `T` vai antes de chegar.
- **Perturbação.** Cada Ocorrência é um multiplicador com perfil no tempo sobre um termo do motor (entrada, dissipação ou fator das turbinas), com rampa de 5 s na entrada e na saída, salvo quando a tabela traz outro perfil (Xenônio: 15/30/15 s, Parte 2 §5.4). O Seguimento de carga não perturba o motor: é só uma meta de potência. O motor (`sim/motor.ts`) recebe o multiplicador; na Era 2 o termo de entrada que Barras e Xenônio multiplicam é só a injeção das varetas ativas, e o decaimento fica de fora (Parte 2 §5.2). As fórmulas de §4.2 e §8.3 ficam como estão.
- **Meta.** `T` na zona de ouro (70–90 %) durante pelo menos **75 %** da duração, sem Cascata e sem SCRAM — ou, quando a Ocorrência diz, a potência do Núcleo numa faixa. A Cascata continua valendo: aceitar é correr o risco de operar perto do limite.
- **Recompensa**, escolhida pelo jogador ao superar: **🛡 +3 pontos** (sem passar de 100) **ou 🔬 igual a 60 s da produção total de 🔬/s** no instante (Núcleo, laboratórios, universidades, institutos). O jogador pega o que o está travando. Falhar não tira nada além do que a física tirou.
- **Nunca offline e nunca automática.** O modo seguro (§5) continua valendo durante a Ocorrência, e o SCRAM automático a 95 % reprova a meta. A coluna "Resposta" das tabelas vale para o trecho estável: nas rampas o jogador acompanha a perturbação com o controle (o valor da Resposta parado desde o aceite pode passar de 95 % na rampa).
- **Card "Ocorrências"** (2 telas, com os Bipes) na primeira oferta. O diário do tabuleiro (§10.1) registra a oferta, o resultado e a recompensa.

**Ocorrências da Era 1** (valores iniciais, a calibrar na simulação; a primeira oferta de cada save é a Nuvem, e um save que chega à v10 já na Era 2 recebe primeiro o Xenônio, Parte 2 §5.4). A coluna do meio usa o exemplo de §8.3: `h = 5`, `t = 2`, capacidade 100, `T*` = 83 %.

| Ocorrência | Perturbação | Duração | Exige | Sem mexer no controle | Resposta |
|---|---|---|---|---|---|
| **Nuvem sobre o campo** | entrada ×0,6 | 45 s | 1 heliostato | `Q*` = 50, `T` cai para 50 % e sai do ouro | carga 60 % devolve 83 % |
| **Céu limpo e frio** | entrada ×1,25 | 45 s | 1 heliostato | `Q*` = 104,2: Cascata | carga 125 % devolve 83 % |
| **Turbina em meia carga** | uma turbina a 50 % | 30 s | 2 turbinas | `Q*` = 111,1 (1,5 turbina): Cascata | carga 133 % devolve 83 % |

Frases de física (cartão da oferta e card):
- Nuvem: "Uma nuvem derruba a luz direta em segundos. Nas torres de verdade o operador reduz a vazão no receptor para a temperatura de saída não despencar."
- Céu limpo e frio: "Ar frio e seco deixa passar mais luz direta: um dia limpo de inverno pode render mais radiação direta que um dia de verão com névoa."
- Turbina em meia carga: "Quando uma turbina perde carga, o calor que ela tirava fica no receptor: ou as outras tiram mais, ou ele passa do limite. Nas torres de verdade o sal quente vai para o tanque, e quando o tanque enche o operador tira espelhos de foco."

**Ritmo.** Com a Estabilidade passiva em +1,8/min na zona de ouro (§7), quem aceita todas as Ocorrências e escolhe 🛡 sobe ≈ 1,8 + 3 a cada ~5 min (4 min de relógio + o aceite + 30–45 s de Ocorrência) ≈ 2,4/min e enche a barra em ≈ 42 min; quem deixa rodar enche em ≈ 56 min, sem Cascata. São os números da barra na Era 1; na Era 2 a saída também depende da 🔬 da Fusão básica (Parte 2 §4.2). As duas pontas ficam dentro da faixa de §7 (40–75 min). As eras seguintes trazem Ocorrências próprias (Era 2 na Parte 2 §5.4; a Era 3 traz as da Contenção).

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

- **Estabilidade** sobe enquanto o Núcleo opera dentro da faixa (mais rápido na zona de ouro) e a cada Ocorrência superada em que o jogador escolhe 🛡 (§4.4). Chega a 100 % → habilita o botão da próxima era.
- **Próxima era** exige: Estabilidade 100 % + pesquisa específica concluída + custo em ₵.
- A era nova traz: novo cenário (a câmera afasta: colina → cidade → oceano → órbita → espaço profundo → estrela), nova grade com peças novas, novas usinas na lista, e **uma balança que muda de natureza**.

| Era | Cenário | Núcleo | O que muda na balança |
|---|---|---|---|
| 1 Vento e Sol | colina | Torre Solar (CSP) | só Calor; aprende o básico |
| 2 Fissão | o mesmo arquipélago, ao entardecer | Reator PWR | combustível esgota; peças gastas **continuam quentes** (calor de decaimento); produzir passa a custar. Completa em `docs/GDD-parte2.md` |
| 3 Fusão | plataforma no oceano | Tokamak | entra a **Contenção**, que consome potência da Rede |
| 4 Antimatéria | órbita / Lua | Anel acelerador | no vácuo só se dissipa por radiação: radiadores rendem menos; armadilhas precisam de energia constante |
| 5 Buraco negro | espaço profundo | Reator Hawking | balança **invertida**: massa baixa demais explode, alta demais rende pouco |
| 6 Dyson | a estrela | Enxame de coletores | balança de **luz**: cobrir demais a estrela congela as colônias (demanda colapsa) |

**Medidor Kardashev:** `P` = potência **instalada** em watts, `(ofertaUsinasKw + ofertaNucleoKw) × 1000` — instalada, não vendida. Barra em `log10` de 10³ W a 10⁵⁰ W, com marcos reais: humanidade em 2026 ≈ 2×10¹³ W, Tipo I = 10¹⁶ W, Tipo II = 10²⁶ W, Sol = 3,8×10²⁶ W, Tipo III = 10³⁶ W; e marcos especulativos, marcados como tais: Tipo IV = 10⁴⁶ W, Tipo V = 10⁵⁰ W (multiverso). Índice `K = (log10 P − 6) ÷ 10` (fórmula de Sagan), mostrado com duas casas quando `K ≥ 0` (a partir de 1 MW); antes disso, "abaixo da escala" e o próximo marco. Potência até 10²⁴ W usa prefixos SI; acima, notação científica. O jogador vê onde está de verdade. Os tipos também são os degraus da escada de escalas (§2.4).

**Prestígio** ("Nova simulação"): pós-MVP. Depois da Era 6 (ou a partir da Era 4), reiniciar por **Constantes** permanentes. Definido na Parte 2.

---

## 7. Economia — regras gerais

- **Custo da n-ésima unidade** de uma usina da lista: `custo_base × 1,15^n` (bairros e demais prédios: 1,25, ver Colocação).
- **Melhoria** (nível): `custo_base × 3^nível`, produção `× (1 + 0,5 × nível)`.
- **Peças da grade:** preço fixo por era, sem inflação por unidade (a limitação é o espaço e o calor, não o preço).
- **Receita/s** = potência vendida (kW) × preço (₵ por kW·s) × multiplicador da balança Rede.
- **Preço base** por era: Era 1 = 1,0; cada era multiplica a escala de potência por ~100 e o preço por ~0,1 (mais watts, menos ₵ por watt — reflete o custo da energia caindo). Números finos das Eras 2–6 na Parte 2.
- **Pesquisa/s** = potência do Núcleo ÷ 10 × multiplicador da zona de calor.
- **Offline:** janela `min(agora − salvoEmMs, 8 h)`; relógio andando para trás conta como 0. Nada é comprado offline; a **fila de remoção anda** (é trabalho já pago, não compra nem produção: Sessão 9) e o relatório conta os obstáculos removidos. A Rede usa o balanço congelado do save, **sem bateria** (nem carrega nem descarrega) e com receita ×0,5. Núcleo em modo seguro obrigatório: calcula `T*` do equilíbrio da grade salva; se `T* ≥ 95 %`, o Núcleo fica **desligado** o tempo todo (0 kW, 0 🔬, Estabilidade parada) e o jogador é avisado do motivo; senão, potência ×0,7, pesquisa/s da faixa de `T*` ×0,7 e Estabilidade da faixa ×0,7. Ao voltar, `Q = Q*` (limitado a 95 % da capacidade), cronômetro da Cascata e SCRAM zerados. Nunca há Cascata offline. Relatório "Enquanto você esteve fora": tempo, ₵, 🔬, Estabilidade e, se for o caso, "Núcleo ficou desligado: sua configuração passaria de 95 %".
- **Nada acumula sem sumidouro (v0.6):** todo recurso tem para onde ir e todo número tem como evoluir, do consumo à produção. ₵ se gasta em colocar, evoluir, desmatar e expedir; 🔬 se gasta na árvore; potência sem subestação com folga é **desperdiçada** (aparece como "sem escoamento") até o jogador subir o nível das subestações (ou dos cabos) ou evoluir a cidade; calor dissipa ou vira Cascata; a população só cresce evoluindo a cidade ou colocando bairro novo; Estabilidade para em 100 % e vira a próxima era. Vale para a cidade e para o Núcleo: cada tipo de peça do Núcleo tem nível incremental no painel do Núcleo e um degrau de era na árvore (heliostato de dois eixos, turbina de alta pressão, radiador ativo, tanque de dois sais; §7.1, §8.3), e o Receptor evolui pelo cerâmico e pela Grade 7×7. ₵ parado com 🔬 travando vira ciência pelo nível de laboratórios, universidades e institutos (§7.1, v0.9). Um recurso que só sobe sem decisão é um defeito de design a corrigir.
- **Colocação (v0.6):** cada prédio tem custo base × 1,25ⁿ por unidade colocada do mesmo tipo (usinas mantêm 1,15ⁿ). Remover devolve 50 %. Obstáculos: custo fixo por tipo + tempo de remoção. Expedição por ilha e cabo submarino por casa de mar (§8.5). Evolução da cidade: (`₵ 250 × 2,5^(densidade − 1)` + 🔬 30, 150, 600) × N bairros (v0.8, §8.6). Tarifa por kW vendido cresce com a densidade média dos bairros atendidos (×1, ×1,15, ×1,3, ×1,5).
- **Ritmo definido:** ~60 min de jogo ativo por era; **meta por era: 50–70 min recusando as Ocorrências, 40–50 min operando** (medida na Sessão 10 F). Estabilidade sobe **+1,2 pontos/min** fora da zona de ouro (frio, normal e alerta) e **+1,8/min** na zona de ouro, mais **+3 por Ocorrência superada com 🛡 escolhido** (§4.4): 100 % em ≈ 42 min jogando as Ocorrências e escolhendo 🛡, ≈ 56 min deixando rodar, sem Cascata. Cada Cascata custa 30 pontos (§5): ≈ 12,5 min para quem joga as Ocorrências (2,4/min), ≈ 17 min para quem deixa rodar (1,8/min). Faixa da Estabilidade: 40–75 min contando paradas e Cascatas. *(v0.9, vale junto com as Ocorrências, na Sessão 10; até lá as taxas são 1,5 e 2,5. Motivo: com 2,5/min a barra era um cronômetro de 40 min sem nada a fazer; agora quem opera ganha o tempo de volta.)*

---

### 7.1 Melhorias: incrementais e de era (v0.8)

Toda melhoria é **por tipo, nunca por unidade**. Melhorar cata-vento melhora todos os cata-ventos; evoluir a cidade evolui todos os bairros; subir o nível das subestações sobe todas. A única coisa "por unidade" que sobra é o que é posição: colocar, remover, trocar uma vareta. Dois degraus:

- **Incremental** (₵, repetível, compra-se onde a coisa está: paleta, painel do Núcleo, painel da Cidade): nível `n` por tipo. Regra geral: custo `base × 3ⁿ`; efeito por nível: usinas **+50 %** (como já era, §7), peças do Núcleo **+10 %** na grandeza da peça (calor, kW por u, dissipação, capacidade), subestações e cabos **teto ×2**, **ciência +25 % de 🔬** (laboratório, universidade e instituto de pesquisa, cada um no seu tipo; v0.9). **Máximo 5 níveis por tipo** para usinas, peças e ciência (o degrau seguinte é de era); 3 para subestações (a offshore para no 2, como a tabela da Parte 2 §3.2); cabos sem teto. *(Sessão 9: "5 por era" foi lido como 5 por tipo — as usinas da Era 1 param no 5 também na Era 2 —, e um save antigo acima de 5 guarda o nível, só não compra mais.)* **Convenção de n:** nos degraus ×3 (usinas, subestações, cabos, ciência) `n` é o nível que se compra — o nível 1 custa a base × 3, como a melhoria de usina sempre custou (§7); nos degraus ×2 (peças, equipe de manutenção) `n` é o nível atual — o nível 1 do Heliostato custa ₵ 150 (§8.3). Onde a unidade conta em rede ou em quantidade (subestação, cidade, ciência), o custo multiplica pelo número de unidades: `base × 3ⁿ × N` — Laboratório ₵ 60, Universidade ₵ 400, Instituto ₵ 20 000 de base. *(v0.9: a ciência com nível converte o ₵ que a simulação mostra parado em 🔬, que é o que trava; na Era 1, com o código da Sessão 8 (sem os níveis da v0.8), o bot chega a ter ₵ 150–318 mil sem uso entre os minutos 20 e 30. **Os 5 níveis são no total, por tipo**, não por era: a Era 2 não reabre níveis de laboratório e universidade, e o destino do caixa dela é o nível dos Institutos. O nível sobrevive à transição de era (Parte 2 §2).)* **Unidade nova de tipo com nível** (subestações e ciência, os tipos em que o custo multiplica por N) paga, além da colocação, o que o tipo já pagou por unidade para chegar ao nível: `base × (3¹ + … + 3ⁿ)`, só em ₵, como o bairro novo paga a densidade (§8.6); remover devolve 50 % do total. *(Revisão da v0.9: com a unidade nova herdando o nível de graça, subir o nível com uma universidade e construir as outras depois dividia o custo por N — ₵ 145 mil em vez de ₵ 871 mil para seis universidades no Nv 5 —, e o sumidouro de ₵ que a ciência com nível existe para ser sumia. Com o acumulado, tanto faz subir antes ou depois de construir. Usinas, peças e cabos não pagam: o custo do nível deles não depende de quantas unidades existem.)*
- **De era** (🔬, uma vez, na árvore): muda a forma ou libera o tipo seguinte — Lâminas de fibra, Torre mais alta, Heliostato de dois eixos, Subestação de 138 kV, Megacidade. Cada nó continua com a frase de física.

O jogador vê o nível onde a coisa está: "Nv 3" na carta da paleta, na peça da grade, na linha da cidade. Nada de nível escondido em lista.

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

A demanda não é usina: vem dos bairros (§8.1). Bairro novo: ₵ 40 × 1,25ⁿ mais o acumulado das evoluções da cidade, com a demanda da densidade dela (§8.6, v0.8).

Melhorias da Rede: **Lâminas de fibra** (cata-vento e turbina eólica +25 %) é nó da árvore desde a v0.6 (🔬 25, gasto, §8.6); o nível incremental das usinas está em §7.1. A Bateria e a Turbina eólica se desbloqueiam gastando 🔬 (§8.6), não por limiar.

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

Melhorias do Núcleo: **Rastreamento solar** (₵ 150 + 🔬 30): cada espelho injeta 5 u/s em vez de 4 — isso muda `Q*`, e a marca do equilíbrio na barra move na hora para o jogador perceber que precisa reajustar · Receptor cerâmico (capacidade +50, ₵ 300 + 🔬 80) · **Grade 7×7** (₵ 2 000 + 🔬 1 500, nó da árvore, §8.6): o 5×5 é embutido no 7×7 com deslocamento (+1, +1), peças e entulho preservados; o anel 3 (24 casas externas) pesa 0,25 e só aceita heliostato.

**Consequência de balanço do 7×7:** com 2 turbinas e todas as casas de espelho, `h` chega a 6 + 8 + 24 × 0,25 = 20 → `Q* = 333 u`, que só cabe na zona de ouro com tanques (3 tanques → capacidade 550 → `T* ≈ 61 %`; 2 tanques + Receptor cerâmico → 450 → `T* ≈ 74 %`). A grade grande existe para ser usada **junto** com os tanques; a dica da barra de calor continua valendo.

**Níveis das peças (v0.8, §7.1).** Cada tipo de peça tem nível incremental comprado no painel do Núcleo, valendo para todas as peças do tipo: custo `5 × custo da peça × 2ⁿ` (Heliostato ₵ 150, 300, 600, 1 200, 2 400), efeito **+10 % por nível** — calor do Heliostato, kW por u da Turbina, dissipação do Radiador, capacidade do Tanque. Máximo 5 por era. O Receptor não tem nível (o Receptor cerâmico é o degrau de era dele). Subir o nível dos Heliostatos sobe `Q*`: é uma decisão de calor, não só de dinheiro. Os nós da árvore (Heliostato de dois eixos, Turbina de alta pressão, Radiador ativo, Tanque de dois sais) são os degraus **de era** e multiplicam por cima.

### 8.4 Saída da Era 1
Estabilidade 100 % + pesquisa "Fissão básica" (🔬 3 000) + ₵ 50 000 → Era 2. Com 🔬 virando moeda (v0.6), "Fissão básica" é um **nó da árvore** que custa 🔬 3 000 + ₵ 50 000 (§8.6). A conta antiga ("com o Núcleo em ~16 kW, 🔬 3 000 leva 20–30 min") valia quando o Núcleo era a única fonte: com laboratórios e universidades a simulação da Sessão 7 chega aos 🔬 3 000 em **11 minutos**, e o que segura a era passa a ser a árvore inteira (≈ 🔬 22 mil) e a Estabilidade. Card explicativo de transição: de kW para MW. O que acontece na transição e a Era 2 inteira estão na Parte 2 (`docs/GDD-parte2.md`, §2).

**Ritmo medido (Sessão 7, parte F).** Um bot jogando bem fecha a Era 1 em **≈ 41 min**, e quem manda é a Estabilidade: +2,5 pontos/min na zona de ouro dá 40 minutos de piso para qualquer jogador que acerte a grade logo. A meta de era de §7 (50–70 min recusando as Ocorrências) vale para jogo humano (com paradas, erros de proporção e Cascatas), não para jogo perfeito. Se a gestão quiser o piso em 50–70 também no jogo perfeito, o ajuste é na taxa de Estabilidade (ouro 2,5 → ~1,8/min), que esta sessão não podia tocar. *(v0.9: o playtest do autor apontou a espera, o que reabre o ajuste 1 da Sessão 7. A taxa passa a 1,8/min no ouro e 1,2/min fora dele, e as Ocorrências de §4.4 devolvem o ritmo a quem joga: ≈ 42 min jogando, ≈ 56 min deixando rodar.)*

**Ritmo medido (Sessão 9, parte G, ainda com 2,5/1,5).** O bot passou a comprar níveis (turbina, ciência, usinas, Equipe), a evoluir a cidade inteira, a pôr bairro onde há subestação no alcance, a enfileirar remoção para os N Bipes e a juntar para o Vaso a partir de 85 % de 🛡. Resultados (e, entre parênteses, o mesmo bot sem comprar nível de ciência):
- A Era 1 fecha no piso da Estabilidade nas duas rotas: 41,5 min na corrida (43,4) e 42,3 na cidade (44,9). O Reator sai aos 42 e aos 43 min.
- A Era 2 corrida fecha em 48,1 min (51,7), também no piso da 🛡. Os minutos parados caem de 31 para 5: a ciência com nível acabou com a espera por 🔬, que era a dominante (Parte 2 §4.2).
- A Era 2 cidade fecha em 68,3 min, com a arcologia aos 67,3; sem nível de ciência ela não fecha em 75 min. Essa rota é sensível ao bot: pequenas mudanças de decisão levaram o fechamento a 45,7, 50,3 e 68,3 min em três rodadas. O que a segura no começo da Era 2 é juntar ₵ e 🔬 para evoluir a cidade inteira à megacidade.
- Minutos parados (potência e população paradas, ₵ subindo) até o fechamento: 15 de 91 na corrida e 30 de 112 na cidade. Na medida da v0.9 eram ≈ 36 de ≈ 105.

A Era 2 corrida abaixo de 50 min não é defeito da Sessão 9: é o piso da Estabilidade, que a Sessão 10 sobe para ≈ 56 min com 1,8/1,2 e devolve a quem joga as Ocorrências.

---

### 8.5 Arquipélago da Era 1 (v0.6)

| Ilha | Casas | Terreno dominante | Expedição | Nasce com |
|---|---|---|---|---|
| Principal | 640 | planície, colinas ao norte | aberta | Núcleo, aldeia (1 bairro d1), 1 subestação, ~45 % de obstáculos |
| Ventania | 320 | colinas e picos | ₵ 1,8 mil | pinheiros esparsos, 3 picos |
| Solar | 300 | planície | ₵ 5,4 mil | arbustos, pedras |
| Costa | 260 | litoral largo | ₵ 13,5 mil | pântano, árvores |
| Bosque | 220 | floresta densa | ₵ 27 mil | 90 % de árvores |
| Pedreira | 160 | montanhas, cristais | ₵ 60 mil | 4 montanhas 2×2, cristais |
| Recife | 96 | litoral | ₵ 135 mil | pedras |
| Farol | 52 | rocha | ₵ 300 mil | pico, vazio |

Cabo submarino: ₵ 150 + **₵ 120** por casa de mar, entre os dois litorais mais próximos; sem cabo, a ilha só alimenta bairros e subestações dela mesma (a energia que sobra vira "sem escoamento"). O cabo tem **teto próprio de 30 kW**, nos dois sentidos, e **nível** (custo da rota ×3ⁿ, teto ×2ⁿ), como a subestação: ligar a ilha não basta, é preciso dimensionar o cabo. Foi assim que o cabo deixou de ser uma trava (₵ 230–270 contra ₵ 600 a ₵ 100 mil das expedições) e virou decisão contínua (v0.6, Sessão 7).
Obstáculos: arbusto ₵ 3, árvore ₵ 8, pedra ₵ 25, pântano ₵ 60, montanha 2×2 ₵ 400 + 🔬 20 (tempos de remoção e Bipes no parágrafo v0.8 abaixo) — **dinamitar devolve 🔬 40 e deixa quatro casas de rocha com cristal** (laboratório ou universidade sobre cristal rende +50 %, §8.6) —, pico permanente (vento +30 % nos vizinhos). Subestação ₵ 120 × 1,25ⁿ, alcance 3, teto 40 kW; nível: custo ×3ⁿ, teto ×2, **nível máximo 3** (40 → 80 → 160 → 320 kW, ajuste 2 da Sessão 7: com o bot instalando ~390 kW, uma subestação só deixa de bastar e a segunda volta a ser decisão no fim da era). Os preços das expedições foram **multiplicados por 3** na Sessão 7 depois da simulação de 60 minutos: com os valores antigos o bot abria o arquipélago inteiro em 30 minutos e ainda sobrava caixa. Com estes, a última ilha cai por volta dos 40 minutos.

**v0.8 — níveis por tipo e remoção.** Subestação e cabo deixam de subir por unidade: **"Subestações nível n"** vale para todas (custo `₵ 120 × 3ⁿ × N`, N = quantas existem; teto ×2ⁿ; máximo 3; a subestação nova paga o acumulado do nível, §7.1) e **"Cabos nível n"** vale para todos os cabos ligados (custo = soma das rotas ligadas × 3ⁿ; teto ×2ⁿ). Na migração, o nível global nasce igual ao maior nível existente.
Remoção de obstáculos: **dois Bipes de manutenção** de nascença trabalham em paralelo; **"Equipe de manutenção"** (incremental, ₵ 150 × 2ⁿ, máximo 4 níveis) soma um Bipe por nível; tempos: arbusto 0,5 s, árvore 1,5 s, pedra 4 s, pântano 5 s, montanha 15 s (eram 1/3/8/10/30 s e um Bipe só: ficou lento demais no playtest). Nó de era **"Máquinas pesadas"** (🔬 120, ramo Rede): tempos ÷ 2. **Seleção em área**: arrastar no desktop, toque longo e arrastar no celular, até 8×8 casas; o custo total aparece antes de confirmar e a fila reparte entre os Bipes. *(Sessão 9, detalhes:)* a fila é uma só e cada Bipe livre pega a próxima; a seguinte começa no instante exato em que a anterior termina, então o resultado não depende do tamanho do tick. No desktop, arrastar seleciona com a ferramenta Desmatar (ou com Shift), e aí a câmera anda pelo botão do meio ou direito; nas outras ferramentas arrastar continua movendo a câmera. A área é **tudo ou nada**: sem ₵ (ou sem a 🔬 da montanha) para o lote inteiro, recusa. Montanha que encosta no retângulo entra uma vez; pico, ilha fechada, construções, mar e o que já está na fila ficam de fora. A montanha **gasta** 🔬 20 ao entrar na fila, como diz o custo acima (o código só exigia o saldo; corrigido na Sessão 9). Remover construção continua na hora, devolvendo 50 %.

### 8.6 Cidade, laboratório, universidade e árvore da Era 1 (v0.6)

| Densidade | Nome | Demanda | População | Tarifa | Evoluir para a próxima |
|---|---|---|---|---|---|
| 1 | Aldeia | 8 kW | 100 | ×1 | ₵ 250 + 🔬 30 |
| 2 | Vila | 20 kW | 400 | ×1,15 | ₵ 625 + 🔬 150 |
| 3 | Cidade | 48 kW | 1 600 | ×1,3 | ₵ 1 562 + 🔬 600 |
| 4 | Metrópole | 110 kW | 6 400 | ×1,5 | — |

Bairro novo: ₵ 40 × 1,25ⁿ mais o acumulado das evoluções da cidade (v0.8, abaixo), 1 casa, precisa de subestação no alcance. Laboratório: ₵ 60 × 1,25ⁿ, 🔬 0,2/s, consome 2 kW. Universidade: liberada com 1 000 habitantes, ₵ 400 × 1,5ⁿ, no máximo 1 por 2 000 habitantes, 🔬 0,5/s × √(**alunos** ÷ 1 000) com **alunos = população ÷ universidades ativas** (ajuste 3 da Sessão 7: quatro universidades dividindo 16 400 habitantes rendem 4 🔬/s no total, não 8 — a ciência cresce com gente, não com prédio), consome 5 kW. Núcleo: 🔬 = kW ÷ 10 × faixa, como antes. Laboratório e universidade têm **nível por tipo** (v0.9, §7.1): +25 % de 🔬 por nível, custo `base × 3ⁿ × N`; a unidade nova paga o acumulado do nível do tipo.

**Árvore da Era 1** (🔬 gasto; cada nó vem com um card de uma frase de física). Os custos abaixo já são os **recalibrados pela simulação de 60 minutos** da Sessão 7: os originais somavam 🔬 2,9 mil contra 🔬 38 mil ganhos numa era, e a árvore inteira acabava aos 15 minutos. A curva é progressiva — os primeiros nós continuam baratos (o começo não mudou), e os últimos custam de 8 a 10 vezes o que custavam.
- Vento: Lâminas de fibra (+25 %, 🔬 25) → Torre mais alta (+40 %, 🔬 150: "a potência do vento vai com o cubo da velocidade, e a 80 m ele é uns 30 % mais rápido que a 30 m — no papel seria mais que o dobro; a torre mais alta e mais pesada come o resto") → Controle de passo (esteira −50 %, 🔬 1 000) → Rotor de três pás (+15 %, 🔬 2 000). Escolha exclusiva no fim (🔬 4 000 cada): Eixo vertical (sem esteira, −20 % de potência) ou Eixo horizontal (+20 % e a esteira fica).
- Sol: Painel bifacial (+15 %, 🔬 60: "capta a luz que o chão reflete") → Antirreflexo (+8 %, 🔬 200) → Limpeza automática (+10 %, 🔬 1 300) → Rastreamento solar (Núcleo: 5 u/s por espelho, 🔬 30 + ₵ 150, como antes).
- Rede: Bateria (🔬 20) e Laboratório (nasce pesquisado: a primeira ciência não pode custar 🔬) → Subestação de alta tensão (alcance 5, 🔬 800) → Bateria de fluxo (+50 % de kWh por unidade, 🔬 1 600); Universidade (🔬 250); Máquinas pesadas (tempos de remoção ÷ 2, 🔬 120, v0.8, §8.5).
- Núcleo: Tanque de sal fundido (peça), Receptor cerâmico (🔬 80 + ₵ 300), Grade 7×7 (🔬 1 500 + ₵ 2 000); e um degrau de era por tipo de peça (§8.3, v0.8): Heliostato de dois eixos (+25 % de calor, 🔬 700), Turbina de alta pressão (+30 % de kW por u, 🔬 1 200), Radiador ativo (dissipa 9 u/s, consome 1 kW do Núcleo, 🔬 900), Tanque de dois sais (+50 % de capacidade, 🔬 1 100). Cada nó vale para todas as peças do tipo e multiplica por cima do nível incremental comprado no painel do Núcleo (§7.1).
- Cidade: Iluminação eficiente (bairros pedem 10 % menos e pagam o mesmo, 🔬 250) → Bombas de calor (tarifa +10 %, 🔬 1 800).
- Saída da era: **Fissão básica** (🔬 3 000 + ₵ 50 000, exige Receptor cerâmico e Turbina de alta pressão) é o nó de §8.4 — com 🔬 virando moeda, a "pesquisa específica" da transição de era é um nó como os outros. A Era 2 em si é a Sessão 8.
Desbloqueios de usina passam a gastar 🔬: turbina eólica 🔬 40, bateria 🔬 20. O Núcleo continua a ₵ 100.

---

**v0.8 — a cidade evolui inteira.** A densidade é **da cidade**, não de cada bairro: "Evoluir a cidade para Vila" evolui todos os bairros de uma vez, ao custo `custo da evolução × N bairros` (₵ e 🔬, com a mesma curva). Um bairro novo nasce na densidade da cidade e custa a aldeia (`₵ 40 × 1,25ⁿ`) **mais o que a cidade pagou por bairro para chegar à densidade**, em ₵ **e** 🔬 (numa metrópole: ₵ 2 437 + 🔬 780). *(Sessão 9: o texto anterior dizia `₵ 40 × 1,25ⁿ × 2,5^(d−1)`, só em ₵; com ele a estratégia dominante era evoluir a cidade com um bairro só e construir o resto depois, pagando a 🔬 da evolução uma vez em vez de N vezes. Com o acumulado, é indiferente evoluir antes ou depois de construir. Remover devolve 50 % dos ₵; a 🔬 não volta.)* O painel da Cidade mostra uma linha só (densidade, população, demanda, tarifa) e um botão. Na migração, a cidade nasce na maior densidade entre os bairros. Motivo: evoluir casa por casa era gerência sem decisão (playtest da v0.7).

## 9. O que faz o jogo surpreender

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

### 10.1 HUD limpo e "ver acontecendo" (v0.8)

**HUD com quatro números**: ₵ (com a taxa), ⚡ (balanço `r` com a faixa e a demanda), 🔥 (calor do Núcleo com a faixa; a Estabilidade vira um anel fino em volta do ícone) e 🔬 (saldo com a taxa e o próximo nó). 👥 vai para o painel da Cidade e para o callout do bairro; 🛡 vai para o painel do Núcleo. O capítulo ativo é **uma linha** (objetivo, progresso, recompensa). O extrato continua no popover da nota. *(v0.9)* O ícone 🔥 **pulsa** enquanto há uma Ocorrência oferecida (§4.4); tocar nele abre o painel do Núcleo no cartão da oferta.

**O jogo tem de parecer vivo sem ler número**: (1) **pulsos de energia** correndo nos cabos submarinos e da subestação aos bairros, na cor da faixa de `r`; (2) **"+₵"** flutuando sobre os bairros a cada venda (agregado a cada 2 s por bairro, no máximo 12 na tela) e **"+🔬"** sobre laboratórios e universidades; (3) **janelas acesas** nos bairros conforme a densidade, **piscando** no apagão (faixa efetiva de `r` abaixo de 0,8, §4.1) e **apagadas** quando menos da metade da demanda é atendida *(Sessão 9: o texto dizia "apagando no apagão (`r < 0,5`)", mas o apagão de §4.1 começa em 0,8; atendimento conta a bateria cobrindo, então com ela a luz fica acesa)*; (4) **Bipes** andando até o obstáculo, um por remoção em curso; (5) chaminé da térmica fumegando quando liga; (6) o Núcleo brilhando proporcional a `T`; (7) um **diário** de três linhas no rodapé do tabuleiro ("Árvore caiu em Bosque", "Capítulo concluído: +₵ 120", "Vareta 12 esgotou"), cada linha some em 6 s. Orçamento: no máximo 3 ms a mais por quadro com o arquipélago cheio.

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
| 9 | Melhorias por tipo (incrementais e de era, com a ciência — v0.9), cidade que evolui inteira, remoção rápida e em área, HUD limpo, "ver acontecendo" (v0.8) | o jogo parece vivo e melhorar é decisão |
| 10 | Ocorrências nas Eras 1 e 2 (§4.4, Parte 2 §5.4), Estabilidade 1,8/1,2 (v0.9) | a espera virou operação: a barra de 🛡 enche em ≈ 42 min jogando e ≈ 56 deixando rodar (Era 1, Núcleo no ouro); na Era 2 a saída também depende da 🔬 da Fusão básica, que a ciência com nível (Sessão 9) e a recompensa 🔬 aceleram. A rota operador mede o fechamento das duas eras (meta de §7) |
| 11 | Era 3 (Contenção + acoplamento com a Rede; abre o planeta; Ocorrências da Contenção) | |
| 12–14 | Eras 4–6 (sistema estelar), balanceamento, prestígio (galáxia em diante), som | jogo completo |

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
*v0.7 — Parte 2 criada com a Era 2 completa; §6 e §8.4 apontam para ela. Ajustes da Sessão 7 registrados em `docs/sessoes/sessao-7-ajustes.md` e aplicados na Sessão 8: subestação com nível máximo 3 (§8.5) e universidade rendendo por alunos (§8.6).*
*v0.8 — playtest da v0.7 (Eras 1–2): melhorias por tipo em dois degraus (§7.1, §8.3, §8.5), cidade que evolui inteira (§8.6), remoção paralela, mais rápida e em área (§8.5), HUD com quatro números e o jogo "acontecendo" na cena (§10.1). Era 3 passa para a Sessão 10 (§12). Ver `docs/correcoes-gdd-v0.8.md`.*
*v0.9 — a espera medida na simulação da Sessão 8 (≈ 36 de ≈ 105 min parados esperando 🔬, ₵ ou 🛡): **Ocorrências**, o sub-jogo opcional de operação do Núcleo (§4.4); Estabilidade 1,8/min no ouro e 1,2/min fora, +3 por Ocorrência superada com 🛡 escolhido (§7, §8.4); **ciência com nível** por tipo (§7.1, §8.6); textos que ainda contradiziam a v0.8 corrigidos (§2.4, §2.5, §7, §8.2, §8.5); a Sessão 10 passa a ser as Ocorrências e a Era 3 vai para a 11 (§12). Ver `docs/correcoes-gdd-v0.9.md`.*
