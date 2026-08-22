import { useState, type FormEvent } from "react";
import { SECRET_SITE_USERNAME } from "./lumiAssets";

type Props = { password: string; siteName: string; onUnlock: () => void };

export default function SecretLoginForm({ password: expectedPassword, siteName, onUnlock }: Props) {
  const [username, setUsername] = useState(SECRET_SITE_USERNAME);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username.trim().toLocaleLowerCase() === SECRET_SITE_USERNAME.toLocaleLowerCase() && password === expectedPassword) {
      setError("");
      onUnlock();
      return;
    }
    setError("Incorrect username or password.");
  }

  return <form className="secret-login-form" onSubmit={submit}>
    {error && <p className="secret-login-error" role="alert" aria-live="assertive">{error}</p>}
    <label htmlFor={`${siteName}-username`}>Username</label>
    <input id={`${siteName}-username`} name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
    <label htmlFor={`${siteName}-password`}>Password</label>
    <input id={`${siteName}-password`} name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
    <button type="submit">Log In</button>
  </form>;
}
