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

function WikiNpcLink({ npc, label }: WikiNpcLinkProps) {
  const [open, setOpen] = useState(false);
  const imageUrl = npc.portrait_path ? apiUrl(npc.portrait_path) : "";

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
      {open ? (
        <span className="wiki-preview-card" role="dialog" aria-label={`${npc.name} preview`}>
          <span className="wiki-preview-header">
            {imageUrl ? <img src={imageUrl} alt="" className="wiki-preview-portrait" /> : null}
            <span>
              <strong className="wiki-preview-name">{npc.name}</strong>
              <span className="wiki-preview-role">{npc.rank_title || npc.role || "Unknown role"}</span>
            </span>
          </span>
          <span className="wiki-preview-meta">
            {npc.court ? <span>Court: {npc.court}</span> : null}
            {npc.ring ? <span>Ring: {npc.ring}</span> : null}
            {npc.house ? <span>House: {npc.house}</span> : null}
          </span>
          {npc.short_blurb ? <span className="wiki-preview-summary">{npc.short_blurb}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

function WikiLocationLink({ location, label }: { location: LocationRecord; label: string }) {
  const [open, setOpen] = useState(false);

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
      {open ? (
        <span className="wiki-preview-card" role="dialog" aria-label={`${location.name} preview`}>
          <span className="wiki-preview-header">
            <span>
              <strong className="wiki-preview-name">{location.name}</strong>
              <span className="wiki-preview-role">{location.district || "Location"}</span>
            </span>
          </span>
          <span className="wiki-preview-meta">
            {location.ring ? <span>Ring: {location.ring}</span> : null}
            {location.court ? <span>Court: {location.court}</span> : null}
            {location.faction ? <span>Faction: {location.faction}</span> : null}
          </span>
          {location.summary ? <span className="wiki-preview-summary">{location.summary}</span> : null}
        </span>
      ) : null}
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
