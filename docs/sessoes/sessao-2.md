# Sessão 2 — Núcleo da Era 1: Torre Solar, Calor, Cascata e Estabilidade

## Antes de começar
Aplique `docs/correcoes-gdd-v0.3.md` ao GDD e ao `CLAUDE.md`. Três números do §8.3 não fecham com as definições das peças, e um deles torna o teste obrigatório do `CLAUDE.md` impossível. Corrigir depois de codar custa mais caro.

## Objetivo
A camada **Núcleo** jogável: grade 5×5 com o Receptor fixo no centro, peças posicionáveis, calor que sobe e desce conforme a geometria, zona de ouro que acelera a Pesquisa, e Cascata com entulho, SCRAM e perda de Estabilidade. A Pesquisa passa a existir de verdade e destrava o que ficou órfão na Sessão 1 (Bateria 🔬20, Turbina eólica 🔬40).

Referências no GDD: §2.2 e §2.3 (acoplamento), §4.2 (balança do Calor), §5 (Cascata), §6 (Estabilidade), §8.3 (Torre Solar), §10 (rampa de calor), §11 (arquitetura).

## Entregas

### 1. `src/content/era1-nucleo.ts`
Peças com os números exatos do §8.3: Receptor (capacidade 100 u), Heliostato (₵30), Turbina a vapor (₵50), Radiador (₵40), Tanque de sal fundido (₵60). Melhoria "Receptor cerâmico" (capacidade +50, ₵300 + 🔬80) como dado, com efeito. Desbloqueio do Núcleo: ₵100.

Regras de posicionamento como **dado**, não como `if` espalhado pela UI: a Turbina só aceita anel 1; o Tanque só conta se adjacente ao Receptor; o Radiador só dissipa se adjacente.

### 2. `src/sim/nucleo.ts`
- Grade como `Array<Peca | null>` de 25 posições, índice 12 = Receptor.
- `anel(indice)` → `1 | 2` — anel 1 são as 8 vizinhas do centro, diagonais incluídas; anel 2 são as 16 restantes.
- `espelhosEfetivos(grade)` → `h`, contando anel 1 como 1 e anel 2 como 0,5.
- `balancoDeCalor(grade, Q)` → `dQ/dt = 4·h − 6·rad − 0,12·t·Q`. A constante `4/0,12` vem de `content/`, nunca cravada.
- `capacidade(grade)` → `100 + 150 × tanques adjacentes` (+50 com Receptor cerâmico).
- `potenciaNucleoKw(grade, Q)` → `0,12 · Q · 0,8` por turbina.
- `equilibrio(grade)` → `Q*`, função pura — é o que os testes e o card explicativo usam.

### 3. `src/sim/calor.ts`
`T = Q / capacidade`. Faixas do §4.2 e seus multiplicadores: `<40 %` pesquisa ×0,5; `40–70 %` neutro; `70–90 %` **ouro** (pesquisa ×1,3, Estabilidade acelerada); `90–100 %` alerta; `>100 %` conta o cronômetro da Cascata.

### 4. `src/sim/cascata.ts`
- Gatilho: `T > 100 %` por **5 000 ms acumulados de forma contínua** — cronômetro em milissegundos no estado (`tempoAcimaDoLimiteMs`), zerado assim que `T` volta a ≤ 100 %. Não use contagem de ticks.
- Efeitos (§5): peças do anel 1 viram **entulho**; **Estabilidade −30**; **SCRAM 20 s**; **bateria −10 %**; Pesquisa preservada.
- Durante o SCRAM: espelhos não injetam calor, turbinas não consomem nem geram, radiadores continuam dissipando. `Q` cai. Sem pesquisa e sem potência do Núcleo nesses 20 s.
- Entulho ocupa a casa e não produz. Reconstruir custa 50 % do preço da peça; limpar sem reconstruir é grátis após 30 s.

### 5. `src/sim/estabilidade.ts`
0–100 %. Sobe +1,5 pontos/min na faixa normal e +2,5/min na zona de ouro (§7). Não sobe durante SCRAM. Piso em 0 depois da Cascata.

### 6. Pesquisa e acoplamento
`pesquisa/s = potênciaNucleoKw / 10 × multiplicador da zona de calor`. A potência do Núcleo **soma na oferta da Rede** e entra no cálculo de `r` — este é o primeiro ponto onde as duas camadas se tocam.

**Ordem no tick (estende a da Sessão 1 — respeite exatamente, os testes dependem):**
1. potência do Núcleo, calculada com o `Q` do **início** do tick;
2. oferta da Rede = usinas + potência do Núcleo;
3. venda até a demanda → bateria → receita com o multiplicador de `r`;
4. calor: entrada dos espelhos → dissipação dos radiadores → consumo das turbinas;
5. pesquisa e Estabilidade, pela faixa de `T` **depois** do passo 4;
6. cronômetro e checagem da Cascata.

### 7. `src/store/`
Ações `desbloquearNucleo`, `colocarPeca(indice, pecaId)`, `removerPeca(indice)`, `limparEntulho(indice)`, `reconstruir(indice)`, `alternarModoSeguro`, `scramManual`.

### 8. `src/scene/GridScene.ts` (Phaser)
Grade 5×5 sobre o fundo da Sessão 1. Cada peça é uma forma flat-vector com sombra chapada deslocada (§10). A cor do Receptor segue a **rampa de calor** (`#3A6FF2 → #FFD23F → #FF7A1A → #FFFFFF`) — a temperatura tem que ser legível sem ler número. Toque/clique coloca a peça selecionada; casa inválida recusa com feedback. Partículas de calor subindo, proporcionais a `T`. Onda de choque branca e tremor leve na Cascata.

Phaser só desenha e despacha; toda a decisão está no sim.

### 9. `src/ui/`
Barra de Calor com as quatro faixas marcadas e a zona de ouro destacada; barra de Estabilidade; seletor de peça com preço; botão de SCRAM manual; toggle **modo seguro** (SCRAM automático a 95 %, potência do Núcleo ×0,7); contador de 🔬. A Bateria e a Turbina eólica da Rede passam a desbloquear de verdade.

### 10. `src/sim/save.ts`
`versao: 2` com migração de saves da versão 1 (jogo antigo entra com `nucleo` no estado inicial, sem perder Rede nem créditos). Teste de migração.

## Testes Vitest

Equilíbrio e faixas (todos com `t = 2`, sem radiador, capacidade 100):

| h | Q* esperado | Faixa |
|---|---|---|
| 5 | 83,3 | ouro |
| 5,5 | 91,7 | alerta |
| 6 | 100,0 | limite exato |
| 6,5 | 108,3 | cascata |

- `h = 5` converge para 83,3 ± 0,5 em 60 s de ticks.
- **`h = 6` estabiliza em 100 % e NÃO dispara Cascata em 120 s.** (A aproximação é assintótica — este teste é o que impede a regressão descrita nas correções.)
- **`h = 6,5`, partindo do equilíbrio de `h = 6`, dispara a Cascata 5,0 s ± 0,1 depois de `T` passar de 100 %.**
- `h = 6,5` + 1 radiador → `Q* = 83,3`: o radiador devolve a zona de ouro.
- 1 tanque de sal com `h = 6, t = 2` → capacidade 250, `T = 40 %`, pesquisa cai para ×0,5. O tanque compra margem e cobra em pesquisa.
- Turbina em casa de anel 2 é recusada.
- Cascata aplica exatamente: −30 de Estabilidade, SCRAM de 20 s, entulho no anel 1, bateria −10 %, Pesquisa intacta.
- Durante o SCRAM não há pesquisa nem potência do Núcleo, e `Q` cai.
- Modo seguro dispara SCRAM a 95 % e nunca deixa chegar a 100 %.
- `pesquisa/s` = potência ÷ 10 × multiplicador, nas quatro faixas.
- Migração de save v1 → v2 preserva créditos, usinas e vilas.

## Critérios de pronto
- [ ] Desbloquear o Núcleo por ₵100 e montar a configuração `h = 5, t = 2` leva a barra de Calor à zona de ouro, com o Núcleo em 16 kW e 🔬 subindo.
- [ ] Acrescentar um espelho de anel 2 leva à Cascata em 5 s, com onda de choque, entulho, SCRAM e Estabilidade caindo 30.
- [ ] Um radiador devolve a configuração para a zona de ouro.
- [ ] A cor do Receptor acompanha a temperatura sem precisar de número.
- [ ] A potência do Núcleo aparece na oferta da Rede e move o `r`.
- [ ] Com 🔬 20 e 🔬 40 a Bateria e a Turbina eólica desbloqueiam.
- [ ] Save antigo (v1) carrega sem perder progresso.
- [ ] `npm test`, `npm run typecheck`, `npm run build` passam.
- [ ] `docs/ESTADO.md` atualizado.

## Fora de escopo — não faça nesta sessão
Grade 7×7, cards explicativos, medidor Kardashev, cálculo offline, Contenção, Era 2 e a transição de era, som, Bipes, prestígio. O que for tentador vai para "Pendências".

## Armadilhas conhecidas
- **Integração.** Euler explícito com `dt` fixo de 100 ms: `Q += (4h − 6·rad − 0,12·t·Q) · dt`. Nunca integre com `dt` variável — o teste dos 5 s não fecha. Com `t` alto o passo continua estável (`0,12·t·dt ≪ 1`), mas se algum dia `t·dt` chegar perto de 1 o método oscila; deixe um comentário.
- **A assíntota.** `h = 6` nunca ultrapassa 100 %. Se você "consertar" isso truncando ou arredondando `Q`, o par de testes quebra. O calor **precisa** poder passar da capacidade.
- **Adjacência.** Anel 1 inclui as diagonais. Se contar só as 4 ortogonais, `h` muda e nenhum número do §8.3 bate.
- **Cronômetro da Cascata em ms**, contínuo, zerado ao voltar para ≤ 100 %.
- **StrictMode** continua montando duas vezes: a `GridScene` não pode duplicar peças nem listeners.
- **Ordem do tick.** A potência do Núcleo usa o `Q` do início do tick. Se usar o `Q` já atualizado, a receita muda de casa decimal e os testes da Sessão 1 quebram junto.

## Prompt para colar no Claude Code
> Leia `CLAUDE.md`, `docs/GDD-parte1.md`, `docs/correcoes-gdd-v0.3.md`, `docs/ESTADO.md` e `docs/sessoes/sessao-2.md`. Primeiro aplique as correções do GDD e do `CLAUDE.md` num commit separado. Depois monte um plano em passos numerados para cumprir **só** a Sessão 2 e me mostre antes de executar. Implemente passo a passo, rodando `typecheck` e `test` a cada passo, e termine atualizando `docs/ESTADO.md`.
