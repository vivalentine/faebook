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

  const metadataChips = useMemo(() => {
    if (!location) return [] as Array<{ key: string; label?: string; value: string }>;

    const chips: Array<{ key: string; label?: string; value: string }> = [];

    if (location.ring) {
      chips.push({ key: `ring-${location.ring}`, label: "Ring", value: location.ring });
    }
    if (location.court) {
      chips.push({ key: `court-${location.court}`, label: "Court", value: location.court });
    }
    if (location.district) {
      chips.push({ key: `district-${location.district}`, label: "District", value: location.district });
    }
    if (location.map_id) {
      chips.push({ key: `map-${location.map_id}`, label: "Map", value: location.map_id });
    }
    if (location.landmark_slug) {
      chips.push({ key: `landmark-${location.landmark_slug}`, label: "Landmark", value: location.landmark_slug });
    }

    for (const tag of location.tags) {
      chips.push({ key: `tag-${tag}`, label: "Tag", value: tag });
    }

    return chips;
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
        {metadataChips.length > 0 ? (
          <div className="chapter-chip-row" aria-label="Location metadata">
            {metadataChips.map((chip) => (
              <span key={chip.key} className="chapter-chip">
                {chip.label ? <strong>{chip.label}:</strong> : null}
                <span>{chip.value}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="dashboard-markdown documents-reader-markdown">
          {renderRecapMarkdown(location.body_markdown || location.summary || "", { entityIndex })}
        </div>
      </section>
    </main>
  );
}
