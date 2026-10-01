import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the GPEC application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="fr">/i);
  assert.match(html, /<title>ProspectivRH \| Université Paris-Saclay<\/title>/i);
  assert.match(html, /Pilotage prospectif des emplois et compétences/);
  assert.match(html, /Données de démonstration/);
  assert.match(html, /Connexions SQL/);
  assert.match(html, /logo-upsaclay\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("keeps the finished product free of starter artifacts", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ProspectivRH/);
  assert.match(page, /Aucun identifiant individuel/);
  assert.match(layout, /og\.png/);
  assert.match(css, /--plum:\s*#63003c/i);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/logo-upsaclay.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});
