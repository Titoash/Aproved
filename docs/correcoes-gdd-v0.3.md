# Correções do GDD — v0.3

> **Reconstruído.** O arquivo original não estava no repositório nem no upload quando a Sessão 2 começou. Este texto foi deduzido de `docs/sessoes/sessao-2.md` (tabela de `Q*`, critérios de pronto e armadilhas), que fixa os valores corretos. Se a versão original divergir, ela vence: substitua este arquivo e reaplique.

Três números do §8.3 não fecham com as definições das peças do próprio §8.3. Com `h` espelhos efetivos, `t` turbinas e `rad` radiadores adjacentes:

```
dQ/dt = 4·h − 6·rad − 0,12·t·Q        →        Q* = (4·h − 6·rad) ÷ (0,12·t)
```

## 1. Potência do exemplo da zona de ouro (§8.3)
- **Estava:** "4 espelhos no anel 1 + 2 no anel 2 (h = 5), 2 turbinas → Q ≈ 83 → zona de ouro, ~8 kW."
- **Certo:** cada turbina gera `0,12 × Q × 0,8` = 8 kW com Q = 83,3. São **2 turbinas: ~16 kW**. Os 8 kW eram por turbina.

## 2. `h = 6` não cascateia (§8.3, §11 e regra 2 do `CLAUDE.md`)
- **Estava:** "+2 espelhos (h = 6) → Q = 100 → Cascata em 5 s", e o teste obrigatório "6 espelhos efetivos + 2 turbinas cascateiam em 5 s".
- **Certo:** com h = 6 e t = 2, `Q* = 100` exatamente. A aproximação é assintótica: `Q` chega a 100 % e **nunca passa**, então o cronômetro da Cascata (T > 100 %) não dispara. O teste era impossível.
- **Novo texto:** "+2 espelhos (h = 6) → Q → 100 (encosta no limite, alerta permanente, sem Cascata). +2,5 espelhos (h = 6,5) → Q* = 108 → **Cascata 5 s depois de T passar de 100 %**."
- **Teste obrigatório:** "**6,5** espelhos efetivos + 2 turbinas cascateiam em 5 s (partindo do equilíbrio de h = 6)". E o par de guarda: "h = 6 estabiliza em 100 % e não cascateia em 120 s".

## 3. A constante do equilíbrio (§8.3)
- **Estava:** "o calor converge para `Q = 33 × h ÷ t`". Com h = 6 e t = 2 isso dá 99, não 100, e os exemplos deixam de fechar.
- **Certo:** `Q* = 4·h ÷ (0,12·t) = 33,3 × h ÷ t` (dízima). Sempre calcular a partir das constantes das peças, nunca da constante arredondada.

## Tabela de referência (t = 2, sem radiador, capacidade 100)
| h | Q* | T | Faixa |
|---|---|---|---|
| 5 | 83,3 | 83 % | ouro |
| 5,5 | 91,7 | 92 % | alerta |
| 6 | 100,0 | 100 % | limite exato, sem Cascata |
| 6,5 | 108,3 | 108 % | Cascata em 5 s |
| 6,5 + 1 radiador | 83,3 | 83 % | ouro |

## Onde foi aplicado
- `docs/GDD-parte1.md`: §8.3 (equilíbrio e exemplos), §11 (exemplo de teste), rodapé de versão.
- `CLAUDE.md`: regra 2 (teste obrigatório da Sessão 2).
