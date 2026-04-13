import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import type { LocationRecord, MapLayerConfig } from "../types";

type LocationForm = {
  id?: number;
  slug: string;
  name: string;
  ring: string;
  court: string;
  faction: string;
  district: string;
  summary: string;
  body_markdown: string;
  tags: string;
  map_id: "" | MapLayerConfig["map_id"];
  landmark_slug: string;
  is_published: boolean;
};

const EMPTY_FORM: LocationForm = {
  slug: "",
  name: "",
  ring: "",
  court: "",
  faction: "",
  district: "",
  summary: "",
  body_markdown: "",
  tags: "",
  map_id: "",
  landmark_slug: "",
  is_published: false,
};

function toForm(location: LocationRecord): LocationForm {
  return {
    id: location.id,
    slug: location.slug,
    name: location.name,
    ring: location.ring || "",
    court: location.court || "",
    faction: location.faction || "",
    district: location.district || "",
    summary: location.summary || "",
    body_markdown: location.body_markdown || "",
    tags: location.tags.join(", "),
    map_id: location.map_id || "",
    landmark_slug: location.landmark_slug || "",
    is_published: location.is_published,
  };
}

function ringSortValue(ring: string) {
  const normalized = ring.toLowerCase();
  if (normalized.includes("inner")) return 0;
  if (normalized.includes("outer")) return 1;
  return 2;
}

export default function LocationsPage() {
  const { user } = useAuth();
  const isDm = user?.role === "dm";
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);

  const grouped = useMemo(() => {
    const groups = new Map<string, LocationRecord[]>();
    for (const location of locations) {
      const ring = location.ring?.trim() || "Unringed";
      const list = groups.get(ring) || [];
      list.push(location);
      groups.set(ring, list);
    }

    return Array.from(groups.entries())
      .map(([ring, entries]) => ({
        ring,
        entries: entries.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        const rank = ringSortValue(a.ring) - ringSortValue(b.ring);
        return rank !== 0 ? rank : a.ring.localeCompare(b.ring);
      });
  }, [locations]);

  async function loadLocations() {
    try {
      setLoading(true);
      setError("");
      const response = await apiFetch("/api/locations");
      const data = (await response.json()) as { locations?: LocationRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load locations");
      }
      setLocations(Array.isArray(data.locations) ? data.locations : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load locations");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLocations();
  }, []);

  async function saveLocation() {
    if (!isDm) return;
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await apiFetch(form.id ? `/api/locations/${form.id}` : "/api/locations", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({
          slug: form.slug,
          name: form.name,
          ring: form.ring,
          court: form.court,
          faction: form.faction,
          district: form.district,
          summary: form.summary,
          body_markdown: form.body_markdown,
          tags: form.tags,
          map_id: form.map_id || null,
          landmark_slug: form.landmark_slug,
          is_published: form.is_published,
        }),
      });
      const data = (await response.json()) as { location?: LocationRecord; error?: string };
      if (!response.ok || !data.location) {
        throw new Error(data.error || "Failed to save location");
      }
      setForm(EMPTY_FORM);
      setLocations((current) => {
        const others = current.filter((item) => item.id !== data.location?.id);
        return [...others, data.location as LocationRecord];
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="home-page locations-page">
      <section className="page-heading">
        <h1>Locations Atlas</h1>
        <p className="topbar-meta">An at-a-glance library of notable places across the rings.</p>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="topbar-meta">Loading locations…</p> : null}

      <section className="locations-groups">
        {grouped.map((group) => (
          <article className="state-card" key={group.ring}>
            <h2>{group.ring}</h2>
            <div className="locations-card-grid">
              {group.entries.map((location) => (
                <Link to={`/locations/${location.slug}`} className="locations-card" key={location.id}>
                  <p className="chapter-list-meta">{location.ring || "Unringed"}</p>
                  <h3>{location.name}</h3>
                  <p className="topbar-meta">
                    {[location.court, location.faction, location.district].filter(Boolean).join(" • ") || "—"}
                  </p>
                  {location.summary ? <p>{location.summary}</p> : null}
                  {location.map_id ? <p className="chapter-list-meta">Map: {location.map_id}</p> : null}
                  {isDm ? (
                    <span className={`chapter-status ${location.is_published ? "published" : "draft"}`.trim()}>
                      {location.is_published ? "Published" : "Draft"}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      {isDm ? (
        <section className="state-card locations-admin-card">
          <h2>{form.id ? "Edit Location" : "Create Location"}</h2>
          <div className="chapter-editor-grid documents-editor-grid">
            <label className="toolbar-field"><span>Name</span><input className="text-input" value={form.name} onChange={(e)=>setForm((c)=>({...c,name:e.target.value}))} /></label>
            <label className="toolbar-field"><span>Slug</span><input className="text-input" value={form.slug} onChange={(e)=>setForm((c)=>({...c,slug:e.target.value}))} /></label>
            <label className="toolbar-field"><span>Ring</span><input className="text-input" value={form.ring} onChange={(e)=>setForm((c)=>({...c,ring:e.target.value}))} /></label>
            <label className="toolbar-field"><span>Court</span><input className="text-input" value={form.court} onChange={(e)=>setForm((c)=>({...c,court:e.target.value}))} /></label>
            <label className="toolbar-field"><span>Faction</span><input className="text-input" value={form.faction} onChange={(e)=>setForm((c)=>({...c,faction:e.target.value}))} /></label>
            <label className="toolbar-field"><span>District / Category</span><input className="text-input" value={form.district} onChange={(e)=>setForm((c)=>({...c,district:e.target.value}))} /></label>
            <label className="toolbar-field"><span>Map</span><input className="text-input" value={form.map_id} placeholder="overworld / inner-ring / outer-ring" onChange={(e)=>setForm((c)=>({...c,map_id:e.target.value as LocationForm['map_id']}))} /></label>
            <label className="toolbar-field"><span>Landmark slug</span><input className="text-input" value={form.landmark_slug} onChange={(e)=>setForm((c)=>({...c,landmark_slug:e.target.value}))} /></label>
            <label className="toolbar-field"><span>Tags (comma-separated)</span><input className="text-input" value={form.tags} onChange={(e)=>setForm((c)=>({...c,tags:e.target.value}))} /></label>
            <label className="toolbar-field"><span>Summary</span><input className="text-input" value={form.summary} onChange={(e)=>setForm((c)=>({...c,summary:e.target.value}))} /></label>
          </div>
          <label className="toolbar-field">
            <span>Body (markdown + wiki-links)</span>
            <textarea className="text-area" rows={8} value={form.body_markdown} onChange={(e)=>setForm((c)=>({...c,body_markdown:e.target.value}))} />
          </label>
          <label className="documents-upload-button"><input type="checkbox" checked={form.is_published} onChange={(e)=>setForm((c)=>({...c,is_published:e.target.checked}))} /> Published</label>
          <div className="dashboard-row-actions documents-editor-actions">
            <button className="secondary-link" type="button" onClick={()=>setForm(EMPTY_FORM)}>Reset</button>
            <button className="action-button" type="button" onClick={()=>void saveLocation()} disabled={saving}>{saving ? "Saving..." : (form.id ? "Save Location" : "Create Location")}</button>
          </div>
          <div className="chapter-list">
            {locations.map((location) => (
              <button key={location.id} type="button" className="chapter-list-link" onClick={() => setForm(toForm(location))}>
                {location.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
