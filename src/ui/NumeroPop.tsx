import { useEffect, useRef, useState, type ReactNode } from "react";

/** Só o número que mudou faz um "pop" de 180 ms; nada mais se mexe. */
export function NumeroPop({ valor, children }: { valor: number | string; children: ReactNode }) {
  const anterior = useRef(valor);
  const [chave, setChave] = useState(0);
  useEffect(() => {
    if (anterior.current !== valor) {
      anterior.current = valor;
      setChave((k) => k + 1);
    }
  }, [valor]);
  return (
    <span key={chave} className={chave > 0 ? "pop" : undefined}>
      {children}
    </span>
  );
}
