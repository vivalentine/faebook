import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSecretContent } from "./build-secret-content.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "faebook-lumi-"));
  await mkdir(path.join(root, "lumi/nsfw-pixie"), { recursive: true });
  await mkdir(path.join(root, "lumi/faeo3/works"), { recursive: true });
  return root;
}

const work = (slug = "example-work", chapters = [{ number: 1, title: "Opening", file: "chapter-01.md" }]) => ({ slug, title: "Example Work", author: "LumiTurnleaf", rating: "Explicit", archiveWarnings: ["No Archive Warnings Apply"], category: ["F/F"], fandoms: ["Feywild"], relationships: ["A/B"], characters: ["A", "B"], additionalTags: ["Example"], language: "English", status: "complete", summary: "A test work.", published: "2026-08-22", chapters });

test("builds empty manifests", async () => {
  const root = await fixture();
  try { const result = await buildSecretContent({ publicRoot: root }); assert.deepEqual(result, { gallery: [], works: [] }); }
  finally { await rm(root, { recursive: true }); }
});

test("builds sorted Pixie metadata and one-shot/multi-chapter works", async () => {
  const root = await fixture();
  try {
    const pixie = path.join(root, "lumi/nsfw-pixie");
    for (const name of ["002_second.JPG", "001_first.webp", "third.gif", ".hidden.png", "ignore.svg"]) await writeFile(path.join(pixie, name), "image");
    await writeFile(path.join(pixie, "gallery.json"), JSON.stringify({ "001_first.webp": { title: "Authored", tags: ["Fae"] }, "missing.png": { title: "Missing" }, "third.gif": "bad" }));
    const works = path.join(root, "lumi/faeo3/works");
    const one = path.join(works, "example-work"); await mkdir(one); await writeFile(path.join(one, "work.json"), JSON.stringify(work())); await writeFile(path.join(one, "chapter-01.md"), "*Hello.*");
    const multi = path.join(works, "multi-work"); await mkdir(multi); const chapters = [{ number: 2, title: "Two", file: "chapter-02.txt" }, { number: 1, title: "One", file: "chapter-01.md" }]; await writeFile(path.join(multi, "work.json"), JSON.stringify(work("multi-work", chapters))); await writeFile(path.join(multi, "chapter-01.md"), "One"); await writeFile(path.join(multi, "chapter-02.txt"), "Two");
    const warnings = []; const result = await buildSecretContent({ publicRoot: root, warn: (message) => warnings.push(message) });
    assert.deepEqual(result.gallery.map((item) => item.title), ["Authored", "Second", "Third"]); assert.equal(result.works[1].chapterCount, 2); assert.deepEqual(result.works[1].chapters.map((chapter) => chapter.number), [1, 2]); assert.equal(warnings.length, 2);
    assert.doesNotMatch(await readFile(path.join(root, "lumi/faeo3/works-manifest.json"), "utf8"), /Hello/);
  } finally { await rm(root, { recursive: true }); }
});

test("rejects malformed work JSON and missing chapter files", async () => {
  const root = await fixture(); const folder = path.join(root, "lumi/faeo3/works/broken"); await mkdir(folder);
  try { await writeFile(path.join(folder, "work.json"), "{"); await assert.rejects(buildSecretContent({ publicRoot: root }), /malformed JSON.*work\.json/); await writeFile(path.join(folder, "work.json"), JSON.stringify(work("broken"))); await assert.rejects(buildSecretContent({ publicRoot: root }), /referenced chapter file is missing/); }
  finally { await rm(root, { recursive: true }); }
});

test("rejects a duplicate slug and duplicate chapter number", async () => {
  const root = await fixture(); const works = path.join(root, "lumi/faeo3/works");
  try {
    for (const name of ["one", "two"]) { const folder = path.join(works, name); await mkdir(folder); await writeFile(path.join(folder, "work.json"), JSON.stringify(work("same"))); await writeFile(path.join(folder, "chapter-01.md"), "Text"); }
    await assert.rejects(buildSecretContent({ publicRoot: root }), /duplicate slug/);
    await rm(path.join(works, "two"), { recursive: true }); const folder = path.join(works, "one"); await writeFile(path.join(folder, "work.json"), JSON.stringify(work("same", [{ number: 1, title: "A", file: "chapter-01.md" }, { number: 1, title: "B", file: "chapter-02.md" }]))); await writeFile(path.join(folder, "chapter-02.md"), "Text"); await assert.rejects(buildSecretContent({ publicRoot: root }), /duplicate chapter number/);
  } finally { await rm(root, { recursive: true }); }
});
