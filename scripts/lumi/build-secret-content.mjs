import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif"]);
const STORY_EXTENSIONS = new Set([".md", ".txt"]);
const REQUIRED_WORK_FIELDS = ["slug", "title", "author", "rating", "archiveWarnings", "category", "fandoms", "relationships", "characters", "additionalTags", "language", "status", "summary", "chapters"];

function titleFromFilename(filename) {
  return path.basename(filename, path.extname(filename)).replace(/^\d+[\s_-]*/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
  const pixieDir = path.join(root, "lumi/nsfw-pixie");
  const faeo3Dir = path.join(root, "lumi/faeo3");
  const worksDir = path.join(faeo3Dir, "works");
  await Promise.all([mkdir(pixieDir, { recursive: true }), mkdir(worksDir, { recursive: true })]);

  const pixieFiles = (await readdir(pixieDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const metadataFile = path.join(pixieDir, "gallery.json");
  const metadata = (await exists(metadataFile)) ? await readJson(metadataFile, "Pixie gallery") : {};
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") throw new Error(`Pixie gallery: ${metadataFile} must contain a JSON object`);
  for (const filename of Object.keys(metadata)) {
    if (!pixieFiles.includes(filename)) warn(`[Lumi content] Pixie metadata references missing image: ${filename}`);
  }
  const gallery = pixieFiles.map((filename) => {
    const authored = metadata[filename];
    if (authored != null && (Array.isArray(authored) || typeof authored !== "object")) warn(`[Lumi content] Ignoring malformed metadata entry for ${filename}`);
    const safe = authored && !Array.isArray(authored) && typeof authored === "object" ? authored : {};
    return { id: path.basename(filename, path.extname(filename)), filename, src: `/lumi/nsfw-pixie/${encodeURIComponent(filename)}`, title: typeof safe.title === "string" && safe.title.trim() ? safe.title : titleFromFilename(filename), ...(typeof safe.caption === "string" ? { caption: safe.caption } : {}), ...(Array.isArray(safe.tags) ? { tags: safe.tags.filter((tag) => typeof tag === "string") } : {}) };
  });
  await writeFile(path.join(pixieDir, "gallery-manifest.json"), `${JSON.stringify(gallery, null, 2)}\n`);

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
  return { gallery, works };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSecretContent().then(({ gallery, works }) => console.log(`[Lumi content] Generated ${gallery.length} Pixie image(s) and ${works.length} FaeO3 work(s).`)).catch((error) => { console.error(`[Lumi content] ${error.message}`); process.exitCode = 1; });
}
