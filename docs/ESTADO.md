# Estado do projeto

Atualizado ao fim da **Sessão 3** (Era 1 fechada por dentro).

## Implementado

### Sessão 1 — Scaffold + Rede da Era 1
- Vite 8 + React 19 + TypeScript 6 (strict), Zustand 5, Phaser 3.90, Vitest 5, oxlint. Scripts `dev`, `build`, `test`, `typecheck`, `lint`.
- `src/sim/`: `state.ts`, `tick.ts` (100 ms fixos, `sim/tempo.ts`), `rede.ts`, `custos.ts`, `acoes.ts`, `formatar.ts` (PT-BR, prefixos SI), `save.ts` (único ponto com `localStorage`), `loop.ts` (rAF + acumulador limitado a 5 s).
- `src/content/era1.ts`: usinas, vila, bateria, economia, faixas de `r` (GDD §4.1, §7, §8.2). HUD, lista da Rede, painel de progresso; fundo Phaser; tokens do §10.

### Sessão 2 — Núcleo da Era 1
- `content/era1-nucleo.ts`, `sim/nucleo.ts`, `calor.ts`, `cascata.ts`, `estabilidade.ts`, tick em seis passos, desbloqueio por 🔬, `acoesNucleo.ts`, save v2. `GridScene` (grade, rampa de calor, partículas, onda de choque), painel do Núcleo com barras de Calor e Estabilidade, seletor de peças, SCRAM, modo seguro, Receptor cerâmico.

### Sessão 3 — Bateria, offline, Kardashev, melhorias, mobile
- **Docs:** `docs/correcoes-gdd-v0.4.md` aplicado ao GDD (§3, §4.1, §6, §7, §8.2, §8.3, §12).
- **Bateria como amortecedor (`sim/rede.ts`):** `BATERIA.potenciaKw = 10`; `balancoRede()` devolve `rBruto`, `faixaBruta`, `cobertoKw`, `absorvidoKw`, `motivoBateria` e a `faixa` efetiva pela regra "falha vira neutro, nunca ouro"; carga e descarga limitadas por ±10 kW por unidade e pela energia no tick; opções `{ potenciaNucleoKw, dtS, melhorias, semBateria }`. HUD mostra a faixa efetiva e "🔋 bateria cobrindo/absorvendo N kW".
- **Melhorias nomeadas (`content/era1.ts` `MELHORIAS`, `sim/melhorias.ts`):** Lâminas de fibra (₵ 200, cata-vento e turbina eólica +25 %) lida em `potenciaUsina()`; Rastreamento solar (₵ 150 + 🔬 30, espelhos a 5 u/s) lido como `calorPorEspelho()` e passado a `balancoDeCalor`, `equilibrioU` e `passoCalor`. Compra única; 🔬 é requisito. Cards nos painéis da Rede e do Núcleo; a marca de `Q*` na barra move na hora.
- **Offline (`sim/offline.ts`, `save.ts` v3):** `salvoEmMs` carimbado no save e no export; janela `min(agora − salvoEmMs, 8 h)`, relógio para trás = 0; Rede sobre o balanço congelado sem bateria ×0,5; Núcleo em modo seguro obrigatório (desligado se `T* ≥ 95 %`, senão potência, pesquisa e Estabilidade ×0,7); `Q = Q*` limitado a 95 %, cronômetro e SCRAM zerados; nunca cascateia; não roda ticks. `carregar()` aplica e devolve o relatório; `CardOffline` mostra uma vez (a partir de 60 s de ausência). Importar JSON também aplica o offline desde o carimbo. Migração v2 → v3.
- **Medidor Kardashev (`content/kardashev.ts`, `sim/kardashev.ts`, `ui/PainelKardashev.tsx`):** `P` instalada = (usinas + Núcleo) × 1000; barra log 10³–10²⁷ W com marcos (1 MW auxiliar, Humanidade 2026, Tipo I, Tipo II, Sol); `K = (log10 P − 6) ÷ 10` a partir de 1 MW, antes "abaixo da escala" e o próximo marco; `formatarWatts` científica com prefixo SI acima de 1 MW.
- **Input da grade pelo DOM:** `.grade-area` recebe `pointerup` (ignora arrasto > 8 px e `pointercancel`), `touch-action: pan-y`, grava `casaSobPonteiro` no store; `indiceDaCasa()` em `scene/layout.ts` é a conta única, testada. `GridScene` não registra input e só desenha. `.game-canvas` é `pointer-events: none`.
- **Hi-DPI:** `GameCanvas` usa `Scale.NONE` com `zoom = 1/devicePixelRatio` e `resize(css × dpr)` no `resize` da janela; a cena converte px CSS → px do dispositivo por `1/scale.zoom`. Conferido: em 2× o canvas tem 780×1400 px para 390×700 CSS e a grade sai nítida.
- **Mobile:** abaixo de 900 px a página inteira rola (a camada de UI tinha altura fixa e os painéis ficavam espremidos com rolagem interna — bug das Sessões 1–2, corrigido); rótulos curtos no Kardashev abaixo de 600 px.
- **React por tick:** o loop chama `onTicks` só em frames com tick inteiro, então o store publica no máximo 10 snapshots/s; painéis assinam `state` inteiro (muda a cada tick de qualquer jeito). `useShallow` não trouxe ganho e não foi aplicado.
- **Testes (`npm test`, 197):** faixa efetiva da bateria (0,7 coberto → neutro; vazia → apagão; 1,4 absorvido → neutro; cheia → saturação; ouro fica ouro; déficit > 10 kW por unidade → apagão; limite por energia; multiplicador sobre toda a energia vendida; `semBateria`); offline (10 min = receita/s × 0,5 × 600; 9 h = 8 h; relógio para trás = 0; `T* = 83 %` → ×0,7 e `Q = Q*`; `T* ≥ 95 %` → desligado com motivo; `h = 6` e sem turbinas também desligados); melhorias (Lâminas só nas eólicas; Rastreamento leva `Q*` de 83,3 a 104,2 e cascateia sem reajuste; compra única); Kardashev (16 kW abaixo da escala; 1 MW → K = 0; 2×10¹³ W no marco da humanidade; formatação); migração v2 → v3; `indiceDaCasa` nos cantos e fora da grade.
- **Verificação no navegador (Playwright + Chromium):** bateria cobrindo 4 kW aparece no HUD com preço ×1 e vira apagão ao esvaziar; card "Enquanto você esteve fora" com 2 h (₵ 13,5 mil, 🔬 ≈ 10,5 mil, Estabilidade +80) e com 9 h → 8 h e "Núcleo ficou desligado"; Kardashev com marcos, "K abaixo da escala" a 21 kW e `K = 0,01` a 1,2 MW; Rastreamento move `Q*` de 83,3 para 104,2 na hora; Lâminas levam o cata-vento a 1,25 kW; no viewport de 390 px com toque e DPR 2, um arrasto de dedo sobre a grade rola a página sem colocar peça e um toque coloca exatamente uma; canvas em 2×.

## Próxima sessão
`docs/sessoes/sessao-4.md` (a escrever) — passe de arte (tokens, rampa de calor, sombras, glow), 3 cards explicativos da Era 1 (o tanque de sal e o Rastreamento precisam de card), Grade 7×7, Bipes, fontes locais, favicon.

## Decisões da Sessão 3 que o GDD não fixa (conferir)
1. **Relatório offline** só aparece a partir de 60 s de ausência (`OFFLINE.minimoRelatorioMs`); o ganho é aplicado sempre.
2. **Importar JSON** aplica o offline desde o `salvoEmMs` do arquivo, como um carregamento.
3. **Estabilidade offline** só sobe se o Núcleo produz (potência > 0), como no tick.
4. **Q ao voltar** quando o Núcleo ficou desligado é 95 % da capacidade; sem modo seguro ligado, uma grade acima do limite volta a subir na hora — o card avisa.
5. **1 MW** entra como marco auxiliar na barra Kardashev (é onde K = 0 e o próximo marco antes da humanidade ficaria a 9 ordens de grandeza).
6. **Remover peça** continua sem reembolso; **cronômetro da Cascata** e **SCRAM** como na Sessão 2.

## Pendências
- Sessão 4: cards explicativos, passe de arte, Grade 7×7 (₵ 800 + 🔬 150), Bipes, fontes locais, favicon, som.
- Contenção, Era 2 e transição de era, prestígio.
- O gesto de rolagem sintetizado do Chromium (`Input.synthesizeScrollGesture`) não funciona no headless deste ambiente; o roteiro usa `dispatchTouchEvent`. Vale um teste manual num Android real.
- A onda de choque e o tremor da Cascata usam a câmera do Phaser; com o canvas em 2× ficaram proporcionais, mas não foram revistos no passe de arte.
- Painéis assinam o `state` inteiro e re-renderizam a cada tick (10 Hz); se a lista crescer, fatiar com seletores.
