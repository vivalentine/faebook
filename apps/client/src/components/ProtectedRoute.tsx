import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { AuthRole } from "../types";

type Props = {
  allowRoles: AuthRole[];
  children: ReactElement;
};

export default function ProtectedRoute({ allowRoles, children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-shell">
        <div className="state-card">
          <p>Checking session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!allowRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}