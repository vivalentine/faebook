import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { renderRecapMarkdown } from "../components/RecapMarkdown";
import { apiFetch } from "../lib/api";
import { useWikiEntityIndex } from "../lib/wikiLinks";
import type { LocationRecord } from "../types";

export default function LocationDetailPage() {
  const { slug = "" } = useParams();
  const entityIndex = useWikiEntityIndex();
  const [location, setLocation] = useState<LocationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadLocation() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/locations/${encodeURIComponent(slug)}`);
        const data = (await response.json()) as { location?: LocationRecord; error?: string };
        if (!response.ok || !data.location) {
          throw new Error(data.error || "Location not found");
        }
        if (active) {
          setLocation(data.location);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load location");
          setLocation(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLocation();
    return () => {
      active = false;
    };
  }, [slug]);

  const metadata = useMemo(() => {
    if (!location) return [] as string[];
    return [location.ring, location.court, location.faction, location.district].filter(Boolean) as string[];
  }, [location]);

  if (loading) {
    return <main className="home-page"><p className="topbar-meta">Loading location…</p></main>;
  }

  if (!location) {
    return (
      <main className="home-page">
        <p className="error-banner">{error || "Location not found."}</p>
        <Link to="/locations" className="secondary-link">Back to Locations</Link>
      </main>
    );
  }

  return (
    <main className="home-page location-detail-page">
      <section className="page-heading">
        <p className="eyebrow">Locations</p>
        <h1>{location.name}</h1>
        <p className="topbar-meta">{location.summary || "No summary available."}</p>
      </section>
      <section className="state-card">
        <div className="chapter-chip-row">
          {metadata.map((value) => (
            <span key={value} className="chapter-chip">{value}</span>
          ))}
          {location.map_id ? <span className="chapter-chip">Map: {location.map_id}</span> : null}
          {location.landmark_slug ? <span className="chapter-chip">Landmark: {location.landmark_slug}</span> : null}
          {location.tags.map((tag) => (
            <span key={tag} className="chapter-chip">#{tag}</span>
          ))}
        </div>
        <div className="dashboard-markdown documents-reader-markdown">
          {renderRecapMarkdown(location.body_markdown || location.summary || "", { entityIndex })}
        </div>
      </section>
    </main>
  );
}
