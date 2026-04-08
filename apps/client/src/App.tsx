import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DmDirectoryPage from "./pages/DmDirectoryPage";
import DmNpcPage from "./pages/DmNpcPage";
import PlayerDirectoryPage from "./pages/PlayerDirectoryPage";
import PlayerNpcPage from "./pages/PlayerNpcPage";
import BoardPage from "./pages/BoardPage";
import LoginPage from "./pages/LoginPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute allowRoles={["dm"]}>
                <DmDirectoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dm/npcs/:slug"
            element={
              <ProtectedRoute allowRoles={["dm"]}>
                <DmNpcPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dm/board"
            element={
              <ProtectedRoute allowRoles={["dm"]}>
                <BoardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/player"
            element={
              <ProtectedRoute allowRoles={["player", "dm"]}>
                <PlayerDirectoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/player/npcs/:slug"
            element={
              <ProtectedRoute allowRoles={["player", "dm"]}>
                <PlayerNpcPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/player/board"
            element={
              <ProtectedRoute allowRoles={["player", "dm"]}>
                <BoardPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}