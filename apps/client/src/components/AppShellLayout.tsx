import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type NavItem = {
  label: string;
  to: string;
  dmOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "NPC Directory", to: "/directory" },
  { label: "Investigation Board", to: "/board" },
  { label: "Maps", to: "/maps" },
  { label: "Archive", to: "/archive", dmOnly: true },
  { label: "DM Tools", to: "/dm-tools", dmOnly: true },
];

export default function AppShellLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.dmOnly || user?.role === "dm"),
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
          <p className="drawer-user">{user?.display_name || user?.username}</p>

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
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="drawer-utility-row">
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
          <button
            className="hamburger"
            type="button"
            aria-label="Open navigation"
            onClick={() => setIsDrawerOpen((open) => !open)}
          >
            ☰
          </button>
        </header>

        {logoutError ? (
          <div className="state-card error-card small-card shell-error-banner">
            <p>{logoutError}</p>
          </div>
        ) : null}

        <Outlet />
      </div>
    </div>
  );
}
