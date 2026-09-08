# Aproved — guia para o Claude Code

Jogo idle/incremental em PT-BR sobre construir uma rede elétrica, era a era.
Stack: **Vite + React + TypeScript**, **Zustand** (store), **Phaser** (canvas), **Vitest** (testes).

## Comandos
- `npm run dev` — servidor de desenvolvimento.
- `npm test` — testes (Vitest, ambiente `node`).
- `npm run typecheck` — `tsc --noEmit` nos dois projetos (app e config).
- `npm run build` — `tsc -b && vite build`.
- `npm run lint` — oxlint.

Rode `typecheck` e `test` a cada passo; `build` antes de encerrar uma sessão.

## Estrutura de pastas
```
src/
  sim/        simulação pura, sem React/Phaser/DOM (única exceção: save.ts toca localStorage)
    state.ts     tipos do estado e estadoInicial()
    tick.ts      tick(state, dtMs) em timestep fixo de 100 ms
    rede.ts      balança Oferta × Demanda, faixas de r, bateria, receita
    custos.ts    custo da n-ésima unidade e da melhoria
    acoes.ts     compras/melhorias como funções puras (devolvem null se impossível)
    formatar.ts  PT-BR, vírgula decimal, prefixos SI
    save.ts      localStorage, versao, exportar/importar JSON
    loop.ts      requestAnimationFrame + acumulador (limite de 5 s)
  content/    números do jogo por era (era1.ts) — nada de regra aqui, só dados
  store/      Zustand: snapshot do GameState + ações; jogo.ts liga o loop ao store
  ui/         React: HUD, painéis, tokens de arte (tokens.css)
  canvas/     Phaser: GameCanvas (montagem) e cenas
docs/
  GDD-parte1.md   documento de design (fonte dos números) — AINDA NÃO ESTÁ NO REPO
  ESTADO.md       o que existe e o que ficou pendente
  sessoes/        especificação de cada sessão de trabalho
```

## Regras
- Simulação é pura e determinística: `tick(state, dtMs)` devolve um estado novo, nunca muta.
- Ordem no tick: produção → venda até a demanda → bateria (excedente/déficit) → receita com multiplicador de `r`.
- Créditos acumulam como `number` sem arredondar; arredonde só em `formatar.ts`.
- `localStorage` só em `src/sim/save.ts`. Todo save tem `versao`.
- Números do jogo ficam em `src/content/`; a UI e a simulação leem de lá.
- Textos da UI e nomes de código em PT-BR (identificadores sem acento).
- StrictMode monta duas vezes em dev: instâncias externas (Phaser, loop) vivem em `ref`/closure e são destruídas no cleanup.
- Não implemente o que a sessão atual marca como fora de escopo.
