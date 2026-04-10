import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShellLayout from "./components/AppShellLayout";
import BoardPage from "./pages/BoardPage";
import DmDirectoryPage from "./pages/DmDirectoryPage";
import DmNpcPage from "./pages/DmNpcPage";
import LoginPage from "./pages/LoginPage";
import PlayerDirectoryPage from "./pages/PlayerDirectoryPage";
import PlayerNpcPage from "./pages/PlayerNpcPage";
import HomePage from "./pages/HomePage";
import MapsPage from "./pages/MapsPage";
import SettingsPage from "./pages/SettingsPage";
import DmToolsPage from "./pages/DmToolsPage";
import ArchivePage from "./pages/ArchivePage";
import SearchPage from "./pages/SearchPage";
import ChaptersPage from "./pages/ChaptersPage";
import "./App.css";

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
            <Route path="search" element={<SearchPage />} />
            <Route path="chapters" element={<ChaptersPage />} />
            <Route path="chapters/:chapterNumber" element={<ChaptersPage />} />
            <Route path="settings" element={<SettingsPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
