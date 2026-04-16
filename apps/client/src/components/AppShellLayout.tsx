import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";
import { getUserSettings } from "../lib/userSettings";
import type { SearchSuggestion, SearchSuggestionsResponse, UserProfile } from "../types";

type NavItem = {
  label: string;
  to: string;
  icon: "home" | "search" | "book-open" | "file-text" | "message-circle" | "users" | "pinboard" | "map" | "journal" | "map-pin" | "archive" | "sliders";
  dmOnly?: boolean;
  playerOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/", icon: "home" },
  { label: "Search", to: "/search", icon: "search" },
  { label: "Chapter Library", to: "/chapters", icon: "book-open" },
  { label: "Documents", to: "/documents", icon: "file-text" },
  { label: "Whisper Network", to: "/whisper-network", icon: "message-circle" },
  { label: "NPC Directory", to: "/directory", icon: "users" },
  { label: "Investigation Board", to: "/board", icon: "pinboard" },
  { label: "Maps", to: "/maps", icon: "map" },
  { label: "Player Journal", to: "/journal", icon: "journal", playerOnly: true },
  { label: "Locations", to: "/locations", icon: "map-pin" },
  { label: "Archive", to: "/archive", icon: "archive", dmOnly: true },
  { label: "DM Tools", to: "/dm-tools", icon: "sliders", dmOnly: true },
];

function DrawerNavIcon({ icon }: { icon: NavItem["icon"] }) {
  switch (icon) {
    case "home":
      return <path d="M3 10.5 12 3l9 7.5M6.5 8.5V21h11V8.5" />;
    case "search":
      return (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21" />
        </>
      );
    case "book-open":
      return (
        <>
          <path d="M3 5.8c2.8-1.3 5.9-1.4 9 0v13.9c-3.1-1.4-6.2-1.3-9 0z" />
          <path d="M21 5.8c-2.8-1.3-5.9-1.4-9 0v13.9c3.1-1.4 6.2-1.3 9 0z" />
        </>
      );
    case "file-text":
      return (
        <>
          <path d="M7 3h8l4 4v14H7z" />
          <path d="M15 3v4h4M10 11h6M10 15h6M10 19h4" />
        </>
      );
    case "message-circle":
      return (
        <>
          <path d="M21 11.4a8.5 8.5 0 0 1-8.5 8.5H5l-2 2v-7.5A8.5 8.5 0 1 1 21 11.4Z" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a2.5 2.5 0 1 1 0 5M16.5 20a4.5 4.5 0 0 0-2.2-3.9" />
        </>
      );
    case "pinboard":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="8" cy="9" r="1.2" />
          <circle cx="16" cy="8" r="1.2" />
          <circle cx="13.5" cy="15.5" r="1.2" />
          <path d="M9 9.6 15 8.6M15.2 9.2l-1.2 5.2M12.8 15.8 9.2 10.2" />
        </>
      );
    case "map":
      return (
        <>
          <path d="M3 6.5 8.8 4l6.4 2.5L21 4v13.5L15.2 20l-6.4-2.5L3 20z" />
          <path d="M9 4.2v13.1M15 6.3v13.4" />
        </>
      );
    case "journal":
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2.2" />
          <path d="M9 3v18M12 8h4M12 12h4M12 16h3" />
        </>
      );
    case "map-pin":
      return (
        <>
          <path d="M12 21s6-5.8 6-10a6 6 0 1 0-12 0c0 4.2 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2.2" />
        </>
      );
    case "archive":
      return (
        <>
          <path d="M3 7h18v4H3zM5 11h14v10H5zM10 15h4" />
        </>
      );
    case "sliders":
      return (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="1.8" />
          <circle cx="15" cy="12" r="1.8" />
          <circle cx="11" cy="18" r="1.8" />
        </>
      );
    default:
      return null;
  }
}

export default function AppShellLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [shellSearch, setShellSearch] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [profileImagePath, setProfileImagePath] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsDrawerOpen(false);
    setIsSuggestionOpen(false);
    setActiveSuggestionIndex(-1);
  }, [location.pathname]);

  useEffect(() => {
    const query = shellSearch.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSuggestionsLoading(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setIsSuggestionsLoading(true);
        const response = await apiFetch(
          `/api/search/suggestions?q=${encodeURIComponent(query)}&limit=6`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as SearchSuggestionsResponse | { error?: string };
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || "Suggestion lookup failed");
        }
        const nextSuggestions = (data as SearchSuggestionsResponse).suggestions || [];
        setSuggestions(nextSuggestions);
        setIsSuggestionOpen(nextSuggestions.length > 0);
        setActiveSuggestionIndex(-1);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setSuggestions([]);
        setIsSuggestionOpen(false);
        setActiveSuggestionIndex(-1);
      } finally {
        if (!controller.signal.aborted) {
          setIsSuggestionsLoading(false);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [shellSearch]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!searchContainerRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !searchContainerRef.current.contains(target)) {
        setIsSuggestionOpen(false);
        setActiveSuggestionIndex(-1);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);


  useEffect(() => {
    if (!user) {
      setProfileImagePath(null);
      return;
    }

    const settings = getUserSettings(user.id);
    document.body.classList.toggle("ui-density-compact", settings.uiDensity === "compact");
    document.body.classList.toggle("prefers-reduced-motion", settings.reducedMotion);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfileImagePath(null);
      return;
    }

    const controller = new AbortController();

    async function loadProfileImage() {
      try {
        const response = await apiFetch("/api/profile", { signal: controller.signal });
        const data = (await response.json()) as { profile?: UserProfile; error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Failed to load profile");
        }
        setProfileImagePath(data.profile?.profile_image_path || null);
      } catch {
        if (!controller.signal.aborted) {
          setProfileImagePath(null);
        }
      }
    }

    void loadProfileImage();

    return () => controller.abort();
  }, [user]);

  const navItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.dmOnly) {
          return user?.role === "dm";
        }
        if (item.playerOnly) {
          return user?.role === "player";
        }
        return true;
      }),
    [user?.role],
  );

  async function handleSignOut() {
    try {
      setLoggingOut(true);
      setLogoutError("");
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Sign out failed");
    } finally {
      setLoggingOut(false);
    }
  }

  function closeSuggestionDropdown() {
    setIsSuggestionOpen(false);
    setActiveSuggestionIndex(-1);
  }

  function navigateFromSearch(query: string) {
    const nextQuery = query.trim();
    closeSuggestionDropdown();
    if (!nextQuery) {
      navigate("/search");
      return;
    }
    navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
  }

  function handleSuggestionSelect(suggestion: SearchSuggestion) {
    setShellSearch(suggestion.title);
    closeSuggestionDropdown();
    if (suggestion.url) {
      navigate(suggestion.url);
      return;
    }
    navigateFromSearch(suggestion.title);
  }

  function getSuggestionEntityLabel(suggestion: SearchSuggestion) {
    switch (suggestion.type) {
      case "npc":
        return "NPC";
      case "canonical_alias":
        return "Canonical Alias";
      case "personal_alias":
        return "Personal Alias";
      case "npc_note":
        return "NPC Note";
      case "dashboard_suspect":
        return "Suspect";
      case "dashboard_note":
        return "Note";
      case "map_pin":
        return "Map Pin";
      case "session_recap":
        return "Recap";
      case "archive_record":
        return "Archive";
      case "import_log":
        return "Import Log";
      default:
        return suggestion.label || "Result";
    }
  }

  return (
    <div className={`app-shell app-shell-layout ${isDrawerOpen ? "drawer-open" : ""}`.trim()}>
      <button
        className="drawer-backdrop"
        type="button"
        aria-hidden={!isDrawerOpen}
        tabIndex={isDrawerOpen ? 0 : -1}
        onClick={() => setIsDrawerOpen(false)}
      />

      <aside className={`app-drawer ${isDrawerOpen ? "open" : ""}`}>
        <div className="drawer-top">
          <p className="eyebrow">FaeBook</p>

          <nav className="drawer-nav" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `drawer-link ${isActive ? "active" : ""}`.trim()
                }
                end={item.to === "/"}
              >
                <span className="drawer-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <DrawerNavIcon icon={item.icon} />
                  </svg>
                </span>
                <span className="drawer-link-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="drawer-utility-row">
          <NavLink to="/profile" className="drawer-account-chip">
            {profileImagePath ? (
              <img
                className="drawer-account-avatar"
                src={apiUrl(profileImagePath)}
                alt={`${user?.display_name || user?.username || "User"} token`}
              />
            ) : (
              <span className="drawer-account-avatar drawer-account-avatar-fallback" aria-hidden="true">
                {(user?.display_name || user?.username || "?").trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="drawer-account-name">{user?.display_name || user?.username}</span>
          </NavLink>
          <NavLink to="/settings" className="drawer-settings" aria-label="Settings">
            ⚙️
          </NavLink>
          <button
            className="drawer-signout"
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      <div className="app-content-area">
        <header className="shell-header">
          <div className="shell-header-row">
            <button
              className="hamburger"
              type="button"
              aria-label="Open navigation"
              onClick={() => setIsDrawerOpen((open) => !open)}
            >
              ☰
            </button>
            <form
              className="shell-search-form"
              onSubmit={(event) => {
                event.preventDefault();
                const selectedSuggestion =
                  activeSuggestionIndex >= 0 ? suggestions[activeSuggestionIndex] : null;
                if (selectedSuggestion) {
                  handleSuggestionSelect(selectedSuggestion);
                  return;
                }
                navigateFromSearch(shellSearch);
              }}
            >
              <div className="shell-search-input-wrap" ref={searchContainerRef}>
                <input
                  className="text-input shell-search-input"
                  type="search"
                  placeholder="Search NPCs, notes, suspects, pins..."
                  value={shellSearch}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setIsSuggestionOpen(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!isSuggestionOpen || suggestions.length === 0) {
                      if (event.key === "Escape") {
                        closeSuggestionDropdown();
                      }
                      return;
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveSuggestionIndex((current) =>
                        current + 1 >= suggestions.length ? 0 : current + 1,
                      );
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveSuggestionIndex((current) =>
                        current <= 0 ? suggestions.length - 1 : current - 1,
                      );
                      return;
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeSuggestionDropdown();
                    }
                  }}
                  onChange={(event) => {
                    setShellSearch(event.target.value);
                    setIsSuggestionOpen(true);
                  }}
                />
                {isSuggestionOpen ? (
                  <div className="shell-search-suggestions" role="listbox" aria-label="Search suggestions">
                    {isSuggestionsLoading && suggestions.length === 0 ? (
                      <p className="shell-search-suggestions-empty">Searching…</p>
                    ) : null}
                    {!isSuggestionsLoading && suggestions.length === 0 ? (
                      <p className="shell-search-suggestions-empty">No quick suggestions.</p>
                    ) : null}
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.type}-${suggestion.id}`}
                        type="button"
                        className={`shell-search-suggestion-item ${index === activeSuggestionIndex ? "active" : ""}`.trim()}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <span className="shell-search-suggestion-title">{suggestion.title}</span>
                        <span className="shell-search-suggestion-type">
                          {getSuggestionEntityLabel(suggestion)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button className="drawer-signout shell-search-button" type="submit">
                Search
              </button>
            </form>
          </div>
        </header>

        {logoutError ? (
          <div className="state-card error-card small-card shell-error-banner">
            <p>{logoutError}</p>
          </div>
        ) : null}

        <div className="app-page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
