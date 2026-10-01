/**
 * Painel da Rede (GDD §2.1, v0.6): a lista de compra virou **paleta de construção** — escolhe-se um prédio e
 * toca-se numa casa do arquipélago. O nível **por tipo** (v0.8) mora na carta da paleta: "Nv n" no nome e o
 * botão do próximo nível embaixo (§7.1: nada de nível escondido em lista). Abaixo ficam o extrato, a cidade
 * e as ilhas, com a linha única dos cabos (todos sobem juntos).
 */
import { BATERIA, type Desbloqueio } from "../content/era1";
import { USINAS, ordemUsinas } from "../content/usinas";
import { BATERIA_REDE, DISTRITO_INDUSTRIAL, INSTITUTO, SUBESTACAO_138, SUBESTACAO_OFFSHORE } from "../content/era2";
import { BAIRRO, LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { NO_POR_ID } from "../content/arvore";
import { CABO, ILHAS, OBSTACULOS, SUBESTACAO, type IlhaId } from "../content/era1-arquipelago";
import { desbloqueado } from "../sim/acoes";
import { defDaCidade } from "../sim/cidade";
import { formatarCreditos, formatarNumero, formatarPotencia } from "../sim/formatar";
import { acumuladoDaUnidade, custoCabo, custoColocar, custoExpedicao, ilhaAberta, pesquisaColocar, podeComprarIlha, podeLigarCabo, temCabo, tetoCabo } from "../sim/mundo";
import { efeitosDe } from "../sim/arvore";
import { fatorUsina } from "../sim/niveis";
import { analisar } from "../sim/producao";
import { avaliarMelhoria, custoProximoNivel, nivelDe, nivelMaximo, unidadesDe } from "../sim/melhorias";
import type { AlvoMelhoria, GameState, TipoConstrucao } from "../sim/state";
import { useGameStore, type FerramentaMundo } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";
import { Extrato } from "./Extrato";
import { PainelCidade } from "./PainelCidade";
import { IconeCadeado, IconeItem } from "./icones";
import { LinhaNivel } from "./LinhaNivel";
import { alvoDoTipo, descreverNivel } from "./niveis";
import { rolarParaOTabuleiro } from "./rolagem";

function textoBloqueio(state: GameState, desbloqueio: Desbloqueio | undefined): string | null {
  if (desbloqueado(state, desbloqueio)) return null;
  const partes: string[] = [];
  const analise = analisar(state);
  if (desbloqueio?.usina) {
    const [id, n] = desbloqueio.usina;
    const nome = n === 1 ? USINAS[id].nome : USINAS[id].nomePlural;
    if (analise.contagem[id] < n) partes.push(`${n} ${nome.toLowerCase()} (${analise.contagem[id]}/${n})`);
  }
  if (desbloqueio?.no !== undefined) {
    const no = NO_POR_ID[desbloqueio.no];
    partes.push(`o nó "${no?.nome ?? desbloqueio.no}" da árvore (🔬 ${no?.pesquisa ?? 0})`);
  }
  return `Desbloqueia com ${partes.join(" e ")}`;
}

interface ItemPaleta {
  id: FerramentaMundo;
  nome: string;
  detalhe: string;
  desbloqueio?: Desbloqueio;
}

function itensDaPaleta(state: GameState): ItemPaleta[] {
  const itens: ItemPaleta[] = ordemUsinas(state.era).map((id) => ({
    id,
    nome: USINAS[id].nome,
    detalhe: `${formatarPotencia(USINAS[id].potenciaKw * fatorUsina(state.melhorias.usinas[id]) * efeitosDe(state).potencia[id])} por unidade${USINAS[id].lado === 2 ? " · 2×2" : ""}${USINAS[id].agua ? " · mar raso" : ""}${USINAS[id].combustivelPorSegundo ? ` · ${formatarCreditos(USINAS[id].combustivelPorSegundo)}/s de gás` : ""}`,
    desbloqueio: USINAS[id].desbloqueio,
  }));
  // O bairro novo nasce na densidade da cidade (v0.8).
  const cidade = defDaCidade(state);
  itens.push({ id: "bairro", nome: BAIRRO.nome, detalhe: `${cidade.nome} · +${formatarPotencia(cidade.demandaKw)} · ${formatarNumero(cidade.populacao, 0)} hab` });
  itens.push({ id: "subestacao", nome: SUBESTACAO.nome, detalhe: `alcance ${efeitosDe(state).alcanceSubestacao} · teto ${formatarPotencia(SUBESTACAO.tetoKw)}` });
  itens.push({ id: "bateria", nome: BATERIA.nome, detalhe: `+${BATERIA.capacidadeKwh} kWh · ±${formatarPotencia(BATERIA.potenciaKw)}`, desbloqueio: BATERIA.desbloqueio });
  itens.push({ id: "laboratorio", nome: LABORATORIO.nome, detalhe: `🔬 ${LABORATORIO.pesquisaPorSegundo}/s · −${formatarPotencia(LABORATORIO.consumoKw)}`, desbloqueio: { no: "laboratorio" } });
  itens.push({
    id: "universidade",
    nome: UNIVERSIDADE.nome,
    detalhe: `🔬 pela raiz dos alunos · −${formatarPotencia(UNIVERSIDADE.consumoKw)}`,
    desbloqueio: { no: "universidade" },
  });
  if (state.era >= 2) {
    itens.push({ id: "subestacao138", nome: SUBESTACAO_138.nome, detalhe: `alcance ${SUBESTACAO_138.alcance} · teto ${formatarPotencia(SUBESTACAO_138.tetoKw)}`, desbloqueio: { no: "subestacaoDe138kV" } });
    itens.push({ id: "subestacaoOffshore", nome: SUBESTACAO_OFFSHORE.nome, detalhe: `mar raso · alcance ${SUBESTACAO_OFFSHORE.alcance} · teto ${formatarPotencia(SUBESTACAO_OFFSHORE.tetoKw)}`, desbloqueio: { no: "subestacaoOffshore" } });
    itens.push({ id: "bateriaRede", nome: BATERIA_REDE.nome, detalhe: `+${formatarNumero(BATERIA_REDE.capacidadeKwh, 0)} kWh · ±${formatarPotencia(BATERIA_REDE.potenciaKw)}`, desbloqueio: BATERIA_REDE.desbloqueio });
    itens.push({ id: "distritoIndustrial", nome: DISTRITO_INDUSTRIAL.nome, detalhe: `2×2 · +${formatarPotencia(DISTRITO_INDUSTRIAL.demandaKw)} · tarifa ×${formatarNumero(DISTRITO_INDUSTRIAL.tarifa, 1)}`, desbloqueio: DISTRITO_INDUSTRIAL.desbloqueio });
    itens.push({ id: "institutoPesquisa", nome: INSTITUTO.nome, detalhe: `2×2 · 🔬 ${INSTITUTO.pesquisaPorSegundo}/s · −${formatarPotencia(INSTITUTO.consumoKw)}`, desbloqueio: INSTITUTO.desbloqueio });
  }
  return itens;
}

/**
 * Faixa do nível no pé da carta (v0.8): o botão do próximo nível é irmão do rádio, nunca dentro dele, para
 * o clique no centro da carta continuar sendo "escolher o prédio". Sem unidade colocada, não aparece.
 */
function BarraNivelPaleta({ alvo }: { alvo: AlvoMelhoria }) {
  const state = useGameStore((s) => s.state);
  const melhorar = useGameStore((s) => s.melhorar);
  if (unidadesDe(state, alvo) === 0) return null;
  const n = nivelDe(state, alvo);
  const maximo = nivelMaximo(alvo);
  const { nome, efeito } = descreverNivel(state, alvo);
  // A carta já mostra o número com o nível (kW por unidade, teto); só a Equipe precisa dizer quantos Bipes.
  const rotulo = alvo.tipo === "equipe" ? efeito : `Nv ${n}`;
  if (maximo !== null && n >= maximo) {
    return (
      <span className="paleta-nivel paleta-nivel--max" data-nivel={alvo.tipo} title={efeito}>
        <span className="paleta-nivel-efeito">{rotulo}</span>
        <span>máximo</span>
      </span>
    );
  }
  const v = avaliarMelhoria(state, alvo);
  const custo = custoProximoNivel(state, alvo);
  return (
    <button
      type="button"
      className="paleta-nivel"
      data-nivel={alvo.tipo}
      disabled={!v.ok}
      aria-label={`Subir ${nome} para o nível ${n + 1}`}
      title={v.motivo ?? `${efeito} agora; o nível vale para todas as unidades do tipo, inclusive as que vierem`}
      onClick={() => melhorar(alvo)}
    >
      <span className="paleta-nivel-efeito">{rotulo}</span>
      <span className="paleta-nivel-botao">
        ↑ Nv {n + 1} <span className={state.creditos < custo ? "pilula-custo--caro" : ""}>{formatarCreditos(custo)}</span>
      </span>
    </button>
  );
}

function BotaoPaleta({ item }: { item: ItemPaleta }) {
  const state = useGameStore((s) => s.state);
  const ferramenta = useGameStore((s) => s.ferramentaMundo);
  const selecionar = useGameStore((s) => s.selecionarFerramentaMundo);
  const bloqueio = textoBloqueio(state, item.desbloqueio);
  const tipo = item.id as TipoConstrucao;
  const custo = custoColocar(state, tipo);
  const pesquisa = pesquisaColocar(state, tipo);
  const caro = state.creditos < custo || state.pesquisa < pesquisa;
  const alvo = alvoDoTipo(tipo);
  const nivel = alvo ? nivelDe(state, alvo) : 0;
  // subestação e ciência novas pagam o nível que o tipo já tem (§7.1, revisão da v0.9)
  const doNivel = tipo !== "bairro" ? acumuladoDaUnidade(state, tipo) : 0;
  return (
    <div className={`paleta-carta ${alvo && !bloqueio ? "paleta-carta--nivel" : ""}`}>
      <button
        type="button"
        role="radio"
        aria-checked={ferramenta === item.id}
        className={`paleta-item ${ferramenta === item.id ? "paleta-item--ativa" : ""} ${bloqueio ? "paleta-item--bloqueada" : ""}`}
        disabled={!!bloqueio}
        title={bloqueio ?? item.detalhe}
        onClick={() => {
          selecionar(item.id);
          rolarParaOTabuleiro();
        }}
      >
        <IconeItem id={item.id as never} />
        <span className="paleta-nome">
          {item.nome}
          {/* com unidade colocada o "Nv n" vai na faixa de baixo; sem nenhuma, o nível guardado aparece aqui */}
        {nivel > 0 && alvo && unidadesDe(state, alvo) === 0 ? <span className="marca-nivel">Nv {nivel}</span> : null}
        </span>
        {bloqueio ? (
          <span className="paleta-custo paleta-custo--bloqueio">
            <IconeCadeado /> {bloqueio.replace("Desbloqueia com ", "")}
          </span>
        ) : (
          <span
            className={`paleta-custo ${caro ? "pilula-custo--caro" : ""}`}
            title={doNivel > 0 ? `${formatarCreditos(custo - doNivel)} da unidade + ${formatarCreditos(doNivel)} do Nv ${nivel} do tipo` : undefined}
          >
            {formatarCreditos(custo)}
            {pesquisa > 0 ? ` · 🔬 ${formatarNumero(pesquisa, 0)}` : ""}
            {doNivel > 0 ? ` · com Nv ${nivel}` : ""}
          </span>
        )}
        <span className="paleta-detalhe">{item.detalhe}</span>
      </button>
      {alvo && !bloqueio ? <BarraNivelPaleta alvo={alvo} /> : null}
    </div>
  );
}

function Ferramentas() {
  const ferramenta = useGameStore((s) => s.ferramentaMundo);
  const selecionar = useGameStore((s) => s.selecionarFerramentaMundo);
  const opcoes: { id: FerramentaMundo; nome: string; detalhe: string; icone: "remover" | "arvore" }[] = [
    { id: "remover", nome: "Remover", detalhe: "devolve 50 % do custo", icone: "remover" },
    {
      id: "desmatar",
      nome: "Desmatar",
      detalhe: `árvore ${formatarCreditos(OBSTACULOS.arvore.custo)} · arraste para uma área`,
      icone: "arvore",
    },
  ];
  return (
    <div className="paleta paleta--ferramentas" role="radiogroup" aria-label="Ferramentas">
      {opcoes.map((o) => (
        <div key={o.id} className={`paleta-carta ${o.id === "desmatar" ? "paleta-carta--nivel" : ""}`}>
          <button
            type="button"
            role="radio"
            aria-checked={ferramenta === o.id}
            className={`paleta-item ${ferramenta === o.id ? "paleta-item--ativa" : ""}`}
            title={o.detalhe}
            onClick={() => {
              selecionar(o.id);
              rolarParaOTabuleiro();
            }}
          >
            <IconeItem id={o.icone} />
            <span className="paleta-nome">{o.nome}</span>
            <span className="paleta-detalhe">{o.detalhe}</span>
          </button>
          {o.id === "desmatar" ? <BarraNivelPaleta alvo={{ tipo: "equipe" }} /> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Uma ilha do arquipélago: expedição (₵), cabo submarino (₵ 150 + ₵ 120 por casa de mar) e o nível do
 * cabo. O cabo tem teto próprio de kW: ligar não basta, é preciso dimensionar (GDD §8.5).
 */
function LinhaIlha({ id }: { id: IlhaId }) {
  const state = useGameStore((s) => s.state);
  const comprarIlha = useGameStore((s) => s.comprarIlha);
  const ligarCabo = useGameStore((s) => s.ligarCabo);
  const def = ILHAS.find((i) => i.id === id);
  if (!def || def.expedicao === null) return null;
  const aberta = ilhaAberta(state.mundo, id);
  const cabo = temCabo(state.mundo, id);
  const usado = analisar(state).cabos.find((c) => c.ilha === id);
  return (
    <li className={`linha ${cabo ? "linha--comprada" : ""}`}>
      <div className="linha-texto">
        <span className="linha-nome">
          {def.nome}
          {aberta ? <span className="marca-comprado"> ✔ aberta</span> : null}
          {cabo ? <span className="marca-comprado"> ✔ cabo</span> : null}
        </span>
        <span className="linha-meta">
          {cabo && usado
            ? `cabo ${formatarPotencia(usado.usadoKw)} de ${formatarPotencia(usado.tetoKw)} · ${def.descricao}`
            : `${def.casas} casas · ${def.descricao}`}
        </span>
      </div>
      <div className="linha-acoes">
        {!aberta ? (
          <BotaoCompra titulo="Expedição" custo={custoExpedicao(id) ?? 0} creditos={state.creditos} habilitado={podeComprarIlha(state, id)} variante="primario" onClick={() => comprarIlha(id)} />
        ) : !cabo ? (
          <BotaoCompra
            titulo={`Ligar cabo (${formatarPotencia(tetoCabo(state.melhorias.cabos, efeitosDe(state)))})`}
            custo={custoCabo(id)}
            creditos={state.creditos}
            habilitado={podeLigarCabo(state, id)}
            variante="primario"
            onClick={() => ligarCabo(id)}
          />
        ) : null}
      </div>
    </li>
  );
}

export function PainelRede() {
  const estado = useGameStore((s) => s.state);
  const itens = itensDaPaleta(estado);
  return (
    <section className="rede" aria-label="Rede">
      <h2>Construir</h2>
      <p className="rede-dica">Escolha e toque numa casa. Cada casa é uma decisão: terreno, vizinhos e escoamento mudam o que ela rende.</p>
      <div className="paleta" role="radiogroup" aria-label="Paleta de construção">
        {itens.map((item) => (
          <BotaoPaleta key={item.id} item={item} />
        ))}
      </div>
      <Ferramentas />

      <h2 className="rede-subtitulo">Extrato</h2>
      <Extrato />

      <PainelCidade />

      <h2 className="rede-subtitulo">Ilhas</h2>
      <p className="rede-dica">
        A expedição abre a ilha; o cabo ({formatarCreditos(CABO.custoFixo)} + {formatarCreditos(CABO.custoPorCasa)} por casa de mar) leva a energia dela à rede principal — até o teto dele ({formatarPotencia(CABO.tetoKw)}, ×2 por nível; todos os cabos sobem juntos).
      </p>
      <ul className="lista">
        <LinhaNivel alvo={{ tipo: "cabos" }} />
        {ILHAS.filter((i) => i.expedicao !== null).map((i) => (
          <LinhaIlha key={i.id} id={i.id} />
        ))}
      </ul>

    </section>
  );
}
