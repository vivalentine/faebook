import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type LocationState = {
  from?: string;
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      await login(username.trim().toLowerCase(), password);

      navigate(state?.from || "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="login-shell">
        <div className="login-card">
          <p className="eyebrow">FaeBook</p>
          <h1>Sign in</h1>
          <p className="login-copy">
            Usernames for this build are dm, terry, hilton, and usaq.
          </p>

          {error ? (
            <div className="state-card error-card small-card">
              <p>{error}</p>
            </div>
          ) : null}

          <form className="note-form" onSubmit={handleSubmit}>
            <input
              className="text-input"
              type="text"
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <input
              className="text-input"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="action-button" type="submit" disabled={saving}>
              {saving ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}