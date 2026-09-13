# Sessão 6 — relatório de produção

Branch `claude/sessao-6`, a partir de `claude/era1-scaffold-rede-pqkglz`. GDD v0.6, roteiro em
`docs/sessoes/sessao-6.md`. Este arquivo abre com o plano (passo a passo) e termina com decisões, medições
e pendências.

## Plano

**A · Geração do arquipélago (sim puro)**
1. `content/era1-arquipelago.ts`: grade 64×64, semente, plataforma, as 8 ilhas de §8.5 (casas, terreno
   dominante, expedição, obstáculos de nascença), tabela de obstáculos (custo, 🔬, tempo), subestação
   (custo, alcance, teto, níveis), cabo (fixo + por casa de mar), terrenos e seus fatores.
2. `sim/arquipelago.ts` (tipos) e `sim/gerarArquipelago.ts`: crescimento determinístico por fila de
   prioridade a partir de 8 sementes, com canal de mar obrigatório entre ilhas; terreno por casa;
   obstáculos de nascença; clareira inicial em volta da plataforma e da aldeia; rota de cabo por ilha.
3. Testes: 2048 casas exatas repartidas nos tamanhos de §8.5, ilhas 4-conexas e separadas por mar,
   plataforma 7×7 na principal, terreno válido, determinismo.

**B · Estado e ações (sim puro)**
4. `GameState.mundo`: `construcoes`, `obstaculos`, fila de remoção, `ilhasAbertas`, `cabos`.
5. `sim/mundo.ts`: colocar, remover (50 %), remover obstáculo (cobra e agenda), comprar ilha, ligar cabo.
6. `sim/producao.ts`: produção por usina = base × nível × terreno × esteira × sombra × pico; escoamento
   por subestação (alcance 3, teto em kW); demanda dos bairros com subestação; "sem escoamento" como
   sumidouro. Contagens da Rede derivadas das construções.
7. Save v6 com migração v5 → v6 (unidades recolocadas na principal, excedente reembolsado).

**C · Cena**
8. Mar com ondulação, litoral, céu e horizonte no lugar do espaço.
9. Terreno do arquipélago: 8 ilhas com penhasco, ilhas fechadas com véu e placa de expedição.
10. Obstáculos como sprites (árvore, arbusto, pedra, pântano, montanha 2×2, pico), cabos submarinos,
    alcance da subestação, realce de colocação com motivo, Bipe de manutenção na remoção com barra.

**D · UI**
11. Paleta de construção no lugar da lista de compra; extrato da Rede.
12. Escada crescente (esquerda → direita no celular, baixo → cima no desktop) com degraus que crescem.
13. Nota de ₵ desenhada no HUD com extrato ao tocar.
14. Tooltips das peças do Núcleo e card "As cinco peças"; abertura reescrita em torno de espaço.

**E · Verificação**
15. Testes do sim (geração, colocação, esteira, sombra, alcance/teto, remoção com tempo, expedição,
    cabo, migração v6, contagens derivadas) e medições de ms/tick.
16. Roteiro Playwright em `scripts/e2e/sessao-6.cjs` nos dois tamanhos, capturas em
    `docs/capturas/sessao-6/`, `ESTADO.md`, checklist e este relatório.

## Execução

(preenchido ao longo da sessão)
