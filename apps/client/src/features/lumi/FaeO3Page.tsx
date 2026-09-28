import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { renderRecapMarkdown } from "../../components/RecapMarkdown";
import "./faeo3.css";

type Chapter = { number: number; title: string; src: string };
type Work = { slug: string; title: string; author: string; rating: string; archiveWarnings: string[]; category: string[]; fandoms: string[]; relationships: string[]; characters: string[]; additionalTags: string[]; language: string; status: string; summary: string; notes?: string; published?: string; updated?: string; chapterCount: number; chapters: Chapter[] };
const emptyEntityIndex = { npcIndex: { bySlug: new Map(), byName: new Map() }, locationIndex: { bySlug: new Map(), byName: new Map() } };

function Header() { return <header className="faeo3-archive-header"><Link to="/secret/faeo3" className="faeo3-archive-brand"><strong>FaeO3</strong><small>Fae Archive of Our Own</small></Link><nav aria-label="Archive navigation">Tales · Hoards · Keepsakes · Grimoire</nav></header>; }
function Tags({ label, values }: { label: string; values: string[] }) { return values.length ? <li><strong>{label}:</strong> {values.map((value) => <span className="faeo3-tag" key={value}>{value}</span>)}</li> : null; }
function ChapterCount({ work }: { work: Work }) { return <>Chapters: {work.chapterCount}/{work.status.toLowerCase() === "complete" ? work.chapterCount : "?"}</>; }
function NotFound({ message }: { message: string }) { return <section className="faeo3-reading faeo3-not-found"><h1>404 — Page Not Found</h1><p>{message}</p><Link to="/secret/faeo3">← Return to the work index</Link></section>; }
function WorkTags({ work }: { work: Work }) { return <ul className="faeo3-tag-groups"><Tags label="Rating" values={[work.rating]} /><Tags label="Archive Warning" values={work.archiveWarnings} /><Tags label="Category" values={work.category} /><Tags label="Fandom" values={work.fandoms} /><Tags label="Relationships" values={work.relationships} /><Tags label="Characters" values={work.characters} /><Tags label="Additional Tags" values={work.additionalTags} /></ul>; }
function WorkIndex({ works }: { works: Work[] }) { return <section className="faeo3-index"><h1>Lumi Turnleaf's Tales</h1><p className="archive-private">A private grimoire. No Petals, Whispers, or public footprints are kept here.</p>{works.length === 0 && <p className="faeo3-empty">No works posted yet.</p>}{works.map((work) => <article className="faeo3-listing" key={work.slug}><h2><Link to={`/secret/faeo3/works/${work.slug}`}>{work.title}</Link></h2><p className="faeo3-byline">by {work.author}</p><WorkTags work={work} /><blockquote className="faeo3-listing-summary">{work.summary}</blockquote><p className="faeo3-stats"><span>Status: {work.status}</span><ChapterCount work={work} /></p></article>)}</section>; }
function Prose({ text }: { text: string }) { return <>{renderRecapMarkdown(text, { entityIndex: emptyEntityIndex })}</>; }

function WorkReader({ work, chapterNumber }: { work: Work; chapterNumber?: string }) {
  const navigate = useNavigate();
  const requested = chapterNumber ? Number(chapterNumber) : undefined;
  const selected = requested ? work.chapters.find((chapter) => chapter.number === requested) : work.chapters[0];
  const entireWork = work.chapterCount > 1 && !chapterNumber;
  const chaptersToLoad = entireWork ? work.chapters : selected ? [selected] : [];
  const [prose, setProse] = useState<Record<number, string>>({});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!chaptersToLoad.length) return;
    setFailed(false);
    Promise.all(chaptersToLoad.map(async (chapter) => { const response = await fetch(chapter.src); if (!response.ok) throw new Error(); return [chapter.number, await response.text()] as const; }))
      .then((contents) => setProse(Object.fromEntries(contents))).catch(() => setFailed(true));
  }, [work.slug, chapterNumber]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!selected && !entireWork) return <NotFound message="That chapter isn't in this work." />;
  const selectedIndex = selected ? work.chapters.indexOf(selected) : -1;
  return <article className="faeo3-reading"><h1>{work.title}</h1><p className="faeo3-byline">by {work.author}</p><dl><dt>Rating</dt><dd>{work.rating}</dd><dt>Archive Warnings</dt><dd>{work.archiveWarnings.join(", ") || "None"}</dd><dt>Category</dt><dd>{work.category.join(", ") || "—"}</dd><dt>Fandoms</dt><dd>{work.fandoms.join(", ") || "—"}</dd><dt>Relationships</dt><dd>{work.relationships.join(", ") || "—"}</dd><dt>Characters</dt><dd>{work.characters.join(", ") || "—"}</dd><dt>Additional Tags</dt><dd>{work.additionalTags.join(", ") || "—"}</dd><dt>Language</dt><dd>{work.language}</dd><dt>Published</dt><dd>{work.published || "Not listed"}</dd>{work.updated && <><dt>Updated</dt><dd>{work.updated}</dd></>}<dt>Chapters</dt><dd>{work.chapterCount}/{work.status.toLowerCase() === "complete" ? work.chapterCount : "?"}</dd><dt>Status</dt><dd>{work.status}</dd></dl>
    <section className="faeo3-summary"><h2>Summary</h2><p>{work.summary}</p>{work.notes && <aside><strong>Author's Notes</strong><p>{work.notes}</p></aside>}</section>
    {work.chapterCount > 1 && <nav className="faeo3-chapter-nav" aria-label="Chapter navigation"><label>Chapter <select value={entireWork ? "entire" : String(selected?.number)} onChange={(event) => navigate(event.target.value === "entire" ? `/secret/faeo3/works/${work.slug}` : `/secret/faeo3/works/${work.slug}/chapters/${event.target.value}`)}><option value="entire">Entire Work</option>{work.chapters.map((chapter) => <option value={chapter.number} key={chapter.number}>{chapter.number}: {chapter.title}</option>)}</select></label>{!entireWork && selectedIndex > 0 && <Link to={`/secret/faeo3/works/${work.slug}/chapters/${work.chapters[selectedIndex - 1].number}`}>← Previous Chapter</Link>}{!entireWork && selectedIndex < work.chapters.length - 1 && <Link to={`/secret/faeo3/works/${work.slug}/chapters/${work.chapters[selectedIndex + 1].number}`}>Next Chapter →</Link>}</nav>}
    {failed ? <p className="faeo3-prose-state">This chapter couldn't be loaded.</p> : chaptersToLoad.map((chapter) => <section className="faeo3-prose" key={chapter.number}>{work.chapterCount > 1 && <h2>Chapter {chapter.number}: {chapter.title}</h2>}{prose[chapter.number] == null ? <p>Loading chapter…</p> : <Prose text={prose[chapter.number]} />}</section>)}<Link to="/secret/faeo3">← Work index</Link></article>;
}

export default function FaeO3Page({ legacy = false }: { legacy?: boolean }) {
  const { slug, chapterNumber } = useParams();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { fetch("/lumi/faeo3/works-manifest.json").then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then(setWorks).catch(() => setError(true)); }, []);
  const work = useMemo(() => works?.find((item) => item.slug === slug), [works, slug]);
  if (legacy && slug) return <Navigate to={`/secret/faeo3/works/${slug}`} replace />;
  return <main className="secret-site-page faeo3-site"><Header />{error ? <NotFound message="The archive index couldn't be loaded." /> : works === null ? <section className="faeo3-index"><p>Loading the archive…</p></section> : slug && !work ? <NotFound message="That work doesn't exist in this archive." /> : work ? <WorkReader key={`${work.slug}-${chapterNumber ?? "entire"}`} work={work} chapterNumber={chapterNumber} /> : <WorkIndex works={works} />}</main>;
}
