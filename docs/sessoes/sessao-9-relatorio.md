# Relatório da Sessão 9 — melhorias por tipo, cidade inteira, remoção em área, HUD limpo e cena viva

Branch `claude/adoring-fermat-wnbjgz`, a partir de `a96db9a` (GDD v0.9 e especificação da Sessão 10). Especificação: `docs/sessoes/sessao-9.md`, com o GDD v0.8 e a v0.9 revisada.

## 1. Plano e base medida

1. **Parte 0:** ajustes da Sessão 8 (itens 2, 3, 4 e 8) e o defeito do offline do reator.
2. **A:** melhorias por tipo, com a ciência com nível, e save v9.
3. **B:** cidade inteira.
4. **C:** Núcleo com nível por peça e "Trocar todas as gastas".
5. **D:** remoção com N Bipes e em área.
6. **E:** HUD limpo e nível na carta.
7. **F:** "ver acontecendo".
8. **G:** balanceamento.
9. **H:** verificação.

Ordem de corte da especificação: fumaça, "+🔬", Escavadeiras. **Nada foi cortado.**

Base medida antes da sessão (a simulação da v0.9, sobre o código da Sessão 8):
- a Era 1 fecha em 54,2 min;
- a Era 2 corrida fecha em 64,9 min;
- a rota cidade não fecha: a megacidade e a arcologia nunca acontecem;
- ≈ 36 de ≈ 105 minutos parados.

No meio da sessão, uma revisão adversarial do GDD v0.9 confirmou 32 achados (13 médios, 19 baixos). Foram aplicados antes da parte D (`2b2d6db`; resumo em `docs/correcoes-gdd-v0.9.md`).

## 2. O que foi feito

| Parte | Commits | O quê |
|---|---|---|
| 0 | `e184cdd` `b78d827` `8d3fa67` `d5938fa` `ba52075` `dc24f21` | O `loop.ts` recebe o relógio de fora, e um teste garante a pureza do sim. A Arcologia exige só a Megacidade. O callout da subestação diz os números dos três tipos e a ilha da offshore. O offline do reator é integrado por trechos: 8 h fora não rendem mais 48× a 🔬 de 10 min. A simulação ganha as rotas corrida e cidade. A Estabilidade da Era 2 só sobe com fissão, e o Vaso volta frio depois de uma ausência longa. |
| A | `4731df2` `f210d78` | Níveis por tipo: usinas, peças, subestações, cabos e ciência, com save v9 e migração v8 → v9. Depois da revisão, a unidade nova de subestação ou de ciência paga o acumulado do nível. |
| B | `98ccfb7` | `state.cidade.densidade`. A evolução custa × N bairros, e o bairro novo paga o acumulado em ₵ e 🔬. |
| C | `26937b1` | Nível de peça no seletor e desenhado na grade; "Trocar todas as gastas". |
| D | `2c16647` `85d5173` `ef87db4` | Tempos pela metade, N Bipes, Equipe, Máquinas pesadas e Escavadeiras, e área com confirmação. A fila anda offline, e a montanha gasta 🔬 20. |
| E | `27e960e` | HUD com quatro números, capítulo numa linha (e a grade do layout corrigida), faixa de nível na carta da paleta. |
| F | `db320e7` `b3e6b8d` `5659d1e` `396227d` | Fios e pulsos, pulsos nos cabos, "+₵" e "+🔬", janelas, Bipes andando, fumaça, brilho ∝ T e diário. Mais a medida de ms por quadro. |
| G | `82fba86` `165232e` `f256d22` `1bb48db` | 🔬 da Era 2 recalibrada. O bot compra níveis e roda as duas rotas nas duas eras, com janelas paradas por minuto e `--sem-nivel-ciencia`. |
| H | este commit | `scripts/e2e/sessao-9.cjs`, roteiros 6–8 atualizados, capturas, ESTADO e este relatório. |

## 3. Decisões fora do GDD (ou que o GDD passou a registrar)

1. **Unidade nova de subestação ou de ciência paga o acumulado do nível do tipo** (Parte 1 §7.1). É a mesma correção do bairro novo. Sem ela, subir o nível com uma universidade e construir as outras depois custava ₵ 145 mil em vez de ₵ 871 mil para seis.
2. **O máximo de 5 níveis de ciência é no total, por tipo**, não por era, e o nível atravessa a transição (§7.1, Parte 2 §4.2).
3. **A fila de remoção anda offline** (§7). É trabalho já pago, e o relatório "Enquanto você esteve fora" conta os obstáculos.
4. **Seleção em área no desktop só com a ferramenta Desmatar ou com Shift.** Com as outras ferramentas, arrastar continua movendo a câmera, e o pan fica com o botão do meio ou direito. **Área tudo ou nada.** Montanha que encosta entra uma vez.
5. **A montanha gasta 🔬 20.** O GDD sempre disse isso; o código só exigia o saldo.
6. **Escavadeiras exige Máquinas pesadas** (Parte 2 §6).
7. **As janelas piscam no apagão (r < 0,8) e apagam abaixo de metade atendida** (§10.1). O atendimento conta a bateria cobrindo.
8. **O diário é DOM, não canvas.** Custa zero no quadro, é lido por leitor de tela e pelos roteiros. Some quando o callout ou a confirmação ocupam o rodapé, e os callouts desviam dele.
9. **O "+🔬" do canvas é um frasco desenhado.** O emoji depende de fonte colorida e sai como quadrado no Chromium sem ela (regra 6).

## 4. Medições

### 4.1 Simulação (`npm run simular`, ainda com Estabilidade 2,5/1,5)

| | corrida | cidade | corrida sem nível de ciência | cidade sem nível de ciência |
|---|---|---|---|---|
| Era 1 fecha em (🛡 + nó) | 41,5 min | 42,3 min | 43,4 min | 44,9 min |
| Reator construído | 42 min | 43 min | 46 min | 46 min |
| Era 1: cidade no fim | Vila, 29 bairros | Metrópole, 29 bairros | Cidade, 28 | Metrópole, 31 |
| Era 2 fecha em | **48,1 min** | **68,3 min** | 51,7 min | não fecha em 75 |
| Megacidade / arcologia | — | 40,2 / 67,3 min | — | 51,2 / 74,6 min |
| Minutos parados (Era 1 + Era 2, até o fechamento) | 10 + 5 de 91 | 7 + 23 de 112 | 6 + 31 de 98 | 11 + 18 de 121 |
| ₵ em níveis (duas eras) | ₵ 57 mi | ₵ 32 mi | ₵ 15 mi | ₵ 13 mi |

- **A ciência com nível fez o que a v0.9 pedia.** Na Era 2 corrida, os minutos parados caem de 31 para 5, e a era fecha no piso da Estabilidade em vez de esperar 🔬.
- A janela que sobra na Era 1 corrida (min 36–42, trava 🛡) é a barra enchendo. As Ocorrências da Sessão 10 existem para isso.
- **A rota cidade é sensível ao bot.** Nas rodadas desta sessão ela fechou em 45,7, 50,3 e 68,3 min com mudanças pequenas de decisão. O que a segura é juntar ₵ e 🔬 para evoluir a cidade inteira à megacidade (min 7–39 da Era 2).
- A receita líquida nunca ficou negativa.

### 4.2 Desempenho (`scripts/e2e/perf-cena.cjs`)

Mundo cheio (todas as ilhas, construção em toda casa de terra, 6 Bipes em curso), mediana de 3 rodadas de 4 s, em ms por quadro:

| | antes da F (entrada + quadro) | depois da F | diferença |
|---|---|---|---|
| desktop · ilha | 1,571 + 3,421 = 4,99 | 1,343 + 3,143 = 4,49 | −0,5 (ruído) |
| desktop · Núcleo | 0,754 + 4,254 = 5,01 | 1,144 + 4,467 = 5,61 | +0,60 |
| celular · ilha | 0,863 + 2,815 = 3,68 | 1,383 + 2,918 = 4,30 | +0,62 |
| celular · Núcleo | 0,713 + 2,808 = 3,52 | 0,975 + 3,225 = 4,20 | +0,68 |

O teto do GDD é +3 ms. A montagem da entrada passou a entrar na conta (`marcar("entrada")`). O tick com 6 Bipes e fila de 64 no mundo cheio custa 2,8 ms (Vitest, `desempenho.test.ts`).

### 4.3 Verificação

- `npm test`: 502 testes. Os novos:
  - `remocao.test.ts`: fila paralela, independência do tamanho do tick, área, offline e save;
  - `vida.test.ts`: consumidores e eventos de vários ticks;
  - `ui/__tests__/hud.test.ts`: o HUD bate com o tick;
  - diário no `gameStore.test.ts`;
  - custo acumulado do nível em `melhorias.test.ts`;
  - desempenho com 6 Bipes.
- `npm run typecheck`, `npm run lint` e `npm run build` limpos.
- `scripts/e2e/sessao-9.cjs`: 52 verificações nos dois tamanhos, cobrindo:
  - HUD de quatro itens e capítulo numa linha que não cobre o tabuleiro;
  - nível de usina pela carta (×1,5) e nível de peça pelo seletor;
  - a cidade evoluindo pelo botão, com custo × N, e o bairro novo pagando o acumulado;
  - dois Bipes em paralelo e o diário;
  - área por arrasto no desktop e por toque longo no celular, com confirmação e cobrança única;
  - fios e "+₵";
  - sem rolagem horizontal e sem erro no console.
- Roteiros 6, 7 e 8 atualizados às APIs novas (👥 no painel da Cidade, `cidade.densidade`, `evoluirCidade`, `melhorar({ tipo: "cabos" })`) e verdes como regressão, com as capturas fora do repositório: 52, 76 e 82 verificações.

## 5. Conflitos com o GDD

| Onde | O que não fechava | O que fiz |
|---|---|---|
| Parte 1 §8.6, bairro novo | `× 2,5^(d−1)` só em ₵ deixava evoluir a cidade com um bairro e construir depois, pagando a 🔬 uma vez | O bairro novo paga o acumulado da evolução por bairro, em ₵ e 🔬 (GDD editado na parte B) |
| Parte 1 §7.1, ciência com nível | A unidade nova herdava o nível de graça, e o sumidouro se desfazia | Acumulado, como o bairro (revisão da v0.9) |
| Parte 2 §4.1, 🔬 da megacidade e da arcologia | Com a cidade inteira, 🔬 × 30–50 bairros: a arcologia custava 🔬 450–750 mil contra 250–540 mil ganhos na era, e nunca acontecia | 🔬 1 000 e 3 000 por bairro; o ₵ não mudou (`82fba86`) |
| Parte 1 §10.1, janelas | "apagando no apagão (r < 0,5)", mas o apagão começa em 0,8 | Piscam abaixo de 0,8 e apagam abaixo de metade atendida (`b3e6b8d`) |
| Parte 1 §8.5, montanha | "₵ 400 + 🔬 20", mas o código só exigia o saldo | Gasta (`2c16647`) |
| Sessão 9 G, "Era 1 e Era 2 em 50–70 min com 2,5/1,5" | Com a ciência com nível, a Era 2 corrida cai para o piso da 🛡 (48,1 min), como a Era 1 (41,5) já caía na Sessão 7 | Mantido e registrado em Parte 1 §8.4. As taxas da Sessão 10 (1,8/1,2) sobem o piso para ≈ 56 min |

## 6. O que a gestão deve verificar primeiro

1. `docs/capturas/sessao-9/desktop-05-area.png` e `celular-05-area.png`: a seleção em área. Conferir o retângulo, a confirmação com custo e tempo, e os "+₵" sobre os bairros.
2. `desktop-01-hud.png` e `celular-01-hud.png`: o HUD de quatro números e o capítulo numa linha.
3. `desktop-02-paleta-nivel.png` e `celular-02-paleta-nivel.png`: o nível na carta.
4. `desktop-07-vida.png`: os fios, os pulsos e as janelas.
5. A recalibração da 🔬 da Era 2 (Parte 2 §4.1) e a Era 2 corrida abaixo de 50 min (Parte 1 §8.4).

## 7. Pendências

Estão em `docs/ESTADO.md`, seção "Da Sessão 9":
- a sensibilidade da rota cidade;
- a rolagem de 9 px do painel do Núcleo em 800 px de altura;
- os "+₵" só no que está na tela;
- a rolagem automática na borda durante a seleção;
- a Equipe comprada só na rota cidade.
