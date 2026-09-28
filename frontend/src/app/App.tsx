// Route the Gemma app and gate review access. Edit for navigation; copy guards for new pages.
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth";
import { LoginPage } from "../pages/LoginPage";
import { ChatPage } from "../pages/ChatPage";
import { ReviewPage } from "../pages/ReviewPage";
export function App() {
  const { user, loading, error, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  if (loading) return <div className="loading">Loading your session…</div>;
  const reviewer = user?.roles.some((role) => ["teacher", "admin"].includes(role));
  return (
    <>
      <header className="site-header">
        <NavLink to="/" className="brand">
          <img className="brand-icon" src="/favicon.svg" alt="" width="36" height="36" />
          TLF<span className="brand-light"> / Gemma</span>
        </NavLink>
        {user && (
          <>
            <nav>
              <NavLink to="/" end>
                My chat
              </NavLink>
              {reviewer && <NavLink to="/review">Review chats</NavLink>}
            </nav>
            <div className="account">
              <span>{user.email}</span>
              <button className="text-button" onClick={() => void logout().catch((e) => setLogoutError(e.message))}>
                Sign out
              </button>
            </div>
          </>
        )}
      </header>
      {(error || logoutError) && (
        <p role="alert" className="error global-error">
          {error || logoutError}
        </p>
      )}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={user ? <ChatPage key={user.id} /> : <Navigate to="/login" replace />} />
        <Route path="/review" element={!user ? <Navigate to="/login" replace /> : reviewer ? <ReviewPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
