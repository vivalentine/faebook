import { useEffect, useState } from "react";
import LumiSticker from "./LumiSticker";
import SecretLoginForm from "./SecretLoginForm";
import { PIXIE_LOGIN_BACKGROUNDS } from "./lumiAssets";

type GalleryItem = { id: string; filename: string; src: string; title: string; caption?: string; tags?: string[] };

function Gallery() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  useEffect(() => {
    fetch("/lumi/nsfw-pixie/gallery-manifest.json")
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data: GalleryItem[]) => setItems(data))
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  return <main className="secret-site-page pixie-site"><header className="pixie-feed-header"><div className="pixie-profile-mark"><strong>pixie</strong><LumiSticker sticker="moth" size={54} rotate={-5} /><LumiSticker sticker="cyan-sparkle" size={28} rotate={8} /></div><span>@xX_LumiLuvsYuri_Xx</span></header>
    <section className="pixie-gallery" aria-label="Lumi's private art gallery">
      {items === null && !error && <p className="pixie-gallery-state">Loading Lumi's gallery…</p>}
      {error && <p className="pixie-gallery-state">The gallery couldn't be loaded right now.</p>}
      {items?.length === 0 && <p className="pixie-gallery-state">Lumi hasn't posted anything here yet.</p>}
      {items?.map((item) => <button className="pixie-gallery-item" type="button" key={item.id} onClick={() => setSelected(item)} aria-label={`Open ${item.title}`}><img src={item.src} alt={item.title} loading="lazy" /><span>{item.title}</span></button>)}
    </section>
    {selected && <div className="pixie-lightbox" role="dialog" aria-modal="true" aria-label={selected.title} onClick={() => setSelected(null)}><article onClick={(event) => event.stopPropagation()}><button type="button" className="pixie-lightbox-close" onClick={() => setSelected(null)} aria-label="Close artwork">×</button><img src={selected.src} alt={selected.title} /><div className="pixie-art-details"><h1>{selected.title}</h1>{selected.caption && <p>{selected.caption}</p>}{selected.tags?.length ? <div className="pixie-feed-tags">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}</div></article></div>}
  </main>;
}

export default function PixiePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [background] = useState(() => PIXIE_LOGIN_BACKGROUNDS[Math.floor(Math.random() * PIXIE_LOGIN_BACKGROUNDS.length)]);
  if (unlocked) return <Gallery />;
  return <main className="secret-site-page pixie-login-site" style={{ backgroundImage: `linear-gradient(#0005, #0005), url("${background}")` }}><section className="pixie-login-modal"><div className="pixie-login-brand"><div className="pixie-logo">pixie</div><LumiSticker sticker="black-star" size={32} rotate={7} /></div><p className="pixie-tagline">art lives here.</p><h1>Log in to Pixie</h1><SecretLoginForm siteName="pixie" password="donotpost" onUnlock={() => setUnlocked(true)} /></section></main>;
}
