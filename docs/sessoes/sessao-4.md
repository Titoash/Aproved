# Sessão 4 — Era 1 bonita: passe de arte, cards explicativos, Bipes, Grade 7×7

> Pressupõe a Sessão 3 concluída (input da grade pelo DOM, bateria como amortecedor, melhorias, offline, Kardashev). Antes de planejar, leia `docs/ESTADO.md` e reconcilie: se algo da Sessão 3 ficou pendente, entra aqui **antes** da arte.

## Objetivo
A Era 1 fica pronta para alguém jogar sem o autor do lado: bonita, legível, com os cards que ensinam o que a mecânica cobra (zona de ouro, tanque, Rastreamento, Cascata, bateria), mascotes originais e a Grade 7×7 como último upgrade da era. Nenhuma regra de simulação muda, exceto a expansão da grade.

Referências: GDD §5 (Cascata), §8.3 (Torre Solar), §9 (o que surpreende), §10 (direção de arte).

---

## Parte A — Direção de arte aplicada

### A.1 Princípio: a ousadia vai toda para o Núcleo
Um elemento memorável, o resto quieto. A **Torre Solar** — a esfera do Receptor na rampa de calor, com brilho que cresce com `T` — é a única coisa que chama atenção na tela. Tudo em volta (HUD, Rede, barras) é disciplinado: pouca cor, cor só quando significa estado.

O que **não** fazer, porque é o padrão genérico e não é este jogo:
- não cortar a interface em cartões idênticos com a mesma sombra em tudo (o "kit SaaS"); hierarquia vem de espaçamento e divisórias, não de mais caixas;
- não usar caixa alta com espaçamento em rótulos, nem rótulos decorativos acima de conteúdo;
- não animar entrada de seção, nem hover em todo botão; movimento só como resposta a uma ação ou para o Núcleo;
- não usar contorno preto em forma nenhuma; sombra é **chapada e deslocada** na matiz do fundo.

### A.2 Hierarquia da tela
Desktop (≥ 1100 px):
```
┌─ HUD (faixa fina, sem cartão) ─────────────────────────────────────┐
│ ₵ 12,4 mil  +75/s │ ⚡ 96 kW ● ouro │ 🔥 83 % │ 🔬 1 240 │ 🛡 42 % │
├─ Núcleo (palco, sem cartão) ───────────┬─ Rede (lista com divisórias)─┤
│         [grade solta sobre o fundo]    │ Cata-vento     12 · 12 kW [₵]│
│  ▁▁▁ barra de calor com faixas ▁▁▁     │ Painel solar    4 · 12 kW [₵]│
│  ▁▁▁ Estabilidade ▁▁▁                  │ ...                          │
│  [seletor de peças em pílulas]         │ Melhorias                    │
├─ Kardashev (barra log, largura total) ─┴──────────────────────────────┤
└─ Save (discreto, no rodapé) ──────────────────────────────────────────┘
```
Mobile (≤ 600 px), uma coluna nesta ordem: HUD compacto fixo no topo (₵, ⚡ com o ponto de `r`, 🔥) → grade → barra de calor → seletor de peças como faixa horizontal rolável → Estabilidade → Kardashev → Rede → Save.

A grade fica "solta": sem cartão em volta, com uma base elíptica escura embaixo (sombra chapada da torre). É o palco.

### A.3 Tipografia
- Outfit 500/600/700 para títulos e números grandes; Nunito 400/600/700 para texto. Escala: 12 / 14 / 16 / 20 / 28 / 40 px. `font-variant-numeric: tabular-nums` em todo número que muda.
- Linhas de texto com no máximo 70 caracteres (cards).
- **Fontes locais:** baixar os `.woff2` de Outfit e Nunito (licença OFL) para `public/fonts/`, declarar com `@font-face` e `font-display: swap`, remover as tags do Google Fonts do `index.html`.

### A.4 Tokens (completar `src/ui/tokens.css`)
Manter os existentes e adicionar:
- `--casa: #1c2250`, `--casa-anel1: #232a5e`, `--torre: #2b3270`, `--turbina-carcaca: #e9edff`, `--tanque: #c9cfff`, `--entulho: #3a3f5e`;
- rampa de calor como lista de paradas (já está em `content/era1-nucleo.ts`) — a UI e a cena leem da mesma fonte;
- `--glow-sun: 0 0 24px rgba(255, 210, 63, .45)` e equivalente para `--coral`, usados **só** no Receptor, na esfera do HUD de 🔥 e no botão primário quando algo está comprável pela primeira vez.

### A.5 Peças na grade (`src/scene/GridScene.ts`, tudo vetorial em `Graphics`)
Cada peça: forma simples, sombra chapada 4 px (canvas) para baixo e para a direita, sem contorno. A cor comunica estado.

| Peça | Forma | Estado visível |
|---|---|---|
| Casa vazia | quadrado arredondado `--casa` (anel 1 em `--casa-anel1`) | realce válido: borda `--leaf` 2 px; inválido: `--coral` |
| Heliostato | espelho = retângulo arredondado (0,7 × 0,45 da casa) **girado para apontar ao Receptor** (`atan2` do centro), face `--sky` com faixa de brilho branca a 40 %, pedestal fino embaixo | anel 2 e 3 com a face 15 % e 30 % mais escura (transmite o peso); com Rastreamento, a faixa de brilho varre a face a cada 6 s |
| Turbina | carcaça circular `--turbina-carcaca` com 3 pás `--navy` | pás giram com velocidade ∝ consumo (paradas no SCRAM); um fio de vapor sobe proporcional à potência |
| Radiador | retângulo arredondado com 4 aletas verticais `--sky` | aletas clareiam enquanto dissipa |
| Tanque | cilindro (elipse no topo + corpo) `--tanque` | nível interno preenchido pela rampa de calor, altura = `T` |
| Receptor | torre = trapézio estreito `--torre` + esfera no topo | esfera na rampa de calor; brilho aditivo com raio de 1,3× a 1,8× conforme `T`; acima de 90 % pulsa a cada 1 s; em SCRAM fica cinza-azulada, sem brilho, com um anel pontilhado girando devagar |
| Entulho | polígono irregular `--entulho` em dois pedaços | um Bipe de manutenção flutua em cima; quando a limpeza fica grátis (30 s) o entulho ganha borda `--leaf` |

Cascata: manter onda e tremor; acrescentar flash branco de 120 ms na esfera, 12 brasas `#ff7a1a` caindo do Receptor por 1,5 s, e o entulho aparecendo com "pop" (escala 1,2 → 1 em 180 ms).

Partículas de calor: reduzir a densidade atual pela metade e colorir pela rampa. `prefers-reduced-motion` desliga partículas, pulso, giro e tremor.

### A.6 UI (React/CSS)
- HUD: números em Outfit 600, rótulos pequenos em Nunito; cor de estado apenas no ponto ao lado de `r` (coral / neutro / `--sun` / `--sky`) e no valor de 🔥 (rampa). Sem cartões.
- Rede: lista com divisórias de 1 px `--card-borda`; cada linha: nome, quantidade, potência total, botão-pílula com o custo à direita. Melhorias como linhas da mesma lista, com uma marca de "comprado" quando feitas.
- Barra de calor: fundo segmentado pelas faixas (frio, normal, ouro em `--sun` a 25 %, alerta, crítico), preenchimento na rampa, marca de `Q*` como triângulo pequeno, limite como traço. Abaixo da barra, **uma linha de dica** derivada de `Q*` (não do `T` atual): se `Q* < 70 %` → "Adicione espelhos: a marca sobe"; se `Q* > 100 %` → "Tire um espelho ou ponha um radiador"; senão nada. É isso que resolve o problema do tanque sem ler o card.
- Estabilidade: preenchimento `--leaf` → `--sun`.
- Botões: pílula; primário `--sun` com texto `--navy`; desabilitado a 40 % de opacidade; pressionar = `scale(.97)`. Ao comprar, **só** o número que mudou faz um "pop" de 180 ms (`ease-out-back`); nada mais se mexe.
- Foco de teclado visível em tudo que é clicável.
- Favicon original em `public/favicon.svg`: esfera laranja da rampa sobre um triângulo `--torre`, fundo `--navy`.

---

## Parte B — Cards explicativos (`src/content/cards-era1.ts` + `src/ui/CardExplicativo.tsx`)

Formato: um card por vez, sobre a tela, com um Bipe narrador no canto, título em Outfit, texto em Nunito, botão "Entendi" (e "Próximo" quando há mais telas). Aparece **uma vez** por gatilho; `cardsVistos` fica no save. Cada card tem `id`, `gatilho`, `titulo`, `texto`, `bipe` (papel e expressão).

Os textos abaixo são finais, salvo ajuste do Tito. Não reescrever o tom.

### B.1 Abertura da Era 1 — "Do vento à estrela" (3 telas, gatilho: primeiro carregamento sem save)

**Tela 1 — Tudo começa com 1 kW**
Um cata-vento de quintal gera 1 kW. A humanidade inteira, hoje, usa uns 20 trilhões de watts. O Sol despeja no espaço 19 trilhões de vezes isso, o tempo todo, sem cobrar. Este jogo é a distância entre esses dois números. O medidor Kardashev mostra onde você está. Por enquanto, no comecinho.

**Tela 2 — A Torre Solar**
Espelhos no chão apontam para uma torre. A luz vira calor no Receptor. O calor ferve um fluido que gira uma turbina, e a turbina faz eletricidade. É só isso — e é o suficiente para existirem torres assim de verdade na Espanha e no Marrocos. Na grade: espelho injeta calor, turbina consome calor e gera kW, radiador joga calor fora. Colado na torre, cada espelho vale o dobro.

**Tela 3 — A regra de ouro**
Turbinas rendem mais quando o Receptor está quente. Física de verdade: quanto maior a diferença de temperatura, mais trabalho se tira do mesmo calor — Carnot descobriu isso em 1824. Então o melhor lugar para operar é quente, entre 70 e 90 %, perto do limite. Passou de 100 % por 5 segundos, o Receptor derrete: isso é a Cascata. A marquinha na barra mostra onde a sua configuração vai parar. Mire a marquinha na zona de ouro.

### B.2 Tanque de sal (gatilho: primeira compra de tanque)
**O tanque não esfria nada. Ele dá espaço.**
O tanque guarda calor em sal derretido. Torres reais fazem isso para gerar energia à noite, horas depois de o Sol se pôr. Aqui ele aumenta a capacidade do Receptor: o mesmo calor agora ocupa uma fatia menor da barra, e você desceu para fora da zona de ouro. Não é defeito, é espaço. Coloque mais espelhos até a marquinha voltar para o ouro. Mais capacidade, mais espelhos, mais kW.

### B.3 Rastreamento solar (gatilho: compra da melhoria)
**Seus espelhos agora seguem o Sol.**
Espelhos que acompanham o Sol entregam mais calor cada um: 5 em vez de 4. A marquinha do equilíbrio acabou de subir 25 %. Se você já estava perto do limite, agora está acima dele. Tire um espelho ou ponha um radiador antes que os 5 segundos acabem.

### B.4 Cascata (gatilho: primeira Cascata; usa os números reais do momento)
**O Receptor derreteu.**
O calor entrou mais rápido do que saiu por 5 segundos: {entrada} u/s entrando, {saida} u/s saindo. Torres de verdade resolvem isso em segundos, desfocando os espelhos; aqui você tem o SCRAM e o modo seguro. O que sobrou: as peças do anel 1 viraram entulho (reconstruir custa metade; limpar é grátis em 30 s), a Estabilidade caiu 30 pontos e o Núcleo fica desligado por 20 s. A Pesquisa você não perdeu.

`{entrada}` = calor por espelho × `h` no tick do gatilho; `{saida}` = dissipação dos radiadores + consumo das turbinas no mesmo tick. O sim registra os dois em `ultimaCascata` para a UI ler.

### B.5 Bateria (gatilho: primeira compra de bateria)
**A bateria não gera nada. Ela segura a balança.**
Ela cobre um déficit curto e absorve um excedente curto — e enquanto consegue, o preço não cai. Cada unidade guarda 20 kWh e aguenta 10 kW de fluxo. Quando o Núcleo desliga num SCRAM, é ela que evita o apagão.

### B.6 Mecânica dos gatilhos
O sim expõe uma fila de eventos por tick (`eventos: EventoJogo[]`, limpa a cada tick) — `primeiraCompra`, `melhoriaComprada`, `cascata`, `primeiroCarregamento`. A UI consome, mostra o card se `id ∉ cardsVistos`, e despacha `marcarCardVisto(id)`. Nada de `if` de card dentro do sim.

---

## Parte C — Bipes (mascotes originais)

Robôs esféricos de manutenção. Um SVG base em `src/ui/bipe/Bipe.tsx` com props `papel` e `expressao`.
- Corpo: círculo. Cor por papel: operador `--sky`, manutenção `--leaf`, cientista `--sun`.
- Um olho só: círculo grande `--navy` com um brilho branco pequeno no canto superior; pálpebra que pisca a cada 4–6 s (CSS, desligado em `reduced-motion`).
- Antena: haste curta no topo com uma bolinha que acende na cor do papel.
- Dois braços em cápsula, sem mãos. Sem pernas: flutua sobre uma sombra elíptica.
- Expressões só por olho e antena: `neutro`, `apontando` (olho olha para o lado, braço estendido), `alarmado` (olho maior, antena vermelha), `cansado` (olho meio fechado — o do card offline).
- Sem contorno preto; sombra chapada 4 px.
- Onde aparecem: narrador dos cards; sobre o entulho na grade (Phaser desenha uma versão mínima com `Graphics`: círculo, olho, antena, sobe-e-desce de 2 s); no card "Enquanto você esteve fora" (cansado).

Não existe passarinho, logo ou personagem de terceiros em lugar nenhum.

---

## Parte D — Grade 7×7

Último upgrade da Era 1: **Grade 7×7** (₵ 800 + 🔬 150), como dado em `MELHORIAS_NUCLEO`.
- `lado` deixa de ser constante: vive em `nucleo.lado` (5 ou 7). `anel()`, `podeColocar()`, `entulharAnel1()`, `contar()` e os índices do Receptor recebem `lado`.
- Anel 3 (as 24 casas externas do 7×7) com peso **0,25**; só heliostato entra no anel 3 (`aneis: [1, 2, 3]` no dado do heliostato).
- `expandirGrade(grade5): grade7` embute o 5×5 no 7×7 com deslocamento (+1, +1): `(x, y) → (x + 1) + (y + 1) × 7`. Peças, entulho e Receptor preservados.
- `GridScene` e o input da grade pelo DOM leem `lado` do store e recalculam o tamanho da casa.
- Save **v4**: `nucleo.lado`, `cardsVistos`, `ultimaCascata`; migração v3 → v4 (`lado = 5`, `cardsVistos = []`).
- Consequência de balanço a registrar no GDD §8.3: com 7×7 e 2 turbinas, `h` chega a 6 + 8 + 24 × 0,25 = 20 → `Q* = 333`, o que só cabe na zona de ouro com tanques (3 tanques → capacidade 550 → `T* ≈ 61 %`; 2 tanques + cerâmico → 450 → 74 %). A grade grande existe para ser usada **junto** com os tanques. A dica da barra continua valendo.

---

## Testes (Vitest)
- `anel()` para `lado = 7`: índice 24 = anel 0; 8 vizinhas = 1; 16 seguintes = 2; 24 externas = 3.
- `expandirGrade` preserva cada peça na casa correspondente e mantém o Receptor no centro.
- `h` com anel 3 a 0,25; heliostato aceito e turbina/radiador/tanque recusados no anel 3.
- Compra da Grade 7×7 exige ₵ 800 e 🔬 150, é única, e depois dela `podeColocar` aceita índice 48.
- Migração v3 → v4 preserva tudo e adiciona os campos novos.
- Eventos: `primeiraCompra` dispara só na primeira unidade; `cascata` carrega `entrada` e `saida` iguais ao balanço do tick; `marcarCardVisto` persiste.
- Dica da barra: `Q* = 55 %` → "Adicione espelhos"; `Q* = 108 %` → "Tire um espelho…"; `Q* = 83 %` → sem dica.

## Critérios de pronto
- [x] Capturas com Playwright em 1280×800 e 390×844 conferidas contra a Parte A: hierarquia, sem cartões idênticos, sem caixa alta em rótulo, sombra chapada em tudo, o Receptor é o único elemento com brilho.
- [x] Espelhos apontam para a torre; pás giram com a potência; tanque mostra o nível; Receptor pulsa acima de 90 % e fica cinza no SCRAM.
- [x] Os 7 cards aparecem nos gatilhos certos, uma vez cada, e sobrevivem ao recarregamento.
- [x] O card da Cascata mostra os números do momento.
- [x] Dica da barra aparece e some conforme `Q*`.
- [x] Bipe sobre cada entulho; Bipe narrador nos cards; Bipe cansado no card offline.
- [x] Grade 7×7 comprável, expande sem perder peças, anel 3 só aceita espelho.
- [x] Fontes servidas de `public/fonts/`; nenhuma requisição a `fonts.googleapis.com`.
- [x] `prefers-reduced-motion` desliga partículas, giro, pulso e tremor.
- [x] Favicon próprio.
- [x] `npm test`, `npm run typecheck`, `npm run build` passam; `docs/ESTADO.md` e GDD §8.3 (nota do 7×7) atualizados.

## Fora de escopo — não faça nesta sessão
Era 2, transição de era, prestígio, som e música, prefetch de eras futuras, qualquer mudança nas fórmulas de calor, Rede ou offline.

## Armadilhas conhecidas
- Toda função de `nucleo.ts` que assume 25 casas ou índice 12 quebra silenciosamente com 49 casas: procurar por `25`, `12` e `NUCLEO.lado` antes de começar a Parte D.
- A rampa de calor tem uma fonte só (`content/`); se a UI e a cena divergirem em uma parada, a esfera e o número de 🔥 mostram cores diferentes.
- O card da Cascata precisa dos números **do tick do gatilho**, não do estado atual (que já está em SCRAM, com entrada 0).
- Cards nunca bloqueiam o tick: a simulação continua por baixo; só o card de abertura pausa (jogo ainda nem começou).
- Fontes: verificar peso e nome exatos nos `@font-face`; um nome errado cai no fallback sem avisar.
- Rotação do heliostato: calcular uma vez por peça ao redesenhar (a cena é `dirty`-based), não a cada frame.

## Prompt para colar no Claude Code
> Leia `CLAUDE.md`, `docs/ESTADO.md`, `docs/GDD-parte1.md` e `docs/sessoes/sessao-4.md`. Se a Sessão 3 deixou pendências, liste-as e proponha resolvê-las antes. Depois monte um plano em passos numerados para cumprir **só** a Sessão 4, na ordem Parte D → Parte B → Parte C → Parte A, e me mostre antes de executar. Implemente passo a passo, rodando `typecheck` e `test` a cada passo, tire capturas com Playwright nos dois tamanhos ao fim da Parte A, e termine atualizando `docs/ESTADO.md`.
