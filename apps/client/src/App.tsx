import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShellLayout from "./components/AppShellLayout";
import { LiveCampaignStateProvider } from "./context/LiveCampaignStateContext";
import "./App.css";

const ArchivePage = lazy(() => import("./pages/ArchivePage"));
const BoardPage = lazy(() => import("./pages/BoardPage"));
const ChaptersPage = lazy(() => import("./pages/ChaptersPage"));
const DmDirectoryPage = lazy(() => import("./pages/DmDirectoryPage"));
const DmNpcPage = lazy(() => import("./pages/DmNpcPage"));
const DmToolsPage = lazy(() => import("./pages/DmToolsPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const LocationDetailPage = lazy(() => import("./pages/LocationDetailPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MapsPage = lazy(() => import("./pages/MapsPage"));
const PlayerDirectoryPage = lazy(() => import("./pages/PlayerDirectoryPage"));
const PlayerNpcPage = lazy(() => import("./pages/PlayerNpcPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WhisperNetworkPage = lazy(() => import("./pages/WhisperNetworkPage"));
const TacticalEncountersPage = lazy(() => import("./pages/TacticalEncountersPage"));
const TacticalEncounterPage = lazy(() => import("./pages/TacticalEncounterPage"));
const TacticalPresentationPage = lazy(() => import("./pages/TacticalPresentationPage"));
const FaeO3Page = lazy(() => import("./features/lumi/FaeO3Page"));
const PixiePage = lazy(() => import("./features/lumi/PixiePage"));
const LumiStickerAtlasPreview = import.meta.env.DEV
  ? lazy(() => import("./features/lumi/LumiStickerAtlasPreview"))
  : null;

function RouteLoadingFallback() {
  return (
    <div className="route-loading-wrap" role="status" aria-live="polite" aria-label="Loading page">
      <div className="route-loading-card">
        <p className="route-loading-label">Gathering whispers...</p>
      </div>
    </div>
  );
}

function DirectoryRoute() {
  const { user } = useAuth();
  return user?.role === "dm" ? <DmDirectoryPage /> : <PlayerDirectoryPage />;
}

function DirectoryNpcRoute() {
  const { user } = useAuth();
  return user?.role === "dm" ? <DmNpcPage /> : <PlayerNpcPage />;
}

function LegacyNpcRedirect() {
  const { slug = "" } = useParams();
  return <Navigate to={`/directory/${slug}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LiveCampaignStateProvider>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            {LumiStickerAtlasPreview && <Route path="/dev/lumi-stickers" element={<LumiStickerAtlasPreview />} />}
            <Route path="/secret/faeo3" element={<ProtectedRoute allowRoles={["dm", "player"]}><FaeO3Page /></ProtectedRoute>} />
            <Route path="/secret/faeo3/works/:slug" element={<ProtectedRoute allowRoles={["dm", "player"]}><FaeO3Page /></ProtectedRoute>} />
            <Route path="/secret/faeo3/works/:slug/chapters/:chapterNumber" element={<ProtectedRoute allowRoles={["dm", "player"]}><FaeO3Page /></ProtectedRoute>} />
            <Route path="/secret/faeo3/tales/:slug" element={<ProtectedRoute allowRoles={["dm", "player"]}><FaeO3Page legacy /></ProtectedRoute>} />
            <Route path="/secret/pixie" element={<ProtectedRoute allowRoles={["dm", "player"]}><PixiePage /></ProtectedRoute>} />
            <Route path="/dm/encounters/:encounterId/presentation" element={<ProtectedRoute allowRoles={["dm"]}><TacticalPresentationPage /></ProtectedRoute>} />

            <Route
              path="/"
              element={
                <ProtectedRoute allowRoles={["dm", "player"]}>
                  <AppShellLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="directory" element={<DirectoryRoute />} />
              <Route path="directory/:slug" element={<DirectoryNpcRoute />} />
              <Route path="board" element={<BoardPage />} />
              <Route path="maps" element={<MapsPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="locations" element={<LocationsPage />} />
              <Route path="locations/:slug" element={<LocationDetailPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="chapters" element={<ChaptersPage />} />
              <Route path="chapters/:chapterNumber" element={<ChaptersPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/:slug" element={<DocumentsPage />} />
              <Route path="whisper-network" element={<WhisperNetworkPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route
                path="dm/profiles/:userId"
                element={
                  <ProtectedRoute allowRoles={["dm"]}>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="dm-tools"
                element={
                  <ProtectedRoute allowRoles={["dm"]}>
                    <DmToolsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="archive"
                element={
                  <ProtectedRoute allowRoles={["dm"]}>
                    <ArchivePage />
                  </ProtectedRoute>
                }
              />
              <Route path="dm/encounters" element={<ProtectedRoute allowRoles={["dm"]}><TacticalEncountersPage /></ProtectedRoute>} />
              <Route path="dm/encounters/:encounterId" element={<ProtectedRoute allowRoles={["dm"]}><TacticalEncounterPage /></ProtectedRoute>} />
            </Route>

            <Route path="/player" element={<Navigate to="/directory" replace />} />
            <Route path="/player/npcs/:slug" element={<LegacyNpcRedirect />} />
            <Route path="/player/board" element={<Navigate to="/board" replace />} />
            <Route path="/dm/npcs/:slug" element={<LegacyNpcRedirect />} />
            <Route path="/dm/board" element={<Navigate to="/board" replace />} />

            <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </LiveCampaignStateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
