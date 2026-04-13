import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { SearchResponse, SearchResult } from "../types";

const SEARCH_FILTERS = [
  { value: "all", label: "All" },
  { value: "npcs", label: "NPCs" },
  { value: "locations", label: "Locations" },
  { value: "documents", label: "Documents" },
  { value: "chapters", label: "Chapters" },
  { value: "whisper_network", label: "Whisper Network" },
  { value: "maps", label: "Maps / Pins / Landmarks" },
] as const;

type SearchFilterValue = (typeof SEARCH_FILTERS)[number]["value"];

function parseFilterValue(rawValue: string | null): SearchFilterValue {
  const value = String(rawValue || "all").trim().toLowerCase();
  return SEARCH_FILTERS.some((filter) => filter.value === value) ? (value as SearchFilterValue) : "all";
}

function groupByLabel(results: SearchResult[]) {
  const grouped = new Map<string, SearchResult[]>();

  for (const result of results) {
    const key = result.label || "Other";
    const existing = grouped.get(key) || [];
    existing.push(result);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialEntityFilter = parseFilterValue(searchParams.get("entity"));

  const [query, setQuery] = useState(initialQuery);
  const [entityFilter, setEntityFilter] = useState<SearchFilterValue>(initialEntityFilter);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<SearchResponse>({
    query: initialQuery,
    limit: 40,
    offset: 0,
    total: 0,
    has_more: false,
    entity_filter: initialEntityFilter,
    results: [],
  });

  useEffect(() => {
    setQuery(initialQuery);
    setEntityFilter(initialEntityFilter);
  }, [initialQuery, initialEntityFilter]);

  useEffect(() => {
    const nextQuery = initialQuery.trim();
    const nextEntityFilter = initialEntityFilter;
    if (!nextQuery) {
      setResponse({
        query: "",
        limit: 40,
        offset: 0,
        total: 0,
        has_more: false,
        entity_filter: nextEntityFilter,
        results: [],
      });
      setLoading(false);
      setError("");
      return;
    }

    async function loadSearch() {
      try {
        setLoading(true);
        setError("");
        const result = await apiFetch(
          `/api/search?q=${encodeURIComponent(nextQuery)}&entity=${encodeURIComponent(nextEntityFilter)}`
        );
        const data = (await result.json()) as SearchResponse | { error?: string };

        if (!result.ok) {
          throw new Error((data as { error?: string }).error || "Search failed");
        }

        setResponse(data as SearchResponse);
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : "Search failed");
        setResponse({
          query: nextQuery,
          limit: 40,
          offset: 0,
          total: 0,
          has_more: false,
          entity_filter: nextEntityFilter,
          results: [],
        });
      } finally {
        setLoading(false);
      }
    }

    void loadSearch();
  }, [initialQuery, initialEntityFilter]);

  const grouped = useMemo(() => groupByLabel(response.results), [response.results]);

  return (
    <div className="main-content search-shell">
      <div className="topbar">
        <div>
          <h1>Global Search</h1>
          <p className="topbar-meta">Permission-aware search across your allowed campaign data.</p>
        </div>
      </div>

      <section className="state-card search-form-card">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            const next = query.trim();
            if (!next) {
              setSearchParams(entityFilter === "all" ? {} : { entity: entityFilter });
              return;
            }
            const nextParams: Record<string, string> = { q: next };
            if (entityFilter !== "all") {
              nextParams.entity = entityFilter;
            }
            setSearchParams(nextParams);
          }}
        >
          <input
            className="text-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search NPCs, aliases, notes, suspects, pins, recaps..."
          />
          <button type="submit" className="action-button search-submit-button">
            Search
          </button>
        </form>
        <div className="search-filter-row" role="tablist" aria-label="Search entity filters">
          {SEARCH_FILTERS.map((filter) => {
            const isActive = entityFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`search-filter-chip ${isActive ? "active" : ""}`.trim()}
                onClick={() => {
                  setEntityFilter(filter.value);
                  const nextQuery = query.trim();
                  if (!nextQuery) {
                    setSearchParams(filter.value === "all" ? {} : { entity: filter.value });
                    return;
                  }
                  setSearchParams(filter.value === "all" ? { q: nextQuery } : { q: nextQuery, entity: filter.value });
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      {!response.query && !loading ? (
        <div className="state-card">
          <p>Enter at least 2 characters to search.</p>
        </div>
      ) : null}

      {loading ? (
        <div className="state-card">
          <p>Searching…</p>
        </div>
      ) : null}

      {error ? (
        <div className="state-card error-card">
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && !error && response.query ? (
        <div className="search-results-shell">
          <p className="topbar-meta">
            Found {response.total} result{response.total === 1 ? "" : "s"} for “{response.query}”.
          </p>

          {grouped.length === 0 ? (
            <div className="state-card">
              <p>No matching results in your current permission scope.</p>
            </div>
          ) : (
            grouped.map(([label, items]) => (
              <section key={label} className="state-card search-group-card">
                <h2>{label}</h2>
                <ul className="search-result-list">
                  {items.map((item) => (
                    <li key={`${item.type}-${item.id}`} className="search-result-item">
                      <div>
                        <p className="search-result-title">{item.title}</p>
                        {item.snippet ? <p className="search-result-snippet">{item.snippet}</p> : null}
                      </div>
                      {item.url ? (
                        <Link to={item.url} className="secondary-link search-result-link">
                          Open
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
