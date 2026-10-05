/* Builds the app into one self-contained HTML file: the React code, Tone.js,
   the piano samples and the CSS, all inline, so it runs from any static host
   or straight from disk.

     npm run build            → build/sketchpad-app.html
     npm run site             → dist/ (the installable site, D-076)

   esbuild bundles sketchpad.jsx; Tailwind keeps only the classes it uses. */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "build");
mkdirSync(out, { recursive: true });

const bundle = await build({
  stdin: {
    contents: `import React from "react"; import { createRoot } from "react-dom/client";
               import App from "./sketchpad.jsx";
               createRoot(document.getElementById("root")).render(React.createElement(App));`,
    resolveDir: root, loader: "jsx",
  },
  bundle: true, minify: true, write: false, format: "iife",
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const input = join(out, "tailwind.in.css");
writeFileSync(input, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
execFileSync("npx", ["tailwindcss", "-i", input, "-o", join(out, "tailwind.css"), "--content", join(root, "sketchpad.jsx"), "--minify"], { stdio: "ignore" });
const css = readFileSync(join(out, "tailwind.css"), "utf8");
rmSync(input); rmSync(join(out, "tailwind.css"));

// the page ground and ink, so there is no white flash before React draws (tokens T.ground, T.ink)
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Sketchpad</title>
<meta name="description" content="Pick a key, play chords, practise lessons on the piano.">
<style>${css}
html,body{background:#EDE7DA;color:#2E2A24}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
</style></head><body>
<div id="root"></div>
<script>${js}</script>
</body></html>
`;
writeFileSync(join(out, "sketchpad-app.html"), page);
console.log(`build/sketchpad-app.html  ${(page.length / 1024).toFixed(0)} KB`);
