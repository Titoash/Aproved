# Sessão 5 — Ilha-tabuleiro: 2048 casas, regiões, vagas e escada de escalas

> Pressupõe a Sessão 4 concluída e o GDD v0.5 aplicado (`docs/correcoes-gdd-v0.5.md`). Referência visual: a amostra aprovada (`scratchpad/mock2`, publicada como artifact) — o jogo porta o renderizador dela.

## Objetivo
A Era 1 inteira se joga numa ilha isométrica de 2048 casas: a plataforma do Núcleo no centro, as usinas da Rede aparecendo nas regiões conforme são compradas, locais compráveis, e a escada de escalas navegável (ilha → multiverso) com o medidor Kardashev até 10⁵⁰ W. Nenhuma fórmula de simulação muda; entram só as vagas e os locais.

## Partes
- **A · Sim e conteúdo.** `content/era1-tabuleiro.ts` (ilha, regiões, vagas, preços, níveis); `sim/ilha.ts` (tipos), `sim/gerarIlha.ts` (geração determinística, 2048 casas exatas), `sim/tabuleiro.ts` (vagas, alocação determinística das usinas em vagas, locais compráveis); `GameState.tabuleiro.regioesDesbloqueadas`; save v5 com migração; compras da Rede respeitam vagas; evento `regiaoDesbloqueada`; Kardashev I–V.
- **B · Cena.** Phaser em modo Canvas com um objeto de desenho próprio (`renderCanvas`) que chama os módulos portados: `scene/tabuleiro/{base,fundo,terreno,sprites,escalas,cena,camera}.ts` e `TabuleiroScene`. Câmera com pan, zoom e pinch pelo DOM (o palco), presets Ilha e Núcleo, transição de 900 ms entre níveis, hit-test das casas da plataforma e das placas de local, entulho, Cascata (flash, brasas, tremor, onda), SCRAM, realce sob o ponteiro.
- **C · UI.** Escada de escalas (`Escada.tsx`), botões de preset no palco, ícones vetoriais das usinas na lista, "sem vaga" nos botões com atalho para o local, seção "Locais" na Rede, régua Kardashev com os tipos I–V, card do primeiro local desbloqueado.
- **D · Verificação.** Testes do sim (ilha, vagas, alocação, migração, ações, Kardashev, store); roteiro Playwright nos dois tamanhos; `docs/ESTADO.md`.

## Checklist
- [ ] GDD v0.5 aplicado em commit separado
- [ ] `gerarIlha`: 2048 casas exatas, determinística, conexa, plataforma na região do Núcleo
- [ ] vagas por categoria e alocação estável (prefixo preservado ao comprar e ao desbloquear)
- [ ] compra sem vaga recusada com motivo; desbloquear local cobra ₵ e emite evento
- [ ] save v5 com migração v4 → v5; saves antigos com excesso de usinas carregam
- [ ] cena isométrica com terreno, sprites, Núcleo na plataforma (anel 3 bloqueado até a Grade 7×7), Rede nas vagas, placas de local
- [ ] câmera: pan, zoom, pinch, presets, limites, hi-DPI; toque na casa coloca peça; toque na placa compra o local
- [ ] Cascata e SCRAM visíveis na ilha; entulho na plataforma
- [ ] escada de escalas com transição e bloqueio por potência; fundo por nível
- [ ] Kardashev I–V até 10⁵⁰ W; notação científica acima de 10²⁴ W
- [ ] mobile 390×844 sem rolagem horizontal; escada compacta
- [ ] `test`, `typecheck`, `lint`, `build` verdes; capturas nos dois tamanhos; `ESTADO.md`
