import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { MapLandmark, MapLayerConfig, MapPin } from "../types";

declare global {
  interface Window {
    OpenSeadragon?: any;
  }
}

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
  onMapPlacement: (point: { x: number; y: number }) => void;
  onPinClick: (pin: MapPin) => void;
  onLandmarkClick: (landmark: MapLandmark) => void;
  onViewerPanningChange?: (isPanning: boolean) => void;
};

const DEFAULT_MAP_ERROR = "Map tile source is missing for this layer.";
const OPENSEADRAGON_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/openseadragon.min.js";

async function loadOpenSeadragonGlobal() {
  if (window.OpenSeadragon) {
    return window.OpenSeadragon;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-openseadragon='true']");
    if (existing && window.OpenSeadragon) {
      resolve();
      return;
    }

    const script = existing || document.createElement("script");
    script.src = OPENSEADRAGON_SCRIPT_URL;
    script.async = true;
    script.dataset.openseadragon = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load OpenSeadragon runtime"));
    if (!existing) {
      document.head.appendChild(script);
    }
  });

  if (!window.OpenSeadragon) {
    throw new Error("OpenSeadragon runtime is unavailable");
  }

  return window.OpenSeadragon;
}

const TiledMapViewer = forwardRef<TiledMapViewerHandle, TiledMapViewerProps>(function TiledMapViewer(
  {
    layer,
    addMode,
    landmarkAddMode,
    pins,
    landmarks,
    onMapPlacement,
    onPinClick,
    onLandmarkClick,
    onViewerPanningChange,
  },
  ref,
) {
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any | null>(null);
  const [mapError, setMapError] = useState("");
  const [pinScreenPositions, setPinScreenPositions] = useState<MarkerScreenPosition[]>([]);
  const [landmarkScreenPositions, setLandmarkScreenPositions] = useState<MarkerScreenPosition[]>([]);

  const imageAspectRatio = useMemo(() => {
    if (!layer.width || !layer.height) {
      return 1;
    }
    return layer.height / layer.width;
  }, [layer.height, layer.width]);

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
    let isCancelled = false;

    async function mountViewer() {
      const host = viewerHostRef.current;
      if (!host) return;

      if (!layer.tile_source) {
        setMapError(DEFAULT_MAP_ERROR);
        return;
      }

      setMapError("");
      const OpenSeadragon = await loadOpenSeadragonGlobal();
      if (isCancelled || !viewerHostRef.current) return;
      const viewer = OpenSeadragon({
        element: viewerHostRef.current,
        tileSources: [layer.tile_source],
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
      });

      viewerRef.current = viewer;

      const updateMarkerPositions = () => {
        const viewport = viewer.viewport;
        if (!viewport) return;

        const nextPins = pins.map((pin) => {
          const viewportPoint = viewport.imageToViewportCoordinates(pin.x * layer.width, pin.y * layer.height);
          const pixelPoint = viewport.pixelFromPoint(viewportPoint, true);
          return {
            id: pin.id,
            left: pixelPoint.x,
            top: pixelPoint.y,
          };
        });

        const nextLandmarks = landmarks.map((landmark) => {
          const viewportPoint = viewport.imageToViewportCoordinates(
            landmark.x * layer.width,
            landmark.y * layer.height,
          );
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

      const mapCanvasPointToNormalized = (eventPosition: { x: number; y: number }) => {
        const viewportPoint = viewer.viewport.pointFromPixel(eventPosition, true);
        const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

        return {
          x: Math.max(0, Math.min(1, imagePoint.x / layer.width)),
          y: Math.max(0, Math.min(1, imagePoint.y / layer.height)),
        };
      };

      viewer.addHandler("open", () => {
        viewer.viewport.goHome(true);
        updateMarkerPositions();
      });

      viewer.addHandler("canvas-click", (event: any) => {
        if (!event.quick) {
          return;
        }

        if (!addMode && !landmarkAddMode) {
          return;
        }

        const point = mapCanvasPointToNormalized(event.position);
        onMapPlacement(point);
      });

      viewer.addHandler("canvas-drag", () => {
        onViewerPanningChange?.(true);
      });
      viewer.addHandler("canvas-release", () => {
        onViewerPanningChange?.(false);
      });
      viewer.addHandler("animation", updateMarkerPositions);
      viewer.addHandler("resize", updateMarkerPositions);
      viewer.addHandler("viewport-change", updateMarkerPositions);

      viewer.addOnceHandler("tile-load-failed", () => {
        setMapError(`Unable to load map tiles for ${layer.label}.`);
      });
    }

    void mountViewer();

    return () => {
      isCancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      setPinScreenPositions([]);
      setLandmarkScreenPositions([]);
      onViewerPanningChange?.(false);
    };
  }, [
    addMode,
    imageAspectRatio,
    landmarkAddMode,
    landmarks,
    layer.default_zoom,
    layer.label,
    layer.max_zoom,
    layer.min_zoom,
    layer.tile_source,
    layer.width,
    layer.height,
    onMapPlacement,
    onViewerPanningChange,
    pins,
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
                onLandmarkClick(landmark);
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
                onPinClick(pin);
              }}
            >
              <span>{pin.title}</span>
            </button>
          );
        })}
      </div>

      {mapError ? (
        <div className="maps-layer-error" role="alert">
          <p>{mapError}</p>
        </div>
      ) : null}
    </section>
  );
});

export default TiledMapViewer;
