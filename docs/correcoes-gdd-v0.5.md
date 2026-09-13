# Correções do GDD — v0.5 (Sessão 5: ilha-tabuleiro e escalas)

Origem: a amostra visual aprovada pelo autor (ilha isométrica de 2048 casas com cara de infográfico científico, escada de escalas do planeta ao multiverso). O GDD v0.4 descrevia o Núcleo como uma grade solta sobre o fundo e parava em 10²⁷ W. As decisões abaixo foram tomadas pelo autor ("tudo aprovado") com os detalhes fixados por mim; estão marcadas para revisão onde a Parte 2 vai decidir de verdade.

## 1. Tabuleiro (§2.2, §2.4 novo)
- As duas camadas moram na **mesma ilha**: plataforma 7×7 do Núcleo no centro, regiões da Rede em volta. 2048 casas de terra, grade 52×52, forma por ruído com semente fixa por era.
- A Rede continua uma **lista** (não muda o contrato de §2.1): comprar coloca a usina numa vaga da região certa, de forma determinística pelas contagens.
- **Vagas** são o único limite novo: sem vaga da categoria, o botão avisa e o jogador compra um local. Locais não dão bônus. Saves antigos com mais usinas do que vagas continuam produzindo. Motivo: é a mecânica "novos locais" do Reactor citada em §1, e as vagas somadas (74 vento, 56 sol, 46 vila) ficam acima do que a economia da Era 1 compra, então a balança de §8 não muda.

## 2. Escalas (§2.4, §6)
- Escada de seis níveis: ilha, planeta, sistema, galáxia, universo, multiverso, alinhada aos tipos Kardashev I–V. Navegação livre; um nível **abre** pela potência instalada (10²⁶, 10³⁶, 10⁴⁶, 10⁵⁰ W).
- Régua do medidor vai de 10³ a **10⁵⁰ W**. Tipos IV e V são **especulativos** (ficção declarada): acima do Sol não há marco físico. Potência acima de 10²⁴ W em notação científica.
- Eras × níveis: 1–2 na ilha, 3 abre o planeta, 4–6 no sistema; galáxia em diante é prestígio (Parte 2). Uma câmera só: a transição de era é a transição da escada.
- Decisões adiadas para a Parte 2, já com uma resposta padrão registrada: o que é uma casa acima da ilha; Cascata acima da ilha perde a vaga, nunca o nível.

## 3. Regiões da Era 1 (§8.5 novo)
Tabela de regiões, vagas e preços (Planície ₵ 2,4 mil, Colinas ₵ 6,8 mil). Números em `src/content/era1-tabuleiro.ts`.

## 4. Direção de arte (§10)
Terreno, penhasco, lago, caminhos, regiões bloqueadas, fundo por nível, LOD e modo mapa; luz de cima-esquerda com o Sol no canto superior-esquerdo. Paleta do terreno nomeada.

## 5. Roteiro (§12)
Sessão 5 passa a ser o tabuleiro; a Era 2 vai para a Sessão 6; Era 3 abre o planeta; prestígio começa na galáxia.

## O que não mudou
Fórmulas de calor, Rede, bateria, offline, Cascata, preços das usinas e das peças, cards. A grade jogável do Núcleo continua 5×5 → 7×7 pela melhoria Grade 7×7; a plataforma 7×7 é só o palco dela.
