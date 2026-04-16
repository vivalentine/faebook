import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { Link } from "react-router-dom";
import PlayerLandmarkLocationCard from "./PlayerLandmarkLocationCard";
import type { LocationRecord, MapLandmark, MapLayerConfig, MapPin } from "../types";

type MarkerScreenPosition = {
  id: number;
  left: number;
  top: number;
};

export type TiledMapViewerHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};

type TiledMapViewerProps = {
  layer: MapLayerConfig;
  addMode: boolean;
  landmarkAddMode: boolean;
  pins: MapPin[];
  landmarks: MapLandmark[];
  selectedLandmark: MapLandmark | null;
  selectedLandmarkLocation: LocationRecord | null;
  selectedLandmarkLinkedSummary: Pick<LocationRecord, "slug" | "name" | "ring" | "summary"> | null;
  onCloseSelectedLandmark: () => void;
  onMapPlacement: (point: { x: number; y: number }) => void;
  onPinClick: (pin: MapPin) => void;
  onLandmarkClick: (landmark: MapLandmark) => void;
  onViewerPanningChange?: (isPanning: boolean) => void;
};

const DEFAULT_MAP_ERROR = "Map tile source is missing for this layer.";
const DEFAULT_RENDERER_ERROR = "Unable to initialize the map renderer on this device.";

type OpenSeadragonInitOptions = OpenSeadragon.Options & {
  drawer?: Array<"canvas" | "html" | "webgl">;
};

function buildInlineDziTileSource(layer: MapLayerConfig): any {
  return {
    Image: {
      xmlns: "http://schemas.microsoft.com/deepzoom/2008",
      Url: layer.tile_source.replace(/\.dzi$/i, "_files/"),
      Format: "jpeg",
      Overlap: "1",
      TileSize: "256",
      Size: {
        Width: String(layer.width),
        Height: String(layer.height),
      },
    },
  };
}

function buildViewerOptions(
  host: HTMLDivElement,
  layer: MapLayerConfig,
  rendererMode: "drawer_canvas_first" | "use_canvas_legacy",
): OpenSeadragonInitOptions {
  return {
    element: host,
    tileSources: [buildInlineDziTileSource(layer) as any],
    prefixUrl: "/",
    showNavigator: false,
    showZoomControl: false,
    showHomeControl: false,
    showFullPageControl: false,
    gestureSettingsMouse: {
      clickToZoom: false,
      dblClickToZoom: true,
      pinchToZoom: true,
      flickEnabled: true,
    },
    gestureSettingsTouch: {
      clickToZoom: false,
      dblClickToZoom: false,
      pinchToZoom: true,
      flickEnabled: true,
    },
    minZoomLevel: layer.min_zoom > 0 ? layer.min_zoom : 0.01,
    maxZoomLevel: layer.max_zoom,
    defaultZoomLevel: layer.default_zoom,
    homeFillsViewer: false,
    visibilityRatio: 1,
    constrainDuringPan: true,
    maxZoomPixelRatio: 2,
    ...(rendererMode === "drawer_canvas_first"
      ? { drawer: ["canvas", "html"] }
      : { useCanvas: true }),
  };
}

function createViewer(host: HTMLDivElement, layer: MapLayerConfig): OpenSeadragon.Viewer {
  try {
    return OpenSeadragon(buildViewerOptions(host, layer, "drawer_canvas_first"));
  } catch {
    host.innerHTML = "";
    return OpenSeadragon(buildViewerOptions(host, layer, "use_canvas_legacy"));
  }
}

const TiledMapViewer = forwardRef<TiledMapViewerHandle, TiledMapViewerProps>(function TiledMapViewer(
  {
    layer,
    addMode,
    landmarkAddMode,
    pins,
    landmarks,
    selectedLandmark,
    selectedLandmarkLocation,
    selectedLandmarkLinkedSummary,
    onCloseSelectedLandmark,
    onMapPlacement,
    onPinClick,
    onLandmarkClick,
    onViewerPanningChange,
  },
  ref,
) {
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const layerRef = useRef(layer);
  const addModeRef = useRef(addMode);
  const landmarkAddModeRef = useRef(landmarkAddMode);
  const onMapPlacementRef = useRef(onMapPlacement);
  const onPinClickRef = useRef(onPinClick);
  const onLandmarkClickRef = useRef(onLandmarkClick);
  const onViewerPanningChangeRef = useRef(onViewerPanningChange);
  const pinsRef = useRef(pins);
  const landmarksRef = useRef(landmarks);
  const recalculateMarkersRef = useRef<() => void>(() => {});
  const [mapError, setMapError] = useState("");
  const [pinScreenPositions, setPinScreenPositions] = useState<MarkerScreenPosition[]>([]);
  const [landmarkScreenPositions, setLandmarkScreenPositions] = useState<MarkerScreenPosition[]>([]);

  useEffect(() => {
    layerRef.current = layer;
  }, [layer]);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    landmarkAddModeRef.current = landmarkAddMode;
  }, [landmarkAddMode]);

  useEffect(() => {
    onMapPlacementRef.current = onMapPlacement;
  }, [onMapPlacement]);

  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  useEffect(() => {
    onLandmarkClickRef.current = onLandmarkClick;
  }, [onLandmarkClick]);

  useEffect(() => {
    onViewerPanningChangeRef.current = onViewerPanningChange;
  }, [onViewerPanningChange]);

  useEffect(() => {
    pinsRef.current = pins;
    landmarksRef.current = landmarks;
    recalculateMarkersRef.current();
  }, [pins, landmarks]);

  useEffect(() => {
    recalculateMarkersRef.current();
  }, [layer.width, layer.height]);

  useImperativeHandle(ref, () => ({
    zoomIn() {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.viewport.zoomBy(1.2);
      viewer.viewport.applyConstraints();
    },
    zoomOut() {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.viewport.zoomBy(1 / 1.2);
      viewer.viewport.applyConstraints();
    },
    resetView() {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.viewport.goHome(true);
    },
  }));

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) {
      return;
    }

    if (!layer.tile_source) {
      setMapError(DEFAULT_MAP_ERROR);
      return;
    }

    if (!layer.width || !layer.height) {
      setMapError(`Map dimensions are missing for ${layer.label}.`);
      return;
    }

    setMapError("");

    let viewer: OpenSeadragon.Viewer;
    try {
      viewer = createViewer(host, layer);
    } catch {
      setMapError(`${DEFAULT_RENDERER_ERROR} (${layer.label})`);
      return;
    }

    viewerRef.current = viewer;

    const updateMarkerPositions = () => {
      const viewport = viewer.viewport;
      if (!viewport) return;
      const currentLayer = layerRef.current;
      const width = currentLayer.width;
      const height = currentLayer.height;

      const nextPins = pinsRef.current.map((pin) => {
        const viewportPoint = viewport.imageToViewportCoordinates(pin.x * width, pin.y * height);
        const pixelPoint = viewport.pixelFromPoint(viewportPoint, true);
        return {
          id: pin.id,
          left: pixelPoint.x,
          top: pixelPoint.y,
        };
      });

      const nextLandmarks = landmarksRef.current.map((landmark) => {
        const viewportPoint = viewport.imageToViewportCoordinates(landmark.x * width, landmark.y * height);
        const pixelPoint = viewport.pixelFromPoint(viewportPoint, true);
        return {
          id: landmark.id,
          left: pixelPoint.x,
          top: pixelPoint.y,
        };
      });

      setPinScreenPositions(nextPins);
      setLandmarkScreenPositions(nextLandmarks);
    };
    recalculateMarkersRef.current = updateMarkerPositions;

    const mapCanvasPointToNormalized = (eventPosition: { x: number; y: number }) => {
      const currentLayer = layerRef.current;
      const viewportPoint = viewer.viewport.pointFromPixel(
        new OpenSeadragon.Point(eventPosition.x, eventPosition.y),
        true,
      );
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

      return {
        x: Math.max(0, Math.min(1, imagePoint.x / currentLayer.width)),
        y: Math.max(0, Math.min(1, imagePoint.y / currentLayer.height)),
      };
    };

    viewer.addHandler("open", () => {
      viewer.viewport.goHome(true);
      updateMarkerPositions();
    });

    viewer.addHandler("open-failed", () => {
      setMapError(`Unable to open map tiles for ${layer.label}.`);
    });

    viewer.addHandler("tile-load-failed", () => {
      setMapError(`Unable to load map tiles for ${layer.label}.`);
    });

    viewer.addHandler("canvas-click", (event: any) => {
      if (!event.quick) {
        return;
      }

      if (!addModeRef.current && !landmarkAddModeRef.current) {
        return;
      }

      const point = mapCanvasPointToNormalized(event.position);
      onMapPlacementRef.current(point);
    });

    viewer.addHandler("canvas-drag", () => {
      onViewerPanningChangeRef.current?.(true);
    });

    viewer.addHandler("canvas-release", () => {
      onViewerPanningChangeRef.current?.(false);
    });

    viewer.addHandler("animation", updateMarkerPositions);
    viewer.addHandler("resize", updateMarkerPositions);
    viewer.addHandler("viewport-change", updateMarkerPositions);

    return () => {
      viewer.destroy();
      viewerRef.current = null;
      recalculateMarkersRef.current = () => {};
      setPinScreenPositions([]);
      setLandmarkScreenPositions([]);
      onViewerPanningChangeRef.current?.(false);
    };
  }, [
    layer.default_zoom,
    layer.height,
    layer.label,
    layer.max_zoom,
    layer.min_zoom,
    layer.tile_source,
    layer.width,
  ]);

  const pinScreenById = useMemo(() => {
    const map = new Map<number, MarkerScreenPosition>();
    for (const pin of pinScreenPositions) {
      map.set(pin.id, pin);
    }
    return map;
  }, [pinScreenPositions]);

  const landmarkScreenById = useMemo(() => {
    const map = new Map<number, MarkerScreenPosition>();
    for (const landmark of landmarkScreenPositions) {
      map.set(landmark.id, landmark);
    }
    return map;
  }, [landmarkScreenPositions]);
  const selectedLandmarkScreenPosition = selectedLandmark
    ? landmarkScreenById.get(selectedLandmark.id) || null
    : null;

  return (
    <section className={`maps-viewport-shell ${addMode ? "add-mode" : ""}`.trim()}>
      <div className="maps-osd-host" ref={viewerHostRef} />
      <div className="maps-marker-layer" aria-hidden="true">
        {landmarks.map((landmark) => {
          const position = landmarkScreenById.get(landmark.id);
          if (!position) return null;

          return (
            <button
              type="button"
              key={`landmark-${landmark.id}`}
              className={`map-landmark map-landmark-${landmark.marker_style} ${
                landmark.visibility_scope === "dm_only" ? "is-dm-only" : ""
              }`.trim()}
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
              onClick={(event) => {
                event.stopPropagation();
                onLandmarkClickRef.current(landmark);
              }}
              title={landmark.label}
            >
              <span>{landmark.label}</span>
            </button>
          );
        })}

        {pins.map((pin) => {
          const position = pinScreenById.get(pin.id);
          if (!position) return null;

          return (
            <button
              type="button"
              key={pin.id}
              className={`map-pin map-pin-${pin.category}`}
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
              onClick={(event) => {
                event.stopPropagation();
                onPinClickRef.current(pin);
              }}
            >
              <span>{pin.title}</span>
            </button>
          );
        })}
      </div>

      {selectedLandmark && selectedLandmarkScreenPosition ? (
        <section
          className="map-landmark-popover"
          style={{
            left: `${selectedLandmarkScreenPosition.left}px`,
            top: `${selectedLandmarkScreenPosition.top}px`,
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {selectedLandmarkLocation ? (
            <PlayerLandmarkLocationCard
              location={selectedLandmarkLocation}
              landmark={selectedLandmark}
              onClose={onCloseSelectedLandmark}
            />
          ) : (
            <>
              <h3>{selectedLandmark.label}</h3>
              {selectedLandmarkLinkedSummary?.ring ? (
                <p className="map-landmark-popover-meta">{selectedLandmarkLinkedSummary.ring}</p>
              ) : null}
              {selectedLandmarkLinkedSummary?.summary ? (
                <p>{selectedLandmarkLinkedSummary.summary}</p>
              ) : selectedLandmark.description ? (
                <p>{selectedLandmark.description}</p>
              ) : null}
              <p className="map-landmark-popover-meta">
                {selectedLandmark.visibility_scope === "dm_only" ? "DM-only" : "Public"}
              </p>
              {selectedLandmarkLinkedSummary?.slug ? (
                <Link className="secondary-link" to={`/locations/${selectedLandmarkLinkedSummary.slug}`}>
                  Open location
                </Link>
              ) : null}
              <button className="secondary-link" type="button" onClick={onCloseSelectedLandmark}>
                Close
              </button>
            </>
          )}
        </section>
      ) : null}

      {mapError ? (
        <div className="maps-layer-error" role="alert">
          <p>{mapError}</p>
        </div>
      ) : null}
    </section>
  );
});

export default TiledMapViewer;
