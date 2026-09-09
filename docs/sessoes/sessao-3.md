# Sessão 3 — Fechar a Era 1 por dentro: bateria, offline, Kardashev, melhorias, mobile

## Antes de começar — correções v0.4 ao GDD
Aplicar ao `docs/GDD-parte1.md` antes de codar, como foi feito com a v0.3.

### 1. §4.1 — a bateria não amortece nada hoje
O GDD promete que "a balança tolera oscilação curta" graças à bateria, mas `balancoRede()` decide a faixa pelo `r` bruto. Resultado: com a bateria cobrindo 100 % do déficit o preço ainda cai para ×0,5, e com a bateria absorvendo todo o excedente o preço ainda cai para ×0,75. Comprar bateria hoje só serve para vender energia guardada. Regra nova:

- Cada unidade de Bateria: **+20 kWh** e **±10 kW** de potência de carga/descarga (campo novo `potenciaKw`).
- `cobertoKw` = déficit que a bateria consegue cobrir no tick (limitado pela potência e pela energia guardada). `absorvidoKw` = excedente que ela consegue absorver (limitado pela potência e pelo espaço).
- **Faixa:** se o `r` bruto está na zona de ouro → ouro. Senão, se a bateria cobre **todo** o déficit ou absorve **todo** o excedente → faixa **neutra** do lado correspondente. Senão → faixa do `r` bruto (apagão ou saturação).
- Em uma frase para o GDD: *a bateria transforma falha em neutro, nunca em ouro.*
- O multiplicador continua valendo para toda a energia vendida no tick (direta + descarga), como hoje.

### 2. §7 — cálculo offline, regras exatas
- Janela: `min(agora − salvoEmMs, 8 h)`; relógio andando para trás conta como 0.
- Nada é comprado offline. A Rede usa o balanço congelado do save, **sem bateria** (nem carrega nem descarrega) e com receita ×0,5.
- Núcleo em modo seguro obrigatório: calcula `T*` do equilíbrio da grade salva. Se `T* ≥ 95 %` (o limiar do modo seguro), o Núcleo fica **desligado** o tempo todo (0 kW, 0 🔬, Estabilidade parada) e o jogador é avisado do motivo. Senão: potência ×0,7, pesquisa/s da faixa de `T*` ×0,7, Estabilidade da faixa ×0,7.
- Ao voltar: `Q = Q*` (limitado a 95 % da capacidade), cronômetro da Cascata zerado, SCRAM zerado. Nunca há Cascata offline.
- Relatório "Enquanto você esteve fora": tempo, ₵, 🔬, Estabilidade e, se for o caso, "Núcleo ficou desligado: sua configuração passaria de 95 %".

### 3. §6 — medidor Kardashev, definição
- `P` = potência **instalada** em watts: `(ofertaUsinasKw + ofertaNucleoKw) × 1000`. Instalada, não vendida.
- Barra em `log10`, de 10³ W a 10²⁷ W, com marcos: humanidade em 2026 ≈ 2×10¹³ W, Tipo I = 10¹⁶ W, Tipo II = 10²⁶ W, Sol = 3,8×10²⁶ W.
- Índice `K = (log10 P − 6) ÷ 10` (fórmula de Sagan). Mostrar com duas casas quando `K ≥ 0` (a partir de 1 MW); antes disso, "abaixo da escala" e o próximo marco.

### 4. §8.2 e §8.3 — melhorias nomeadas
- **Lâminas de fibra** (₵ 200): cata-vento e turbina eólica +25 %.
- **Rastreamento solar** (₵ 150 + 🔬 30): cada espelho injeta 5 u/s em vez de 4. Isso **muda `Q*`** — a marca do equilíbrio na barra tem que mover na hora, porque é a forma de o jogador perceber que precisa reajustar.
- **Grade 7×7** sai desta sessão (vai para a Sessão 4, junto com o passe de arte).

---

## Objetivo
A Era 1 completa por dentro: a bateria vira amortecedor de verdade, o jogo rende offline com regras claras, o medidor Kardashev mostra a escala real, as melhorias nomeadas existem, e a grade funciona no celular sem travar a rolagem. Sem arte nova.

Referências: GDD §4.1, §6, §7, §8.2, §8.3, §11; `docs/ESTADO.md` (decisões da Sessão 2 e pendências).

## Entregas

### 1. `src/content/`
- `era1.ts`: `BATERIA.potenciaKw = 10`; `MELHORIAS_REDE` com Lâminas de fibra e Rastreamento como dado (id, nome, custo, requisito de 🔬, efeito).
- `kardashev.ts` (novo): marcos com nome, potência em W e texto curto.
- `offline.ts` ou dentro de `era1.ts`: `OFFLINE = { janelaMaxMs, fatorRede: 0,5, fatorNucleo: 0,7 }`. Nada cravado no sim.

### 2. `src/sim/rede.ts` — bateria como amortecedor
- `balancoRede()` passa a devolver `rBruto`, `faixaBruta`, `cobertoKw`, `absorvidoKw` e a `faixa` efetiva pela regra da correção 1.
- Carga e descarga limitadas por `unidades × potenciaKw` além da energia/espaço.
- O HUD mostra a faixa efetiva e, quando a bateria está segurando a balança, o motivo ("bateria cobrindo 12 kW").

### 3. `src/sim/melhorias.ts` + `acoes.ts`
- Estado `melhorias: Record<MelhoriaId, boolean>` no `GameState`.
- `comprarMelhoria(id)`: uma vez, exige ₵ e 🔬 acumulado (mesma convenção da Sessão 2: 🔬 é requisito, não gasto).
- Efeitos lidos no sim, não copiados: `potenciaUsina()` aplica o fator das Lâminas; `nucleo.ts` passa a receber `calorPorEspelho(state)` em vez de ler `NUCLEO.calorEspelhoAnel1` direto. `equilibrioU`, `balancoDeCalor` e `potenciaNucleoKw` continuam puras, só ganham o parâmetro.

### 4. `src/sim/offline.ts` + `save.ts` v3
- `salvoEmMs: number` no save; `VERSAO_SAVE = 3`; migração v2 → v3 (`salvoEmMs = agora`, `melhorias` vazias).
- `calcularOffline(state, agoraMs): { state, relatorio }` — função pura, usa o balanço congelado. **Não** roda ticks (8 h são 288 000 ticks).
- `carregar()` aplica o offline e devolve o `RelatorioOffline` para a UI mostrar uma vez.

### 5. `src/sim/kardashev.ts`
`potenciaInstaladaW(state)`, `posicaoNaBarra(w)` (0–1 em log), `indiceK(w)`, `proximoMarco(w)`, `formatarWatts(w)` ("1,6×10⁴ W" e, acima de 10⁶, também o prefixo SI: "1,6 MW").

### 6. `src/ui/`
- `PainelKardashev.tsx`: barra log com os marcos e a posição atual; valor em W; K ou "abaixo da escala"; próximo marco e quanto falta.
- `CardOffline.tsx`: o relatório, fechável, aparece só uma vez por carregamento.
- `PainelRede.tsx`: seção de melhorias com custo e requisito. `PainelNucleo.tsx`: Rastreamento junto do Receptor cerâmico; a marca de `Q*` na barra usa o calor por espelho atual.
- HUD: faixa efetiva + motivo da bateria.

### 7. Input da grade pelo DOM (mobile)
Hoje a área da grade é transparente ao ponteiro para o toque chegar ao canvas fixo — e por isso a página não rola quando o dedo cai na grade. Inverter:
- `.grade-area` recebe `pointer-events: auto` e `touch-action: pan-y`. Em `pointerup` (não `pointerdown`, para não disparar ao rolar), calcula a casa pelo `getBoundingClientRect()` — a mesma conta que `GridScene` já faz — e despacha `agirNaCasa(indice)`. `pointermove` grava `casaSobPonteiro` no store para o realce; `pointerleave` limpa.
- `GridScene` **deixa de registrar** `POINTER_DOWN`/`POINTER_MOVE` e desenha o realce lendo `casaSobPonteiro` do store. Phaser volta a só desenhar.
- `.game-canvas` fica `pointer-events: none` e `.camada-ui` volta a `pointer-events: auto` — nenhum toque precisa mais chegar ao canvas.
- Um toque que moveu mais de ~8 px entre `pointerdown` e `pointerup` é rolagem, não clique.

### 8. Hi-DPI e desempenho
- Canvas nítido em tela 2×: renderizar em `devicePixelRatio` e compensar o tamanho CSS (Phaser 3 não faz isso sozinho). Validar visualmente. Se em uma hora não fechar, registrar em Pendências e seguir — não é bloqueante.
- Conferir que React só recebe um snapshot por tick (10 Hz), não por frame; seletores com `useShallow` nos painéis grandes.

### 9. Testes (Vitest)
- Faixa efetiva: `r` bruto 0,7 com bateria cobrindo tudo → neutro baixo; bateria vazia → apagão. `r` bruto 1,4 com bateria absorvendo tudo → neutro alto; cheia → saturação. `r` bruto 1,0 com bateria carregando → ouro. Déficit maior que `unidades × 10 kW` não é coberto por inteiro → apagão.
- Offline: 10 min rendem `receita/s × 0,5 × 600` na Rede; 9 h contam como 8 h; relógio para trás rende 0; `T* = 83 %` → pesquisa ×0,7 e `Q` volta em `Q*`; `T* ≥ 95 %` → Núcleo desligado e relatório com o motivo; nunca cascateia.
- Melhorias: Rastreamento com `h = 5, t = 2` leva `Q*` de 83,3 para 104,2 (o jogador que não reajusta cascateia — isso é intencional e o card da Sessão 4 vai explicar); Lâminas +25 % só nas eólicas; compra única.
- Kardashev: 16 kW → K negativo → "abaixo da escala"; 1 MW → K = 0,00; 2×10¹³ W cai sobre o marco da humanidade; formatação.
- Save: migração v2 → v3 preserva Rede, Núcleo e créditos.
- Input: `indiceDaCasa(x, y, rect)` cobre os cantos e devolve `null` fora da grade.

## Critérios de pronto
- [x] Bateria segurando a balança aparece no HUD com o motivo e o preço fica ×1; bateria vazia ou cheia devolve a penalidade.
- [x] Fechar a aba e voltar (ou editar `salvoEmMs` no save) mostra o card "Enquanto você esteve fora" com números coerentes com os testes; 8 h de teto.
- [x] Núcleo com `T* ≥ 95 %` fica desligado offline e o card diz por quê.
- [x] Medidor Kardashev com marcos; K aparece a partir de 1 MW.
- [x] Rastreamento move a marca de `Q*` na barra na hora da compra; Lâminas mudam a potência das eólicas.
- [x] No celular (ou DevTools em modo toque): rolar a página com o dedo sobre a grade funciona; tocar numa casa coloca a peça; nenhum toque coloca duas.
- [x] Tela 2× nítida, ou pendência registrada com o que foi tentado.
- [x] `npm test`, `npm run typecheck`, `npm run build` passam.
- [x] GDD com as correções v0.4; `docs/ESTADO.md` atualizado.

## Fora de escopo — não faça nesta sessão
Passe de arte, cards explicativos, Bipes, som, Grade 7×7, fontes locais, favicon, Era 2, transição de era, prestígio. (Tudo isso é a Sessão 4 ou depois.)

## Armadilhas conhecidas
- Offline não roda ticks e não aplica Cascata nem compras: é o balanço congelado vezes o tempo. Se alguém "simplificar" rodando o loop, 8 h viram 288 000 ticks no carregamento.
- `salvoEmMs` sai de `Date.now()` no save e é comparado com `Date.now()` no load; `tempoMs` do jogo é outra coisa e não serve para isso.
- Rastreamento muda a constante 4 do balanço de calor: todos os testes de `Q*` da Sessão 2 supõem a melhoria desligada. Os testes novos cobrem os dois estados; os antigos continuam valendo com ela desligada.
- A bateria só cobre o que consegue em potência (±10 kW por unidade) **e** em energia dentro do tick. Ordem do tick inalterada: produção → venda → bateria → receita.
- Se sobrar um `this.input.on` no `GridScene`, o mesmo toque chega pelo DOM e pelo Phaser e coloca duas peças.
- `pointerup` depois de rolagem: guardar a posição do `pointerdown` e ignorar se moveu mais de 8 px.

## Prompt para colar no Claude Code
> Leia `CLAUDE.md`, `docs/ESTADO.md`, `docs/GDD-parte1.md` e `docs/sessoes/sessao-3.md`. Aplique primeiro as correções v0.4 ao GDD. Depois monte um plano em passos numerados para cumprir **só** a Sessão 3 e me mostre antes de executar. Implemente passo a passo, rodando `typecheck` e `test` a cada passo, e termine atualizando `docs/ESTADO.md`.
