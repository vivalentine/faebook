import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FaeIcon, { type FaeIconName } from "./FaeIcon";
import { apiFetch, apiUrl } from "../lib/api";
import { getUserSettings } from "../lib/userSettings";
import type { SearchSuggestion, SearchSuggestionsResponse, UserProfile } from "../types";

type NavItem = {
  label: string;
  to: string;
  icon: FaeIconName;
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
                  <FaeIcon icon={item.icon} />
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
