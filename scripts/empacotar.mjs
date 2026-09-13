// Empacota dist-artifact/ num único HTML (fragmento para publicar como artifact): JS, CSS e fontes embutidos.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const dist = join(raiz, "dist-artifact");
const js = readFileSync(join(dist, "kardashev.js"), "utf8").replace(/<\/script/gi, "<\\/script");
let css = readFileSync(join(dist, "kardashev.css"), "utf8");
for (const fonte of ["Outfit", "Nunito"]) {
  const b64 = readFileSync(join(raiz, "public", "fonts", `${fonte}-latin.woff2`)).toString("base64");
  // o Vite emite `url(./fonts/…)`; qualquer caminho até o arquivo vira a fonte embutida
  css = css.replace(new RegExp(`url\\((["']?)[^)"']*${fonte}-latin\\.woff2\\1\\)`, "g"), `url("data:font/woff2;base64,${b64}")`);
}
const html = [
  "<title>KARDASHEV</title>",
  `<style>${css}</style>`,
  '<div id="root"></div>',
  `<script type="module">${js}</script>`,
  "",
].join("\n");
const saida = join(dist, "kardashev.html");
writeFileSync(saida, html);
const extras = readdirSync(dist).filter((f) => !["kardashev.js", "kardashev.css", "kardashev.html", "index.html", "favicon.svg", "fonts"].includes(f));
console.log(`escrito ${saida} (${(html.length / 1024).toFixed(0)} KB)` + (extras.length ? `; arquivos não embutidos: ${extras.join(", ")}` : ""));
