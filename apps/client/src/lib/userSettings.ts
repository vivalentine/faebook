export type DensityPreference = "comfortable" | "compact";
export type MapZoomSensitivity = "gentle" | "balanced" | "quick";
export type DmBoardDefaultView = "mine" | "last-viewed-player";

export type UserSettings = {
  reducedMotion: boolean;
  uiDensity: DensityPreference;
  boardAutosave: boolean;
  mapZoomSensitivity: MapZoomSensitivity;
  dmBoardDefaultView: DmBoardDefaultView;
};

const STORAGE_VERSION = "v1";

const DEFAULT_SETTINGS: UserSettings = {
  reducedMotion: false,
  uiDensity: "comfortable",
  boardAutosave: true,
  mapZoomSensitivity: "balanced",
  dmBoardDefaultView: "mine",
};

function getStorageKey(userId: number) {
  return `faebook.settings.${STORAGE_VERSION}.user.${userId}`;
}

function sanitizeSettings(value: unknown): UserSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const source = value as Partial<UserSettings>;

  return {
    reducedMotion: source.reducedMotion === true,
    uiDensity: source.uiDensity === "compact" ? "compact" : "comfortable",
    boardAutosave: source.boardAutosave !== false,
    mapZoomSensitivity:
      source.mapZoomSensitivity === "gentle" || source.mapZoomSensitivity === "quick"
        ? source.mapZoomSensitivity
        : "balanced",
    dmBoardDefaultView:
      source.dmBoardDefaultView === "last-viewed-player" ? "last-viewed-player" : "mine",
  };
}

export function getUserSettings(userId: number): UserSettings {
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateUserSettings(userId: number, patch: Partial<UserSettings>): UserSettings {
  const nextSettings = {
    ...getUserSettings(userId),
    ...patch,
  };

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(nextSettings));
  return nextSettings;
}

export function getMapZoomDampingExponent(sensitivity: MapZoomSensitivity) {
  switch (sensitivity) {
    case "gentle":
      return 0.6;
    case "quick":
      return 0.3;
    case "balanced":
    default:
      return 0.45;
  }
}

export const DM_LAST_VIEWED_BOARD_OWNER_KEY = "faebook.dm.lastViewedBoardOwner.v1";
