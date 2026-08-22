import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type ArchiveKind = "faeo3" | "pixie";
type Work = { id:string; slug:string; title:string; summary?:string; description?:string; rating?:string; relationships?:string[]; characters?:string[]; charms?:string[]; warnings?:string[]; cycle?:string; status?:string; body?:string; authorNotes?:string; tags?:string[]; type?:string; images?:Array<{src:string;alt?:string;caption?:string}>; pixieSlug?:string; faeo3Slug?:string };

const accountNames: Record<ArchiveKind, string> = { faeo3: "faeO3", pixie: "pixie" };

function Markdown({ children }: { children: string }) {
  return <>{children.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph.split(/(\*\*[^*]+\*\*)/).map((part, partIndex) => part.startsWith("**") ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part)}</p>)}</>;
}

function SecretLogin({ kind, onUnlock }: { kind: ArchiveKind; onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await apiFetch(`/api/secrets/lumi_${kind}/unlock`, {
      method: "POST",
      body: JSON.stringify({ username: accountNames[kind], password }),
    });
    if (response.ok) onUnlock();
    else {
      setMessage(kind === "faeo3" ? "nope. absolutely not the right ship." : "that folder stays private.");
      setPassword("");
    }
    setBusy(false);
  }

  return <section className="secret-login-panel" aria-labelledby={`${kind}-login-heading`}>
    <p className="secret-login-kicker">Account found</p>
    <h2 id={`${kind}-login-heading`}>Sign in to {accountNames[kind]}</h2>
    {message ? <p className="secret-login-error" role="alert">{message}</p> : null}
    <form onSubmit={submit}>
      <label>Username<input name="username" value={accountNames[kind]} autoComplete="username" readOnly /></label>
      <label>Password<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      <button className="secret-action" type="submit" disabled={busy}>{busy ? "Signing in…" : "Login"}</button>
    </form>
  </section>;
}

function Faeo3Discovery({ onUnlock }: { onUnlock: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return <main className="secret-discovery secret-notebook">
    <div className="secret-page notebook-paper">
      <Link className="secret-return" to="/directory/lumi-turnleaf">← close notebook</Link>
      <header className="notebook-heading"><p>Lumi’s extremely private planning notebook</p><h1>things i am definitely not writing</h1></header>
      <section className="notebook-columns" aria-label="Story planning notes">
        <article className="notebook-entry"><h2>the moon one</h2><p><strong>pairing:</strong> knight / thorn witch</p><p><strong>tags:</strong> enemies to co-conspirators, yearning, one suspicious moth</p><p className="margin-scrawl">the height difference is important!!</p></article>
        <aside className="notebook-sticky" aria-label="Plot reminder"><strong>chapter three</strong><p>rain scene? accidental hand holding? both?</p></aside>
        <article className="notebook-entry"><h2>crown disaster</h2><p><strong>pairing:</strong> princess / court assassin</p><p className="crossed-out">this is a serious political thriller</p><p>fine. it’s a <mark>crack ship</mark>. everyone is going to call it that anyway.</p></article>
        <aside className="notebook-margin" aria-label="Margin note">not canon ≠ not compelling</aside>
      </section>
      <button className="notebook-scrap secret-action" type="button" aria-expanded={revealed} aria-controls="faeo3-password-clue" onClick={() => setRevealed(true)}>
        {revealed ? "password reminder — unfolded" : "folded scrap — password reminder"}
      </button>
      {revealed ? <div id="faeo3-password-clue" className="secret-reveal" aria-live="polite">
        <p><strong>password reminder</strong><br />what everyone is going to call this pairing anyway</p>
        <SecretLogin kind="faeo3" onUnlock={onUnlock} />
      </div> : null}
    </div>
  </main>;
}

const folders = [
  { name: "references", detail: "poses, fabrics, lighting" },
  { name: "finished", detail: "actually presentable" },
  { name: "commissions", detail: "in progress" },
];

function PixieDiscovery({ onUnlock }: { onUnlock: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return <main className="secret-discovery secret-directory">
    <div className="secret-page pixie-browser">
      <header className="pixie-browser-header"><div><p>Pixie / LumiTurnleaf / private</p><h1>art directory</h1></div><Link className="secret-return" to="/directory/lumi-turnleaf">Return to FaeBook</Link></header>
      <p className="directory-intro">Local folders · last sorted at an unreasonable hour</p>
      <section className="secret-grid" aria-label="Private art folders">
        {folders.map((folder) => <button className="folder-card secret-action" type="button" key={folder.name} aria-label={`Open ${folder.name} folder`}><span className="folder-icon" aria-hidden="true" /><strong>{folder.name}</strong><small>{folder.detail}</small></button>)}
        <button className="folder-card folder-suspicious secret-action" type="button" aria-expanded={revealed} aria-controls="pixie-private-folder" onClick={() => setRevealed(true)} aria-label="Open do not post folder">
          <span className="folder-icon" aria-hidden="true" /><strong>do not post</strong><small>{revealed ? "folder open" : "private drafts"}</small>
        </button>
      </section>
      {revealed ? <section id="pixie-private-folder" className="folder-drawer" aria-live="polite">
        <div><p className="secret-login-kicker">do not post /</p><h2>Unpublished files</h2><ul><li>thornwitch_alt_final_FINAL.png</li><li>knight-shirt-study-03.png</li><li>court-assassin-closeup.png</li></ul><p className="pixie-password-hint"><strong>Password hint:</strong> folder name, no spaces.</p></div>
        <SecretLogin kind="pixie" onUnlock={onUnlock} />
      </section> : null}
    </div>
  </main>;
}

function CrossLink({to,children}:{to:string;children:ReactNode}){return <Link className="secret-crosslink" to={to}>{children} →</Link>}
function Faeo3({works}:{works:Work[]}){const {slug}=useParams();const work=works.find(w=>w.slug===slug);if(work)return <main className="faeo3-site"><ArchiveHeader kind="faeo3"/><article className="faeo3-reading"><div className="faeo3-workhead"><h1>{work.title}</h1><dl><dt>Rating</dt><dd>{work.rating}</dd><dt>Warnings</dt><dd>{work.warnings?.join(", ")}</dd><dt>Relationships</dt><dd>{work.relationships?.join(", ")}</dd><dt>Characters</dt><dd>{work.characters?.join(", ")}</dd><dt>Charms</dt><dd>{work.charms?.join(", ")}</dd><dt>Status</dt><dd>{work.status}</dd></dl><h2>Summary</h2><p>{work.summary}</p><aside><strong>Author's note</strong><p>{work.authorNotes}</p></aside></div><section className="faeo3-prose"><Markdown>{work.body||""}</Markdown></section>{work.pixieSlug?<CrossLink to={`/secret/pixie/art/${work.pixieSlug}`}>Illustrations available on Pixie</CrossLink>:null}<nav className="secret-prevnext"><Link to="/secret/faeo3">← Tale index</Link></nav></article></main>;return <main className="faeo3-site"><ArchiveHeader kind="faeo3"/><section className="faeo3-index"><h1>Lumi Turnleaf's Tales</h1><p className="archive-private">A private grimoire. No Petals, Whispers, or public footprints are kept here.</p>{works.map(w=><article className="faeo3-listing" key={w.id}><h2><Link to={`/secret/faeo3/tales/${w.slug}`}>{w.title}</Link></h2><p className="faeo3-byline">by LumiTurnleaf · {w.status}</p><p>{w.summary}</p><ul className="charm-list">{[...(w.relationships||[]),...(w.characters||[]),...(w.charms||[])].map(x=><li key={x}>{x}</li>)}</ul></article>)}</section></main>}
function ArchiveHeader({kind}:{kind:ArchiveKind}){return <header className="secret-site-header"><Link to={`/secret/${kind}`} className="secret-brand">{kind==="faeo3"?<>FAEO3 <small>Fae Archive of Our Own</small></>:<>Pixie <small>Lumi's private atelier</small></>}</Link><nav>{kind==="faeo3"?"Tales · Hoards · Keepsakes · Grimoire":"Illustrations · Manga · Sketches · Panel Drafts"}</nav><Link to="/directory/lumi-turnleaf">Return to FaeBook</Link></header>}
function Pixie({works}:{works:Work[]}){const {slug}=useParams();const work=works.find(w=>w.slug===slug);const [page,setPage]=useState(0);if(work){const image=work.images?.[page];const at=works.indexOf(work);return <main className="pixie-site"><ArchiveHeader kind="pixie"/><article className="pixie-art"><div className="pixie-canvas"><img src={image?.src} alt={image?.alt||work.title}/><p>{image?.caption}</p>{(work.images?.length||0)>1?<div className="pixie-pages"><button disabled={!page} onClick={()=>setPage(p=>p-1)}>← Previous page</button><span>{page+1} / {work.images?.length}</span><button disabled={page===(work.images?.length||1)-1} onClick={()=>setPage(p=>p+1)}>Next page →</button></div>:null}</div><aside><p className="pixie-type">{work.type}</p><h1>{work.title}</h1><p>{work.description}</p><div className="pixie-tags">{work.tags?.map(t=><span key={t}>#{t}</span>)}</div>{work.faeo3Slug?<CrossLink to={`/secret/faeo3/tales/${work.faeo3Slug}`}>Based on Tale #{works[at]?.id} on FAEO3</CrossLink>:null}<nav className="secret-prevnext">{at>0?<Link to={`/secret/pixie/art/${works[at-1].slug}`}>← Previous artwork</Link>:<span/>}{at<works.length-1?<Link to={`/secret/pixie/art/${works[at+1].slug}`}>Next artwork →</Link>:null}</nav></aside></article></main>}const groups=["illustration","manga","sketch","panel-draft"];return <main className="pixie-site"><ArchiveHeader kind="pixie"/><section className="pixie-profile"><div className="pixie-avatar">L</div><div><h1>Lumi Turnleaf</h1><p>private sketches, finished things, and things that are none of your business.</p></div></section><section className="pixie-gallery">{groups.map(g=>{const items=works.filter(w=>w.type===g);return items.length?<section key={g}><h2>{g.replace("panel-draft","Panel Drafts").replace(/^./,c=>c.toUpperCase())}</h2><div className="pixie-grid">{items.map(w=><Link to={`/secret/pixie/art/${w.slug}`} key={w.id}><img src={w.images?.[0]?.src} alt={w.images?.[0]?.alt||w.title}/><strong>{w.title}</strong><p>{w.tags?.map(t=>`#${t}`).join("  ")}</p></Link>)}</div></section>:null})}</section></main>}

export default function SecretArchivePage({kind}:{kind:ArchiveKind}){const [state,setState]=useState<"loading"|"locked"|"open">("loading");const [works,setWorks]=useState<Work[]>([]);async function load(){const status=await apiFetch(`/api/secrets/lumi_${kind}/status`);if(!status.ok){setState("locked");return}const data=await status.json();if(!data.unlocked){setState("locked");return}const content=await apiFetch(`/api/secrets/lumi_${kind}/content`);if(!content.ok){setState("locked");return}setWorks((await content.json()).works||[]);setState("open")}// Loading is intentionally tied to the route kind; `load` is recreated per render.
// eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
useEffect(()=>{void load()},[kind]);if(state==="loading")return <main className={`secret-lock secret-${kind}`}><p>checking the wards...</p></main>;if(state==="locked")return kind==="faeo3"?<Faeo3Discovery onUnlock={()=>void load()}/>:<PixieDiscovery onUnlock={()=>void load()}/>;return kind==="faeo3"?<Faeo3 works={works}/>:<Pixie works={works}/>}
