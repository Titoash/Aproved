# Estado do projeto

Atualizado ao fim da **Sessão 4** (Era 1 bonita: arte, cards, Bipes, Grade 7×7).

## Implementado

### Sessão 1 — Scaffold + Rede da Era 1
- Vite 8 + React 19 + TypeScript 6 (strict), Zustand 5, Phaser 3.90, Vitest 5, oxlint. Scripts `dev`, `build`, `test`, `typecheck`, `lint`.
- `src/sim/`: estado, tick de 100 ms (`sim/tempo.ts`), Rede (balança, bateria, receita), custos, ações, formatação PT-BR, save (único ponto com `localStorage`), loop.
- `src/content/era1.ts`: usinas, vila, bateria, economia e faixas de `r` (GDD §4.1, §7, §8.2).

### Sessão 2 — Núcleo da Era 1
- Torre Solar: `nucleo.ts`, `calor.ts`, `cascata.ts`, `estabilidade.ts`, tick em seis passos, desbloqueio por 🔬, `acoesNucleo.ts`, `GridScene`, painel do Núcleo.

### Sessão 3 — Bateria, offline, Kardashev, melhorias, mobile
- Bateria como amortecedor (faixa efetiva), melhorias nomeadas (Lâminas, Rastreamento), offline puro, medidor Kardashev, input da grade pelo DOM, hi-DPI, página rolando no mobile.

### Sessão 4 — Era 1 bonita
- **Parte D — Grade 7×7:** `nucleo.lado` (5 ou 7) no estado; `anel()`, `contar()`, `podeColocar()`, `entulharAnel1()` por lado; anel 3 a 0,25 só para heliostato; `expandirGrade()` embute o 5×5 no 7×7 com deslocamento (+1, +1); Grade 7×7 como melhoria (₵ 800 + 🔬 150) que expande a grade na compra; `GridScene` e o input do DOM leem o lado. Save **v4** (`nucleo.lado`, `nucleo.ultimaCascata`, `cardsVistos`) com migração v3 → v4. Nota de balanço do 7×7 no GDD §8.3.
- **Parte B — Cards explicativos:** `content/cards-era1.ts` com os textos finais (abertura em 3 telas, tanque, Rastreamento, Cascata, bateria) e `cardParaEvento()` como única tabela evento → card. O sim expõe `eventos` por tick/ação (`primeiroCarregamento`, `primeiraCompra` só na primeira unidade, `melhoriaComprada`, `cascata` com `entrada`/`saida` do tick, também gravados em `nucleo.ultimaCascata`). O store enfileira os cards, mostra um por vez, marca como visto ao fechar (`cardsVistos` no save); só a abertura pausa o jogo. `CardExplicativo` com Bipe narrador, "Próximo"/"Entendi".
- **Parte C — Bipes:** `ui/bipe/Bipe.tsx` (SVG original: corpo, um olho com brilho, antena, braços em cápsula, sombra elíptica; papéis operador/manutenção/cientista; expressões neutro/apontando/alarmado/cansado; piscar em CSS, desligado em reduced-motion). Narrador dos cards, cansado no card offline, versão mínima em `Graphics` flutuando sobre cada entulho.
- **Parte A — Direção de arte:**
  - Fontes locais: `public/fonts/Outfit-latin.woff2` e `Nunito-latin.woff2` (variáveis, OFL incluída) com `@font-face` e `font-display: swap`; nenhuma requisição ao Google Fonts. Favicon próprio (esfera da rampa sobre a torre).
  - Tokens novos em `tokens.css` (`--casa`, `--casa-anel1`, `--torre`, `--turbina-carcaca`, `--tanque`, `--entulho`, `--glow-sun`, `--glow-coral`, escala 12/14/16/20/28/40).
  - `GridScene`: camadas fundo/estático/dinâmico/efeitos; base elíptica sob a grade; espelhos girados para a torre com a face escurecendo pelo anel e faixa de brilho (varre a face a cada 6 s com o Rastreamento); turbinas com pás girando pelo consumo e fio de vapor; radiadores com aletas que clareiam ao dissipar; tanques com nível na rampa; torre com esfera na rampa, brilho por `T`, pulso acima de 90 %, cinza-azulada com anel pontilhado em SCRAM; entulho em dois pedaços com borda verde quando a limpeza é grátis; Cascata com flash, 12 brasas e pop do entulho; partículas pela metade; `prefers-reduced-motion` desliga partículas, giro, pulso, tremor e varredura. O desenho é recortado ao retângulo do palco (máscara) para não vazar por cima do HUD quando o palco rola.
  - UI: HUD em faixa sem cartão (₵, ⚡ com o ponto de `r`, 🔥 na rampa com a esfera brilhando na zona de ouro, 🔬, 🛡); Núcleo como palco solto sobre o fundo; barra de calor segmentada com marca de `Q*` em triângulo, limite e **dica derivada de `Q*`** (`dicaDeEquilibrio()` no sim); Estabilidade de leaf a sun; seletor e controles em pílulas; Rede em lista com divisórias e melhorias como linhas com marca de comprado; Kardashev em largura total; save num rodapé discreto com a caixa de importar escondida; pop de 180 ms só no número que mudou; foco de teclado visível; sem caixa alta em rótulo; sombra chapada em tudo. Mobile: HUD compacto fixo no topo, ordem grade → calor → seletor (rolável) → Estabilidade → Kardashev → Rede → save.
- **Testes (`npm test`, 235):** anel para lado 7; `expandirGrade`; `h` com anel 3 e recusas no anel 3; compra da Grade 7×7 (₵, 🔬, única, índice 48); migração v3 → v4; eventos (`primeiraCompra` só na primeira, `cascata` com os fluxos do tick, `marcarCardVisto` persistido); dica da barra; store (abertura pausa, cards uma vez, fila).
- **Verificação no navegador (Playwright + Chromium, 1280×800 e 390×844):** abertura em 3 telas pausando o jogo; fontes de `/fonts/` e nenhuma ao Google; favicon; sem caixa alta; Receptor laranja na zona de ouro e cinza no SCRAM; cards de tanque, Rastreamento, Cascata (25 u/s entrando, 24,7 u/s saindo, do tick) e bateria, uma vez cada e ausentes após recarregar; dica aparece com o tanque e some ao tirá-lo; Grade 7×7 expande preservando as peças, recusa turbina e aceita espelho no anel 3 (`h = 5,25`); ordem mobile confirmada por posição; reduced-motion desliga o piscar do Bipe.

## Próxima sessão
`docs/sessoes/sessao-5.md` (a escrever) — Era 2 (fissão: esgotamento e calor de decaimento) e transição de era (zoom cósmico e troca de paleta). MVP = Eras 1–2.

## Decisões da Sessão 4 que o GDD não fixa (conferir)
1. **`primeiraCompra`** dispara quando a contagem daquele item passa de 0 para 1 (também se o jogador removeu tudo e comprou de novo); o card só aparece uma vez por `cardsVistos`.
2. **Card da Cascata** usa `ultimaCascata` (persistido), então sobrevive a um recarregamento entre a Cascata e o "Entendi".
3. **Importar JSON** fecha qualquer card aberto e não redispara a abertura (só jogo novo e "Resetar" disparam).
4. **Remover peça** e **entulho** como nas sessões anteriores; a Grade 7×7 exige Núcleo desbloqueado.
5. **Glow** só em três lugares: esfera do Receptor, esfera do 🔥 no HUD (a partir de 70 %) e o botão "Desbloquear o Núcleo" quando comprável.

## Pendências
- Sessão 5+: Era 2, transição de era, Contenção, prestígio, som.
- Bipe no entulho é a versão mínima em `Graphics`; a versão SVG completa vive nos cards.
- O tremor da Cascata usa a câmera do Phaser e aparece só dentro do recorte do palco.
- Painéis assinam o `state` inteiro e re-renderizam a cada tick (10 Hz); se a lista crescer, fatiar com seletores.
- O roteiro de teste usa `dispatchTouchEvent` para o toque (o gesto sintetizado do Chromium não funciona no headless); vale um teste manual em Android.
