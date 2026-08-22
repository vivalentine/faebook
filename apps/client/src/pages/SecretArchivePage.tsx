import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type ArchiveKind = "faeo3" | "pixie";
type Work = { id: string; slug: string; title: string };

const secretSiteUsername = "xX_LumiLuvsYuri_Xx";
const pixieLoginBackgrounds: string[] = [];

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
      body: JSON.stringify({ username: secretSiteUsername, password }),
    });
    if (response.ok) onUnlock();
    else {
      setMessage("Incorrect username or password.");
      setPassword("");
    }
    setBusy(false);
  }

  return <form className="secret-login-form" onSubmit={submit}>
    {message ? <p className="secret-login-error" role="alert">{message}</p> : null}
    <label>Username<input name="username" value={secretSiteUsername} autoComplete="username" readOnly /></label>
    <label>Password<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus /></label>
    <button type="submit" disabled={busy}>{busy ? "Logging in…" : "Log In"}</button>
  </form>;
}

function Faeo3Login({ onUnlock }: { onUnlock: () => void }) {
  const categories = ["All Fandoms", "Anime & Manga", "Books & Literature", "Music & Performers", "Original Works", "Other Media"];
  return <main className="faeo3-login-site">
    <header className="faeo3-login-header">
      <div className="faeo3-identity-row">
        <div className="faeo3-logo"><strong>FaeO3</strong><span>Fae Archive of Our Own</span></div>
        <span className="faeo3-login-context">Log in to FaeO3</span>
      </div>
      <div className="faeo3-navigation-row">
        <nav aria-label="Archive navigation"><span>Fandoms</span><span>Browse</span><span>Search</span><span>About</span></nav>
        <label className="faeo3-search"><span className="sr-only">Search</span><input type="search" /></label>
      </div>
    </header>
    <div className="faeo3-login-layout">
      <aside className="faeo3-categories"><h2>Find your favorites</h2><ul>{categories.map((category) => <li key={category}>{category}</li>)}</ul></aside>
      <section className="faeo3-welcome">
        <p className="faeo3-intro">A non-profit, non-commercial archive for transformative fanworks, created by and for fans.</p>
        <div className="faeo3-account-panel">
          <h1>Log in to FaeO3</h1><p>With a FaeO3 account, you can:</p>
          <ul><li>Post and organize your fanworks</li><li>Bookmark works you want to revisit</li><li>Subscribe to authors and series</li><li>Keep private works private</li></ul>
          <SecretLogin kind="faeo3" onUnlock={onUnlock} />
        </div>
      </section>
    </div>
  </main>;
}

function PixieLogin({ onUnlock }: { onUnlock: () => void }) {
  const [background] = useState(() => pixieLoginBackgrounds.length ? pixieLoginBackgrounds[Math.floor(Math.random() * pixieLoginBackgrounds.length)] : "");
  return <main className={`pixie-login-site${background ? " has-art" : ""}`} style={background ? { backgroundImage: `linear-gradient(#0004,#0004), url(${background})` } : undefined}>
    <section className="pixie-login-modal">
      <div className="pixie-logo">pixie</div><p className="pixie-tagline">art lives here.</p><h1>Log in to Pixie</h1>
      <SecretLogin kind="pixie" onUnlock={onUnlock} />
    </section>
  </main>;
}

function ArchiveHeader({ kind }: { kind: ArchiveKind }) {
  return <header className="secret-site-header"><Link to={`/secret/${kind}`} className="secret-brand">{kind === "faeo3" ? <><strong>FaeO3</strong><small>Fae Archive of Our Own</small></> : <strong>pixie</strong>}</Link><Link to="/directory/lumi-turnleaf">Return to FaeBook</Link></header>;
}

function AuthenticatedArchive({ kind, works }: { kind: ArchiveKind; works: Work[] }) {
  return <main className={`${kind}-site`}><ArchiveHeader kind={kind} /><section className="secret-empty-state"><p>{works.length ? null : kind === "faeo3" ? "Lumi hasn't posted anything here yet." : "No public works yet."}</p></section></main>;
}

export default function SecretArchivePage({ kind }: { kind: ArchiveKind }) {
  const [state, setState] = useState<"loading" | "locked" | "open">("loading");
  const [works, setWorks] = useState<Work[]>([]);
  const load = useCallback(async () => {
    const status = await apiFetch(`/api/secrets/lumi_${kind}/status`);
    if (!status.ok || !(await status.json()).unlocked) { setState("locked"); return; }
    const content = await apiFetch(`/api/secrets/lumi_${kind}/content`);
    if (!content.ok) { setState("locked"); return; }
    setWorks((await content.json()).works || []);
    setState("open");
  }, [kind]);

  // The route change is the external event that refreshes server-side unlock state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  if (state === "loading") return <main className={`secret-loading ${kind}-site`} role="status"><p>Loading…</p></main>;
  if (state === "locked") return kind === "faeo3" ? <Faeo3Login onUnlock={() => void load()} /> : <PixieLogin onUnlock={() => void load()} />;
  return <AuthenticatedArchive kind={kind} works={works} />;
}
