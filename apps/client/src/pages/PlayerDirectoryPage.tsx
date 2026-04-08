import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NpcCard from "../components/NpcCard";
import { useAuth } from "../auth/AuthContext";
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

export default function PlayerDirectoryPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [search, setSearch] = useState("");
  const [houseFilter, setHouseFilter] = useState("all");

  useEffect(() => {
    loadNpcs();
  }, []);

  async function loadNpcs() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/npcs");
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

  async function handleLogout() {
    try {
      setLoggingOut(true);
      setError("");
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoggingOut(false);
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

      return matchesNpc(npc, normalizedQuery);
    });
  }, [houseFilter, npcs, search]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FaeBook</p>
          <h1>NPC Directory</h1>
        </div>

        <div className="topbar-meta topbar-meta-stack">
          <span>
            Showing {filteredNpcs.length} of {npcs.length} NPCs
          </span>
          <span>Signed in as {user?.display_name || user?.username || "Player"}</span>

          <div className="topbar-links">
            <Link to="/player/board">Open board</Link>
          </div>

          <button
            className="action-button secondary-link topbar-action"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
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
              <NpcCard key={npc.id} npc={npc} mode="player" />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
