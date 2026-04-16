import { useState } from "react";
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

function WikiPreviewCard({ preview, ariaLabel }: { preview: WikiPreviewModel; ariaLabel: string }) {
  return (
    <span className="wiki-preview-card" role="dialog" aria-label={ariaLabel}>
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

function WikiNpcLink({ npc, label }: WikiNpcLinkProps) {
  const [open, setOpen] = useState(false);
  const preview = mapNpcPreview(npc);

  return (
    <span
      className="wiki-link-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Link className="wiki-link" to={npcDetailPath(npc.slug)}>
        {label}
      </Link>
      {open ? <WikiPreviewCard preview={preview} ariaLabel={`${npc.name} preview`} /> : null}
    </span>
  );
}

function WikiLocationLink({ location, label }: { location: LocationRecord; label: string }) {
  const [open, setOpen] = useState(false);
  const preview = mapLocationPreview(location);

  return (
    <span
      className="wiki-link-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Link className="wiki-link" to={`/locations/${location.slug}`}>
        {label}
      </Link>
      {open ? <WikiPreviewCard preview={preview} ariaLabel={`${location.name} preview`} /> : null}
    </span>
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
