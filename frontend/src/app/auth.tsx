// Manage the signed-in user and private socket. Edit for session behavior; copy provider patterns only.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ApiError, postJson } from "../shared/api";
import { createUserSocket, type SocketStatus } from "../shared/socket";
import type { User } from "../shared/types";

type AuthValue = {
  user: User | null;
  loading: boolean;
  error: string;
  status: SocketStatus;
  login: () => Promise<string>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
};
export const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SocketStatus>("idle");
  const reloadUser = useCallback(async () => {
    try {
      const data = await postJson<{ user: User }>("/auth/me");
      setUser(data.user);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUser(null);
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reloadUser();
  }, [reloadUser]);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const socket = createUserSocket({
      onStatus: (next) => {
        setStatus(next);
        if (next === "disconnected") void reloadUser();
      },
      onSessionEnded: () => {
        void reloadUser();
      },
      onMessage: (message) => window.dispatchEvent(new CustomEvent("gemma.event", { detail: message })),
    });
    return () => socket.stop();
  }, [userId, reloadUser]);
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        status,
        reloadUser,
        login: async () => {
          const { url } = await postJson<{ url: string }>("/auth/login");
          return url;
        },
        logout: async () => {
          await postJson("/auth/logout");
          setUser(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
