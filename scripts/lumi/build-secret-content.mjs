import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STORY_EXTENSIONS = new Set([".md", ".txt"]);
const REQUIRED_WORK_FIELDS = ["slug", "title", "author", "rating", "archiveWarnings", "category", "fandoms", "relationships", "characters", "additionalTags", "language", "status", "summary", "chapters"];

async function readJson(filename, label) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    throw new Error(`${label}: malformed JSON in ${filename}: ${error.message}`);
  }
}

async function exists(filename) {
  try { await access(filename); return true; } catch { return false; }
}

export async function buildSecretContent({ publicRoot, warn = console.warn } = {}) {
  const root = publicRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/client/public");
  const faeo3Dir = path.join(root, "lumi/faeo3");
  const worksDir = path.join(faeo3Dir, "works");
  await mkdir(worksDir, { recursive: true });

  const entries = (await readdir(worksDir, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).sort((a, b) => a.name.localeCompare(b.name));
  const works = [];
  const slugs = new Set();
  for (const entry of entries) {
    const folder = path.join(worksDir, entry.name);
    const workFile = path.join(folder, "work.json");
    if (!(await exists(workFile))) throw new Error(`FaeO3 work ${folder}: missing work.json`);
    const work = await readJson(workFile, `FaeO3 work ${folder}`);
    for (const field of REQUIRED_WORK_FIELDS) if (work[field] == null || work[field] === "") throw new Error(`FaeO3 work ${workFile}: missing required metadata "${field}"`);
    if (typeof work.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(work.slug)) throw new Error(`FaeO3 work ${workFile}: slug must use lowercase letters, numbers, and hyphens`);
    if (slugs.has(work.slug)) throw new Error(`FaeO3 work ${workFile}: duplicate slug "${work.slug}"`);
    slugs.add(work.slug);
    if (!Array.isArray(work.chapters) || work.chapters.length === 0) throw new Error(`FaeO3 work ${workFile}: work must have at least one chapter`);
    const chapterNumbers = new Set();
    const chapters = [];
    const usedFiles = new Set(["work.json"]);
    for (const chapter of work.chapters) {
      if (!Number.isInteger(chapter.number) || chapter.number < 1 || !chapter.title || !chapter.file) throw new Error(`FaeO3 work ${workFile}: every chapter requires a positive integer number, title, and file`);
      if (chapterNumbers.has(chapter.number)) throw new Error(`FaeO3 work ${workFile}: duplicate chapter number ${chapter.number}`);
      chapterNumbers.add(chapter.number);
      const extension = path.extname(chapter.file).toLowerCase();
      if (!STORY_EXTENSIONS.has(extension) || path.basename(chapter.file) !== chapter.file) throw new Error(`FaeO3 work ${workFile}: chapter ${chapter.number} must reference a local .md or .txt file`);
      const chapterFile = path.join(folder, chapter.file);
      if (!(await exists(chapterFile))) throw new Error(`FaeO3 work ${workFile}: referenced chapter file is missing: ${chapterFile}`);
      usedFiles.add(chapter.file);
      chapters.push({ number: chapter.number, title: chapter.title, src: `/lumi/faeo3/works/${encodeURIComponent(entry.name)}/${encodeURIComponent(chapter.file)}` });
    }
    chapters.sort((a, b) => a.number - b.number);
    for (const field of ["archiveWarnings", "category", "fandoms", "relationships", "characters", "additionalTags"]) {
      if (!Array.isArray(work[field])) throw new Error(`FaeO3 work ${workFile}: "${field}" must be an array`);
      if (work[field].length === 0) warn(`[Lumi content] ${workFile}: metadata array "${field}" is empty`);
    }
    if (!work.published) warn(`[Lumi content] ${workFile}: optional published date is missing`);
    for (const file of await readdir(folder)) if (!usedFiles.has(file) && !file.startsWith(".")) warn(`[Lumi content] ${folder}: unused file ${file}`);
    works.push({ ...work, chapterCount: chapters.length, chapters });
  }
  works.sort((a, b) => (b.published ?? "").localeCompare(a.published ?? "") || a.title.localeCompare(b.title));
  await writeFile(path.join(faeo3Dir, "works-manifest.json"), `${JSON.stringify(works, null, 2)}\n`);
  return { works };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSecretContent().then(({ works }) => console.log(`[Lumi content] Generated ${works.length} FaeO3 work(s).`)).catch((error) => { console.error(`[Lumi content] ${error.message}`); process.exitCode = 1; });
}
