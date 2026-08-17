import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { WinterInterferenceLevel } from "../types";
import "../styles/winter-interference.css";

type GlitchEvent = "chromatic-ghost" | "horizontal-tear" | "frost-surge" | "cold-flash" | "signal-noise" | "deep-freeze";

const INTERVALS: Record<Exclude<WinterInterferenceLevel, "off">, [number, number]> = {
  low: [12_000, 24_000],
  medium: [6_000, 12_000],
  severe: [2_500, 6_000],
};

const EVENTS: Record<Exclude<WinterInterferenceLevel, "off">, GlitchEvent[]> = {
  low: ["chromatic-ghost", "frost-surge", "cold-flash", "signal-noise"],
  medium: ["chromatic-ghost", "horizontal-tear", "frost-surge", "cold-flash", "signal-noise", "deep-freeze"],
  severe: ["chromatic-ghost", "horizontal-tear", "horizontal-tear", "frost-surge", "cold-flash", "signal-noise", "deep-freeze"],
};

function randomBetween([min, max]: [number, number]) {
  return min + Math.random() * (max - min);
}

export default function WinterInterferenceLayer({ level }: { level: WinterInterferenceLevel }) {
  const [event, setEvent] = useState<GlitchEvent | null>(null);
  const [tearTop, setTearTop] = useState(50);

  useEffect(() => {
    let scheduleTimer: number | undefined;
    let eventTimer: number | undefined;
    let disposed = false;
    const reducedMotion = document.body.classList.contains("prefers-reduced-motion")
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setEvent(null);
    if (level === "off" || reducedMotion) return;

    const schedule = () => {
      scheduleTimer = window.setTimeout(() => {
        if (disposed) return;
        const choices = EVENTS[level];
        const nextEvent = choices[Math.floor(Math.random() * choices.length)];
        setTearTop(12 + Math.random() * 76);
        setEvent(nextEvent);
        const duration = nextEvent === "frost-surge" && level === "severe"
          ? randomBetween([400, 700])
          : randomBetween([80, 450]);
        eventTimer = window.setTimeout(() => {
          setEvent(null);
          schedule();
        }, duration);
      }, randomBetween(INTERVALS[level]));
    };

    schedule();
    return () => {
      disposed = true;
      if (scheduleTimer) window.clearTimeout(scheduleTimer);
      if (eventTimer) window.clearTimeout(eventTimer);
      setEvent(null);
    };
  }, [level]);

  if (level === "off") return null;

  return (
    <div
      className={`winter-interference-layer winter-level-${level}${event ? ` winter-event-${event}` : ""}`}
      style={{ "--winter-tear-top": `${tearTop}%` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="winter-cold-cast" />
      <div className="winter-frost winter-frost-primary" />
      <div className="winter-frost winter-frost-crystals" />
      <div className="winter-tear" />
      <div className="winter-fragments" />
    </div>
  );
}
