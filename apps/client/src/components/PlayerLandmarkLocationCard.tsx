import { Link } from "react-router-dom";
import type { LocationRecord, MapLandmark } from "../types";

type PlayerLandmarkLocationCardProps = {
  location: LocationRecord;
  landmark: MapLandmark;
  onClose: () => void;
};

function createBodyPreview(markdown: string, maxLength = 180) {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

export default function PlayerLandmarkLocationCard({
  location,
  landmark,
  onClose,
}: PlayerLandmarkLocationCardProps) {
  const metadata = [location.district, location.ring, location.court].filter(Boolean);
  const bodyPreview = createBodyPreview(location.body_markdown || "");

  return (
    <section className="map-location-card">
      <p className="map-location-card-kicker">Location</p>
      <h3>{location.name}</h3>
      {landmark.label !== location.name ? (
        <p className="map-location-card-meta">Landmark: {landmark.label}</p>
      ) : null}

      {metadata.length > 0 ? (
        <p className="map-location-card-meta">{metadata.join(" • ")}</p>
      ) : null}

      {location.summary ? <p>{location.summary}</p> : null}
      {!location.summary && bodyPreview ? <p>{bodyPreview}</p> : null}

      {location.tags.length > 0 ? (
        <div className="map-location-card-tags">
          {location.tags.map((tag) => (
            <span key={tag} className="chapter-chip">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="map-location-card-actions">
        <Link className="secondary-link" to={`/locations/${location.slug}`}>
          Open location
        </Link>
        <button className="secondary-link" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
