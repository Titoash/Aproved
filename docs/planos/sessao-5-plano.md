# Plano da Sessão 5 — Era 2 e transição de era

Base: `docs/sessoes/sessao-5.md` (especificação) e `docs/ESTADO.md` (fim da Sessão 4).
Cada passo termina com `npm run typecheck` + `npm test` verdes e **um commit** com o número e o título do passo.

Regra que atravessa o plano: **nenhum teste da Era 1 muda de resultado.** Se um mudar, o passo para e a mudança é discutida antes.

---

## Passo 0 — GDD §8.5: os números da Era 2
Só documentação. Escreve no `GDD-parte1.md` a seção **§8.5 Era 2 — Fissão (completa)** com a Parte A da especificação (peças, capacidades, queima, decaimento, exemplo de equilíbrio, Rede, regra da transição), mais uma nota em §7 dizendo que os números finos da Era 2 saíram da Parte 2 para cá. Bump para v0.5 no rodapé, com `docs/correcoes-gdd-v0.5.md` explicando a decisão.
**Fecha quando:** o contrato responde a toda pergunta numérica dos passos 1–7.

## Passo 1 — Estado multi-era e save v5
`sim/state.ts`: `era: 1 | 2`; `NucleoState.tipo: "torreSolar" | "reatorPwr"`; `PecaId` vira união das peças das duas eras; a casa da grade ganha estado por peça (`combustivel: number`, `paradaEmMs: number | null`) num campo opcional, para não inchar as peças da Era 1. `VERSAO_SAVE = 5`, migração v4 → v5 (`era: 1`, `nucleo.tipo: "torreSolar"`, peças sem estado extra).
**Testes:** migração v4 → v5 preserva grade, calor, melhorias e `cardsVistos`; save v5 ida e volta; save v3 ainda sobe até v5 em cadeia.

## Passo 2 — Registry de eras em `content/`
`content/eras.ts` com `DEF_ERA: Record<Era, DefinicaoEra>` reunindo: peças, constantes do Núcleo, usinas, itens, preço base, demanda inicial e faixas. `content/era2.ts` e `content/era2-nucleo.ts` com os dados do passo 0. `sim/nucleo.ts`, `sim/calor.ts`, `sim/rede.ts`, `sim/tick.ts` e `sim/acoesNucleo.ts` passam a receber a definição da era em vez de importar `NUCLEO`/`PECAS` da Era 1 direto.
**Fecha quando:** `grep -rn "content/era1" src/sim` não acha nada além do registry, e **os testes da Era 1 passam sem uma linha editada**.

## Passo 3 — Combustível que esgota
`sim/combustivel.ts` puro: `queimar(casa, anel, dtS)`, `estaGasta()`, `custoRecarga()`, `recarregar()`. Entra como passo 4a do tick, antes do balanço de calor. Ação `recarregarVareta(indice)` em `acoesNucleo.ts` e no store.
**Testes:** vareta do anel 1 dura 400 s e a do anel 2, 800 s; ao esgotar, a entrada de fissão dela zera; recarga cobra ₵ 240 e devolve 100 %; recarga sem ₵ devolve `null`.

## Passo 4 — Calor de decaimento
`sim/decaimento.ts`: `calorDeDecaimento(casa, tempoMs, entradaNominal)` com meia-vida 90 s, fração 0,07 e corte 0,05 u/s. Entra em `balancoDeCalor` como um termo que **não** é zerado pelo SCRAM; `equilibrioU()` e `dicaDeEquilibrio()` passam a considerá-lo; `offline.ts` usa o mesmo termo no `T*` do modo seguro. Remoção de vareta gasta recusada enquanto quente, com motivo.
**Testes (os que definem a era):**
- SCRAM com 5 varetas no anel 1 e **nenhuma bomba** → `T` **sobe** e a Cascata acontece durante o SCRAM;
- as mesmas 5 varetas **com 1 bomba** → `T` cai e não cascateia;
- decaimento cai à metade em 90 s e some no corte;
- vareta gasta e quente recusa remoção; depois do corte, aceita.

## Passo 5 — Transição de era
`sim/era.ts`: `podeAvancarEra(state)` (Estabilidade 100 % + 🔬 3 000 + ₵ 50 000) e `avancarEra(state)` aplicando a tabela do §8.5 (o que atravessa, o que zera, salto da demanda base). Ação no store; botão no painel do Núcleo aparecendo só quando o portão abre.
**Testes:** o portão recusa com qualquer um dos três requisitos faltando; `avancarEra` preserva ₵/🔬/usinas/melhorias, troca o Núcleo, zera Estabilidade e calor, soma os 800 kW à demanda das vilas; o save v5 leva a Era 2 e volta.

## Passo 6 — Rede da Era 2 e escala em MW
Usinas, cidade e banco de baterias no `content/era2.ts`; `precoBase` lido do registry; `formatar.ts` ganha kW → MW → GW com vírgula decimal (sem mexer nas casas já testadas da Era 1).
**Testes:** receita da Era 2 com preço 0,1; formatação de 1 440 kW como "1,44 MW"; balança `r` com a demanda da cidade; Kardashev lê a potência instalada das duas eras somadas.

## Passo 7 — Cards, paleta e cena da Era 2
`content/cards-era2.ts` (transição, combustível esgotando, calor de decaimento) e os eventos que os disparam (`eraAvancada`, `combustivelBaixo`, `varetaGasta`). Tokens da paleta da Era 2; `GridScene` desenha vareta com barra de combustível, gasta com halo pulsando na meia-vida, gerador, bomba e pressurizador; zoom cósmico na transição, com fade em `prefers-reduced-motion`.
**Testes:** os eventos disparam uma vez cada e respeitam `cardsVistos`; o resto é verificação no navegador.

## Passo 8 — Fechamento
`npm run build`; `docs/ESTADO.md` com o que existe e o que ficou pendente; checklist da `sessao-5.md` marcado; lista de commits.

---

## Onde cortar, se a sessão ficar longa
Passos **0–5** entregam "a Era 2 por dentro" (o MVP mecânico: fissão, decaimento e a troca de era, testados). Passos **6–7** são a camada visível. O corte natural é depois do 5.

## Riscos conhecidos
1. **Passo 2 é o risco real.** É refatoração de tudo que hoje importa `era1-nucleo` direto. O critério de "os testes da Era 1 passam sem edição" existe para pegar regressão; se um deles quebrar, o passo para.
2. **`anel()` corta em 3.** Serve para 7×7. Uma grade 9×9 exigiria anel 4 — fora do escopo, vai para Pendências.
3. **Euler explícito no calor** (nota em `nucleo.ts`): o decaimento é um termo aditivo que não depende de `Q`, então não afeta a estabilidade do passo. O consumo dos geradores mantém `0,12 × n × dt ≪ 1`.
