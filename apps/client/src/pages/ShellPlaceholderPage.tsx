import { Link } from "react-router-dom";

type Props = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function ShellPlaceholderPage({
  title,
  description,
  ctaLabel,
  ctaHref,
}: Props) {
  return (
    <main className="main-content">
      <section className="state-card placeholder-card">
        <h1>{title}</h1>
        <p>{description}</p>
        {ctaLabel && ctaHref ? (
          <div className="placeholder-actions">
            <Link to={ctaHref} className="action-button secondary-link">
              {ctaLabel}
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
