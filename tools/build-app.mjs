/* Builds each app into one self-contained HTML file: the React code, Tone.js,
   the piano samples and the CSS, all inline, so it runs from any static host
   or straight from disk.

     npm run build            → build/sketchpad-app.html, build/j6-app.html
     npm run site             → dist/ (the installable site, D-076), J-6 at dist/j6/

   esbuild bundles each page; Tailwind keeps only the classes they use. The
   J-6 page imports Sketchpad's theory through j6/j6.mjs, which in Node reads
   the extracted tests/theory.mjs; here that import is pointed at sketchpad.jsx
   itself, so the page carries one copy of the theory and the recordings. (D-086) */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "build");
mkdirSync(out, { recursive: true });

export const PAGES = [
  { entry: "./sketchpad.jsx", file: "sketchpad-app.html", title: "Sketchpad",
    description: "Pick a key, play chords, practise lessons on the piano." },
  { entry: "./j6/app.jsx", file: "j6-app.html", title: "J-6 Explorer",
    description: "What the Roland J-6 is playing, and how to play a progression on it." },
];

const theoryFromSource = {
  name: "theory-from-source",
  setup(b) { b.onResolve({ filter: /tests\/theory\.mjs$/ }, () => ({ path: join(root, "sketchpad.jsx") })); },
};

const input = join(out, "tailwind.in.css");
writeFileSync(input, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
execFileSync("npx", ["tailwindcss", "-i", input, "-o", join(out, "tailwind.css"),
  "--content", `${join(root, "sketchpad.jsx")},${join(root, "j6", "*.jsx")}`, "--minify"], { stdio: "ignore" });
const css = readFileSync(join(out, "tailwind.css"), "utf8");
rmSync(input); rmSync(join(out, "tailwind.css"));

for (const page of PAGES) {
  const bundle = await build({
    stdin: {
      contents: `import React from "react"; import { createRoot } from "react-dom/client";
                 import App from "${page.entry}";
                 createRoot(document.getElementById("root")).render(React.createElement(App));`,
      resolveDir: root, loader: "jsx",
    },
    bundle: true, minify: true, write: false, format: "iife",
    loader: { ".jsx": "jsx" },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [theoryFromSource],
    logLevel: "warning",
  });
  const js = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

  // the page ground and ink, so there is no white flash before React draws (tokens T.ground, T.ink)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<style>${css}
html,body{background:#EDE7DA;color:#2E2A24}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
</style></head><body>
<div id="root"></div>
<script>${js}</script>
</body></html>
`;
  writeFileSync(join(out, page.file), html);
  console.log(`build/${page.file}  ${(html.length / 1024).toFixed(0)} KB`);
}
