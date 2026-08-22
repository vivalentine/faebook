import { useEffect, useState } from "react";
import NpcPortrait from "../components/NpcPortrait";
import { apiFetch } from "../lib/api";
import type { Npc } from "../types";

const interests = [
  "idols",
  "manga",
  "yuri",
  "fanfiction",
  "gossip",
  "shipping",
  "pretty women with terrible judgment",
  "watching mortals make decisions",
];

export default function LumiProfilePage() {
  const [npc, setNpc] = useState<Npc | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/npcs/lumi-turnleaf")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load NPC: ${response.status}`);
        setNpc(await response.json());
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Failed to load NPC."));
  }, []);

  if (error) return <div className="app-shell"><div className="state-card error-card"><p>{error}</p></div></div>;
  if (!npc) return <div className="app-shell"><div className="state-card"><p>Loading NPC page...</p></div></div>;

  return <div className="app-shell lumi-page-shell">
    <main className="lumi-profile">
      <header className="lumi-masthead">
        <h1>~*~ LUMI TURNLEAF'S EXTREMELY NORMAL FAEBOOK PAGE ~*~</h1>
        <p className="lumi-subtitle">yes i changed the css. no you can't.</p>
        <div className="lumi-system"><span>profile permissions: don't worry about it</span><span>last updated: whenever i wanted</span></div>
      </header>

      <div className="lumi-marquee" aria-label="welcome 2 my page ★ behave badly but interestingly"><span>welcome 2 my page ★ behave badly but interestingly</span></div>

      <div className="lumi-layout">
        <aside className="lumi-sidebar">
          <section className="lumi-profile-card">
            <div className="lumi-portrait"><NpcPortrait npc={npc} variant="detail" /></div>
            <h2>Lumi Turnleaf</h2>
            <p className="lumi-handle">@lumi_turnleaf</p>
            <p className="lumi-elsewhere">find me elsewhere: xX_LumiLuvsYuri_Xx</p>
            <p className="lumi-online">● online probably</p>
            <p>hi!!!! i'm lumi. i write things, draw things, know things i probably shouldn't, and have been informed that "editing the production stylesheet for fun" is not an acceptable hobby. rude.</p>
          </section>

          <section className="lumi-widget lumi-art-folder">
            <h2>CURRENT ART FOLDER</h2>
            <code>~/art/DO_NOT_POST/</code>
            <small>seriously.</small>
          </section>

          <div className="lumi-stamps" aria-label="Profile badges">
            <span>THIS PAGE CONTAINS YURI</span><span>VIEW SOURCE AT YOUR OWN RISK</span><span>NO COURT ETIQUETTE</span>
          </div>
        </aside>

        <div className="lumi-main-column">
          <section className="lumi-widget">
            <h2>CURRENTLY</h2>
            <p>currently obsessed with: Lyra Glimmerthirst</p>
            <p>currently writing: NONE OF YOUR BUSINESS</p>
            <p>currently drawing: ALSO NONE OF YOUR BUSINESS</p>
          </section>

          <article className="lumi-post">
            <p>okay but "crack ship" is a coward's phrase. if the chemistry works, the chemistry works. i'm just saying.</p>
            <div className="lumi-tags"><span>#fanfic</span><span>#shipping</span><span>#crackship</span><span>#i can explain</span></div>
          </article>

          <section className="lumi-widget">
            <h2>INTERESTS</h2>
            <div className="lumi-interests">{interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
          </section>
        </div>
      </div>
    </main>
  </div>;
}
