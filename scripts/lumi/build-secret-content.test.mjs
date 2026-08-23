import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSecretContent } from "./build-secret-content.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "faebook-lumi-"));
  await mkdir(path.join(root, "lumi/faeo3/works"), { recursive: true });
  return root;
}

const work = (slug = "example-work", chapters = [{ number: 1, title: "Opening", file: "chapter-01.md" }]) => ({ slug, title: "Example Work", author: "LumiTurnleaf", rating: "Explicit", archiveWarnings: ["No Archive Warnings Apply"], category: ["F/F"], fandoms: ["Feywild"], relationships: ["A/B"], characters: ["A", "B"], additionalTags: ["Example"], language: "English", status: "complete", summary: "A test work.", published: "2026-08-22", chapters });

async function addWork(root, folderName, metadata, chapterContents) {
  const folder = path.join(root, "lumi/faeo3/works", folderName);
  await mkdir(folder);
  await writeFile(path.join(folder, "work.json"), JSON.stringify(metadata));
  for (const [filename, content] of Object.entries(chapterContents)) await writeFile(path.join(folder, filename), content);
}

test("builds an empty FaeO3 work manifest", async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await buildSecretContent({ publicRoot: root }), { works: [] });
    assert.deepEqual(JSON.parse(await readFile(path.join(root, "lumi/faeo3/works-manifest.json"), "utf8")), []);
  } finally { await rm(root, { recursive: true }); }
});

test("builds one-shot and ordered multi-chapter works without embedding chapter text", async () => {
  const root = await fixture();
  try {
    await addWork(root, "example-work", work(), { "chapter-01.md": "*Hello.*" });
    const chapters = [{ number: 2, title: "Two", file: "chapter-02.txt" }, { number: 1, title: "One", file: "chapter-01.md" }];
    await addWork(root, "multi-work", work("multi-work", chapters), { "chapter-01.md": "One", "chapter-02.txt": "Two" });
    const result = await buildSecretContent({ publicRoot: root });
    const multi = result.works.find((item) => item.slug === "multi-work");
    assert.equal(result.works.length, 2);
    assert.equal(multi.chapterCount, 2);
    assert.deepEqual(multi.chapters.map((chapter) => chapter.number), [1, 2]);
    assert.deepEqual(multi.chapters.map((chapter) => chapter.src), ["/lumi/faeo3/works/multi-work/chapter-01.md", "/lumi/faeo3/works/multi-work/chapter-02.txt"]);
    const generated = await readFile(path.join(root, "lumi/faeo3/works-manifest.json"), "utf8");
    assert.deepEqual(JSON.parse(generated), result.works);
    assert.doesNotMatch(generated, /Hello/);
  } finally { await rm(root, { recursive: true }); }
});

test("rejects malformed work JSON and missing chapter files", async () => {
  const root = await fixture(); const folder = path.join(root, "lumi/faeo3/works/broken"); await mkdir(folder);
  try {
    await writeFile(path.join(folder, "work.json"), "{");
    await assert.rejects(buildSecretContent({ publicRoot: root }), /malformed JSON.*work\.json/);
    await writeFile(path.join(folder, "work.json"), JSON.stringify(work("broken")));
    await assert.rejects(buildSecretContent({ publicRoot: root }), /referenced chapter file is missing/);
  } finally { await rm(root, { recursive: true }); }
});

test("rejects duplicate slugs and duplicate chapter numbers", async () => {
  const root = await fixture();
  try {
    await addWork(root, "one", work("same"), { "chapter-01.md": "Text" });
    await addWork(root, "two", work("same"), { "chapter-01.md": "Text" });
    await assert.rejects(buildSecretContent({ publicRoot: root }), /duplicate slug/);
    await rm(path.join(root, "lumi/faeo3/works/two"), { recursive: true });
    const duplicateChapters = [{ number: 1, title: "A", file: "chapter-01.md" }, { number: 1, title: "B", file: "chapter-02.md" }];
    await writeFile(path.join(root, "lumi/faeo3/works/one/work.json"), JSON.stringify(work("same", duplicateChapters)));
    await writeFile(path.join(root, "lumi/faeo3/works/one/chapter-02.md"), "Text");
    await assert.rejects(buildSecretContent({ publicRoot: root }), /duplicate chapter number/);
  } finally { await rm(root, { recursive: true }); }
});
