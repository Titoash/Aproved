# Correções ao GDD v0.2 — aplicar antes da Sessão 2

Três problemas encontrados na conferência do §8.3 contra as próprias definições das peças. Os dois primeiros quebram testes; o terceiro muda o ritmo da era pela metade.

---

## 1. O teste obrigatório do `CLAUDE.md` é matematicamente impossível

**Onde:** `CLAUDE.md` §"Regras que não se negociam", item 2 — *"6 espelhos efetivos + 2 turbinas cascateiam em 5 s"*. E GDD §8.3, terceiro exemplo — *"+2 espelhos (h = 6) → Q = 100 → Cascata em 5 s"*.

**O problema:** pelas definições das peças, a dinâmica do calor é

```
dQ/dt = 4·h − 6·rad − 0,12·t·Q
```

com `h` = espelhos efetivos (anel 1 = 1, anel 2 = 0,5), `rad` = radiadores adjacentes, `t` = turbinas.

O equilíbrio é `Q* = (4h − 6·rad) / (0,12·t)`. Com `h = 6`, `t = 2`, `rad = 0`:

```
Q* = 24 / 0,24 = 100,0
```

Exatamente a capacidade. E a aproximação é **assintótica**: `Q(τ) = 100·(1 − e^(−0,24τ))` a partir do zero. O calor tende a 100 % e **nunca ultrapassa**, nem em 5 s nem em uma hora. Como o gatilho da Cascata é "> 100 % por 5 s", essa configuração nunca cascateia. Trocar o gatilho para "≥ 100 %" também não resolve: o limite nunca é atingido em tempo finito.

**Correção:** `h = 6` é exatamente a **fronteira**, não a falha. O menor passo que ultrapassa é adicionar um espelho de **anel 2** (`h = 6,5`):

```
Q* = 26 / 0,24 = 108,3  →  T passa de 100 % imediatamente  →  Cascata 5 s depois
```

Substituir o exemplo do GDD §8.3 por:

| Configuração | Q* | Resultado |
|---|---|---|
| h = 5 (4 no anel 1 + 2 no anel 2), t = 2 | 83,3 | **zona de ouro** |
| h = 5,5, t = 2 | 91,7 | alerta |
| **h = 6, t = 2** | **100,0** | **limite exato — alerta permanente, nunca cascateia** |
| **h = 6,5, t = 2** | **108,3** | **Cascata 5 s depois** |
| h = 6,5, t = 2, **1 radiador** | 83,3 | volta para a zona de ouro |

E trocar o teste obrigatório do `CLAUDE.md` por um **par**, que é mais forte porque fixa a assíntota *e* o gatilho:

> "h = 6 com 2 turbinas estabiliza em 100 % e não cascateia em 120 s; acrescentar um espelho de anel 2 dispara a Cascata 5 s depois."

## 2. A constante é 100/3, não 33

**Onde:** GDD §8.3, *"o calor converge para Q = 33 × h ÷ t"*.

`4 / 0,12 = 33,333…`. Com 33 cravado, `h = 6, t = 2` dá 99 em vez de 100 e o exemplo do limite exato deixa de ser exato.

**Correção:** escrever a fórmula como `Q* = (4h − 6·rad) / (0,12·t)` e derivar a constante dos dados de `src/content/`. Nunca escrever `33` (nem `33,33`) no código.

## 3. Ambiguidade nos "~8 kW" — muda o ritmo da era pela metade

**Onde:** GDD §8.3, *"h = 5, 2 turbinas → Q ≈ 83 → zona de ouro, ~8 kW"*.

A turbina consome `0,12 × Q` u/s e gera `0,8 kW` por unidade consumida. Com `Q = 83,3`:

```
por turbina: 0,12 × 83,3 = 10 u/s  →  10 × 0,8 = 8 kW
duas turbinas:                                    16 kW
```

Ou seja, **8 kW é por turbina**; o total da configuração é 16 kW. Como `pesquisa/s = potência do Núcleo ÷ 10 × multiplicador da zona`, a diferença é grande:

| Leitura | Núcleo | 🔬/s na zona de ouro | 🔬 3 000 em |
|---|---|---|---|
| 8 kW no total | 8 kW | 1,04 | **48 min** |
| 16 kW no total | 16 kW | 2,08 | **24 min** |

O §8.4 promete "30–50 min". Só a primeira leitura cumpre — mas ela contradiz os números das peças.

**Correção:** assumir 16 kW (as peças mandam) e escolher um dos dois ajustes:
- **(a)** trocar §8.4 para "🔬 3 000 leva 20–30 min de operação"; ou
- **(b)** baixar a turbina para `0,4 kW por unidade consumida`, mantendo os 30–50 min.

Recomendo **(a)**: mexer no rendimento da turbina reequilibra toda a economia da Era 1 e ainda desalinha o medidor Kardashev. E 24 min de Núcleo somados ao tempo de Rede já dão os ~60 min por era do §7.

---

## Ajustes menores que valem entrar junto

- **Anel 1 e anel 2 precisam de definição explícita.** Anel 1 = as 8 casas vizinhas do Receptor (incluindo diagonais). Anel 2 = as 16 casas restantes do 5×5. Sem isso escrito, `h` fica ambíguo e nenhum teste é reproduzível.
- **O calor tem que poder passar de 100 %.** O gatilho "> 100 % por 5 s" exige que `Q` acumule acima da capacidade em vez de ser truncado. Dizer isso no §4.2.
- **Tanque de sal fundido empurra para fora da zona de ouro.** Ele aumenta a capacidade sem mudar `Q*`: com um tanque, `T = 100 / 250 = 40 %` — sai da faixa 70–90 % e a pesquisa cai para ×0,5. Isso é uma boa tensão de projeto (o tanque compra margem e cobra em pesquisa), mas é contraintuitivo e precisa de card explicativo. Registrar no §8.3.
- **Bateria e Turbina eólica ficaram órfãs na Sessão 1.** Ambas desbloqueiam por 🔬 (20 e 40) e a Pesquisa só nasce no Núcleo, que é a Sessão 2. O critério de pronto da Sessão 1 que pede "bateria visível carregando" só se cumpre se a bateria começar liberada. Ou libera a bateria desde o início, ou o critério migra para a Sessão 2.
