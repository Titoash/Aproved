# Estado do projeto

Atualizado ao fim da **Sessão 2** (Núcleo da Era 1).

## Implementado

### Sessão 1 — Scaffold + Rede da Era 1
- Vite 8 + React 19 + TypeScript 6 (strict), Zustand 5, Phaser 3.90, Vitest 5, oxlint. Scripts `dev`, `build`, `test`, `typecheck`, `lint`.
- `src/sim/`: `state.ts`, `tick.ts` (100 ms fixos), `rede.ts` (balança Oferta × Demanda, bateria, receita), `custos.ts`, `acoes.ts`, `formatar.ts` (PT-BR, prefixos SI), `save.ts` (único ponto com `localStorage`, exportar/importar JSON), `loop.ts` (rAF + acumulador limitado a 5 s).
- `src/content/era1.ts`: usinas, vila, bateria, economia e faixas de `r` com os números do GDD §4.1, §7 e §8.2.
- HUD, lista da Rede, painel de progresso; fundo Phaser com gradiente e estrelas; tokens do §10.

### Sessão 2 — Núcleo da Era 1: Torre Solar, Calor, Cascata e Estabilidade
- **Docs:** `docs/correcoes-gdd-v0.3.md` aplicado ao GDD (§4.2, §8.3, §8.4, §11) e à regra 2 do `CLAUDE.md`.
- **`src/content/era1-nucleo.ts`:** peças com regras de posicionamento como dado (`aneis`, `efeitoSoAdjacente`), constantes da Torre Solar, faixas de calor, Cascata, modo seguro, Receptor cerâmico, rampa de calor. `FAIXAS_R` também migrou para `content/`.
- **`src/sim/nucleo.ts`:** `anel()`, `contar()`, `espelhosEfetivos()`, `capacidadeU()`, `balancoDeCalor()`, `equilibrioU()`, `potenciaNucleoKw()`, `passoCalor()` (Euler explícito, dt fixo, calor pode passar da capacidade), posicionamento e `entulharAnel1()`.
- **`src/sim/calor.ts`:** `T = Q ÷ capacidade`, faixas do §4.2, `pesquisaPorSegundo()`.
- **`src/sim/cascata.ts` e `estabilidade.ts`:** cronômetro contínuo em ms (conta ticks inteiros acima de 100 %, zera ao voltar ou em SCRAM), `aplicarCascata()` (anel 1 vira entulho, −30 de Estabilidade, SCRAM 20 s, cronômetro zerado; a bateria −10 % é aplicada pelo tick), `scram()`, entulho (limpeza grátis após 30 s, reconstrução a 50 %).
- **`src/sim/tick.ts`:** ordem de seis passos; a potência do Núcleo (Q do início do tick, 0 em SCRAM, ×0,7 no modo seguro) soma na oferta da Rede e move o `r`; pesquisa e Estabilidade pela faixa depois do calor; modo seguro dispara SCRAM a 95 %.
- **`src/sim/acoes.ts` e `acoesNucleo.ts`:** desbloqueio por 🔬 de verdade (Bateria 🔬 20, Turbina eólica 🔬 40); desbloquear Núcleo (₵ 100), colocar/remover peça, limpar/reconstruir entulho, modo seguro, SCRAM manual, Receptor cerâmico (₵ 300 + 🔬 80).
- **`src/sim/save.ts`:** `versao: 2`, migração v1 → v2 (Rede e créditos intactos, Núcleo bloqueado), normalização da grade (casas inválidas caem, Receptor volta ao centro).
- **`src/store/gameStore.ts`:** ações do Núcleo, `ferramenta` selecionada, `agirNaCasa()` e `avisoGrade` para o feedback da cena.
- **`src/scene/GridScene.ts`:** grade 5×5 alinhada ao elemento `.grade-area` do DOM, peças flat-vector com sombra chapada, Receptor na rampa de calor com brilho quando quente, partículas proporcionais a `T`, realce válido/inválido sob o ponteiro, flash na casa recusada, onda de choque e tremor na Cascata. Só desenha e despacha para o store. `BackgroundScene` lança a `GridScene`.
- **`src/ui/PainelNucleo.tsx`:** desbloqueio; barra de Calor com as faixas marcadas, a zona de ouro destacada, marca do equilíbrio e contagem regressiva da Cascata; barra de Estabilidade; seletor de peças com preço; SCRAM manual; toggle de modo seguro; Receptor cerâmico; linha de entulho. HUD ganhou 🔬 e a oferta separada em usinas + núcleo. Layout em três colunas; a camada de UI é transparente ao ponteiro fora dos painéis para o clique chegar ao canvas.
- **Testes (`npm test`, 105):** tabela de `Q*` (5 → 83,3 ouro; 5,5 → 91,7 alerta; 6 → 100 limite; 6,5 → 108,3 cascata), `h = 5` converge em 60 s, **`h = 6` estabiliza em 100 % sem Cascata em 120 s**, **`h = 6,5` partindo do equilíbrio de `h = 6` cascateia 5,0 s depois**, radiador devolve a zona de ouro, tanque (capacidade 250, `T` → 40 %, pesquisa ×0,5), turbina em anel 2 recusada, efeitos exatos da Cascata, SCRAM (sem pesquisa, sem potência, `Q` cai), modo seguro (SCRAM a 95 %, nunca 100 %), pesquisa/s nas quatro faixas, Estabilidade +2,5 e +1,5/min, migração v1 → v2, store.
- **Verificação no navegador (Playwright + Chromium):** save v1 carrega; Núcleo por ₵ 100; turbina em anel 2 recusada com aviso; `h = 5, t = 2` leva a barra à zona de ouro com o Núcleo em ~16 kW e 🔬 subindo; o Receptor fica laranja; a potência do Núcleo aparece na oferta e move o `r`; `h = 6,5` passa de 100 % e um radiador devolve a zona de ouro; remover o radiador cascateia (~9 s: 4,6 s para cruzar 100 % + 5 s), com SCRAM, seis entulhos, Estabilidade −30 e Núcleo a 0 kW; reconstruir custa 50 %; com 🔬 45 a Bateria e a Turbina eólica desbloqueiam; modo seguro liga.

## Próxima sessão
`docs/sessoes/sessao-3.md` (a escrever) — passe de arte (tokens, rampa de calor, sombras, glow), 3 cards explicativos da Era 1, medidor Kardashev, modo seguro no offline, cálculo offline. Pronto quando o jogo estiver bonito e completo até o fim da Era 1.

## Decisões da Sessão 2 que o GDD não fixa (conferir)
1. **Cronômetro da Cascata** conta ticks inteiros passados acima de 100 % (o tick em que `T` cruza não conta) e zera durante o SCRAM. Assim a Cascata vem exatamente 5,0 s depois do tick em que `T` passou do limite.
2. **Durante o SCRAM** só os radiadores adjacentes esfriam. Sem radiador, `Q` fica parado; depois da Cascata o anel 1 é entulho, então o jogador tem os 20 s para tirar espelhos do anel 2 ou reconstruir turbinas antes de a próxima Cascata contar.
3. **Estabilidade** só sobe com o Núcleo produzindo (potência > 0), fora do SCRAM e com `T ≤ 100 %`; frio, normal e alerta rendem +1,5/min, zona de ouro +2,5/min.
4. **🔬 é requisito acumulado, não gasto**, inclusive no Receptor cerâmico (₵ 300 + 🔬 80).
5. **Remover peça não reembolsa**; reconstruir entulho custa 50 % e limpar é grátis após 30 s (clicar no entulho faz o que for possível: limpa se já é grátis, senão reconstrói).
6. **Modo seguro** com `h > 12,5` e sem turbinas pode passar de 100 % por um tick antes do SCRAM (impossível na grade 5×5 com turbinas).
7. **Faixa "frio"** é `T < 40 %` como no GDD; com o tanque o equilíbrio chega por baixo, então `T` fica logo abaixo de 40 % e a pesquisa é ×0,5.

## Pendências
- Sessão 3: cards explicativos (o tanque de sal precisa de um, ver correções v0.3), medidor Kardashev, cálculo offline (hoje uma aba em segundo plano aplica no máximo 5 s ao voltar), modo seguro sempre ligado no offline, som, Bipes.
- Grade 7×7 (₵ 800 + 🔬 150), Contenção, Era 2 e transição de era, prestígio.
- Melhorias nomeadas da Rede (Lâminas de fibra, Rastreamento) do GDD §8.2.
- Mobile: a área da grade é transparente ao ponteiro, então o toque ali vai para o canvas e não rola a página; rolar pelos painéis funciona. Revisar no passe mobile.
- Hi-DPI: o canvas roda em resolução 1 (levemente borrado em telas retina); ajustar `resolution`/`zoom` no passe de arte.
- Fontes Outfit e Nunito vêm do Google Fonts com fallback; para servir offline, trazer os arquivos para `public/`.
- O HUD e o painel do Núcleo re-renderizam a cada frame (aceitável no tamanho atual).
- Favicon ainda é o do Vite.
