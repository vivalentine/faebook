import { useCallback, useLayoutEffect, useState } from "react";
import { presentationViewBox, type PresentationViewBox } from "../lib/tacticalPresentationConstants";

export function usePresentationViewBox<T extends HTMLElement>() {
  const [container, setContainer] = useState<T | null>(null);
  const containerRef = useCallback((node: T | null) => setContainer(node), []);
  const [viewBox, setViewBox] = useState<PresentationViewBox>(() => presentationViewBox(1920, 1080));

  useLayoutEffect(() => {
    if (!container) return;
    const update = (width: number, height: number) => setViewBox(presentationViewBox(width, height));
    const rect = container.getBoundingClientRect();
    update(rect.width, rect.height);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  return { containerRef, viewBox };
}
