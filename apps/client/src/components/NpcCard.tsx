import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { getFallbackReputation, getReputationIndicatorClassName } from "../lib/npcReputation";
import type { Npc } from "../types";

type Props = {
  npc: Npc;
  mode: "dm" | "player";
  onToggleVisibility?: (npc: Npc) => void;
  savingSlug?: string;
};

export default function NpcCard({
  npc,
  mode,
  onToggleVisibility,
  savingSlug = "",
}: Props) {
  const navigate = useNavigate();
  const imageUrl = npc.portrait_path ? apiUrl(npc.portrait_path) : "";
  const detailsHref = `/directory/${npc.slug}`;
  const reputation = npc.reputation || getFallbackReputation();

  function shouldIgnoreCardNavigation(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest("a, button, input, textarea, select, label, [data-no-card-nav='true']"));
  }

  function handleCardNavigate() {
    navigate(detailsHref);
  }

  return (
    <article
      className="npc-card npc-card-clickable"
      role="link"
      tabIndex={0}
      aria-label={`Open ${npc.name}`}
      onClick={(event) => {
        if (shouldIgnoreCardNavigation(event.target)) {
          return;
        }
        handleCardNavigate();
      }}
      onKeyDown={(event) => {
        if (shouldIgnoreCardNavigation(event.target)) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleCardNavigate();
        }
      }}
    >
      <div className="npc-image-wrap">
        {mode === "player" ? (
          <span
            className={getReputationIndicatorClassName(reputation)}
            title={reputation.card_label}
            aria-label={reputation.card_label}
          >
            {reputation.card_indicator === "heart"
              ? "💗"
              : reputation.card_indicator === "knife"
              ? "🔪"
              : null}
          </span>
        ) : null}

        {imageUrl ? (
          <img className="npc-image" src={imageUrl} alt={npc.name} />
        ) : (
          <div className="npc-image placeholder">No image</div>
        )}
      </div>

      <div className="npc-card-body">
        <div className="npc-card-header">
          <div>
            <h2>{npc.name}</h2>
            <p className="rank-line">{npc.rank_title || npc.role || "Unranked"}</p>
          </div>

          {mode === "dm" ? (
            <span
              className={
                npc.is_visible
                  ? "visibility-pill visible"
                  : "visibility-pill hidden"
              }
            >
              {npc.is_visible ? "Visible" : "Hidden"}
            </span>
          ) : null}
        </div>

        <div className="meta-row">
          {npc.house ? <span>House: {npc.house}</span> : null}
          {npc.court ? <span>Court: {npc.court}</span> : null}
          {npc.ring ? <span>Ring: {npc.ring}</span> : null}
        </div>

        {npc.short_blurb ? <p className="blurb">{npc.short_blurb}</p> : null}

        {npc.met_summary ? (
          <div className="summary-box">
            <p className="summary-label">Met when</p>
            <p>{npc.met_summary}</p>
          </div>
        ) : null}

        {mode === "dm" && onToggleVisibility ? (
          <div className="card-actions">
            <button
              className="action-button"
              data-no-card-nav="true"
              onClick={(event) => {
                event.stopPropagation();
                onToggleVisibility(npc);
              }}
              disabled={savingSlug === npc.slug}
            >
              {savingSlug === npc.slug
                ? "Saving..."
                : npc.is_visible
                ? "Hide from players"
                : "Reveal to players"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
