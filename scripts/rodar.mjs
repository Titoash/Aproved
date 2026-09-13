/**
 * Executa um script TypeScript do projeto pelo pipeline do Vite (resolve os imports sem extensão
 * como o app resolve). Uso: `node scripts/rodar.mjs scripts/simular.ts [args]`.
 */
import { createServer } from "vite";

const alvo = process.argv[2];
if (!alvo) {
  console.error("uso: node scripts/rodar.mjs <arquivo.ts> [args]");
  process.exit(1);
}

const servidor = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });
try {
  const mod = await servidor.ssrLoadModule(alvo.startsWith("/") ? alvo : `/${alvo}`);
  if (typeof mod.main === "function") await mod.main(process.argv.slice(3));
} finally {
  await servidor.close();
}
