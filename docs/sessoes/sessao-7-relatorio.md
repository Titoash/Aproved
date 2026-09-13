# Sessão 7 — relatório de produção

Branch `claude/sessao-7`. GDD v0.6, roteiro em `docs/sessoes/sessao-7.md`, ajustes da gestão em
`docs/sessoes/sessao-6-ajustes.md`. Este arquivo abre com o plano e termina com decisões, medições e
pendências.

> **Base do branch.** O protocolo manda sair de `claude/era1-scaffold-rede-pqkglz`, mas essa ref é
> **ancestral** da Sessão 6 (ela não foi movida quando a gestão incorporou o branch): sair dali jogaria
> fora os 9 commits da Sessão 6. O branch saiu de `faab8c3` ("docs: ajustes da gestão sobre a Sessão 6"),
> que é a ponta com a Sessão 6 e os ajustes. Decisão registrada; a gestão pode querer mover a ref base.

## Plano

**0 · Ajustes da Sessão 6** (commit próprio, com o GDD atualizado onde o item pede)
1. Cabo submarino com teto próprio de kW (30 kW, nível custo ×3ⁿ e teto ×2ⁿ) e ₵ 120 por casa de mar.
2. Montanha devolve 🔬 40 e deixa 4 casas de rocha **com cristal** (+50 % em laboratório/universidade).
3. Régua Kardashev: só "Tipo II" rotulado; o Sol vira marca auxiliar sem rótulo (título no ponteiro).
4. Minimapa mostra as ilhas já ligadas por cabo.
5. e 6. são medições/consequências das partes F e B–C.

**A · Cidade (sim puro)**
7. `content/cidade-era1.ts`: densidades 1–4 (demanda, população, tarifa, custo de evolução), bairro,
   laboratório, universidade, cristal.
8. `sim/cidade.ts`: `densidadeDe`, `evoluirBairro` (₵ + 🔬), `populacaoTotal`, `limiteUniversidades`,
   `tarifaMedia` (ponderada pela demanda). A tarifa entra na receita sem mexer na fórmula de `r`.

**B · Ciência (sim puro)**
9. Laboratório e universidade como construções: consomem kW (entram na demanda) e geram 🔬.
10. 🔬 vira saldo gastável: `gastarPesquisa`; desbloqueios, evoluções e montanha debitam.
11. Save v7 com migração v6 → v7 (cabos com nível, 🔬 vira saldo, o que já estava desbloqueado fica).

**C · Árvore de pesquisa**
12. `content/arvore-era1.ts`: os nós de §8.6 com custo, efeito, pré-requisitos, exclusões e a frase de
    física de cada um; as três melhorias nomeadas viram nós; três níveis por peça do Núcleo.
13. `sim/arvore.ts`: `podePesquisar`, `pesquisar`, `efeitosDe` — efeitos aplicados nas fórmulas de
    produção, esteira, alcance, bateria, tarifa, calor, turbina, radiador e capacidade.

**D · Capítulos**
14. `content/capitulos-era1.ts` + `sim/capitulos.ts`: um objetivo ativo por vez, recompensa em ₵ ou 🔬.

**E · UI e cena**
15. Painel do bairro (densidade, população, demanda, Evoluir), laboratório e universidade na paleta,
    sprites novos, cristal na cena.
16. Tela da árvore de pesquisa (colunas por tecnologia, frase de física, custo, exclusões).
17. HUD: 🔬 como saldo, 👥 população, capítulo ativo. Cards: primeira evolução, primeira universidade,
    primeiro nó pesquisado.

**F · Balanceamento**
18. `scripts/simular.ts`: bot que segue os capítulos por 60 min de jogo, relatório a cada 5 min e os
    primeiros 10 minutos em detalhe; recalibrar §8.5 e §8.6 até a Era 1 fechar em 50–70 min.

**G · Verificação**
19. Testes do sim; `scripts/e2e/sessao-7.cjs` nos dois tamanhos (com o da Sessão 6 passando);
    capturas em `docs/capturas/sessao-7/`; `ESTADO.md`; checklist; este relatório.

---

## O que foi feito

### 0 · Ajustes da Sessão 6 (commits 2 a 4)

1. **Cabo submarino com teto próprio** (`sim/producao.ts`, `sim/mundo.ts`). O cabo passou a ter **30 kW
   de teto**, nos dois sentidos, e **nível** (custo da rota ×3ⁿ, teto ×2ⁿ). O preço por casa de mar subiu
   de ₵ 40 para ₵ 120. Cada ilha fora da principal é uma mini-rede: o que ela consome dela mesma não passa
   pelo cabo; o excedente atravessa até o teto e o resto vira "sem escoamento". `mundo.cabos` deixou de ser
   uma lista e virou `ilha → nível` (save v7). O extrato mostra `Cabo · Ventania 12 kW de 30 kW · no teto`.
2. **Montanha devolve ciência.** Dinamitar devolve **🔬 40** e marca as quatro casas como **cristal**:
   valem como rocha e dão **+50 %** a laboratório e universidade em cima delas. A cena desenha o cristal
   (o sprite já existia desde a v0.5 e não estava sendo usado).
3. **Régua Kardashev:** "Sol" virou marca auxiliar sem rótulo (o texto continua no título ao passar o
   ponteiro); "Tipo II" ficou. Campo `semRotulo` em `content/kardashev.ts`.
4. **Minimapa** ganhou um traço tracejado entre cada ilha ligada por cabo e a principal.

Os itens 5 (medir os dez primeiros minutos) e 6 (🔬 deixar de ser limiar) são as partes F e B–C.

### A · Cidade (sim puro)

`content/cidade-era1.ts` guarda as quatro densidades de §8.6 (demanda, população, tarifa, custo de
evolução), o bairro, o laboratório e a universidade. `sim/cidade.ts` tem `densidadeDe`, `custoEvolucao`,
`avaliarEvolucao`, `evoluirBairro`, `populacaoDoMundo`, `limiteUniversidades` e `pesquisaUniversidade`.

A demanda de cada bairro passa a sair da densidade, a população é a soma das densidades e a **tarifa média
é ponderada pela demanda dos bairros atendidos** — ela multiplica o preço base na receita e **não toca na
razão `r`**: `balancoRede` ganhou `tarifa` como opção, e a tabela de faixas de §4.1 continua igual.

### B · Ciência e 🔬 gasto

Laboratório e universidade são construções que **consomem kW** (entram na demanda, como um bairro) e geram
🔬 no tick. Ambos exigem subestação no alcance — decisão minha, registrada abaixo. A universidade só
funciona dentro do limite de população (1 por 2 000 habitantes) e rende `0,5/s × √(pop ÷ 1 000)`.

`state.pesquisa` virou **saldo gastável**: a árvore, as evoluções de bairro e a montanha debitam.

### C · Árvore de pesquisa

`content/arvore-era1.ts` tem 25 nós em cinco ramos, cada um com `efeitoTexto`, `fisica` (uma frase de
física de verdade), custo em 🔬 (e ₵ onde §8.3 pedia), `pre` e `exclui`. `sim/efeitos.ts` dobra os nós
comprados numa estrutura só (memoizada pela identidade da lista) e `sim/arvore.ts` faz consulta e compra.

As três melhorias nomeadas viraram nós, `src/sim/melhorias.ts` e `MELHORIAS` sumiram, e `state.melhorias`
deu lugar a `state.pesquisados`. Os efeitos entram em `producao` (potência, esteira, alcance, demanda,
tarifa), `nucleo` (calor por espelho, dissipação, kW por u, capacidade do tanque, Receptor cerâmico,
grade), `rede` (capacidade da bateria) e `tick`.

### D · Capítulos

17 objetivos curtos em `content/capitulos-era1.ts`, com a condição como **dado** (construções, terreno,
densidade, população, nós, cabo, zona de ouro, Estabilidade, potência, desmatamento). `sim/capitulos.ts`
mede e conclui no tick, pagando a recompensa sem botão de coletar.

### E · Interface e cena

Tela da árvore (uma coluna por tecnologia, exclusões visíveis), painel da Cidade (densidade, população,
demanda, Evoluir com ₵ + 🔬), HUD com 🔬 clicável (com o próximo nó à vista), 👥 população e a faixa do
capítulo com progresso. Sprites novos de laboratório (cúpula) e universidade (colunata e cúpula dourada),
e o bairro que **cresce de altura e acende janelas conforme a densidade** (a metrópole ganha antena com
luz de obstáculo). Cinco cards novos. No celular, 🔬 e 👥 deixaram de sumir e o HUD passou a quebrar em
duas linhas.

### F · Balanceamento

`scripts/simular.ts` (`npm run simular`) roda um bot por 60 minutos de jogo **com o tick do sim** — nenhuma
regra reimplementada: todas as decisões passam pelas funções puras que a interface usa. Imprime ₵, 🔬,
população, Estabilidade, kW, `r` e o que comprou a cada minuto nos dez primeiros e de cinco em cinco
depois, mais os marcos e o estado final. `scripts/rodar.mjs` carrega o TypeScript pelo pipeline do Vite.

## Medições

### Simulação de 60 minutos (rodada final)

| Marco | Quando |
|---|---|
| 5 cata-ventos | 0,5 min |
| primeira zona de ouro | 0,7 min |
| Núcleo comprável (₵ 100) / desbloqueado | 0,7 min |
| primeiro 🔬 gasto num nó | 0,9 min |
| expedição de Ventania comprável (₵ 1,8 mil) | 2,4 min |
| Ventania aberta | 2,8 min |
| primeira evolução de bairro | 2,6 min |
| 🔬 3 000 acumulados | 11,4 min |
| ₵ 50 000 | 16,2 min |
| nó "Fissão básica" comprado | 29,1 min |
| árvore inteira paga | ≈ 35 min |
| arquipélago inteiro aberto | ≈ 40 min |
| **Estabilidade 100 %** | **41,4 min** |

Os dez primeiros minutos (ajuste 5 da gestão): 9 cata-ventos e o Núcleo no primeiro minuto; a zona de
ouro da Rede aos 42 s; a primeira expedição comprável aos 2,4 min — bem dentro dos 12 minutos que a
gestão pôs como limite. O começo **não** é lento; se alguma coisa, é rápido demais para um bot.

### Desempenho

| O quê | Medida |
|---|---|
| 60 min de jogo simulados (36 000 ticks + decisões a cada 2 s) | ≈ 40 s de relógio |
| Tick com o mundo da simulação (≈ 90 construções) | **0,001 ms** (análise memoizada) |
| Tick com 1 999 construções (teste de desempenho) | **0,010 ms** |
| Análise completa sem cache, mundo cheio | **4,7 ms** |
| Quadro no roteiro Playwright (swiftshader, 1280×800) | 1,6–3,0 ms |

Nada mudou no caminho quente: a árvore entra pelo cache de efeitos (`WeakMap` pela identidade da lista de
nós) e a análise continua memoizada pela identidade do mundo.

## Decisões fora do GDD (e os ajustes que fiz nele)

1. **O branch saiu de `faab8c3`, não de `claude/era1-scaffold-rede-pqkglz`.** A ref indicada pelo protocolo
   é **ancestral** da Sessão 6 (não foi movida quando a gestão incorporou o branch): sair dela apagaria os
   nove commits da Sessão 6. Sugiro a gestão mover a ref ou o protocolo passar a citar o branch principal.
2. **`vila` virou `bairro`.** Na v0.6 "Vila" é o nome da **densidade 2**; manter o tipo de construção com
   o nome de uma densidade tornaria todo texto ambíguo. O id no save é `bairro` e a migração converte.
3. **Laboratório e universidade precisam de subestação no alcance**, como bairro e usina, e **entram na
   demanda**. O GDD só dizia "consome 2 kW / 5 kW". Sem a regra, a ciência seria o único prédio que
   funciona no meio do nada — e a subestação perderia metade do sentido.
4. **Laboratórios e universidades rendem 🔬 offline** com o mesmo fator da Rede (×0,5). §7 só falava do
   Núcleo, que continua em modo seguro obrigatório.
5. **"Fissão básica" virou nó da árvore** (🔬 3 000 + ₵ 50 000, exige Receptor cerâmico e Turbina de alta
   pressão). §8.4 já pedia "pesquisa específica"; com 🔬 virando moeda, um nó é a leitura natural. **GDD
   ajustado** (§8.4 e §8.6). A Era 2 continua sendo a Sessão 8.
6. **A fila de capítulos não trava.** A simulação mostrou o bot preso no segundo capítulo ("5 cata-ventos
   numa colina") por 57 minutos com quinze objetivos seguintes já cumpridos. Agora qualquer capítulo
   pendente cujo objetivo fechou é pago; a interface continua mostrando **um** por vez.
7. **O nó "Laboratório" nasce pesquisado.** A primeira ciência não pode custar 🔬 — seria um ovo sem
   galinha.
8. **Os `**negritos**` dos cards passaram a ser renderizados.** Vinham crus na tela desde a Sessão 6.

### Números recalibrados (GDD §8.5 e §8.6)

| O quê | Antes | Agora | Por quê |
|---|---|---|---|
| Cabo: ₵ por casa de mar | 40 | **120** | ajuste 1 da gestão |
| Cabo: teto | — | **30 kW, ×2 por nível** | ajuste 1 da gestão |
| Expedições | ₵ 600 … 100 mil | **₵ 1,8 mil … 300 mil** | o bot abria o arquipélago inteiro em 30 min |
| Árvore: nós de topo | 🔬 120–500 | **🔬 700–4 000** | a árvore inteira custava 🔬 2,9 mil contra 🔬 38 mil ganhos por era e acabava aos 15 min |
| Grade 7×7 | 🔬 150 + ₵ 800 | **🔬 1 500 + ₵ 2 000** | idem |
| Montanha | ₵ 400 + 🔬 20 | **idem, devolvendo 🔬 40 e cristal** | ajuste 2 da gestão |

Os nós de entrada (Lâminas de fibra 🔬 25, Bateria 🔬 20, Turbina eólica 🔬 40, Painel bifacial 🔬 60,
Rastreamento solar 🔬 30 + ₵ 150, Receptor cerâmico 🔬 80 + ₵ 300) **não mudaram**: o começo estava certo,
o que estava errado era o topo da curva.

## O conflito que não consegui fechar: a Era 1 termina em 41 min, não em 50–70

Com os números acima, a simulação fecha a Era 1 em **41,4 minutos**, e quem manda é a **Estabilidade**:
ela sobe +2,5 pontos/min na zona de ouro, então 100 % custa **40 minutos de operação** para qualquer
jogador que acerte a proporção espelhos/turbinas logo — e o bot acerta no primeiro minuto. Todos os outros
gates (🔬, ₵, árvore, arquipélago) agora caem entre 11 e 40 min, ou seja, **o conteúdo e a barra terminam
juntos**, que era o objetivo do recalibre; o que sobra é o piso da barra.

Baixar esse piso exigiria mexer na taxa de Estabilidade, que o roteiro desta sessão proíbe ("nenhuma
fórmula de calor, Cascata, Estabilidade… muda"). Então **aponto em vez de contornar**:

- **Proposta:** zona de ouro 2,5 → **1,8 pontos/min** (e faixa normal 1,5 → 1,2). Com isso o jogo perfeito
  fecha em ~56 min e o jogo humano, com paradas e Cascatas, nos 60–70 — exatamente a janela de §7.
- **Alternativa:** deixar como está e aceitar que os 50–70 minutos de §7 descrevem **jogo humano**, não
  jogo ótimo. O GDD ganhou a medição em §8.4 com essa leitura.

Registrei os dois caminhos no GDD §8.4; a escolha é da gestão.

## Verificação

- `npm run typecheck`, `npx vitest run` (**299 testes**), `npm run lint`, `npm run build` e
  `npm run build:artifact` passam.
- `scripts/e2e/sessao-7.cjs`: **74 verificações** verdes nos dois tamanhos (1280×800 e 390×844), com
  capturas em `docs/capturas/sessao-7/`.
- `scripts/e2e/sessao-6.cjs` continua verde (**52 verificações**) — só precisou de uma linha nova, porque
  `mundo.cabos` deixou de ser lista.

Testes novos: `cidade.test.ts` (11), `arvore.test.ts` (18), `capitulos.test.ts` (7), `save-v7.test.ts` (8)
e o teto do cabo em `producao.test.ts`/`mundo.test.ts`.

## Defeitos encontrados e corrigidos no caminho

- **A fila de capítulos travava** (item 6 acima) — achado pela simulação, não pelos testes.
- **O HUD do celular estourava** depois que 🔬 e 👥 pararam de sumir: quatro itens não cabem em 390 px.
  Agora a faixa quebra em duas linhas.
- **`plantar` dos testes só achava casa em colina** para prédios que não olham terreno, e faltava casa
  perto da plataforma para bairro, laboratório e universidade.
- **Os `**negritos**` dos cards** apareciam crus.
- **O bot da simulação crescia a demanda dentro de um apagão** e travava o jogo em `r = 0,33`: a primeira
  versão priorizava cidade quando havia caixa. Agora oferta vem primeiro, sempre.

## O que a gestão deve verificar primeiro

1. **A decisão da Estabilidade** (a seção do conflito acima). É a única coisa que impede a Era 1 de cair
   na janela de 50–70 minutos, e a escolha é de design, não de código.
2. **A árvore**: `docs/capturas/sessao-7/desktop-05-arvore.png` e o jogo. Ler as 25 frases de física —
   elas são conteúdo, não enfeite, e a única que eu reescrevi contra o GDD é a da Torre mais alta (o GDD
   dizia "+30 % de vento e potência com o cubo", o que daria mais que o dobro de potência; o nó dá +40 %,
   então a frase explica por que sobra +40 %).
3. **A cidade evoluindo**: colocar bairros, evoluir, ver a tarifa média subir no extrato e a universidade
   acender com 1 000 habitantes.
4. **O cabo com teto** (ajuste 1): ligar Ventania, encher o cabo e ver "no teto" no extrato.
5. **O ritmo dos dez primeiros minutos** jogando de verdade: a simulação diz que está rápido, e o bot não
   erra. A pergunta que fica é se um humano sente o mesmo.

## Pendências

1. **A subestação some como decisão no fim da era.** Com alcance 5 (nó) e teto ×2 por nível a ₵ ×3, uma
   subestação cobre a ilha inteira: o bot termina os 60 minutos com **uma**. Sugiro limitar o nível a 3 ou
   fazer o nó de alcance não valer para subestação já melhorada.
2. **A universidade escala rápido demais**: √(pop ÷ 1 000) com uma metrópole já dá ×2,5 por universidade.
3. **Obstáculo comum não devolve nada** — só a montanha devolve 🔬. Arbusto, árvore, pedra e pântano
   continuam sendo só custo.
4. **O bairro não tem painel de toque na cena**: tocar seleciona a linha no painel da Cidade, que no
   celular fica abaixo do tabuleiro.
5. **A tela da árvore não desenha as ligações** entre nó e pré-requisito: hoje a dependência aparece como
   texto ("Exige Lâminas de fibra"). Com 25 nós ainda se lê; com a Era 2 não vai dar.
6. As da Sessão 6 que continuam: régua Kardashev apertada no celular, `OffscreenCanvas` como requisito,
   Android real só com eventos sintéticos.

## Como rodar

```
npm run dev -- --host 127.0.0.1 --port 5173
NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-7.cjs
NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-6.cjs
npm run simular            # 60 min de jogo simulado
npm run simular -- 90      # outra janela
```

## Checklist da sessão

- [x] bairros com densidade, evolução exponencial, tarifa por densidade; testes
- [x] laboratório e universidade; população; 🔬 gasto; migração v6 → v7
- [x] árvore da Era 1 com frases de física; efeitos nas fórmulas; exclusões
- [x] capítulos com recompensas; objetivo ativo no HUD
- [x] UI: painel do bairro, tela da árvore, HUD com 🔬 e 👥, cards
- [x] simulação de 60 min e números recalibrados no GDD
- [x] roteiro Playwright verde; capturas; `ESTADO.md`; relatório; `typecheck`, `test`, `lint`, `build`
