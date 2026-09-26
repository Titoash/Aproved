/**
 * Uma linha de melhoria **por tipo** (GDD §7.1, v0.8): nome, quantas unidades o nível alcança, "Nv n", o
 * efeito do nível e o botão do próximo. Serve para usinas, peças do Núcleo, subestações, cabos e ciência.
 * Só lê o sim e despacha pelo store.
 */
import { avaliarMelhoria, custoProximoNivel, nivelDe, nivelMaximo, unidadesDe } from "../sim/melhorias";
import type { AlvoMelhoria } from "../sim/state";
import { useGameStore } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";
import { IconeItem } from "./icones";
import { descreverNivel } from "./niveis";

/** Botão do próximo nível do tipo ("Nv n+1" com o custo), ou a marca de nível máximo. */
export function BotaoNivel({ alvo }: { alvo: AlvoMelhoria }) {
  const state = useGameStore((s) => s.state);
  const melhorar = useGameStore((s) => s.melhorar);
  const n = nivelDe(state, alvo);
  const maximo = nivelMaximo(alvo);
  if (maximo !== null && n >= maximo) return <span className="marca-comprado">Nv {n} · máximo</span>;
  const avaliacao = avaliarMelhoria(state, alvo);
  return (
    <span title={avaliacao.motivo ?? undefined}>
      <BotaoCompra titulo={`Nv ${n + 1}`} custo={custoProximoNivel(state, alvo)} creditos={state.creditos} habilitado={avaliacao.ok} onClick={() => melhorar(alvo)} />
    </span>
  );
}

/** Linha da lista de melhorias. Não aparece enquanto não houver unidade do tipo (o nível não teria em quem valer). */
export function LinhaNivel({ alvo }: { alvo: AlvoMelhoria }) {
  const state = useGameStore((s) => s.state);
  const unidades = unidadesDe(state, alvo);
  if (unidades === 0) return null;
  const { nome, icone, efeito } = descreverNivel(state, alvo);
  const n = nivelDe(state, alvo);
  return (
    <li className="linha" data-nivel={`${alvo.tipo}${"id" in alvo ? `:${alvo.id}` : ""}`}>
      {icone ? <IconeItem id={icone} /> : null}
      <div className="linha-texto">
        <span className="linha-nome">
          {nome} <span className="marca-nivel">Nv {n}</span>
        </span>
        <span className="linha-meta">
          ×{unidades} · {efeito}
        </span>
      </div>
      <div className="linha-acoes">
        <BotaoNivel alvo={alvo} />
      </div>
    </li>
  );
}
