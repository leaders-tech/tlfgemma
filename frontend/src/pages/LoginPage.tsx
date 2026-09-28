// Show the OIDC entry page. Edit for sign-in copy; copy for another public page.
import { useState } from "react";
import { useAuth } from "../app/auth";
export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState(new URLSearchParams(window.location.search).has("error") ? "Sign-in failed. Please try again." : "");
  const [busy, setBusy] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  return (
    <main className="login">
      <div className="eyebrow">THE LEADERS FOUNDATION</div>
      <h1>
        Your ideas.
        <br />
        <span>Room to grow.</span>
      </h1>
      <p>
        Your workspace for ML competitions.
        <br />
        Ask Gemma, explore ideas, and make them your own.
      </p>
      <button
        className="primary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void login()
            .then((url) => {
              setLoginUrl(url);
              window.location.assign(url);
            })
            .catch((e) => {
              setError(e.message);
              setBusy(false);
            });
        }}
      >
        {busy ? "Connecting…" : "Sign in with TLF"}
        <span aria-hidden="true"> ↗</span>
      </button>
      {loginUrl && (
        <p>
          <a className="text-button" href={loginUrl}>
            Continue to sign in ↗
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="login-facts">
        <span>60 messages / hour</span>
        <span>1,000 characters / message</span>
        <span>One prompt at a time</span>
      </div>
    </main>
  );
}
