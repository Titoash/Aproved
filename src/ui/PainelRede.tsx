/**
 * Painel da Rede (GDD §2.1, v0.6): a lista de compra virou **paleta de construção** — escolhe-se um prédio e
 * toca-se numa casa do arquipélago. Abaixo dela ficam o extrato, as ilhas (expedição e cabo) e os níveis
 * **por tipo** (v0.8): usinas, subestações, cabos e ciência sobem todos juntos.
 */
import { BATERIA, type Desbloqueio } from "../content/era1";
import { USINAS, ordemUsinas } from "../content/usinas";
import { BATERIA_REDE, DISTRITO_INDUSTRIAL, INSTITUTO, SUBESTACAO_138, SUBESTACAO_OFFSHORE } from "../content/era2";
import { BAIRRO, LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { NO_POR_ID } from "../content/arvore";
import { CABO, ILHAS, OBSTACULOS, SUBESTACAO, type IlhaId } from "../content/era1-arquipelago";
import { TIPOS_CIENCIA } from "../content/melhorias";
import { desbloqueado } from "../sim/acoes";
import { defDaCidade } from "../sim/cidade";
import { formatarCreditos, formatarNumero, formatarPotencia } from "../sim/formatar";
import { custoCabo, custoColocar, custoExpedicao, ilhaAberta, pesquisaColocar, podeComprarIlha, podeLigarCabo, temCabo, tetoCabo } from "../sim/mundo";
import { efeitosDe } from "../sim/arvore";
import { fatorUsina } from "../sim/niveis";
import { analisar } from "../sim/producao";
import type { GameState, TipoConstrucao, TipoSubestacao } from "../sim/state";
import { useGameStore, type FerramentaMundo } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";
import { Extrato } from "./Extrato";
import { PainelCidade } from "./PainelCidade";
import { IconeCadeado, IconeItem } from "./icones";
import { LinhaNivel } from "./LinhaNivel";
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

function BotaoPaleta({ item }: { item: ItemPaleta }) {
  const state = useGameStore((s) => s.state);
  const ferramenta = useGameStore((s) => s.ferramentaMundo);
  const selecionar = useGameStore((s) => s.selecionarFerramentaMundo);
  const bloqueio = textoBloqueio(state, item.desbloqueio);
  const custo = custoColocar(state, item.id as TipoConstrucao);
  const pesquisa = pesquisaColocar(state, item.id as TipoConstrucao);
  const caro = state.creditos < custo || state.pesquisa < pesquisa;
  return (
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
      <span className="paleta-nome">{item.nome}</span>
      {bloqueio ? (
        <span className="paleta-custo paleta-custo--bloqueio">
          <IconeCadeado /> {bloqueio.replace("Desbloqueia com ", "")}
        </span>
      ) : (
        <span className={`paleta-custo ${caro ? "pilula-custo--caro" : ""}`}>
          {formatarCreditos(custo)}
          {pesquisa > 0 ? ` · 🔬 ${formatarNumero(pesquisa, 0)}` : ""}
        </span>
      )}
      <span className="paleta-detalhe">{item.detalhe}</span>
    </button>
  );
}

function Ferramentas() {
  const ferramenta = useGameStore((s) => s.ferramentaMundo);
  const selecionar = useGameStore((s) => s.selecionarFerramentaMundo);
  const opcoes: { id: FerramentaMundo; nome: string; detalhe: string; icone: "remover" | "arvore" }[] = [
    { id: "remover", nome: "Remover", detalhe: "devolve 50 % do custo", icone: "remover" },
    { id: "desmatar", nome: "Desmatar", detalhe: `árvore ${formatarCreditos(OBSTACULOS.arvore.custo)} · pedra ${formatarCreditos(OBSTACULOS.pedra.custo)}`, icone: "arvore" },
  ];
  return (
    <div className="paleta paleta--ferramentas" role="radiogroup" aria-label="Ferramentas">
      {opcoes.map((o) => (
        <button
          key={o.id}
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

const SUBESTACOES: readonly TipoSubestacao[] = ["subestacao", "subestacao138", "subestacaoOffshore"];

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
        A expedição abre a ilha; o cabo ({formatarCreditos(CABO.custoFixo)} + {formatarCreditos(CABO.custoPorCasa)} por casa de mar) leva a energia dela à rede principal — até o teto dele ({formatarPotencia(CABO.tetoKw)}, ×2 por nível; todos os cabos sobem juntos, em Níveis).
      </p>
      <ul className="lista">
        {ILHAS.filter((i) => i.expedicao !== null).map((i) => (
          <LinhaIlha key={i.id} id={i.id} />
        ))}
      </ul>

      <h2 className="rede-subtitulo">Níveis</h2>
      <p className="rede-dica">Cada nível vale para todas as unidades do tipo. O degrau seguinte ao último nível é da árvore de pesquisa.</p>
      <ul className="lista">
        {ordemUsinas(estado.era).map((id) => (
          <LinhaNivel key={id} alvo={{ tipo: "usina", id }} />
        ))}
        {SUBESTACOES.map((id) => (
          <LinhaNivel key={id} alvo={{ tipo: "subestacao", id }} />
        ))}
        <LinhaNivel alvo={{ tipo: "cabos" }} />
        {TIPOS_CIENCIA.map((id) => (
          <LinhaNivel key={id} alvo={{ tipo: "ciencia", id }} />
        ))}
      </ul>
    </section>
  );
}
