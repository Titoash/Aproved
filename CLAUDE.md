# KARDASHEV — instruções do projeto

## O que é
Jogo idle web de gerenciamento de energia em duas camadas: **Rede** (lista de usinas, números) e **Núcleo** (grade de peças, geometria). Do cata-vento à esfera de Dyson. Estética flat-vector de infográfico científico.

O design completo está em `docs/GDD-parte1.md`. **É o contrato.** Se código e GDD divergirem, o GDD vence. Se o design precisar mudar, edite o GDD primeiro e explique o porquê no commit.

## Stack
Vite + React + TypeScript (strict) + Phaser 3 + Zustand + Vitest. CSS com variáveis (tokens do GDD §10), sem Tailwind. Interface em PT-BR, vírgula decimal. Mobile-first.

## Comandos
- `npm run dev` — servidor local
- `npm test` — Vitest
- `npm run typecheck` — `tsc --noEmit`
- `npm run build`

`test`, `typecheck` e `build` precisam passar antes de encerrar qualquer sessão.

## Estrutura
```
src/
  sim/      # TypeScript puro: estado, tick de 100 ms, fórmulas, balanças, Cascata, save/load
  ui/       # React: HUD, lista da Rede, balanças, cards, menus, medidor Kardashev
  scene/    # Phaser 3: grade do Núcleo, rampa de calor, partículas, transições
  content/  # dados das eras: peças, usinas, preços, textos dos cards
  store/    # Zustand: snapshot do estado do sim + ações
docs/
  GDD-parte1.md      # contrato de design
  ESTADO.md          # o que existe e o que falta (atualizar ao fim de cada sessão)
  sessoes/sessao-N.md
```

## Regras que não se negociam
1. `src/sim/` é TypeScript puro: nada de React, Phaser, DOM ou `localStorage` lá dentro (exceção: `sim/save.ts` é o único ponto que toca `localStorage`). O sim é a única fonte de verdade e roda em timestep fixo de 100 ms.
2. Toda fórmula do GDD vira função pura com teste no Vitest. Exemplo obrigatório na Sessão 2: "h = 6 com 2 turbinas estabiliza em 100 % e não cascateia em 120 s; acrescentar um espelho de anel 2 dispara a Cascata 5 s depois."
3. Números de jogo (preços, produção, capacidades, faixas) vivem em `src/content/`. Nunca hardcoded na UI ou na cena.
4. Phaser só desenha e captura input; despacha ações para o sim via store. Um `Phaser.Game` por app, criado em `useEffect`, com guarda contra o double-mount do StrictMode e `destroy(true)` no cleanup.
5. Identificadores de domínio em português sem acento (`heliostato`, `receptor`, `cascata`, `zonaDeOuro`, `comprarUsina`); infraestrutura em inglês (`store`, `scene`, `useTick`).
6. Nada de personagens, logos ou imagens de terceiros. Mascotes são os **Bipes** (originais, descritos no GDD §10). Ícones em SVG próprio.
7. Sem biblioteca de big numbers: `number` cobre até 10^308 e o jogo chega a ~10^26.
8. Commits pequenos e descritivos, em português.

## Como trabalhar uma sessão
1. Leia `docs/ESTADO.md` e o `docs/sessoes/sessao-N.md` da vez.
2. Apresente um plano em passos numerados e **espere aprovação** antes de codar.
3. Implemente passo a passo, rodando `typecheck` e `test` a cada passo.
4. Não expanda o escopo da sessão. O que for tentador mas não pedido vai para "Pendências" no `ESTADO.md`.
5. Ao terminar: atualize `docs/ESTADO.md` e liste o que ficou pendente.

## Estilo de resposta
Direto, sem elogios, em PT-BR. Quando um número ou regra do GDD não fechar na prática, aponte o conflito e proponha o ajuste em vez de contornar em silêncio.
