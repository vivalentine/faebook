import { useEffect, useMemo, useState } from "react";
import NpcCard from "../components/NpcCard";
import { apiFetch } from "../lib/api";
import type { Npc } from "../types";

function matchesNpc(npc: Npc, query: string) {
  if (!query) return true;

  const haystack = [
    npc.name,
    npc.house,
    npc.court,
    npc.ring,
    npc.rank_title,
    npc.role,
    npc.short_blurb,
    npc.met_summary,
    npc.introduced_in,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function DmDirectoryPage() {

  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingSlug, setSavingSlug] = useState("");
  const [search, setSearch] = useState("");
  const [houseFilter, setHouseFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  useEffect(() => {
    loadNpcs();
  }, []);

  async function loadNpcs() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/dm/npcs");
      if (!response.ok) {
        throw new Error(`Failed to load NPCs: ${response.status}`);
      }

      const data = await response.json();
      setNpcs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleVisibility(npc: Npc) {
    try {
      setSavingSlug(npc.slug);
      setError("");

      const response = await apiFetch(
        npc.is_visible
          ? `/api/dm/npcs/${npc.slug}/hide`
          : `/api/dm/npcs/${npc.slug}/reveal`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error(`Failed to update NPC: ${response.status}`);
      }

      const updatedNpc = await response.json();

      setNpcs((current) =>
        current.map((item) => (item.slug === updatedNpc.slug ? updatedNpc : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingSlug("");
    }
  }

  const houses = useMemo(() => {
    const values = Array.from(
      new Set(npcs.map((npc) => npc.house).filter(Boolean) as string[])
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [npcs]);

  const filteredNpcs = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return npcs.filter((npc) => {
      if (houseFilter !== "all" && npc.house !== houseFilter) {
        return false;
      }

      if (visibilityFilter === "visible" && !npc.is_visible) {
        return false;
      }

      if (visibilityFilter === "hidden" && npc.is_visible) {
        return false;
      }

      return matchesNpc(npc, normalizedQuery);
    });
  }, [houseFilter, npcs, search, visibilityFilter]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FaeBook</p>
          <h1>DM Control Panel</h1>
        </div>

        <div className="topbar-meta topbar-meta-stack">
          <span>
            Showing {filteredNpcs.length} of {npcs.length} NPCs
          </span>
        </div>
      </header>

      <main className="main-content">
        <section className="toolbar-card">
          <div className="toolbar-grid">
            <label className="toolbar-field">
              <span>Search</span>
              <input
                className="text-input"
                type="text"
                placeholder="Search by name, house, court, blurb..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="toolbar-field">
              <span>House</span>
              <select
                className="text-input"
                value={houseFilter}
                onChange={(event) => setHouseFilter(event.target.value)}
              >
                <option value="all">All houses</option>
                {houses.map((house) => (
                  <option key={house} value={house}>
                    {house}
                  </option>
                ))}
              </select>
            </label>

            <label className="toolbar-field">
              <span>Visibility</span>
              <select
                className="text-input"
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value)}
              >
                <option value="all">All entries</option>
                <option value="visible">Visible to players</option>
                <option value="hidden">Hidden from players</option>
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <div className="state-card">
            <p>Loading NPCs...</p>
          </div>
        ) : error ? (
          <div className="state-card error-card">
            <p>{error}</p>
          </div>
        ) : filteredNpcs.length === 0 ? (
          <div className="state-card">
            <p>No NPCs match the current filters.</p>
          </div>
        ) : (
          <section className="npc-grid">
            {filteredNpcs.map((npc) => (
              <NpcCard
                key={npc.id}
                npc={npc}
                mode="dm"
                onToggleVisibility={toggleVisibility}
                savingSlug={savingSlug}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
