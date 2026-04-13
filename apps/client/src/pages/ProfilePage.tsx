import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";
import type { UserProfile } from "../types";

type ProfileResponse = {
  profile: UserProfile;
  can_manage_image?: boolean;
};

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const { userId } = useParams();
  const isDmInspectMode = useMemo(() => user?.role === "dm" && Boolean(userId), [user?.role, userId]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingText, setSavingText] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [statusLine, setStatusLine] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [bio, setBio] = useState("");
  const [manualImagePath, setManualImagePath] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const route = isDmInspectMode ? `/api/dm/profiles/${userId}` : "/api/profile";
        const response = await apiFetch(route);
        const data = (await response.json()) as ProfileResponse | { error?: string };
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || "Failed to load profile");
        }

        const nextProfile = (data as ProfileResponse).profile;
        setProfile(nextProfile);
        setDisplayName(nextProfile.display_name || "");
        setStatusLine(nextProfile.status_line || "");
        setPronouns(nextProfile.pronouns || "");
        setBio(nextProfile.bio || "");
        setManualImagePath(nextProfile.profile_image_path || "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [isDmInspectMode, userId]);

  const canEditText = Boolean(profile && (!isDmInspectMode || profile.user_id === user?.id));
  const canManageImage = Boolean(user?.role === "dm" && profile);
  const imageUrl = profile?.profile_image_path ? apiUrl(profile.profile_image_path) : "";

  async function handleSaveProfileText() {
    if (!canEditText) {
      return;
    }

    try {
      setSavingText(true);
      setError("");
      setMessage("");

      const response = await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName,
          status_line: statusLine,
          pronouns,
          bio,
        }),
      });
      const data = (await response.json()) as ProfileResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to update profile");
      }

      setProfile((data as ProfileResponse).profile);
      setMessage("Profile updated.");
      await refreshMe();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update profile");
    } finally {
      setSavingText(false);
    }
  }

  async function handleUploadProfileImage(file: File | null) {
    if (!file || !canManageImage || !profile) {
      return;
    }

    try {
      setSavingImage(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.set("profile_image", file);

      const response = await apiFetch(`/api/dm/profiles/${profile.user_id}/image-upload`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ProfileResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to upload profile image");
      }

      const nextProfile = (data as ProfileResponse).profile;
      setProfile(nextProfile);
      setManualImagePath(nextProfile.profile_image_path || "");
      setMessage("Profile image updated.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload profile image");
    } finally {
      setSavingImage(false);
    }
  }

  async function handleSaveManualImagePath() {
    if (!canManageImage || !profile) {
      return;
    }

    try {
      setSavingImage(true);
      setError("");
      setMessage("");

      const response = await apiFetch(`/api/dm/profiles/${profile.user_id}/image-path`, {
        method: "PATCH",
        body: JSON.stringify({
          profile_image_path: manualImagePath,
        }),
      });
      const data = (await response.json()) as ProfileResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to set image path");
      }

      setProfile((data as ProfileResponse).profile);
      setMessage("Profile image path saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to set image path");
    } finally {
      setSavingImage(false);
    }
  }

  if (loading) {
    return (
      <main className="main-content">
        <section className="state-card">
          <p>Loading profile...</p>
        </section>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="main-content">
        <section className="state-card error-card">
          <p>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="main-content profile-page-shell">
      <section className="state-card profile-card">
        <div className="profile-header-row">
          <div>
            <h1>{isDmInspectMode ? "Player Profile (DM View)" : "My Profile"}</h1>
            <p>Keep your campaign-facing persona concise and readable.</p>
          </div>
          {user?.role === "dm" ? <Link className="secondary-link profile-users-link" to="/settings">Settings</Link> : null}
        </div>

        <div className="profile-layout-grid">
          <div className="profile-image-panel">
            <div className="profile-image-wrap">
              {imageUrl ? (
                <img className="profile-image" src={imageUrl} alt={profile?.display_name || "Profile portrait"} />
              ) : (
                <div className="profile-image placeholder">No token assigned</div>
              )}
            </div>
            {canManageImage ? (
              <div className="profile-image-controls">
                <label className="settings-field" htmlFor="profile-image-upload">
                  DM Upload Token
                  <input
                    id="profile-image-upload"
                    className="text-input"
                    type="file"
                    accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg"
                    disabled={savingImage}
                    onChange={(event) => void handleUploadProfileImage(event.target.files?.[0] || null)}
                  />
                </label>
                <label className="settings-field" htmlFor="profile-image-path">
                  Or Set Existing Upload Path
                  <input
                    id="profile-image-path"
                    className="text-input"
                    value={manualImagePath}
                    placeholder="/uploads/player-profiles/example.webp"
                    onChange={(event) => setManualImagePath(event.target.value)}
                    disabled={savingImage}
                  />
                </label>
                <button className="secondary-link" type="button" disabled={savingImage} onClick={() => void handleSaveManualImagePath()}>
                  {savingImage ? "Saving..." : "Save Image Path"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="profile-edit-panel">
            <label className="settings-field" htmlFor="profile-display-name">
              Display Name
              <input
                id="profile-display-name"
                className="text-input"
                value={displayName}
                maxLength={60}
                disabled={!canEditText || savingText}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>

            <label className="settings-field" htmlFor="profile-status-line">
              Status Line
              <input
                id="profile-status-line"
                className="text-input"
                value={statusLine}
                maxLength={120}
                disabled={!canEditText || savingText}
                onChange={(event) => setStatusLine(event.target.value)}
              />
            </label>

            <label className="settings-field" htmlFor="profile-pronouns">
              Pronouns
              <input
                id="profile-pronouns"
                className="text-input"
                value={pronouns}
                maxLength={60}
                disabled={!canEditText || savingText}
                onChange={(event) => setPronouns(event.target.value)}
              />
            </label>

            <label className="settings-field" htmlFor="profile-bio">
              About
              <textarea
                id="profile-bio"
                className="text-input profile-bio-input"
                value={bio}
                maxLength={1500}
                disabled={!canEditText || savingText}
                onChange={(event) => setBio(event.target.value)}
              />
            </label>

            {canEditText ? (
              <button className="action-button" type="button" disabled={savingText} onClick={() => void handleSaveProfileText()}>
                {savingText ? "Saving..." : "Save Profile"}
              </button>
            ) : (
              <p className="settings-inline-note">DM can inspect this player profile but cannot edit player-authored text fields.</p>
            )}

            {message ? <p className="settings-inline-note">{message}</p> : null}
            {error ? <p className="settings-inline-note settings-inline-note-error">{error}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
