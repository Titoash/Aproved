# KARDASHEV (codinome) — Documento de Design v0.5 · Parte 1 de 2

> Parte 1: conceito, os três sistemas, Cascata, economia, **Eras 1 e 2 completas** (§8), direção de arte, arquitetura e roteiro de sessões.
> Parte 2 (próximo passo): Eras 3–6 detalhadas, prestígio, roteiro dos cards explicativos.

---

## 1. Conceito em uma frase

Você começa com cata-ventos numa colina e termina cercando uma estrela. Um idle de gerenciamento de energia em duas camadas: a **Rede** (lista de usinas, números) e o **Núcleo** (grade de peças, geometria). Três balanças precisam ficar na faixa; sair dela dispara uma **Cascata**, que não encerra o jogo, mas faz você **voltar uma etapa**.

**Referências:** Reactor – Energy Sector Tycoon (usinas, calor que vira energia ou explode, pesquisa, novos locais) · estética flat-vector de infográfico científico, cores saturadas sobre fundo escuro (mascotes e identidade originais).

**Plataforma:** web (Vite + React + TypeScript + Phaser 3), desktop e mobile-first no navegador. Save local com exportação.

---

## 2. As duas camadas

### 2.1 Rede (lista) — escala e dinheiro
Lista de usinas com botão de comprar e melhorar. Produz **potência** (kW) de forma passiva. Aqui vive a balança **Oferta × Demanda**. Idle-friendly: roda sozinha, cresce com dinheiro.

### 2.2 Núcleo (grade) — risco e pesquisa
Um tabuleiro por era com a usina crítica da época (Torre Solar → Reator de fissão → Tokamak → Anel de antimatéria → Reator de buraco negro → Enxame de Dyson). A **posição importa**: peças trocam calor com vizinhas. Aqui vivem as balanças **Calor** e, a partir da Era 3, **Contenção**. É a **única fonte de Pesquisa** e o único lugar onde a Cascata acontece.

### 2.3 Acoplamento entre camadas (o que faz o híbrido valer)
- O Núcleo gera Pesquisa; Pesquisa desbloqueia usinas da Rede e a próxima era. Sem Núcleo bem operado, a Rede estagna.
- A partir da Era 3 o Núcleo **consome potência da Rede** para a contenção. Apagão na Rede → contenção cai → Cascata. A balança "tranquila" passa a ter dentes.
- O Núcleo produz potência que também vai para a Rede (e conta para o medidor Kardashev).

---

## 3. Recursos

| Ícone | Recurso | Unidade | Onde vive | Papel |
|---|---|---|---|---|
| ₵ | Créditos | ₵ | global | compra tudo |
| ⚡ | Potência | kW (prefixos SI reais) | Rede + Núcleo | vendida até a demanda |
| 🔋 | Bateria | kWh (±10 kW por unidade) | Rede | amortece a balança Oferta × Demanda |
| 🏙 | Demanda | kW | Rede | quanto a cidade compra |
| 🔥 | Calor | u (unidades) | Núcleo | produzido e dissipado por peças |
| 🔬 | Pesquisa | pontos | Núcleo → global | desbloqueios e eras |
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

**Medidor Kardashev:** `P` = potência **instalada** em watts, `(ofertaUsinasKw + ofertaNucleoKw) × 1000` — instalada, não vendida. Barra em `log10` de 10³ W a 10²⁷ W, com marcos reais: humanidade em 2026 ≈ 2×10¹³ W, Tipo I = 10¹⁶ W, Tipo II = 10²⁶ W, Sol = 3,8×10²⁶ W. Índice `K = (log10 P − 6) ÷ 10` (fórmula de Sagan), mostrado com duas casas quando `K ≥ 0` (a partir de 1 MW); antes disso, "abaixo da escala" e o próximo marco. O jogador vê onde está de verdade.

**Prestígio** ("Nova simulação"): pós-MVP. Depois da Era 6 (ou a partir da Era 4), reiniciar por **Constantes** permanentes. Definido na Parte 2.

---

## 7. Economia — regras gerais

- **Custo da n-ésima unidade** de uma usina da lista: `custo_base × 1,15^n` (Vilas e cidades: 1,25).
- **Melhoria** (nível): `custo_base × 3^nível`, produção `× (1 + 0,5 × nível)`.
- **Peças da grade:** preço fixo por era, sem inflação por unidade (a limitação é o espaço e o calor, não o preço).
- **Receita/s** = potência vendida (kW) × preço (₵ por kW·s) × multiplicador da balança Rede.
- **Preço base** por era: Era 1 = 1,0; cada era multiplica a escala de potência por ~100 e o preço por ~0,1 (mais watts, menos ₵ por watt — reflete o custo da energia caindo). Números finos da **Era 2 em §8.5**; Eras 3–6 na Parte 2.
- **Pesquisa/s** = potência do Núcleo ÷ 10 × multiplicador da zona de calor.
- **Offline:** janela `min(agora − salvoEmMs, 8 h)`; relógio andando para trás conta como 0. Nada é comprado offline. A Rede usa o balanço congelado do save, **sem bateria** (nem carrega nem descarrega) e com receita ×0,5. Núcleo em modo seguro obrigatório: calcula `T*` do equilíbrio da grade salva; se `T* ≥ 95 %`, o Núcleo fica **desligado** o tempo todo (0 kW, 0 🔬, Estabilidade parada) e o jogador é avisado do motivo; senão, potência ×0,7, pesquisa/s da faixa de `T*` ×0,7 e Estabilidade da faixa ×0,7. Ao voltar, `Q = Q*` (limitado a 95 % da capacidade), cronômetro da Cascata e SCRAM zerados. Nunca há Cascata offline. Relatório "Enquanto você esteve fora": tempo, ₵, 🔬, Estabilidade e, se for o caso, "Núcleo ficou desligado: sua configuração passaria de 95 %".
- **Ritmo definido:** ~60 min de jogo ativo por era. Estabilidade sobe +1,5 pontos/min na faixa normal e +2,5/min na zona de ouro (100 % em 40–65 min, contando paradas e Cascatas).

---

## 8. As duas eras do MVP

> §8.1–§8.4: **Era 1 — Vento e Sol** (colina, Torre Solar). §8.5: **Era 2 — Fissão** (cidade e rio, Reator PWR).

### 8.1 Estado inicial
₵ 50 · demanda inicial 5 kW (aldeia) · potência 0 · Núcleo bloqueado.

### 8.2 Rede
| Usina | Custo base | Potência | Desbloqueio |
|---|---|---|---|
| Cata-vento | ₵ 15 | 1 kW | início |
| Painel solar | ₵ 60 | 3 kW | 5 cata-ventos |
| Turbina eólica | ₵ 120 | 6 kW | 🔬 40 |
| Bateria | ₵ 80 | +20 kWh de capacidade | 🔬 20 |
| Vila | ₵ 40 | +8 kW de demanda | início (custo ×1,25) |

Melhorias da Rede (lista): **Lâminas de fibra** (₵ 200): cata-vento e turbina eólica +25 %. Compra única; 🔬 é requisito acumulado, não gasto.

### 8.3 Núcleo: Torre Solar (grade 5×5, centro fixo)
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

### 8.5 Era 2 — Fissão (completa)

> §8.1–§8.4 descrevem a Era 1. Esta subseção descreve a **Era 2** inteira: é o primeiro bloco dos "números finos" que o §7 remetia à Parte 2.

#### 8.5.1 A transição, em detalhe
Portão (repetido do §8.4): **Estabilidade 100 % + 🔬 3 000 + ₵ 50 000**. O botão só aparece com os três satisfeitos.

| Atravessa a transição | Zera ou troca |
|---|---|
| ₵ e 🔬 (🔬 é acumulado, nunca gasto) | O Núcleo: a Torre Solar **é substituída** pelo Reator PWR; peças e entulho da Era 1 desaparecem |
| Usinas, vilas e baterias da Era 1, com quantidades e níveis | Estabilidade volta a **0** — a balança nova precisa ser aprendida |
| Melhorias da Era 1 (os efeitos de Rede seguem valendo) | Calor, SCRAM, modo seguro e cronômetro da Cascata zerados |
| `cardsVistos` — nenhum card da Era 1 reaparece | Preço base da energia: de **1,0** para **0,1** |

A **demanda base** salta para os **800 kW** da cidade inicial, somada à demanda das vilas já compradas. Sem esse salto, `r` explodiria no instante da troca e o jogador cairia em saturação sem ter feito nada.

As usinas e vilas da Era 1 **continuam na lista e continuam compráveis**: o custo delas já inflacionou o bastante para se aposentarem sozinhas. Não existe regra de "aposentar item".

#### 8.5.2 Rede da Era 2 — preço base 0,1

| Item | Custo base | Efeito | Crescimento | Desbloqueio |
|---|---|---|---|---|
| **Hidrelétrica de rio** | ₵ 1 500 | 100 kW | 1,15 | — |
| **Termelétrica a gás** | ₵ 6 000 | 300 kW | 1,15 | 🔬 3 500 |
| **Usina nuclear** | ₵ 20 000 | 900 kW | 1,15 | 🔬 6 000 |
| **Cidade** | ₵ 4 000 | +800 kW de demanda | 1,25 | — |
| **Banco de baterias** | ₵ 8 000 | +2 000 kWh, ±1 000 kW | 1,15 | — |

As faixas de `r` (§4.1) não mudam: a balança Oferta × Demanda é a mesma, só a escala cresce.

#### 8.5.3 Núcleo: Reator PWR (grade 7×7, centro fixo)
A grade da Era 2 **nasce 7×7**. O jogador já pagou pela geometria maior na Era 1 e não faz sentido tirá-la; o reator também é fisicamente maior que a torre. O centro é o **Vaso do reator**, com **1 000 u** de capacidade. Não há expansão 9×9 na Era 2.

| Peça | Anéis | Efeito | Custo |
|---|---|---|---|
| **Vareta de combustível** | 1, 2 | +40 u/s no anel 1, +20 u/s no anel 2 (peso 0,5). Queima combustível. | ₵ 400 |
| **Gerador de vapor** | 1 (só adjacente) | Consome 12 % de `Q` por segundo e gera **8 kW por u** | ₵ 700 |
| **Bomba de refrigerante** | 1, 2 (só adjacente) | Dissipa **60 u/s** | ₵ 550 |
| **Pressurizador** | 1, 2 (só adjacente) | **+1 500 u** de capacidade compartilhada | ₵ 800 |

`kwPorUnidade` = 8, dez vezes a turbina da Era 1; com `Q` uma ordem de grandeza maior, a potência do Núcleo sai ~×100, como o §7 manda. O anel 3 (24 casas externas) existe na grade mas **nenhuma peça da Era 2 o aceita** — é espaço reservado para a Era 3.

#### 8.5.4 Combustível que esgota
- Cada vareta nasce com **100 %** e queima **0,25 %/s ponderado pelo anel** (peso 1 no anel 1, 0,5 no anel 2).
  → vareta do anel 1 dura **400 s** (6 min 40 s); a do anel 2, **800 s**.
- A **0 %** a vareta fica **gasta**: para de fissionar (entrada 0) e passa a emitir apenas calor de decaimento.
- **Recarregar** uma vareta gasta custa **60 % do preço** (₵ 240) e a devolve a 100 %. É o caminho normal, e não exige limpar nada.
- Uma vareta gasta **não pode ser removida enquanto estiver quente** (decaimento acima do corte de §8.5.5). A recusa diz o motivo: *"Ainda quente. Recarregue ou espere esfriar."*

#### 8.5.5 Calor de decaimento — a balança que muda de natureza
Além da fissão, cada vareta emite um calor residual que **não depende de estar produzindo**:

```
decaimento(t) = 0,07 × entradaNominal × 2^(−t / 90 s)
```

- fração **0,07** — os ~7 % reais de potência de decaimento logo após o desligamento
- meia-vida **90 s**; corte em **0,05 u/s**, abaixo do qual conta como zero e a vareta pode ser removida (≈ 6 meias-vidas ≈ 9 min)
- `t` conta do instante em que a vareta **parou de fissionar**: exaustão do combustível **ou** início do SCRAM, o que vier primeiro. Recarregar zera esse relógio junto com o combustível.

**A consequência é a era inteira:** o SCRAM zera a fissão mas **não** zera a entrada de calor. Com 5 varetas no anel 1, o SCRAM começa com `5 × 0,07 × 40 = 14 u/s` entrando e nenhum gerador consumindo. Sem bomba de refrigerante, o calor **sobe durante o SCRAM** e a Cascata acontece assim mesmo.

> Na Era 1, o SCRAM sempre salva. Na Era 2, não. É isso que a era ensina, e é o §9.7 virando mecânica em vez de texto.

#### 8.5.6 Exemplo obrigatório de equilíbrio
Anel 1 cheio — **5 varetas + 1 bomba + 2 geradores** — mais **2 varetas no anel 2**:

- entrada de fissão = `5 × 40 + 2 × 20` = **240 u/s**
- dissipação = `1 × 60` = **60 u/s**
- `Q* = (240 − 60) ÷ (0,12 × 2)` = **750 u**; capacidade 1 000 → **T = 75 %**, zona de ouro
- potência = `2 × 0,12 × 750 × 8` = **1 440 kW ≈ 1,4 MW** (Era 1 na zona de ouro: ~16 kW → ×90, dentro do "~×100" do §7)

E o que a Era 1 não tinha: **isso não é estável no tempo.** Aos 400 s as 5 varetas do anel 1 se esgotam juntas e a entrada cai para `40 (anel 2) + 5 × 2,8 (decaimento) = 54 u/s`, abaixo dos 60 u/s da bomba. O calor despenca e a potência com ele. O jogador aprende a **escalonar as recargas** em vez de trocar tudo de uma vez.

#### 8.5.7 Cascata, modo seguro e offline na Era 2
- **Cascata** (§5): mesma regra e mesmos números. O entulho do anel 1 vale para as peças da Era 2; uma vareta que vira entulho perde o combustível que tinha.
- **Modo seguro**: mesmo limiar de 95 %. A diferença é que agora o SCRAM automático pode não bastar — ver §8.5.5.
- **Offline** (§7): mesma janela e mesmos fatores, com duas regras próprias da era, ambas a favor do jogador — **a ausência nunca piora a grade**:
  1. o combustível **não queima** offline;
  2. o decaimento das varetas já gastas **avança pelo relógio**, então elas esfriam enquanto o jogador está fora.
  O `T*` do modo seguro offline inclui o termo de decaimento das varetas gastas no instante do save.

#### 8.5.8 Saída da Era 2
Estabilidade 100 % + pesquisa "Confinamento magnético" (🔬 300 000) + ₵ 5 000 000 → Era 3. Números escalados pela regra do §7 (×100) e **provisórios** até a Era 3 ser especificada.
---

## 9. O que faz o jogo surpreender

1. **Unidades reais e medidor Kardashev** com marcos de verdade (humanidade hoje, Tipo I, Tipo II, o Sol).
2. **Cards explicativos** por era (3 telas, ciência real, tom curioso e direto): Carnot, calor de decaimento, contenção magnética, radiação no vácuo, radiação Hawking, sombra de Dyson.
3. **Balanças que mudam de natureza** a cada era em vez de só crescer números — inclusive uma invertida (Era 5).
4. **Acoplamento entre camadas**: apagão na Rede derruba a contenção do Núcleo.
5. **Cascata como "voltar um pouco"** com card do que deu errado, não game over.
6. **Transição de era com zoom cósmico** e mudança de paleta.
7. **Detalhes físicos que viram mecânica**: turbina rende mais quente; peça gasta continua quente; no vácuo não há convecção.

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
| 5 | Era 2 (fissão: esgotamento e calor de decaimento) e transição de era | MVP: Eras 1–2 |
| 6 | Era 3 (Contenção + acoplamento com a Rede) | |
| 7–9 | Eras 4–6, balanceamento, prestígio, som | jogo completo |

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
*v0.5 — §8.5 escrita: Era 2 completa (Reator PWR, combustível que esgota, calor de decaimento, Rede e transição), porque os números finos da Era 2 estavam remetidos a uma Parte 2 inexistente; §7 atualizado. Ver `docs/correcoes-gdd-v0.5.md`.*
