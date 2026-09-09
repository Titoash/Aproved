# Correções do GDD — v0.4

Extraídas de `docs/sessoes/sessao-3.md` e aplicadas ao `docs/GDD-parte1.md` antes da Sessão 3.

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


## Onde foi aplicado
- `docs/GDD-parte1.md`: §3 (bateria), §4.1 (regra da bateria), §6 (medidor Kardashev), §7 (offline), §8.2 (Lâminas de fibra), §8.3 (Rastreamento solar), §12 (roteiro das Sessões 3 e 4), rodapé de versão.
