import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FaeSelect from "../components/FaeSelect";
import TiledMapViewer, { type TiledMapViewerHandle } from "../components/TiledMapViewer";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import type {
  MapLandmark,
  MapLandmarkMarkerStyle,
  MapLandmarkVisibilityScope,
  MapLayerConfig,
  LocationRecord,
  MapPin,
  MapPinCategory,
} from "../types";

const PIN_CATEGORIES: MapPinCategory[] = ["clue", "lead", "suspect", "danger", "meeting", "theory"];
const LANDMARK_MARKER_STYLES: MapLandmarkMarkerStyle[] = ["landmark", "district", "estate", "civic", "market"];
const LANDMARK_VISIBILITY_SCOPES: MapLandmarkVisibilityScope[] = ["public", "dm_only"];

type PinDraft = {
  title: string;
  note: string;
  category: MapPinCategory;
};

const EMPTY_DRAFT: PinDraft = {
  title: "",
  note: "",
  category: "clue",
};

type EditorState = {
  mode: "create" | "edit";
  pinId?: number;
  mapLayer: MapLayerConfig["map_id"];
  x: number;
  y: number;
  draft: PinDraft;
};

type LandmarkDraft = {
  label: string;
  slug: string;
  marker_style: MapLandmarkMarkerStyle;
  visibility_scope: MapLandmarkVisibilityScope;
  description: string;
  linked_page_slug: string;
  linked_entity_slug: string;
  sort_order: number;
  unlock_chapter: string;
};

const EMPTY_LANDMARK_DRAFT: LandmarkDraft = {
  label: "",
  slug: "",
  marker_style: "landmark",
  visibility_scope: "public",
  description: "",
  linked_page_slug: "",
  linked_entity_slug: "",
  sort_order: 0,
  unlock_chapter: "",
};

function formatTimestampForFilename(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}${minute}`;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MapsPage() {
  const { user } = useAuth();
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [landmarks, setLandmarks] = useState<MapLandmark[]>([]);
  const [locationsBySlug, setLocationsBySlug] = useState<Record<string, LocationRecord>>({});
  const [activeLayerId, setActiveLayerId] = useState<MapLayerConfig["map_id"] | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [landmarkAddMode, setLandmarkAddMode] = useState(false);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [landmarkEditor, setLandmarkEditor] = useState<
    | {
        mode: "create" | "edit";
        landmarkId?: number;
        map_id: MapLayerConfig["map_id"];
        x: number;
        y: number;
        draft: LandmarkDraft;
      }
    | null
  >(null);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<number | null>(null);

  const mapViewerRef = useRef<TiledMapViewerHandle | null>(null);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.map_id === activeLayerId) || null,
    [layers, activeLayerId],
  );

  const visiblePins = useMemo(
    () => pins.filter((pin) => pin.map_layer === activeLayerId),
    [pins, activeLayerId],
  );

  const visibleLandmarks = useMemo(
    () => landmarks.filter((landmark) => landmark.map_id === activeLayerId),
    [landmarks, activeLayerId],
  );

  const selectedLandmark = useMemo(
    () => visibleLandmarks.find((landmark) => landmark.id === selectedLandmarkId) || null,
    [visibleLandmarks, selectedLandmarkId],
  );
  const locationsByLandmarkSlug = useMemo(() => {
    const next: Record<string, LocationRecord> = {};
    for (const location of Object.values(locationsBySlug)) {
      if (!location.landmark_slug) continue;
      next[location.landmark_slug] = location;
    }
    return next;
  }, [locationsBySlug]);
  const selectedLandmarkLocation = useMemo(() => {
    if (!selectedLandmark) return null;
    const candidateSlugs = [selectedLandmark.slug, selectedLandmark.linked_entity_slug].filter(
      Boolean,
    ) as string[];

    for (const candidateSlug of candidateSlugs) {
      const locationBySlug = locationsBySlug[candidateSlug];
      if (locationBySlug) return locationBySlug;

      const locationByLandmarkSlug = locationsByLandmarkSlug[candidateSlug];
      if (locationByLandmarkSlug) return locationByLandmarkSlug;
    }

    return null;
  }, [locationsByLandmarkSlug, locationsBySlug, selectedLandmark]);

  const loadMaps = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [configResponse, pinResponse, landmarkResponse, locationsResponse] = await Promise.all([
        apiFetch("/api/maps/config"),
        apiFetch("/api/maps/pins"),
        apiFetch("/api/maps/landmarks"),
        apiFetch("/api/locations"),
      ]);

      const configData = await configResponse.json();
      const pinData = await pinResponse.json();
      const landmarkData = await landmarkResponse.json();
      const locationsData = await locationsResponse.json();

      if (!configResponse.ok) {
        throw new Error(configData.error || `Failed to load maps config: ${configResponse.status}`);
      }

      if (!pinResponse.ok) {
        throw new Error(pinData.error || `Failed to load map pins: ${pinResponse.status}`);
      }
      if (!landmarkResponse.ok) {
        throw new Error(
          landmarkData.error || `Failed to load map landmarks: ${landmarkResponse.status}`,
        );
      }

      const nextLayers: MapLayerConfig[] = Array.isArray(configData.layers)
        ? configData.layers
        : [];

      setLayers(nextLayers);
      setPins(Array.isArray(pinData.pins) ? pinData.pins : []);
      setLandmarks(Array.isArray(landmarkData.landmarks) ? landmarkData.landmarks : []);
      const nextLocations = Array.isArray(locationsData.locations) ? locationsData.locations : [];
      setLocationsBySlug(
        nextLocations.reduce((acc: Record<string, LocationRecord>, location: LocationRecord) => {
          acc[location.slug] = location;
          return acc;
        }, {}),
      );

      if (nextLayers[0]) {
        setActiveLayerId((current) => {
          const selected = current || nextLayers[0].map_id;
          const layer = nextLayers.find((entry) => entry.map_id === selected) || nextLayers[0];
          return layer.map_id;
        });
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load maps");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  async function savePin(payload: {
    method: "POST" | "PATCH";
    id?: number;
    map_layer: MapLayerConfig["map_id"];
    x: number;
    y: number;
    draft: PinDraft;
  }) {
    setSaving(true);
    setError("");

    try {
      const endpoint = payload.method === "PATCH" ? `/api/maps/pins/${payload.id}` : "/api/maps/pins";
      const response = await apiFetch(endpoint, {
        method: payload.method,
        body: JSON.stringify({
          map_layer: payload.map_layer,
          x: payload.x,
          y: payload.y,
          title: payload.draft.title,
          note: payload.draft.note,
          category: payload.draft.category,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save pin");
      }

      setPins((current) => {
        if (payload.method === "POST") {
          return [data, ...current];
        }
        return current.map((pin) => (pin.id === data.id ? data : pin));
      });

      setEditorState(null);
      setAddMode(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save pin");
    } finally {
      setSaving(false);
    }
  }

  async function archivePin(pinId: number) {
    setSaving(true);
    setError("");

    try {
      const response = await apiFetch(`/api/maps/pins/${pinId}/archive`, {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive pin");
      }

      setPins((current) => current.filter((pin) => pin.id !== pinId));
      setEditorState(null);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive pin");
    } finally {
      setSaving(false);
    }
  }

  async function saveLandmark(payload: {
    method: "POST" | "PATCH";
    id?: number;
    map_id: MapLayerConfig["map_id"];
    x: number;
    y: number;
    draft: LandmarkDraft;
  }) {
    setSaving(true);
    setError("");
    try {
      const endpoint =
        payload.method === "PATCH" ? `/api/maps/landmarks/${payload.id}` : "/api/maps/landmarks";
      const response = await apiFetch(endpoint, {
        method: payload.method,
        body: JSON.stringify({
          map_id: payload.map_id,
          x: payload.x,
          y: payload.y,
          label: payload.draft.label,
          slug: payload.draft.slug,
          marker_style: payload.draft.marker_style,
          visibility_scope: payload.draft.visibility_scope,
          description: payload.draft.description,
          linked_page_slug: payload.draft.linked_page_slug || null,
          linked_entity_slug: payload.draft.linked_entity_slug || null,
          sort_order: payload.draft.sort_order,
          unlock_chapter:
            payload.draft.unlock_chapter.trim() === ""
              ? null
              : Number(payload.draft.unlock_chapter),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save landmark");
      }

      setLandmarks((current) => {
        if (payload.method === "POST") {
          return [...current, data];
        }
        return current.map((landmark) => (landmark.id === data.id ? data : landmark));
      });
      setLandmarkEditor(null);
      setLandmarkAddMode(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save landmark");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLandmark(landmarkId: number) {
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(`/api/maps/landmarks/${landmarkId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete landmark");
      }
      setLandmarks((current) => current.filter((landmark) => landmark.id !== landmarkId));
      setSelectedLandmarkId((current) => (current === landmarkId ? null : current));
      setLandmarkEditor(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete landmark");
    } finally {
      setSaving(false);
    }
  }

  function onLayerChange(nextLayerId: string) {
    const nextLayer = layers.find((layer) => layer.map_id === nextLayerId);
    if (!nextLayer) return;

    setActiveLayerId(nextLayer.map_id);
    mapViewerRef.current?.resetView();
    setAddMode(false);
    setLandmarkAddMode(false);
    setEditorState(null);
    setLandmarkEditor(null);
    setSelectedLandmarkId(null);
  }

  function onMapPlacement(point: { x: number; y: number }) {
    if (!activeLayer) {
      return;
    }
    if (landmarkAddMode && user?.role === "dm") {
      setLandmarkEditor({
        mode: "create",
        map_id: activeLayer.map_id,
        x: point.x,
        y: point.y,
        draft: { ...EMPTY_LANDMARK_DRAFT },
      });
      return;
    }

    if (!addMode) {
      return;
    }

    setEditorState({
      mode: "create",
      mapLayer: activeLayer.map_id,
      x: point.x,
      y: point.y,
      draft: { ...EMPTY_DRAFT },
    });
  }

  const exportPins = useCallback(
    async (scope: "current" | "all") => {
      if (!user) return;
      const timestamp = formatTimestampForFilename();
      const scopedPins =
        scope === "current"
          ? pins.filter((pin) => pin.map_layer === activeLayerId)
          : [...pins];

      const payload = {
        metadata: {
          export_type: "map_pins_json",
          schema_version: "1.0",
          exported_at: new Date().toISOString(),
          exported_by_user_id: user.id,
          exported_by_username: user.username,
          app_name: "FaeBook",
        },
        pins: scopedPins,
      };

      const scopeLabel = scope === "current" ? activeLayerId : "all";
      downloadJson(`map-pins-${scopeLabel}-${timestamp}.json`, payload);

      try {
        await apiFetch("/api/exports/audit", {
          method: "POST",
          body: JSON.stringify({
            export_type: "map_pins_json",
            object_type: "map_pin",
            object_id: scopeLabel,
            message: `Exported map pins JSON (${scopeLabel})`,
          }),
        });
      } catch (_error) {
        // non-blocking
      }
    },
    [activeLayerId, pins, user],
  );

  if (loading) {
    return (
      <main className="main-content">
        <div className="state-card">
          <p>Loading maps...</p>
        </div>
      </main>
    );
  }

  if (!activeLayer) {
    return (
      <main className="main-content">
        <div className="state-card error-card">
          <p>No map layers were found in config.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content maps-page-shell">
      {error ? (
        <div className="state-card error-card small-card">
          <p>{error}</p>
        </div>
      ) : null}

      <section className="toolbar-card maps-toolbar">
        <div className="maps-toolbar-row">
          <label className="toolbar-field">
            <span>Map Layer</span>
            <FaeSelect
              className="text-input maps-layer-select"
              value={activeLayerId}
              onChange={onLayerChange}
              options={layers.map((layer) => ({
                value: layer.map_id,
                label: layer.label,
              }))}
            />
          </label>

          <div className="maps-controls-inline">
            <button
              className="secondary-link maps-action"
              type="button"
              onClick={() => mapViewerRef.current?.zoomIn()}
            >
              Zoom In
            </button>
            <button
              className="secondary-link maps-action"
              type="button"
              onClick={() => mapViewerRef.current?.zoomOut()}
            >
              Zoom Out
            </button>
            <button
              className="secondary-link maps-action"
              type="button"
              onClick={() => mapViewerRef.current?.resetView()}
            >
              Reset View
            </button>
            <button
              className={`action-button maps-action ${addMode ? "active" : ""}`.trim()}
              type="button"
              onClick={() => {
                setAddMode((current) => !current);
                setLandmarkAddMode(false);
                setEditorState(null);
                setLandmarkEditor(null);
              }}
            >
              {addMode ? "Cancel Add" : "Add Pin"}
            </button>
            {user?.role === "dm" ? (
              <button
                className={`secondary-link maps-action ${landmarkAddMode ? "active" : ""}`.trim()}
                type="button"
                onClick={() => {
                  setLandmarkAddMode((current) => !current);
                  setAddMode(false);
                  setEditorState(null);
                  setLandmarkEditor(null);
                }}
              >
                {landmarkAddMode ? "Cancel Landmark" : "Add Landmark"}
              </button>
            ) : null}
            <button className="secondary-link maps-action" type="button" onClick={() => void exportPins("current")}>
              Export Current Pins
            </button>
            <button className="secondary-link maps-action" type="button" onClick={() => void exportPins("all")}>
              Export All Pins
            </button>
          </div>
        </div>

        <p className="maps-hint">
          {landmarkAddMode && user?.role === "dm"
            ? "Landmark mode is active. Tap the map to place a canonical landmark."
            : addMode
            ? "Add mode is active. Tap the map to place a pin."
            : "Drag to pan, use mouse wheel or pinch to zoom, and tap markers for details."}
        </p>
      </section>

      <TiledMapViewer
        ref={mapViewerRef}
        layer={activeLayer}
        addMode={addMode}
        landmarkAddMode={landmarkAddMode}
        pins={visiblePins}
        landmarks={visibleLandmarks}
        selectedLandmark={selectedLandmark}
        selectedLandmarkLocation={selectedLandmarkLocation}
        selectedLandmarkLinkedSummary={selectedLandmark?.linked_location || null}
        onCloseSelectedLandmark={() => setSelectedLandmarkId(null)}
        onMapPlacement={onMapPlacement}
        onLandmarkClick={(landmark) => {
          setSelectedLandmarkId(landmark.id);
          if (user?.role === "dm") {
            setLandmarkEditor({
              mode: "edit",
              landmarkId: landmark.id,
              map_id: landmark.map_id,
              x: landmark.x,
              y: landmark.y,
              draft: {
                label: landmark.label,
                slug: landmark.slug,
                marker_style: landmark.marker_style,
                visibility_scope: landmark.visibility_scope,
                description: landmark.description || "",
                linked_page_slug: landmark.linked_page_slug || "",
                linked_entity_slug: landmark.linked_entity_slug || "",
                sort_order: landmark.sort_order || 0,
                unlock_chapter: landmark.unlock_chapter == null ? "" : String(landmark.unlock_chapter),
              },
            });
            setAddMode(false);
          }
        }}
        onPinClick={(pin) => {
          setAddMode(false);
          setLandmarkAddMode(false);
          setEditorState({
            mode: "edit",
            pinId: pin.id,
            mapLayer: pin.map_layer,
            x: pin.x,
            y: pin.y,
            draft: {
              title: pin.title,
              note: pin.note,
              category: pin.category,
            },
          });
        }}
      />

      {editorState ? (
        <section className="maps-editor-card">
          <div className="maps-editor-header">
            <h2>{editorState.mode === "create" ? "Add Personal Pin" : "Edit Personal Pin"}</h2>
            <p>
              Layer: {layers.find((layer) => layer.map_id === editorState.mapLayer)?.label || editorState.mapLayer} ·
              Coordinates: {editorState.x.toFixed(3)}, {editorState.y.toFixed(3)}
            </p>
          </div>

          <label className="toolbar-field">
            <span>Title</span>
            <input
              className="text-input"
              value={editorState.draft.title}
              onChange={(event) =>
                setEditorState((current) =>
                  current
                    ? {
                        ...current,
                        draft: {
                          ...current.draft,
                          title: event.target.value,
                        },
                      }
                    : null,
                )
              }
              maxLength={120}
              placeholder="Secret glade"
            />
          </label>

          <label className="toolbar-field">
            <span>Category</span>
            <FaeSelect
              className="text-input"
              value={editorState.draft.category}
              onChange={(nextValue) =>
                setEditorState((current) =>
                  current
                    ? {
                        ...current,
                        draft: {
                          ...current.draft,
                          category: nextValue as MapPinCategory,
                        },
                      }
                    : null,
                )
              }
              options={PIN_CATEGORIES.map((category) => ({
                value: category,
                label: category[0].toUpperCase() + category.slice(1),
              }))}
            />
          </label>

          <label className="toolbar-field">
            <span>Note</span>
            <textarea
              className="text-area"
              value={editorState.draft.note}
              onChange={(event) =>
                setEditorState((current) =>
                  current
                    ? {
                        ...current,
                        draft: {
                          ...current.draft,
                          note: event.target.value,
                        },
                      }
                    : null,
                )
              }
              rows={4}
              maxLength={2000}
              placeholder="Optional details for this location"
            />
          </label>

          <div className="maps-editor-actions">
            <button className="secondary-link maps-action" type="button" onClick={() => setEditorState(null)}>
              Cancel
            </button>

            {editorState.mode === "edit" && editorState.pinId ? (
              <button
                className="board-node-delete-button"
                type="button"
                disabled={saving}
                onClick={() => {
                  void archivePin(editorState.pinId!);
                }}
              >
                Archive Pin
              </button>
            ) : null}

            <button
              className="action-button maps-action"
              type="button"
              disabled={saving}
              onClick={() => {
                void savePin({
                  method: editorState.mode === "create" ? "POST" : "PATCH",
                  id: editorState.pinId,
                  map_layer: editorState.mapLayer,
                  x: editorState.x,
                  y: editorState.y,
                  draft: editorState.draft,
                });
              }}
            >
              {saving ? "Saving..." : editorState.mode === "create" ? "Save Pin" : "Save Changes"}
            </button>
          </div>
        </section>
      ) : null}

      {landmarkEditor ? (
        <section className="maps-editor-card">
          <div className="maps-editor-header">
            <h2>{landmarkEditor.mode === "create" ? "Add Shared Landmark" : "Edit Shared Landmark"}</h2>
            <p>
              Layer: {layers.find((layer) => layer.map_id === landmarkEditor.map_id)?.label || landmarkEditor.map_id}
              {" · "}Coordinates: {landmarkEditor.x.toFixed(3)}, {landmarkEditor.y.toFixed(3)}
            </p>
          </div>
          <label className="toolbar-field">
            <span>Label</span>
            <input
              className="text-input"
              value={landmarkEditor.draft.label}
              maxLength={120}
              onChange={(event) =>
                setLandmarkEditor((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, label: event.target.value } }
                    : null,
                )
              }
            />
          </label>
          <label className="toolbar-field">
            <span>Slug</span>
            <input
              className="text-input"
              value={landmarkEditor.draft.slug}
              maxLength={120}
              onChange={(event) =>
                setLandmarkEditor((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, slug: event.target.value } }
                    : null,
                )
              }
              placeholder="optional-auto-from-label"
            />
          </label>
          <div className="maps-toolbar-row">
            <label className="toolbar-field">
              <span>Marker style</span>
              <FaeSelect
                className="text-input"
                value={landmarkEditor.draft.marker_style}
                onChange={(nextValue) =>
                  setLandmarkEditor((current) =>
                    current
                      ? {
                          ...current,
                          draft: {
                            ...current.draft,
                            marker_style: nextValue as MapLandmarkMarkerStyle,
                          },
                        }
                      : null,
                  )
                }
                options={LANDMARK_MARKER_STYLES.map((style) => ({
                  value: style,
                  label: style,
                }))}
              />
            </label>
            <label className="toolbar-field">
              <span>Visibility</span>
              <FaeSelect
                className="text-input"
                value={landmarkEditor.draft.visibility_scope}
                onChange={(nextValue) =>
                  setLandmarkEditor((current) =>
                    current
                      ? {
                          ...current,
                          draft: {
                            ...current.draft,
                            visibility_scope: nextValue as MapLandmarkVisibilityScope,
                          },
                        }
                      : null,
                  )
                }
                options={LANDMARK_VISIBILITY_SCOPES.map((scope) => ({
                  value: scope,
                  label: scope === "dm_only" ? "DM only" : "Public",
                }))}
              />
            </label>
          </div>
          <label className="toolbar-field">
            <span>Description (optional)</span>
            <textarea
              className="text-area"
              value={landmarkEditor.draft.description}
              rows={3}
              maxLength={1500}
              onChange={(event) =>
                setLandmarkEditor((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, description: event.target.value } }
                    : null,
                )
              }
            />
          </label>
          <label className="toolbar-field">
            <span>Linked location slug (optional)</span>
            <input
              className="text-input"
              value={landmarkEditor.draft.linked_entity_slug}
              placeholder="moonthorn-estate"
              onChange={(event) =>
                setLandmarkEditor((current) =>
                  current
                    ? {
                        ...current,
                        draft: { ...current.draft, linked_entity_slug: event.target.value },
                      }
                    : null,
                )
              }
            />
          </label>
          <div className="maps-toolbar-row">
            <label className="toolbar-field">
              <span>Sort order</span>
              <input
                className="text-input"
                type="number"
                value={landmarkEditor.draft.sort_order}
                onChange={(event) =>
                  setLandmarkEditor((current) =>
                    current
                      ? {
                          ...current,
                          draft: { ...current.draft, sort_order: Number(event.target.value || 0) },
                        }
                      : null,
                  )
                }
              />
            </label>
            <label className="toolbar-field">
              <span>Unlock chapter (optional)</span>
              <input
                className="text-input"
                type="number"
                min={0}
                value={landmarkEditor.draft.unlock_chapter}
                onChange={(event) =>
                  setLandmarkEditor((current) =>
                    current
                      ? { ...current, draft: { ...current.draft, unlock_chapter: event.target.value } }
                      : null,
                  )
                }
              />
            </label>
          </div>
          <div className="maps-editor-actions">
            <button className="secondary-link maps-action" type="button" onClick={() => setLandmarkEditor(null)}>
              Cancel
            </button>
            {landmarkEditor.mode === "edit" && landmarkEditor.landmarkId ? (
              <button
                className="board-node-delete-button"
                type="button"
                disabled={saving}
                onClick={() => void deleteLandmark(landmarkEditor.landmarkId!)}
              >
                Delete Landmark
              </button>
            ) : null}
            <button
              className="action-button maps-action"
              type="button"
              disabled={saving}
              onClick={() =>
                void saveLandmark({
                  method: landmarkEditor.mode === "create" ? "POST" : "PATCH",
                  id: landmarkEditor.landmarkId,
                  map_id: landmarkEditor.map_id,
                  x: landmarkEditor.x,
                  y: landmarkEditor.y,
                  draft: landmarkEditor.draft,
                })
              }
            >
              {saving ? "Saving..." : landmarkEditor.mode === "create" ? "Save Landmark" : "Save Changes"}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
