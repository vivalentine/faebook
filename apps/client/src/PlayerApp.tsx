import { useEffect, useState } from "react";
import "./App.css";

type Npc = {
  id: number;
  slug: string;
  name: string;
  house: string | null;
  faction: string | null;
  court: string | null;
  ring: string | null;
  rank_title: string | null;
  role: string | null;
  introduced_in: string | null;
  portrait_path: string | null;
  met_summary: string | null;
  short_blurb: string | null;
  is_visible: number;
  source_file: string | null;
  created_at: string;
  updated_at: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

function PlayerApp() {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadNpcs() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/api/npcs`);
        if (!response.ok) {
          throw new Error(`Failed to load NPCs: ${response.status}`);
        }

        const data = await response.json();
        setNpcs(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error loading NPCs";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadNpcs();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FaeBook</p>
          <h1>Player Directory</h1>
        </div>
        <div className="topbar-meta">
          <span>{npcs.length} NPCs unlocked</span>
        </div>
      </header>

      <main className="main-content">
        {loading ? (
          <div className="state-card">
            <p>Loading NPCs...</p>
          </div>
        ) : error ? (
          <div className="state-card error-card">
            <p>{error}</p>
          </div>
        ) : npcs.length === 0 ? (
          <div className="state-card">
            <p>No NPCs revealed yet.</p>
          </div>
        ) : (
          <section className="npc-grid">
            {npcs.map((npc) => {
              const imageUrl = npc.portrait_path
                ? `${API_BASE_URL}${npc.portrait_path}`
                : "";

              return (
                <article className="npc-card" key={npc.id}>
                  <div className="npc-image-wrap">
                    {imageUrl ? (
                      <img
                        className="npc-image"
                        src={imageUrl}
                        alt={npc.name}
                      />
                    ) : (
                      <div className="npc-image placeholder">No image</div>
                    )}
                  </div>

                  <div className="npc-card-body">
                    <div className="npc-card-header">
                      <div>
                        <h2>{npc.name}</h2>
                        <p className="rank-line">
                          {npc.rank_title || npc.role || "Unranked"}
                        </p>
                      </div>

                      <span className="visibility-pill visible">Unlocked</span>
                    </div>

                    <div className="meta-row">
                      {npc.house ? <span>House: {npc.house}</span> : null}
                      {npc.court ? <span>Court: {npc.court}</span> : null}
                      {npc.ring ? <span>Ring: {npc.ring}</span> : null}
                    </div>

                    {npc.short_blurb ? (
                      <p className="blurb">{npc.short_blurb}</p>
                    ) : null}

                    {npc.met_summary ? (
                      <div className="summary-box">
                        <p className="summary-label">Met when</p>
                        <p>{npc.met_summary}</p>
                      </div>
                    ) : null}

                    {npc.introduced_in ? (
                      <p className="introduced-in">
                        <strong>First introduced:</strong> {npc.introduced_in}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

export default PlayerApp;