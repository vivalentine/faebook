import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShellLayout from "./components/AppShellLayout";
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
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

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
            </Route>

            <Route path="/player" element={<Navigate to="/directory" replace />} />
            <Route path="/player/npcs/:slug" element={<LegacyNpcRedirect />} />
            <Route path="/player/board" element={<Navigate to="/board" replace />} />
            <Route path="/dm/npcs/:slug" element={<LegacyNpcRedirect />} />
            <Route path="/dm/board" element={<Navigate to="/board" replace />} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
