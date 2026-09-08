# Sessão 1 — Scaffold + Rede da Era 1

## Objetivo
Projeto rodando com a camada **Rede** da Era 1 jogável: comprar usinas e vilas, ver a balança Oferta × Demanda mudar o preço, créditos acumulando em tempo real, progresso salvo. Sem grade ainda (a grade é a Sessão 2).

Referências no GDD: §3 (recursos), §4.1 (balança da Rede), §7 (economia), §8.1–8.2 (Era 1: estado inicial e Rede), §10 (tokens de arte), §11 (arquitetura).

## Entregas
1. **Scaffold:** `npm create vite@latest . -- --template react-ts`; instalar `phaser`, `zustand`; dev: `vitest`. Scripts `test`, `typecheck` (`tsc --noEmit`), `build`. Estrutura de pastas do `CLAUDE.md`.
2. **`src/sim/`**
   - `state.ts` — tipos (esboço abaixo) e `estadoInicial()` com ₵ 50, demanda 5 kW, potência 0.
   - `tick.ts` — `tick(state, dtMs): state` em timestep fixo de 100 ms; loop com `requestAnimationFrame` + acumulador; dt acumulado limitado a 5 s.
   - `rede.ts` — potência ofertada, demanda, `r`, multiplicador de preço por faixa (GDD §4.1), bateria (carrega com excedente, descarrega em déficit), receita/s.
   - `custos.ts` — custo da n-ésima unidade e da melhoria (GDD §7).
   - `formatar.ts` — `formatarPotencia(kW)` → "1,2 MW", `formatarCreditos(n)` → "₵ 12,5 mil", PT-BR com vírgula decimal e prefixos SI.
   - `save.ts` — `localStorage` a cada 10 s, campo `versao`, exportar/importar JSON. Único arquivo que toca `localStorage`.
3. **`src/content/era1.ts`** — usinas, bateria e vila com os números exatos do GDD §8.2 (inclusive desbloqueios por quantidade; desbloqueio por pesquisa fica como campo, sem efeito ainda).
4. **`src/store/`** — Zustand com o snapshot do estado e ações `comprarUsina`, `melhorarUsina`, `comprarVila`, `comprarBateria`.
5. **`src/ui/`** — HUD (₵ e ₵/s, ⚡ ofertada, 🏙 demanda, `r` com a faixa colorida, 🔋 carga/capacidade) e lista da Rede (nome, quantidade, potência total, botão comprar com custo, botão melhorar com custo e nível). Tokens do GDD §10 aplicados de forma simples: fundo navy, cards, tipografia, cor da faixa de `r` (apagão coral, ouro `--sun`, saturação `--sky`).
6. **Phaser:** um componente `GameCanvas` que monta uma cena vazia com o fundo (navy com gradiente radial e estrelas). Nada de grade.
7. **Testes Vitest:**
   - custo da n-ésima unidade e da melhoria;
   - multiplicador de preço por faixa de `r` (0,7 → ×0,5; 1,0 → ×1,25; 1,3 → ×0,75; 1,15 → ×1);
   - bateria carrega com excedente e descarrega em déficit, respeitando a capacidade;
   - 100 ticks (10 s) com 5 kW vendidos a preço 1,0 e `r` neutro rendem ₵ 50.

## Esboço de tipos (ajuste nomes se precisar, mantenha a ideia)
```ts
type UsinaId = "cataVento" | "painelSolar" | "turbinaEolica";

interface GameState {
  versao: number;
  tempoMs: number;
  creditos: number;
  pesquisa: number;
  era: 1;
  rede: RedeState;
  nucleo: null; // Sessão 2
}

interface RedeState {
  usinas: Record<UsinaId, { quantidade: number; nivel: number }>;
  vilas: number;
  demandaBaseKw: number;
  bateria: { kwh: number; capacidadeKwh: number; unidades: number };
}

interface UsinaDef {
  id: UsinaId;
  nome: string;
  custoBase: number;
  crescimento: number; // 1,15
  potenciaKw: number;
  desbloqueio?: { usina?: [UsinaId, number]; pesquisa?: number };
}
```

## Critérios de pronto
- [x] `npm run dev` abre; comprar cata-vento aumenta ⚡ e ₵/s.
- [x] Com 5 kW de demanda inicial, passar de 6,25 kW mostra **saturação** e o preço cai; comprar Vila resolve. Abaixo de 0,8 mostra **apagão**.
- [x] Bateria visível carregando com excedente e descarregando em déficit.
- [x] Recarregar a página mantém o progresso; exportar/importar JSON funciona.
- [x] Números formatados em PT-BR com prefixos SI.
- [x] `npm test`, `npm run typecheck`, `npm run build` passam.
- [x] `docs/ESTADO.md` atualizado com o que existe e o que ficou pendente.

## Fora de escopo — não faça nesta sessão
Grade/Núcleo, pesquisa com efeito, Cascata, Estabilidade, cards explicativos, medidor Kardashev, cálculo offline, som, Era 2, Bipes.

## Armadilhas conhecidas
- **StrictMode** monta duas vezes em dev: guarde a instância do Phaser em um `ref` e chame `destroy(true)` no cleanup.
- **Aba em segundo plano:** o `requestAnimationFrame` pausa; ao voltar, limite o dt acumulado a 5 s. O cálculo offline de verdade é a Sessão 3.
- **Ponto flutuante:** acumule créditos como `number` sem arredondar; arredonde só na formatação.
- **Ordem no tick:** produção → venda até a demanda → bateria (excedente/déficit) → receita com multiplicador de `r`. Sempre nessa ordem, para os testes baterem.

## Prompt para colar no Claude Code
> Leia `CLAUDE.md`, `docs/GDD-parte1.md` e `docs/sessoes/sessao-1.md`. Monte um plano em passos numerados para cumprir **só** a Sessão 1 e me mostre antes de executar. Depois implemente passo a passo, rodando `typecheck` e `test` a cada passo, e termine atualizando `docs/ESTADO.md`.
