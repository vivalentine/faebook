import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { npcDetailPath } from "../lib/npcRoutes";
import { parseWikiText, resolveWikiEntity, type WikiEntityIndex } from "../lib/wikiLinks";
import type { LocationRecord, Npc } from "../types";

type WikiInlineTextProps = {
  text: string;
  entityIndex: WikiEntityIndex;
};

type WikiNpcLinkProps = {
  npc: Npc;
  label: string;
};

type PreviewPlacement = "left" | "right";

type WikiPreviewModel = {
  title: string;
  subtitle: string;
  summary: string | null;
  imageUrl?: string;
  metadata: Array<{ key: "court" | "ring" | "house" | "faction"; label: string; value: string }>;
};

const WIKI_METADATA_ORDER: Array<WikiPreviewModel["metadata"][number]["key"]> = [
  "court",
  "ring",
  "house",
  "faction",
];

function toPreviewMetadata(values: Partial<Record<WikiPreviewModel["metadata"][number]["key"], string | null | undefined>>) {
  const labels: Record<WikiPreviewModel["metadata"][number]["key"], string> = {
    court: "Court",
    ring: "Ring",
    house: "House",
    faction: "Faction",
  };

  return WIKI_METADATA_ORDER.flatMap((key) => {
    const value = (values[key] || "").trim();
    return value ? [{ key, label: labels[key], value }] : [];
  });
}

function mapNpcPreview(npc: Npc): WikiPreviewModel {
  return {
    title: npc.name,
    subtitle: npc.rank_title || npc.role || "Unknown role",
    summary: npc.short_blurb,
    imageUrl: npc.portrait_path ? apiUrl(npc.portrait_path) : undefined,
    metadata: toPreviewMetadata({
      court: npc.court,
      ring: npc.ring,
      house: npc.house,
      faction: npc.faction,
    }),
  };
}

function mapLocationPreview(location: LocationRecord): WikiPreviewModel {
  return {
    title: location.name,
    subtitle: location.district || "Location",
    summary: location.summary,
    metadata: toPreviewMetadata({
      court: location.court,
      ring: location.ring,
      faction: location.faction,
    }),
  };
}

function WikiPreviewCard({
  preview,
  ariaLabel,
  placement,
  id,
  onMouseEnter,
  onMouseLeave,
}: {
  preview: WikiPreviewModel;
  ariaLabel: string;
  placement: PreviewPlacement;
  id: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <span
      className={`wiki-preview-card ${placement === "left" ? "is-left" : "is-right"}`.trim()}
      role="tooltip"
      aria-label={ariaLabel}
      id={id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="wiki-preview-header">
        {preview.imageUrl ? <img src={preview.imageUrl} alt="" className="wiki-preview-portrait" /> : null}
        <span>
          <strong className="wiki-preview-name">{preview.title}</strong>
          <span className="wiki-preview-role">{preview.subtitle}</span>
        </span>
      </span>
      <span className="wiki-preview-meta" data-empty={preview.metadata.length === 0 ? "true" : undefined}>
        {preview.metadata.map((item) => (
          <span key={item.key} className="wiki-preview-meta-item">
            <strong>{item.label}:</strong> {item.value}
          </span>
        ))}
      </span>
      {preview.summary ? <span className="wiki-preview-summary">{preview.summary}</span> : null}
    </span>
  );
}

function getWikiPreviewPosition(triggerRect: DOMRect, cardRect: DOMRect, viewportWidth: number, viewportHeight: number) {
  const gap = 14;
  const edgePadding = 12;
  const availableRight = viewportWidth - triggerRect.right - gap;
  const availableLeft = triggerRect.left - gap;
  const placeRight = availableRight >= cardRect.width || availableRight >= availableLeft;
  const placement: PreviewPlacement = placeRight ? "right" : "left";
  const maxLeft = Math.max(edgePadding, viewportWidth - cardRect.width - edgePadding);

  const left = placeRight
    ? Math.min(triggerRect.right + gap, maxLeft)
    : Math.max(edgePadding, triggerRect.left - gap - cardRect.width);

  const top = Math.min(
    Math.max(edgePadding, triggerRect.top + triggerRect.height / 2 - cardRect.height / 2),
    Math.max(edgePadding, viewportHeight - cardRect.height - edgePadding),
  );

  return { left, top, placement };
}

function WikiEntityLink({
  to,
  label,
  preview,
  previewLabel,
}: {
  to: string;
  label: string;
  preview: WikiPreviewModel;
  previewLabel: string;
}) {
  const previewId = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const previewRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<PreviewPlacement>("right");
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  const closeSoon = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 110);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPreview = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const updatePreviewPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const card = previewRef.current;
    if (!trigger || !card) return;

    const triggerRect = trigger.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const next = getWikiPreviewPosition(triggerRect, cardRect, window.innerWidth, window.innerHeight);
    setCoords({ left: next.left, top: next.top });
    setPlacement(next.placement);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePreviewPosition();
    window.addEventListener("resize", updatePreviewPosition);
    window.addEventListener("scroll", updatePreviewPosition, true);
    return () => {
      window.removeEventListener("resize", updatePreviewPosition);
      window.removeEventListener("scroll", updatePreviewPosition, true);
    };
  }, [open, updatePreviewPosition]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <span
      ref={triggerRef}
      className="wiki-link-wrap"
      onMouseEnter={openPreview}
      onMouseLeave={closeSoon}
      onFocus={openPreview}
      onBlur={closeSoon}
    >
      <Link className="wiki-link" to={to} aria-describedby={open ? previewId : undefined}>
        {label}
      </Link>
      {open
        ? createPortal(
            <span
              className="wiki-preview-layer"
              style={{ left: `${coords.left}px`, top: `${coords.top}px` }}
            >
              <span ref={previewRef}>
                <WikiPreviewCard
                  id={previewId}
                  preview={preview}
                  ariaLabel={previewLabel}
                  placement={placement}
                  onMouseEnter={cancelClose}
                  onMouseLeave={closeSoon}
                />
              </span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function WikiNpcLink({ npc, label }: WikiNpcLinkProps) {
  return (
    <WikiEntityLink
      to={npcDetailPath(npc.slug)}
      label={label}
      preview={mapNpcPreview(npc)}
      previewLabel={`${npc.name} preview`}
    />
  );
}

function WikiLocationLink({ location, label }: { location: LocationRecord; label: string }) {
  return (
    <WikiEntityLink
      to={`/locations/${location.slug}`}
      label={label}
      preview={mapLocationPreview(location)}
      previewLabel={`${location.name} preview`}
    />
  );
}

export default function WikiInlineText({ text, entityIndex }: WikiInlineTextProps) {
  const tokens = parseWikiText(text);

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === "text") {
          return <span key={`text-${index}`}>{token.value}</span>;
        }

        const resolved = resolveWikiEntity(token.target, entityIndex);
        if (!resolved) {
          return (
            <span key={`missing-${index}`} className="wiki-link wiki-link--missing" title="Entity not found">
              {token.label}
            </span>
          );
        }

        if (resolved.type === "npc") {
          return <WikiNpcLink key={`npc-${index}`} npc={resolved.npc} label={token.label} />;
        }

        return <WikiLocationLink key={`loc-${index}`} location={resolved.location} label={token.label} />;
      })}
    </>
  );
}
