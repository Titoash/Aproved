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
