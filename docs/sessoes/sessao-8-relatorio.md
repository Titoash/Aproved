# Sessão 8 — relatório de produção

> Era 2 (fissão), transição de era, Rede em MW, cidade 5–6, árvore e capítulos da Era 2.
> Branch `claude/sessao-8`, a partir de `201dfcd` ("GDD Parte 2: Era 2 completa (v0.7) e especificação da Sessão 8").

## Plano (escrito antes de codar, conforme a regra 2 da produção)

1. **Parte 0 — ajustes da Sessão 7.** Subestação com nível máximo 3; universidade rendendo por alunos
   (`√(pop ÷ n_universidades ÷ 1 000)`); callout de toque na cena para a construção selecionada (bairro com
   "Evoluir"); linhas de ligação na árvore de pesquisa; capturas dos roteiros antigos fora do repositório.
   GDD §8.5 e §8.6 atualizados, testes novos. Commit próprio.
2. **Parte A — transição de era (sim puro).** `state.era` e `nucleo.era`; `construirReator` (Estabilidade
   100 % + `fissaoBasica` + ₵ 200 000): desmonta a Torre devolvendo 50 %, volta a grade para 5×5 com o Vaso no
   centro, zera a Estabilidade, guarda tudo o mais. Save **v8** com migração v7 → v8 (`era: 1` por padrão).
3. **Parte B — reator PWR (sim puro).** `content/era2-nucleo.ts` com as peças de §5.1; motor de calor
   unificado (`motor.ts`) para as duas eras, mantendo `T = Q ÷ capacidade`, faixas, Cascata e Estabilidade;
   `sim/reator.ts` com combustível finito, esgotamento, calor de decaimento, barra de controle sobre as 8
   vizinhas, piscina, torre, troca de vareta, SCRAM da Era 2 e Cascata com entulho quente. A tabela de §5.3
   inteira vira teste, mais o teste obrigatório escrito lá.
4. **Parte C — Rede da Era 2.** Construções 2×2 (âncora + 3 casas), mar raso colocável com pertencimento à
   ilha mais próxima, eólica offshore, fazenda solar, térmica a gás com combustível em ₵/s no extrato,
   subestação de 138 kV, subestação offshore, bateria de rede, nó Cabo HVDC.
5. **Parte D — cidade da Era 2.** Densidades 5 e 6, distrito industrial e instituto de pesquisa.
6. **Parte E — árvore e capítulos da Era 2.** `content/arvore-era2.ts` (frases de física conferidas) e
   `content/capitulos-era2.ts`; Fusão básica como saída com o aviso de que a Era 3 está em produção.
7. **Parte F — UI e cena.** Botão "Construir o Reator", card "Calor de decaimento", câmera que afasta e
   volta, paleta entardecer, reator/varetas/barra/piscina desenhados, callout de peça com "Trocar", paleta
   com as construções da Era 2 (prévia 2×2 e mar raso realçado), extrato com combustível e receita líquida,
   aba da Era 2 na árvore, cards da Era 2.
8. **Parte G — balanceamento.** `scripts/simular.ts` atravessando a Era 1, construindo o reator e jogando
   60 minutos de Era 2; calibrar até a Era 2 fechar em 50–70 min sem receita líquida negativa por mais de
   1 minuto.
9. **Parte H — verificação.** `npm run typecheck`, `npx vitest run`, `npm run lint`, `npm run build`,
   `npm run build:artifact`; `scripts/e2e/sessao-8.cjs` nos dois tamanhos; regressão das Sessões 6 e 7 com
   capturas fora do repositório; capturas em `docs/capturas/sessao-8/`; `ESTADO.md` e este relatório.

Ordem de corte, se faltar tempo (de `sessao-8.md`): Instituto, Bateria de rede, Rede inteligente, Selo verde,
Distrito industrial. Nunca 0, A, B, C (offshore e térmica), E, G, H.

Base medida antes de começar: `typecheck`, `lint` e **299 testes** verdes em `201dfcd`.

---

## O que foi feito

Tudo o que a especificação pedia entrou: nada da ordem de corte (Instituto, Bateria de rede, Rede
inteligente, Selo verde, Distrito industrial) foi cortado. Onze commits, na ordem das partes.

### Parte 0 — ajustes da Sessão 7 (commit `5b9d889`)
- **Subestação com nível máximo 3** (teto 40 → 80 → 160 → 320 kW). `avaliarMelhoriaSubestacao` devolve o
  motivo ("Nível máximo (4): ponha outra subestação") e a interface mostra. §8.5 atualizado.
- **Universidade rende por alunos:** `🔬 0,5/s × √(população ÷ universidades ativas ÷ 1 000)`. A conta
  ficou em duas passadas em `analisarMundo` — o rendimento de cada universidade depende de quantas
  estão ativas, então primeiro se sabe quantas são. §8.6 atualizado, teste ajustado.
- **Callout de toque na cena** (`ui/CalloutCasa.tsx`): tocar numa construção abre um cartão sobre o
  tabuleiro com os números dela e as ações que cabem — "Evoluir" no bairro, "Nível" na subestação,
  "Remover" em tudo. O painel da Cidade continua como segunda via.
- **Linhas de ligação na árvore** (`ui/PainelArvore.tsx`): um SVG por cima do grid, medido no layout com
  `ResizeObserver`; traço fino quando o pré-requisito falta, `leaf` mais forte quando já está comprado.
- **Capturas dos roteiros antigos fora do repositório:** `sessao-6.cjs` e `sessao-7.cjs` aceitam
  `CAPTURAS=/caminho`. Foi assim que a regressão desta sessão rodou.

### Partes A a F — a Era 2 (commits `494bb35`, `d44c23c`, `33ed2cc`)
O desenho central foi **não duplicar o motor de calor**. `sim/motor.ts` é o único lugar que sabe qual
era está em jogo: ele devolve entrada, dissipação, fator das turbinas, kW por u e capacidade, e as
fórmulas de `T`, `Q*`, potência e passo de Euler são as mesmas de sempre. A Era 1 continua com
espelhos, radiadores e turbinas a vapor; a Era 2 entra com varetas, torres e turbinas de alta pressão.
`calor.ts`, `cascata.ts`, `estabilidade.ts` e o tick não mudaram de fórmula — só passaram a perguntar
ao motor.

O que é novo de verdade vive em `sim/reator.ts`: as 8 vizinhas, o combustível que se gasta, o calor de
decaimento, a troca e o SCRAM da era. E em `sim/producao.ts`: construções 2×2 (âncora + ocupação
memoizada por identidade do mundo), mar raso colocável (a ilha de cada casa de água sai de uma busca em
largura a partir da terra, uma vez por arquipélago) e o custo de operação das térmicas.

### Parte G — balanceamento (commit `f164916`)
`scripts/simular.ts` ganhou uma segunda fase. A Era 1 acaba **quando dá para construir o Reator** (e não
num minuto fixo), e a Era 2 roda em seguida.

### Parte H — verificação
343 testes, 82 verificações Playwright da Sessão 8 nos dois tamanhos, e os roteiros das Sessões 6 (52) e
7 (76) verdes como regressão, gravando capturas em `/tmp` para não tocar nas pastas delas.

---

## Decisões fora do GDD (o que a gestão precisa confirmar)

1. **A peça fixa do centro continua sendo `{ tipo: "receptor" }` no estado**, e a era decide se ela é o
   Receptor ou o Vaso. Renomear atravessaria save, migrações, Cascata, cena e testes por um nome que o
   jogador nunca vê — a arte e os textos já dizem "Vaso de pressão" e "Reator PWR". Está documentado em
   `state.ts`.
2. **A repartição por anel da tabela de §5.3 estava errada.** Com 20 u/s no anel 1 e 10 u/s no anel 2,
   "7 varetas (5 + 2)" daria 120 u/s e não os 110 da coluna "Entrada". Os totais só fecham com **4
   varetas no anel 1** — o máximo que sobra ali junto com as 2 turbinas — e o resto no anel 2. A coluna
   "Entrada" é o contrato e não mudou; corrigi a repartição para (4 + 2), (4 + 3), (4 + 4) e registrei a
   correção na Parte 2. Os testes são exatamente estes números.
3. **A troca de vareta espera 3 meias-vidas cheias (180 s).** O cruzamento exato de 1 % acontece em
   log₂(7) = 2,81 meias-vidas, 168 s. §5.2 diz "abaixo de 1 % (≈ 3 meias-vidas, 3 min)" e o teste
   obrigatório de §5.3 diz "só após 180 s": usei 180 s, que satisfaz as duas frases e é o número redondo.
   Registrado na Parte 2.
4. **A curva de ₵ da densidade 5 é ×62,5, não "×2,5 com um ×10 fixo".** O texto de §4.1 daria ₵ 39 050;
   a tabela diz ₵ 97 650. Mantive a tabela (é o número explícito) e corrigi a prosa. Da 5 para a 6 o ×2,5
   volta a valer, e a curva de 🔬 é ×5 na escada inteira.
5. **O decaimento de uma vareta em SCRAM vai para o Vaso; só o da vareta gasta vai para a piscina.**
   §5.1 fala em "varetas gastas nas 8 vizinhas" e §5.2 diz que "a torre de resfriamento é o que segura
   `T` depois de um SCRAM". Ler a piscina como absorvendo tudo tiraria o sentido da torre; ler como está
   escrito mantém as duas peças com papel próprio.
6. **O decaimento é 7 % do calor nominal da vareta, já com a barra de controle e o enriquecimento.**
   Uma vareta abafada por uma barra fissiona menos, acumula menos produto de fissão e decai menos — é o
   mesmo fator, e evita que a barra vire um jeito de esconder calor de decaimento.
7. **A árvore da Era 1 continua comprável na Era 2, mas a da Era 2 só abre com o reator construído**
   (`no.era > state.era` recusa). A tela da árvore ganhou uma aba por era, e a aba da Era 2 nasce
   desabilitada até a transição.
8. **O bot da simulação para de gastar quando a saída da era está à vista.** Não é uma mudança de regra,
   é comportamento de jogador: com a Estabilidade cheia e a Fissão básica na mão ele junta os ₵ 200 000
   do Vaso; na Era 2, com a Estabilidade cheia ele para de evoluir bairros (que consomem 🔬) e junta o
   que a saída pede. Sem isso o bot dissolvia 🔬 144 mil em megacidades e nunca chegava à porta.

---

## Medições

### Simulação das duas eras (`npm run simular`, tick real de 100 ms)

| | Era 1 | Era 2 |
|---|---|---|
| Fecha em | **41,4 min** (Estabilidade; Fissão básica aos 38,3) | **60,9 min** (alvo 50–70) |
| Reator construído | — | aos 44 min, por ₵ 200 000 |
| Potência instalada no fim | 648 kW | 17,9 MW (47 MW quando o bot evolui a cidade até o fim) |
| População | 28 mil | 1,13 milhão |
| Receita líquida negativa | — | **0 minuto** (pior sequência: 0) |
| Cascatas | 0 | 0 |
| Capítulos | 17/17 | 11/12 |

Marcos da Era 2, em minutos desde a transição: primeira vareta 0,2 · reator em 800 kW 1,5 · subestação
de 138 kV 1,9 · primeira offshore 5,0 · primeira troca de vareta 13,2 · megacidade 14,6 · 10 MW
instalados 30,7 · primeira térmica 33,2 · Estabilidade 100 % 48,7 · Reator 7×7 54,0 · **Fusão básica
60,9**.

O reator do bot estabiliza em `T*` = 81 % com 11 varetas, 2 turbinas, 1 torre, 1 piscina e 1 barra — a
zona de ouro, sem nenhuma Cascata em 75 minutos.

### Desempenho

| Medida | Valor | Orçamento |
|---|---|---|
| Tick da Era 1, 1 999 construções | **0,24 ms** | 16 ms |
| Tick da Era 2, 1 999 construções + reator 7×7 com 37 varetas | **0,32 ms** | 16 ms |
| Análise completa do mundo, sem cache | 6,7 ms | 16 ms |
| Quadro no navegador (1280×800, reator cheio) | **1,9 ms** | 16 ms |
| — mar | 0,03 ms | |
| — terreno | 0,07 ms | |
| — cabos | 0,03 ms | |
| — cena (sprites, feixes, callouts) | 1,27 ms | |

Medido com o Chromium do ambiente contra `npm run dev`, com 1 986 construções colocadas e a grade 7×7
lotada. O tick da Era 2 custa 33 % mais que o da Era 1 (o decaimento varre a grade a cada passo) e
continua duas ordens de grandeza abaixo do orçamento.

### Verificação

| | Resultado |
|---|---|
| `npm run typecheck` | verde |
| `npx vitest run` | **343 testes**, 26 arquivos |
| `npm run lint` | verde |
| `npm run build` / `npm run build:artifact` | verdes (artefato de 1 768 KB) |
| `scripts/e2e/sessao-8.cjs` | **82 verificações**, 1280×800 e 390×844 |
| `scripts/e2e/sessao-7.cjs` (regressão) | 76 verificações |
| `scripts/e2e/sessao-6.cjs` (regressão) | 52 verificações |

Capturas em `docs/capturas/sessao-8/` (10 por tamanho). As da Sessão 6 e da Sessão 7 não foram tocadas:
a regressão rodou com `CAPTURAS=/tmp/...`, como o ajuste 7 pediu.

---

## Conflitos com o GDD, e o que fiz

| Onde | O que não fechava | O que fiz |
|---|---|---|
| Parte 2 §5.3 | "7 varetas (5 + 2)" → 120 u/s, não 110 | Corrigi a repartição por anel; a coluna "Entrada" é o contrato |
| Parte 2 §5.2 e §5.3 | "abaixo de 1 %" (168 s) × "só após 180 s" | 3 meias-vidas cheias, 180 s |
| Parte 2 §4.1 | "×10 fixo" daria ₵ 39 050; a tabela diz ₵ 97 650 | Mantive a tabela e corrigi a prosa (×62,5) |
| Parte 2 §6 | "≈ 🔬 190 mil para uma era em que o reator rende 🔬 10/s" | A soma real é 🔬 193 mil, e quem paga é a cidade (≈ 🔬 73/s medidos), não o reator (10,4/s). Registrado |
| Parte 2 §3 | "a Era 2 mira ≈ 40 MW" | O bot chega a 47 MW quando evolui a cidade até o fim, e a 17,9 MW quando corre para a saída. As duas rotas fecham na janela |

Nenhum número de `content/` precisou mudar para a Era 2 fechar em 50–70 minutos: a calibração que faltava
era de **comportamento do bot**, não de conteúdo.

---

## O que a gestão deve verificar primeiro

1. **A transição.** `docs/capturas/sessao-8/desktop-01-construir-reator.png` e `02-era2-reator.png`: o
   botão com o motivo, e o que sobra da Torre depois do desmonte. É a decisão mais irreversível do jogo.
2. **O reator na zona de ouro.** `celular-03-varetas.png`: 6 varetas, 2 turbinas, `T*` = 83 %, `Q*` =
   416,7 u — os números de §5.3 na tela.
3. **O extrato com combustível.** `desktop-10-arquipelago-era2.png`: Receita ₵ 510/s, Combustível
   −₵ 300/s, **Receita líquida ₵ 210/s**. É a lição da era num lugar só.
4. **A troca de vareta.** `desktop-08-extrato-combustivel.png` e `05-vareta-gasta.png`: o callout com o
   combustível restante e o decaimento. Vale conferir se o texto explica por que a troca está travada.
5. **A paleta entardecer.** Compare `desktop-10-arquipelago-era2.png` com as capturas da Sessão 7: o mar
   e o céu escureceram e o Sol desceu. O verde do terreno não mudou — §8 da Parte 2 fala de céu, mar e
   luzes dos bairros, não do chão. Se a gestão quiser o chão mais frio também, é um item novo.
6. **O ritmo.** `npm run simular` inteiro: os dez primeiros minutos da Era 2 minuto a minuto mostram
   onde o dinheiro vai. O bot fecha a era correndo para a saída; um jogador que evolua a cidade até o
   fim chega a 47 MW e demora mais. As duas rotas cabem em 50–70 min, mas só o playtest humano diz qual
   delas é a natural.

## Pendências

Estão listadas em `docs/ESTADO.md`. As que mais pesam:
- O **distrito industrial** e o **instituto** existem, são testados e aparecem no roteiro Playwright, mas
  o bot que corre para a saída não os usa: nunca foram vistos num playtest de ritmo.
- A **arcologia** (densidade 6) nunca foi alcançada na simulação. O nó custa 🔬 14 000 e vem no fim do
  ramo da cidade — pode estar cara demais para o tempo da era.
- A **escolha exclusiva Água pesada × Alta temperatura** está testada como regra, não como decisão de
  ritmo: ela abre depois do Reator 7×7, já na reta final.
- A **subestação offshore** é selecionável mas o callout não diz a qual ilha ela pertence — e é essa
  ilha que paga o teto do cabo.
