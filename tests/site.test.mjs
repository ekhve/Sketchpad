/* The installable site (D-076). The service worker is run for real, in a
   sandbox with a fake cache and network, so "works offline" and "updates on
   the next open" are checked as behaviour, not as text in a file. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as site from "../tools/package-site.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const iconDir = join(here, "..", "site");
const iconsIn = (dir) => Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => [f, readFileSync(join(dir, f))]));
const icons = iconsIn(iconDir);
const j6Icons = iconsIn(join(iconDir, "j6"));
const APP = `<!doctype html><html><head><meta charset=utf8></head><body><div id="root"></div><script>app()</script></body></html>`;

/* A browser, as far as a service worker can see one. */
function browser({ online = true, server = {} } = {}) {
  const stores = new Map();
  const net = { online, server, requests: [] };
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    const key = (r) => (typeof r === "string" ? r : r.url).split("?")[0];
    return {
      addAll: async (reqs) => { for (const r of reqs) m.set(key(r), await sandbox.fetch(r)); },
      match: async (r) => m.get(key(r)),
      keys: () => [...m.keys()],
    };
  };
  const caches = {
    open: async (n) => store(n),
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    has: (n) => stores.has(n),
    files: (n) => (stores.has(n) ? [...stores.get(n).keys()] : []),
  };
  const handlers = {};
  const sandbox = {
    caches,
    Request: class { constructor(url, opts = {}) { this.url = url; this.cache = opts.cache; this.method = "GET"; } },
    fetch: async (r) => {
      const url = typeof r === "string" ? r : r.url;
      net.requests.push({ url, cache: r.cache });
      if (!net.online) throw new TypeError("offline");
      const name = url === "./" ? "index.html" : url.replace("./", "");
      if (!(name in net.server)) return { status: 404, body: "" };
      return { status: 200, body: net.server[name] };
    },
    self: {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: async () => {}, clients: { claim: async () => {} },
    },
  };
  const run = async (type, extra = {}) => {
    let waited, responded;
    handlers[type]({ ...extra, waitUntil: (p) => { waited = p; }, respondWith: (p) => { responded = p; } });
    if (waited) await waited;
    return responded ? await responded : undefined;
  };
  return {
    caches, net,
    load(swSource) { for (const k of Object.keys(handlers)) delete handlers[k]; vm.runInNewContext(swSource, { ...sandbox }); }, // each version runs in its own worker
    install: () => run("install"),
    activate: () => run("activate"),
    get: (url) => run("fetch", { request: { url, method: "GET" } }),
    handles: (type) => type in handlers,
  };
}

const deploy = (html = APP) => site.packageSite(html, icons);
const versionOf = (sw) => sw.match(/const VERSION = "([^"]+)"/)[1];

describe("Feature: Sketchpad installs as an app and works offline", () => {
  test("The site installs as an app with its own name and icon", () => {
    const m = JSON.parse(site.manifest());
    assert.equal(m.name, "Sketchpad");
    assert.equal(m.display, "standalone");
    assert.equal(m.start_url, "./", "opens at its own folder, wherever that is hosted");
    assert.deepEqual(m.icons.map((i) => i.sizes).sort(), ["192x192", "512x512"]);
    const { files } = deploy();
    for (const i of m.icons) assert.ok(files[i.src], `the manifest names ${i.src}, which the site must ship`);
    for (const size of [180, 192, 512]) {
      const png = files[site.iconName(size)];
      assert.equal(png.readUInt32BE(16), size, `${site.iconName(size)} is ${size} pixels wide`);
      assert.equal(png.readUInt32BE(20), size, `${site.iconName(size)} is square`);
    }
    assert.throws(() => site.packageSite(APP, { "icon-192.png": icons["icon-192.png"] }), /missing icon-180/);
  });

  test("The page asks to be kept offline and looks like an app on iOS", () => {
    const html = deploy().files["index.html"];
    const head = html.slice(0, html.indexOf("</head>"));
    for (const tag of ['rel="manifest"', 'name="apple-mobile-web-app-capable" content="yes"',
                       'rel="apple-touch-icon" href="icon-180.png"', 'name="apple-mobile-web-app-title" content="Sketchpad"']) {
      assert.ok(head.includes(tag), `the head carries ${tag}`);
    }
    const tail = html.slice(html.lastIndexOf("<div id=\"root\">"));
    assert.ok(tail.includes('navigator.serviceWorker.register("./sw.js")'), "the page registers the service worker");
    assert.ok(site.REGISTER.includes(".catch("), "a refused registration never breaks the app");
    assert.ok(html.includes("<script>app()</script>"), "the app itself is untouched");
    assert.throws(() => site.installable("<body></body>"), /no <\/head>/);
  });

  test("Every file the site ships is kept for offline use", async () => {
    const { files } = deploy();
    const b = browser({ server: files });
    b.load(files["sw.js"]);
    await b.install();
    const name = versionOf(files["sw.js"]);
    const shipped = Object.keys(files).filter((f) => f !== "sw.js").map((f) => "./" + f);
    assert.deepEqual(b.caches.files(name).sort(), ["./", ...shipped].sort());
    assert.ok(b.net.requests.every((r) => r.cache === "reload"), "installing fetches past the HTTP cache, so a new version is really new");
  });

  test("It works offline once installed", async () => {
    const { files } = deploy();
    const b = browser({ server: files });
    b.load(files["sw.js"]);
    await b.install(); await b.activate();
    b.net.online = false;
    for (const url of ["./", "./index.html", "./index.html?from=homescreen", "./icon-180.png"]) {
      const res = await b.get(url);
      assert.equal(res.status, 200, `${url} opens with no network`);
    }
    assert.equal((await b.get("./")).body, files["index.html"], "the home-screen icon opens the app");
  });

  test("A new version of the app replaces the old one on the next open", async () => {
    const v1 = deploy(), v1again = deploy();
    const v2 = deploy(APP.replace("app()", "app(2)"));
    assert.equal(v1.version, v1again.version, "the same upload keeps its version, so nothing is fetched again");
    assert.notEqual(v1.version, v2.version, "any change to the page makes a new version");
    assert.notEqual(site.contentVersion({ a: "x" }), site.contentVersion({ b: "x" }), "a renamed file is a change too");

    const b = browser({ server: v1.files });
    b.load(v1.files["sw.js"]); await b.install(); await b.activate();
    b.net.server = v2.files;
    b.load(v2.files["sw.js"]); await b.install(); await b.activate();
    b.net.online = false;
    assert.equal((await b.get("./")).body, v2.files["index.html"], "after the update, the new page opens offline");
  });

  test("Old versions are cleared out, and nothing else is touched", async () => {
    const v1 = deploy(), v2 = deploy(APP.replace("app()", "app(2)"));
    const b = browser({ server: v1.files });
    await b.caches.open("someone-elses-cache");
    b.load(v1.files["sw.js"]); await b.install(); await b.activate();
    b.net.server = v2.files;
    b.load(v2.files["sw.js"]); await b.install(); await b.activate();
    assert.ok(!b.caches.has(versionOf(v1.files["sw.js"])), "the old version's cache is deleted");
    assert.ok(b.caches.has(versionOf(v2.files["sw.js"])), "the new one stays");
    assert.ok(b.caches.has("someone-elses-cache"), "caches that are not Sketchpad's are left alone");
  });
});

describe("Feature: The J-6 Explorer installs as its own app", () => {
  const j6 = (html = APP) => site.packageSite(html, j6Icons, site.SITES.j6);

  test("The J-6 Explorer installs as its own app next to Sketchpad", () => {
    const m = JSON.parse(site.manifest(site.SITES.j6));
    assert.equal(m.name, "J-6 Explorer");
    assert.equal(m.display, "standalone");
    assert.equal(m.start_url, "./", "opens at its own folder, j6/");
    assert.equal(m.scope, "./", "and stays in it, so it is a separate app from Sketchpad");
    const { files } = j6();
    const head = files["index.html"].slice(0, files["index.html"].indexOf("</head>"));
    assert.ok(head.includes('name="apple-mobile-web-app-title" content="J-6 Explorer"'), "its own name on the home screen");
    for (const size of [180, 192, 512]) {
      const png = files[site.iconName(size)];
      assert.equal(png.readUInt32BE(16), size, `its own ${site.iconName(size)} is ${size} pixels wide`);
      assert.notDeepEqual(png, icons[site.iconName(size)], "and is not Sketchpad's icon");
    }
    assert.ok(versionOf(files["sw.js"]).startsWith("j6-explorer-"));
    assert.ok(!site.SITES.j6.cachePrefix.startsWith(site.SITES.sketchpad.cachePrefix)
           && !site.SITES.sketchpad.cachePrefix.startsWith(site.SITES.j6.cachePrefix), "neither prefix contains the other");
  });

  test("Updating one app never clears the other's offline copy", async () => {
    const sp1 = deploy(), sp2 = deploy(APP.replace("app()", "app(2)"));
    const j1 = j6(), j2 = j6(APP.replace("app()", "j6(2)"));
    const b = browser({ server: sp1.files });
    b.load(sp1.files["sw.js"]); await b.install(); await b.activate();
    b.net.server = j1.files;
    b.load(j1.files["sw.js"]); await b.install(); await b.activate();
    assert.ok(b.caches.has(versionOf(sp1.files["sw.js"])), "installing the J-6 Explorer keeps Sketchpad's cache");

    b.net.server = sp2.files;
    b.load(sp2.files["sw.js"]); await b.install(); await b.activate();
    assert.ok(b.caches.has(versionOf(j1.files["sw.js"])), "a new Sketchpad keeps the J-6 Explorer's cache");
    assert.ok(!b.caches.has(versionOf(sp1.files["sw.js"])), "and clears its own old one");

    b.net.server = j2.files;
    b.load(j2.files["sw.js"]); await b.install(); await b.activate();
    assert.ok(b.caches.has(versionOf(sp2.files["sw.js"])), "a new J-6 Explorer keeps Sketchpad's cache");
    assert.ok(!b.caches.has(versionOf(j1.files["sw.js"])), "and clears its own old one");
  });
});
