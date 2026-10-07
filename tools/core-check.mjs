/* Checks on the core asset base: the rules in core/DESIGN.md, held to by the code.   (CD-001, D-096)

     node tools/core-check.mjs            the checks, one line each
     node tools/core-check.mjs --report   the traceability matrix: requirement → test, per module
     node tools/core-check.mjs --graph    each module's layer and what it imports

   The same checks run in three places, so that none of them can drift: here, as tests in
   core/tests/architecture.test.mjs, and as gates C1–C4 in tools/check-done.mjs.

   What is checked, and why it is checked by a program rather than by a reader:
     C1  every asset requirement (core/REQUIREMENTS.md, sketchpad/REQUIREMENTS.md) is verified by a test that exists, and
         every test in core/tests names the requirement it verifies;
     C2  every export of every module is documented in its MODULES.md, and nothing documented
         is missing: an interface that is not written down is not an interface;
     C3  the architecture holds: no cycles, every module's layer is what its header and its
         document say, core never imports a product, every module is pure, none is unused;
     C4  every asset requirement and decision traces to a source that exists. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";

const DIRS = ["core", "sketchpad"];
const read = (p) => readFileSync(p, "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

/** Every module, with what it exports, imports and says about itself. */
export async function loadModules(root = ".") {
  const out = [];
  for (const dir of DIRS) {
    const files = readdirSync(join(root, dir)).filter((f) => f.endsWith(".mjs") && f !== "index.mjs").sort();
    for (const f of files) {
      const file = `${dir}/${f}`, id = file.replace(/\.mjs$/, ""), source = read(join(root, file));
      const ns = await import(pathToFileURL(join(root, file)).href + "?check");
      const imports = [...source.matchAll(/^import \{([^}]*)\} from "([^"]+)";$/gm)].map((m) => ({
        names: m[1].split(",").map((x) => x.trim()).filter(Boolean),
        spec: m[2],
        id: resolveSpec(dir, m[2]),
      }));
      const header = source.match(/Layer (\d+)\. Depends on: ([^.]*)\./);
      out.push({
        id, dir, name: f.replace(/\.mjs$/, ""), file, source,
        exports: Object.keys(ns).sort(), imports,
        header: header ? { layer: Number(header[1]), depends: header[2].trim() === "nothing" ? [] : header[2].split(",").map((x) => x.trim()).sort() } : null,
      });
    }
  }
  return out;
}
/** "./notes.mjs" imported from core/ is core/notes; "../core/notes.mjs" from sketchpad/ is too. */
const resolveSpec = (dir, spec) => posix.normalize(posix.join(dir, spec)).replace(/\.mjs$/, "");

/** Who imports each module directly: other modules, and the apps. */
export function loadConsumers(modules, root = ".") {
  const apps = [
    ["sketchpad", ["sketchpad.jsx"]],
    ["j6", readdirSync(join(root, "j6")).filter((f) => /\.(mjs|jsx)$/.test(f)).map((f) => `j6/${f}`)],
  ];
  const used = new Map(modules.map((m) => [m.id, new Set()]));
  for (const m of modules) for (const i of m.imports) used.get(i.id)?.add(m.id);
  for (const [app, files] of apps) for (const f of files) {
    for (const m of read(join(root, f)).matchAll(/from "((?:\.\.?\/)(?:core|sketchpad)\/[\w-]+\.mjs)"/g)) {
      const id = m[1].replace(/^\.\.?\//, "").replace(/\.mjs$/, "");
      used.get(id)?.add(app);
    }
  }
  return used;
}

/** Layer = the longest chain of imports below a module. */
export function layersOf(modules) {
  const by = new Map(modules.map((m) => [m.id, m]));
  const memo = new Map(), stack = new Set(), cycles = [];
  const layer = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) { cycles.push(id); return 0; }
    stack.add(id);
    const deps = [...new Set(by.get(id).imports.map((i) => i.id))].filter((d) => by.has(d));
    const l = deps.length ? 1 + Math.max(...deps.map(layer)) : 0;
    stack.delete(id); memo.set(id, l);
    return l;
  };
  modules.forEach((m) => layer(m.id));
  return { layers: memo, cycles };
}

/** MODULES.md: per module, its layer, dependencies, consumers and interface table. */
export function parseModuleDocs(root = ".") {
  const docs = new Map();
  for (const dir of DIRS) {
    const p = join(root, dir, "MODULES.md");
    if (!existsSync(p)) continue;
    const text = read(p);
    for (const sec of text.split(/^## /m).slice(1)) {
      const id = sec.match(/^([\w-]+\/[\w-]+)/)?.[1];
      if (!id) continue;
      const meta = sec.match(/\*\*Layer\*\* (\d+) · \*\*Depends on\*\* ([^·\n]*) · \*\*Used by\*\* ([^\n]*)/);
      const list = (s) => (s.trim() === "none" || s.trim() === "nothing" ? [] : s.split(",").map((x) => x.trim()).filter(Boolean).sort());
      const table = sec.split(/^### Interface/m)[1] ?? "";
      docs.set(id, {
        layer: meta ? Number(meta[1]) : null,
        depends: meta ? list(meta[2]) : null,
        usedBy: meta ? list(meta[3]) : null,
        exports: [...table.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]).sort(),
        hasPurpose: /\*\*Purpose\.\*\*/.test(sec),
        hasBehaviour: /\*\*Behaviour\.\*\*/.test(sec),
      });
    }
  }
  return docs;
}

/** core/REQUIREMENTS.md and sketchpad/REQUIREMENTS.md: | CR-NOTES-01 | text | Source | Mode | Verified by | (SR- for Sketchpad's own) */
export function parseRequirements(root = ".") {
  return DIRS.flatMap((dir) => {
    const p = join(root, dir, "REQUIREMENTS.md");
    if (!existsSync(p)) return [];
    return [...read(p).matchAll(/^\|\s*((?:CR|SR)-[A-Z]+-\d+)\s*\|([^|]+)\|([^|]+)\|\s*([AIM])\s*\|([^|]+)\|\s*$/gm)]
      .map((m) => ({ id: m[1], text: m[2].trim(), source: m[3].trim(), mode: m[4], verifiedBy: m[5].trim() }));
  });
}

/** Test titles in core/tests and sketchpad/tests that begin with a requirement id. */
export function loadAssetTests(root = ".") {
  const tests = [];
  for (const d of DIRS) {
    const dir = join(root, d, "tests");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".test.mjs")).sort())
      for (const m of read(join(dir, f)).matchAll(/^\s*test\(\s*(["'`])(.+?)\1/gm)) tests.push({ file: `${d}/tests/${f}`, title: m[2], id: m[2].match(/^((?:CR|SR)-[A-Z]+-\d+)\b/)?.[1] ?? null });
  }
  return tests;
}

const FORBIDDEN = [
  ["React", /\buseState\b|\buseEffect\b|\buseRef\b|\bReact\./], ["Tone", /\bTone\./],
  ["the DOM", /\bdocument\.|\bwindow\.|\bnavigator\./], ["a clock", /new Date|Date\.now|performance\.now/],
  ["randomness", /Math\.random/], ["the network", /\bfetch\(|XMLHttpRequest/],
];

/** Every check, as { id, name, ok, detail, problems }. */
export async function checkCore(root = ".") {
  const modules = await loadModules(root);
  const docs = parseModuleDocs(root);
  const reqs = parseRequirements(root);
  const tests = loadAssetTests(root);
  const used = loadConsumers(modules, root);
  const { layers, cycles } = layersOf(modules);
  const results = [];
  const gate = (id, name, problems, detail) => results.push({ id, name, ok: problems.length === 0, problems, detail });

  /* C1 — requirements and tests meet */
  {
    const p = [];
    const reqIds = new Set(reqs.map((r) => r.id));
    const dup = reqs.map((r) => r.id).filter((x, i, a) => a.indexOf(x) !== i);
    for (const d of new Set(dup)) p.push(`${d} is listed twice`);
    for (const r of reqs) {
      const t = tests.filter((x) => x.id === r.id);
      if (r.mode === "A" && !t.length) p.push(`${r.id} (automated) has no test`);
      if (r.mode === "A" && t.length && !t.some((x) => r.verifiedBy.includes(x.file))) p.push(`${r.id} names ${r.verifiedBy}, but its test is in ${t[0].file}`);
    }
    for (const t of tests) {
      if (!t.id) p.push(`test "${t.title}" (${t.file}) names no requirement`);
      else if (!reqIds.has(t.id)) p.push(`test "${t.title}" names ${t.id}, which is not a requirement`);
    }
    gate("C1", "Every asset requirement has a test, and every asset test a requirement", p, `${reqs.length} requirements, ${tests.length} tests`);
  }

  /* C2 — interfaces written down */
  {
    const p = [];
    for (const m of modules) {
      const d = docs.get(m.id);
      if (!d) { p.push(`${m.id} has no section in ${m.dir}/MODULES.md`); continue; }
      for (const e of m.exports) if (!d.exports.includes(e)) p.push(`${m.id} exports ${e}, which its document does not describe`);
      for (const e of d.exports) if (!m.exports.includes(e)) p.push(`${m.id}'s document describes ${e}, which it does not export`);
      if (!d.hasPurpose || !d.hasBehaviour) p.push(`${m.id}'s document needs both a Purpose and a Behaviour`);
    }
    for (const id of docs.keys()) if (!modules.some((m) => m.id === id)) p.push(`MODULES.md describes ${id}, which does not exist`);
    for (const dir of DIRS) {
      const idx = existsSync(join(root, dir, "index.mjs")) ? read(join(root, dir, "index.mjs")) : "";
      for (const m of modules.filter((x) => x.dir === dir)) if (!idx.includes(`"./${m.name}.mjs"`)) p.push(`${dir}/index.mjs does not re-export ${m.id}`);
    }
    gate("C2", "Every module's interface is documented, and nothing documented is missing", p, `${modules.reduce((n, m) => n + m.exports.length, 0)} exports in ${modules.length} modules`);
  }

  /* C3 — the architecture. Each problem carries a tag, so the tests can say which rule broke. */
  {
    const p = [];
    const bad = (tag, msg) => p.push({ tag, msg });
    const deps = (m) => [...new Set(m.imports.map((i) => i.id))].sort();
    for (const c of cycles) bad("cycle", `${c} is part of an import cycle`);
    for (const m of modules) {
      const code = stripComments(m.source);
      if (!m.header) bad("layer", `${m.id} has no header saying its layer and what it depends on`);
      else {
        if (m.header.layer !== layers.get(m.id)) bad("layer", `${m.id}'s header says layer ${m.header.layer}; its imports make it layer ${layers.get(m.id)}`);
        if (m.header.depends.join() !== deps(m).join()) bad("layer", `${m.id}'s header says it depends on [${m.header.depends}]; it imports [${deps(m)}]`);
      }
      const d = docs.get(m.id);
      if (d) {
        if (d.layer !== layers.get(m.id)) bad("layer", `${m.id}'s document says layer ${d.layer}; it is layer ${layers.get(m.id)}`);
        if (d.depends && d.depends.join() !== deps(m).join()) bad("layer", `${m.id}'s document lists dependencies [${d.depends}], not [${deps(m)}]`);
        const u = [...used.get(m.id)].sort();
        if (d.usedBy && d.usedBy.join() !== u.join()) bad("used", `${m.id}'s document says it is used by [${d.usedBy}]; it is used by [${u}]`);
      }
      for (const i of m.imports) {
        if (!i.spec.startsWith(".")) bad("direction", `${m.id} imports "${i.spec}", which is not one of our modules`);
        else if (m.dir === "core" && !i.id.startsWith("core/")) bad("direction", `${m.id} imports ${i.id}: core never depends on a product`);
      }
      if (/^\s*import\s+[^{]/m.test(code) || /\bimport\(/.test(code) || /\brequire\(/.test(code)) bad("pure", `${m.id} uses an import form the checks do not read`);
      for (const [what, re] of FORBIDDEN) if (re.test(code)) bad("pure", `${m.id} uses ${what}: assets stay pure`);
      if (!used.get(m.id).size) bad("used", `${m.id} is imported by nothing`);
    }
    gate("C3", "The architecture holds: acyclic, layered, pure, core independent of products", p.map((x) => x.msg),
      `${modules.length} modules, ${Math.max(...layers.values()) + 1} layers`);
    results[results.length - 1].tagged = p;
  }

  /* C4 — everything traces to something that exists */
  {
    const p = [];
    const text = (f) => (existsSync(join(root, f)) ? read(join(root, f)) : "");
    const productDecisions = new Set([...text("DESIGN.md").matchAll(/^###? (D-\d+)|^\|\s*(D-\d+)\s*\|/gm)].map((m) => m[1] ?? m[2]));
    const productReqs = new Set([...text("REQUIREMENTS.md").matchAll(/^\|\s*(R-\d+)\s*\|/gm)].map((m) => m[1]));
    const useCases = new Set([...text("USE_CASES.md").matchAll(/UC-\d+/g)].map((m) => m[0]));
    const coreDecisions = new Set([...text("core/DESIGN.md").matchAll(/^### (CD-\d+)/gm)].map((m) => m[1]));
    const exists = (t) => (/^D-/.test(t) ? productDecisions : /^CD-/.test(t) ? coreDecisions : /^R-/.test(t) ? productReqs : /^UC-/.test(t) ? useCases : null)?.has(t);
    for (const r of reqs) {
      const ids = r.source.match(/\b(?:CD|D|R|UC)-\d+\b/g) ?? [];
      if (!ids.length) p.push(`${r.id} names no source`);
      for (const t of ids) if (!exists(t)) p.push(`${r.id} cites ${t}, which does not exist`);
    }
    const cited = new Set([...reqs.flatMap((r) => r.source.match(/\bCD-\d+\b/g) ?? []), ...modules.flatMap((m) => m.source.match(/\bCD-\d+\b/g) ?? []),
      ...[...text("core/MODULES.md").matchAll(/\bCD-\d+\b/g)].map((m) => m[0]), ...[...text("core/README.md").matchAll(/\bCD-\d+\b/g)].map((m) => m[0])]);
    for (const d of coreDecisions) if (!cited.has(d)) p.push(`${d} is cited by no requirement, module or document`);
    gate("C4", "Every core requirement traces to a source that exists, and every core decision is used", p, `${coreDecisions.size} core decisions`);
  }
  return { results, modules, docs, reqs, tests, used, layers };
}

/* ---- command line ---- */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { results, modules, reqs, tests, layers, used } = await checkCore();
  if (process.argv.includes("--graph")) {
    for (const m of [...modules].sort((a, b) => layers.get(a.id) - layers.get(b.id) || a.id.localeCompare(b.id)))
      console.log(`layer ${layers.get(m.id)}  ${m.id.padEnd(22)} imports [${[...new Set(m.imports.map((i) => i.id))].join(", ")}]   used by [${[...used.get(m.id)].sort().join(", ")}]`);
  } else if (process.argv.includes("--report")) {
    for (const m of modules) {
      const mine = reqs.filter((r) => r.id.startsWith((m.dir === "core" ? "CR-" : "SR-") + m.name.replace(/-/g, "").toUpperCase() + "-"));
      console.log(`\n${m.id}  (${m.exports.length} exports, ${mine.length} requirements)`);
      for (const r of mine) { const t = tests.filter((x) => x.id === r.id); console.log(`  ${r.id}  ${r.mode}  ${t.length ? t.length + " test" + (t.length > 1 ? "s" : "") : "NO TEST"}  ${r.text.slice(0, 90)}`); }
    }
  }
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}  ${r.name}  (${r.detail})`);
    for (const p of r.problems) console.log(`        · ${p}`);
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
