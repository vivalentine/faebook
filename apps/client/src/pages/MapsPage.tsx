import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import type { MapLayerConfig, MapPin, MapPinCategory } from "../types";

const PIN_CATEGORIES: MapPinCategory[] = ["clue", "lead", "suspect", "danger", "meeting", "theory"];
const PAN_DRAG_THRESHOLD = 8;
const PINCH_ZOOM_DAMPING_EXPONENT = 0.45;

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

type ViewportSize = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampViewportOffsetAxis({
  offset,
  mapLength,
  viewportLength,
  zoom,
}: {
  offset: number;
  mapLength: number;
  viewportLength: number;
  zoom: number;
}) {
  if (viewportLength <= 0 || mapLength <= 0 || zoom <= 0) {
    return offset;
  }

  const scaledLength = mapLength * zoom;
  if (scaledLength <= viewportLength) {
    return -mapLength / 2;
  }

  const halfScaledLength = scaledLength / 2;
  const minCenter = viewportLength - halfScaledLength;
  const maxCenter = halfScaledLength;
  const currentCenter = viewportLength / 2 + offset + mapLength / 2;
  const nextCenter = clamp(currentCenter, minCenter, maxCenter);
  return nextCenter - viewportLength / 2 - mapLength / 2;
}

function clampViewportOffset({
  offset,
  layer,
  zoom,
  viewport,
}: {
  offset: { x: number; y: number };
  layer: Pick<MapLayerConfig, "width" | "height">;
  zoom: number;
  viewport: ViewportSize;
}) {
  return {
    x: clampViewportOffsetAxis({
      offset: offset.x,
      mapLength: layer.width,
      viewportLength: viewport.width,
      zoom,
    }),
    y: clampViewportOffsetAxis({
      offset: offset.y,
      mapLength: layer.height,
      viewportLength: viewport.height,
      zoom,
    }),
  };
}

function computeInitialViewport({
  layer,
  viewport,
}: {
  layer: Pick<MapLayerConfig, "width" | "height" | "default_zoom">;
  viewport: ViewportSize;
}) {
  const zoom = layer.default_zoom;
  const centeredOffset = {
    x: -layer.width / 2,
    y: -layer.height / 2,
  };

  return {
    zoom,
    offset: clampViewportOffset({
      offset: centeredOffset,
      layer,
      zoom,
      viewport,
    }),
  };
}

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
  const [activeLayerId, setActiveLayerId] = useState<MapLayerConfig["map_id"] | "">("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mapStageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
  });
  const pinchStateRef = useRef<
    | {
        active: true;
        pointerA: number;
        pointerB: number;
        startDistance: number;
        startZoom: number;
        startWorldX: number;
        startWorldY: number;
      }
    | { active: false }
  >({ active: false });
  const activeTouchPoints = useRef(new Map<number, { x: number; y: number }>());

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.map_id === activeLayerId) || null,
    [layers, activeLayerId],
  );

  const visiblePins = useMemo(
    () => pins.filter((pin) => pin.map_layer === activeLayerId),
    [pins, activeLayerId],
  );

  const resetView = useCallback((layer: MapLayerConfig) => {
    const viewportEl = viewportRef.current;
    const viewport = {
      width: viewportEl?.clientWidth ?? viewportSize.width,
      height: viewportEl?.clientHeight ?? viewportSize.height,
    };
    const initialViewport = computeInitialViewport({ layer, viewport });
    setZoom(initialViewport.zoom);
    setOffset(initialViewport.offset);
  }, [viewportSize.height, viewportSize.width]);

  const loadMaps = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [configResponse, pinResponse] = await Promise.all([
        apiFetch("/api/maps/config"),
        apiFetch("/api/maps/pins"),
      ]);

      const configData = await configResponse.json();
      const pinData = await pinResponse.json();

      if (!configResponse.ok) {
        throw new Error(configData.error || `Failed to load maps config: ${configResponse.status}`);
      }

      if (!pinResponse.ok) {
        throw new Error(pinData.error || `Failed to load map pins: ${pinResponse.status}`);
      }

      const nextLayers: MapLayerConfig[] = Array.isArray(configData.layers)
        ? configData.layers
        : [];

      setLayers(nextLayers);
      setPins(Array.isArray(pinData.pins) ? pinData.pins : []);

      if (nextLayers[0]) {
        setActiveLayerId((current) => {
          const selected = current || nextLayers[0].map_id;
          const layer = nextLayers.find((entry) => entry.map_id === selected) || nextLayers[0];
          const initialViewport = computeInitialViewport({
            layer,
            viewport: {
              width: viewportRef.current?.clientWidth ?? 0,
              height: viewportRef.current?.clientHeight ?? 0,
            },
          });
          setZoom(initialViewport.zoom);
          setOffset(initialViewport.offset);
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
    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return;
    }

    const syncViewportSize = () => {
      setViewportSize({
        width: viewportEl.clientWidth,
        height: viewportEl.clientHeight,
      });
    };

    syncViewportSize();
    const resizeObserver = new ResizeObserver(() => {
      syncViewportSize();
    });
    resizeObserver.observe(viewportEl);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl || !activeLayer) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = viewportEl.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
      const nextZoom = clamp(zoomRef.current * zoomFactor, activeLayer.min_zoom, activeLayer.max_zoom);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const worldX = (pointerX - offsetRef.current.x - centerX) / zoomRef.current;
      const worldY = (pointerY - offsetRef.current.y - centerY) / zoomRef.current;

      const nextOffsetX = pointerX - centerX - worldX * nextZoom;
      const nextOffsetY = pointerY - centerY - worldY * nextZoom;
      const clampedOffset = clampViewportOffset({
        offset: { x: nextOffsetX, y: nextOffsetY },
        layer: activeLayer,
        zoom: nextZoom,
        viewport: { width: rect.width, height: rect.height },
      });

      setZoom(nextZoom);
      setOffset(clampedOffset);
    };

    viewportEl.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewportEl.removeEventListener("wheel", onWheel);
    };
  }, [activeLayer]);

  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    if (!activeLayer || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    setOffset((current) => {
      const next = clampViewportOffset({
        offset: current,
        layer: activeLayer,
        zoom,
        viewport: viewportSize,
      });

      if (Math.abs(next.x - current.x) < 0.001 && Math.abs(next.y - current.y) < 0.001) {
        return current;
      }
      return next;
    });
  }, [activeLayer, viewportSize, zoom]);

  const computeNormalizedFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapStageRef.current) {
        return { x: 0.5, y: 0.5 };
      }

      const mapRect = mapStageRef.current.getBoundingClientRect();
      const localX = clientX - mapRect.left;
      const localY = clientY - mapRect.top;

      return {
        x: clamp(localX / mapRect.width, 0, 1),
        y: clamp(localY / mapRect.height, 0, 1),
      };
    },
    [],
  );

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

  function onLayerChange(nextLayerId: string) {
    const nextLayer = layers.find((layer) => layer.map_id === nextLayerId);
    if (!nextLayer) return;

    setActiveLayerId(nextLayer.map_id);
    resetView(nextLayer);
    setAddMode(false);
    setEditorState(null);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!viewportRef.current) return;

    const isTouch = event.pointerType === "touch";
    if (isTouch) {
      activeTouchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activeTouchPoints.current.size === 2 && activeLayer) {
        const points = Array.from(activeTouchPoints.current.entries());
        const pointA = points[0][1];
        const pointB = points[1][1];
        const distance = Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
        const rect = viewportRef.current.getBoundingClientRect();
        const midpointX = (pointA.x + pointB.x) / 2 - rect.left;
        const midpointY = (pointA.y + pointB.y) / 2 - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const startZoom = zoomRef.current;
        const startOffset = offsetRef.current;

        pinchStateRef.current = {
          active: true,
          pointerA: points[0][0],
          pointerB: points[1][0],
          startDistance: distance,
          startZoom,
          startWorldX: (midpointX - startOffset.x - centerX) / startZoom,
          startWorldY: (midpointY - startOffset.y - centerY) / startZoom,
        };

        dragStateRef.current = {
          active: false,
          pointerId: -1,
          startX: 0,
          startY: 0,
          baseX: 0,
          baseY: 0,
          moved: true,
        };
      } else if (activeTouchPoints.current.size === 1) {
        dragStateRef.current = {
          active: true,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          baseX: offsetRef.current.x,
          baseY: offsetRef.current.y,
          moved: false,
        };
      }

      viewportRef.current.setPointerCapture(event.pointerId);
      return;
    }

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: offsetRef.current.x,
      baseY: offsetRef.current.y,
      moved: false,
    };

    viewportRef.current.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!activeLayer) return;

    if (event.pointerType === "touch") {
      activeTouchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = pinchStateRef.current;
      if (pinch.active) {
        const pointA = activeTouchPoints.current.get(pinch.pointerA);
        const pointB = activeTouchPoints.current.get(pinch.pointerB);
        const viewportEl = viewportRef.current;
        if (!pointA || !pointB || !viewportEl) return;

        const rect = viewportEl.getBoundingClientRect();
        const midpointX = (pointA.x + pointB.x) / 2 - rect.left;
        const midpointY = (pointA.y + pointB.y) / 2 - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const currentDistance = Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
        const rawRatio = pinch.startDistance > 0 ? currentDistance / pinch.startDistance : 1;
        const dampedRatio = Math.pow(rawRatio, PINCH_ZOOM_DAMPING_EXPONENT);
        const nextZoom = clamp(
          pinch.startZoom * dampedRatio,
          activeLayer.min_zoom,
          activeLayer.max_zoom,
        );

        const nextOffset = {
          x: midpointX - centerX - pinch.startWorldX * nextZoom,
          y: midpointY - centerY - pinch.startWorldY * nextZoom,
        };
        const clampedOffset = clampViewportOffset({
          offset: nextOffset,
          layer: activeLayer,
          zoom: nextZoom,
          viewport: { width: rect.width, height: rect.height },
        });

        dragStateRef.current.moved = true;
        setIsPanning(true);
        setZoom(nextZoom);
        setOffset(clampedOffset);
        return;
      }
    }

    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > PAN_DRAG_THRESHOLD || Math.abs(dy) > PAN_DRAG_THRESHOLD) {
      drag.moved = true;
      setIsPanning(true);
    }

    const viewportEl = viewportRef.current;
    const nextOffset = { x: drag.baseX + dx, y: drag.baseY + dy };
    const clampedOffset = clampViewportOffset({
      offset: nextOffset,
      layer: activeLayer,
      zoom: zoomRef.current,
      viewport: {
        width: viewportEl?.clientWidth ?? viewportSize.width,
        height: viewportEl?.clientHeight ?? viewportSize.height,
      },
    });
    setOffset(clampedOffset);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    activeTouchPoints.current.delete(event.pointerId);

    if (pinchStateRef.current.active) {
      const pinch = pinchStateRef.current;
      if (event.pointerId === pinch.pointerA || event.pointerId === pinch.pointerB) {
        pinchStateRef.current = { active: false };
      }
    }

    if (drag.active && drag.pointerId === event.pointerId) {
      dragStateRef.current = {
        active: false,
        pointerId: -1,
        startX: 0,
        startY: 0,
        baseX: 0,
        baseY: 0,
        moved: drag.moved,
      };
    }

    if (activeTouchPoints.current.size === 0) {
      setIsPanning(false);
    }
  }

  function onMapClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!activeLayer || !addMode) {
      return;
    }

    if (dragStateRef.current.moved) {
      return;
    }

    const point = computeNormalizedFromClientPoint(event.clientX, event.clientY);
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
            <select
              className="text-input maps-layer-select"
              value={activeLayerId}
              onChange={(event) => onLayerChange(event.target.value)}
            >
              {layers.map((layer) => (
                <option key={layer.map_id} value={layer.map_id}>
                  {layer.label}
                </option>
              ))}
            </select>
          </label>

          <div className="maps-controls-inline">
            <button
              className="secondary-link maps-action"
              type="button"
              onClick={() =>
                setZoom((current) => clamp(current * 1.15, activeLayer.min_zoom, activeLayer.max_zoom))
              }
            >
              Zoom In
            </button>
            <button
              className="secondary-link maps-action"
              type="button"
              onClick={() =>
                setZoom((current) => clamp(current / 1.15, activeLayer.min_zoom, activeLayer.max_zoom))
              }
            >
              Zoom Out
            </button>
            <button className="secondary-link maps-action" type="button" onClick={() => resetView(activeLayer)}>
              Reset View
            </button>
            <button
              className={`action-button maps-action ${addMode ? "active" : ""}`.trim()}
              type="button"
              onClick={() => {
                setAddMode((current) => !current);
                setEditorState(null);
              }}
            >
              {addMode ? "Cancel Add" : "Add Pin"}
            </button>
            <button className="secondary-link maps-action" type="button" onClick={() => void exportPins("current")}>
              Export Current Pins
            </button>
            <button className="secondary-link maps-action" type="button" onClick={() => void exportPins("all")}>
              Export All Pins
            </button>
          </div>
        </div>

        <p className="maps-hint">
          {addMode
            ? "Add mode is active. Tap the map to place a pin."
            : "Drag to pan, use mouse wheel or pinch to zoom, and tap any pin to edit."}
        </p>
      </section>

      <section
        className={`maps-viewport-shell ${addMode ? "add-mode" : ""}`.trim()}
        ref={viewportRef}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onMapClick}
        data-panning={isPanning ? "true" : "false"}
      >
        <div
          className="maps-canvas"
          ref={mapStageRef}
          style={{
            width: `${activeLayer.width}px`,
            height: `${activeLayer.height}px`,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <img
            src={activeLayer.image_path}
            alt={activeLayer.label}
            className="maps-image"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
          />

          {visiblePins.map((pin) => (
            <button
              type="button"
              key={pin.id}
              className={`map-pin map-pin-${pin.category}`}
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setAddMode(false);
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
            >
              <span>{pin.title}</span>
            </button>
          ))}
        </div>
      </section>

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
            <select
              className="text-input"
              value={editorState.draft.category}
              onChange={(event) =>
                setEditorState((current) =>
                  current
                    ? {
                        ...current,
                        draft: {
                          ...current.draft,
                          category: event.target.value as MapPinCategory,
                        },
                      }
                    : null,
                )
              }
            >
              {PIN_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category[0].toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
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
    </main>
  );
}
