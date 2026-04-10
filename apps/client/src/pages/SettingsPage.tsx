import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FaeSelect from "../components/FaeSelect";
import { apiFetch } from "../lib/api";
import { getUserSettings, type DmBoardDefaultView, type MapZoomSensitivity, type UserSettings, updateUserSettings } from "../lib/userSettings";

function roleLabel(role: "dm" | "player") {
  return role === "dm" ? "Dungeon Master" : "Player";
}

export default function SettingsPage() {
  const { user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState(user?.display_name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const [settings, setSettings] = useState<UserSettings>(() => {
    if (!user) {
      return {
        reducedMotion: false,
        uiDensity: "comfortable",
        boardAutosave: true,
        mapZoomSensitivity: "balanced",
        dmBoardDefaultView: "mine",
      };
    }

    return getUserSettings(user.id);
  });

  const roleText = useMemo(() => (user ? roleLabel(user.role) : "Unknown"), [user]);

  if (!user) {
    return (
      <main className="main-content settings-page-shell">
        <section className="state-card settings-card">
          <h1>Settings</h1>
          <p>Unable to load your account information right now.</p>
        </section>
      </main>
    );
  }

  const userId = user.id;

  function persistSettings(nextSettings: UserSettings) {
    setSettings(nextSettings);
    updateUserSettings(userId, nextSettings);
    document.body.classList.toggle("ui-density-compact", nextSettings.uiDensity === "compact");
    document.body.classList.toggle("prefers-reduced-motion", nextSettings.reducedMotion);
  }

  function setPreference<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    persistSettings(nextSettings);
  }

  async function handleProfileSave() {
    const displayName = profileName.trim();

    if (!displayName) {
      setProfileMessage("Display name cannot be empty.");
      return;
    }

    try {
      setProfileSaving(true);
      setProfileMessage("");

      const response = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ display_name: displayName }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save profile settings");
      }

      await refreshMe();
      setProfileMessage("Display name updated.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Could not save profile settings");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      setSessionLoading(true);
      setSessionError("");
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setSessionLoading(false);
    }
  }

  return (
    <main className="main-content settings-page-shell">
      <section className="state-card settings-card">
        <div className="settings-card-header">
          <h1>Settings</h1>
          <p>Manage your account and app behavior for this device.</p>
        </div>

        <div className="settings-grid">
          <section className="settings-section">
            <h2>Account</h2>
            <div className="settings-kv-list">
              <div>
                <span>Username</span>
                <strong>{user.username}</strong>
              </div>
              <div>
                <span>Role</span>
                <strong>{roleText}</strong>
              </div>
              <div>
                <span>Permission Tier</span>
                <strong>{user.role === "dm" ? "DM Admin" : "Player Workspace"}</strong>
              </div>
            </div>

            <label className="settings-field" htmlFor="display-name-input">
              Display Name
              <input
                id="display-name-input"
                className="text-input"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                maxLength={60}
              />
            </label>
            <div className="settings-row-actions">
              <button className="action-button" type="button" disabled={profileSaving} onClick={() => void handleProfileSave()}>
                {profileSaving ? "Saving..." : "Save Display Name"}
              </button>
            </div>
            {profileMessage ? <p className="settings-inline-note">{profileMessage}</p> : null}
          </section>

          <section className="settings-section">
            <h2>Session & Access</h2>
            <div className="settings-kv-list">
              <div>
                <span>Session</span>
                <strong>Authenticated</strong>
              </div>
              <div>
                <span>Active Role</span>
                <strong>{user.role}</strong>
              </div>
            </div>
            <div className="settings-row-actions">
              <button className="board-node-delete-button" type="button" disabled={sessionLoading} onClick={() => void handleSignOut()}>
                {sessionLoading ? "Signing out..." : "Sign Out"}
              </button>
            </div>
            {sessionError ? <p className="settings-inline-note settings-inline-note-error">{sessionError}</p> : null}
          </section>

          <section className="settings-section">
            <h2>Appearance</h2>
            <label className="settings-field" htmlFor="ui-density-select">
              Interface Density
              <FaeSelect
                id="ui-density-select"
                className="text-input"
                value={settings.uiDensity}
                onChange={(nextValue) => setPreference("uiDensity", nextValue as "comfortable" | "compact")}
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ]}
              />
            </label>

            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) => setPreference("reducedMotion", event.target.checked)}
              />
              <span>Reduce motion and micro-animation where supported</span>
            </label>
          </section>

          <section className="settings-section">
            <h2>Maps & Board Preferences</h2>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.boardAutosave}
                onChange={(event) => setPreference("boardAutosave", event.target.checked)}
              />
              <span>Enable board autosave</span>
            </label>

            <label className="settings-field" htmlFor="map-zoom-sensitivity-select">
              Map Zoom Sensitivity
              <FaeSelect
                id="map-zoom-sensitivity-select"
                className="text-input"
                value={settings.mapZoomSensitivity}
                onChange={(nextValue) => setPreference("mapZoomSensitivity", nextValue as MapZoomSensitivity)}
                options={[
                  { value: "gentle", label: "Gentle" },
                  { value: "balanced", label: "Balanced" },
                  { value: "quick", label: "Quick" },
                ]}
              />
            </label>
          </section>

          {user.role === "dm" ? (
            <section className="settings-section">
              <h2>DM Admin Preferences</h2>
              <label className="settings-field" htmlFor="dm-board-default-select">
                Default Board Landing
                <FaeSelect
                  id="dm-board-default-select"
                  className="text-input"
                  value={settings.dmBoardDefaultView}
                  onChange={(nextValue) => setPreference("dmBoardDefaultView", nextValue as DmBoardDefaultView)}
                  options={[
                    { value: "mine", label: "Open my DM board" },
                    { value: "last-viewed-player", label: "Open last inspected player board" },
                  ]}
                />
              </label>
              <p className="settings-inline-note">Only DM users see this section.</p>
            </section>
          ) : null}
        </div>

        <p className="settings-footnote">
          These presentation and interaction preferences are saved per user on this browser.
        </p>
      </section>
    </main>
  );
}
