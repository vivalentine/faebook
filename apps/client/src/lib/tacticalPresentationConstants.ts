export const PRESENTATION_WIDTH = 1920;
export const PRESENTATION_HEIGHT = 1080;

export type PresentationViewBox = { x: number; y: number; width: number; height: number };

/** Expands the base presentation frame to the container aspect ratio without cropping it. */
export function presentationViewBox(containerWidth: number, containerHeight: number): PresentationViewBox {
  if (containerWidth <= 0 || containerHeight <= 0) return { x: 0, y: 0, width: PRESENTATION_WIDTH, height: PRESENTATION_HEIGHT };
  const baseAspect = PRESENTATION_WIDTH / PRESENTATION_HEIGHT;
  const actualAspect = containerWidth / containerHeight;
  if (actualAspect < baseAspect) {
    const height = PRESENTATION_WIDTH / actualAspect;
    return { x: 0, y: (PRESENTATION_HEIGHT - height) / 2, width: PRESENTATION_WIDTH, height };
  }
  if (actualAspect > baseAspect) {
    const width = PRESENTATION_HEIGHT * actualAspect;
    return { x: (PRESENTATION_WIDTH - width) / 2, y: 0, width, height: PRESENTATION_HEIGHT };
  }
  return { x: 0, y: 0, width: PRESENTATION_WIDTH, height: PRESENTATION_HEIGHT };
}
