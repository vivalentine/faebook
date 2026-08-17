import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import type { LiveCampaignDate, LiveStateResponse, WinterInterferenceLevel } from "../types";

type LiveCampaignStateValue = {
  campaignDate: LiveCampaignDate | null;
  winterInterferenceLevel: WinterInterferenceLevel;
  campaignUpdatedAt: string | null;
  presentationUpdatedAt: string | null;
  refreshLiveState: () => Promise<void>;
};

const LiveCampaignStateContext = createContext<LiveCampaignStateValue | undefined>(undefined);

export function LiveCampaignStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [campaignDate, setCampaignDate] = useState<LiveCampaignDate | null>(null);
  const [winterInterferenceLevel, setWinterInterferenceLevel] = useState<WinterInterferenceLevel>("off");
  const [presentationUpdatedAt, setPresentationUpdatedAt] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const refreshLiveState = useCallback(async () => {
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await apiFetch("/api/live-state", { signal: controller.signal });
      if (!response.ok) return;
      const data = (await response.json()) as LiveStateResponse;
      if (controller.signal.aborted) return;
      setCampaignDate(data.campaign_date);
      setWinterInterferenceLevel(data.presentation.winter_interference_level);
      setPresentationUpdatedAt(data.presentation.updated_at);
    } catch {
      // Transient live-state failures intentionally retain the last good state.
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      inFlightRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      controllerRef.current?.abort();
      setCampaignDate(null);
      setWinterInterferenceLevel("off");
      setPresentationUpdatedAt(null);
      return;
    }

    void refreshLiveState();
    const intervalId = window.setInterval(() => void refreshLiveState(), 1000);
    return () => {
      window.clearInterval(intervalId);
      controllerRef.current?.abort();
      controllerRef.current = null;
      inFlightRef.current = false;
    };
  }, [refreshLiveState, user]);

  const value = useMemo(() => ({
    campaignDate,
    winterInterferenceLevel,
    campaignUpdatedAt: campaignDate?.updated_at ?? null,
    presentationUpdatedAt,
    refreshLiveState,
  }), [campaignDate, winterInterferenceLevel, presentationUpdatedAt, refreshLiveState]);

  return <LiveCampaignStateContext.Provider value={value}>{children}</LiveCampaignStateContext.Provider>;
}

export function useLiveCampaignState() {
  const value = useContext(LiveCampaignStateContext);
  if (!value) throw new Error("useLiveCampaignState must be used inside LiveCampaignStateProvider");
  return value;
}
