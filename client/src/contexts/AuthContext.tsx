import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { setAppTimeZone } from "@/lib/timezone";
import type { AuthMe, AuthUser } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: {
    name?: string;
    image?: string | null;
    country?: string | null;
  }) => Promise<AuthUser>;
}

const UNAUTHORIZED_EVENT = "finly:unauthorized";

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(user: AuthUser | null, setUser: (user: AuthUser | null) => void, setStatus: (status: AuthStatus) => void): void {
  if (user) {
    setUser(user);
    setStatus("authenticated");
  } else {
    setUser(null);
    setStatus("unauthenticated");
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.auth
      .me()
      .then((me: AuthMe) => {
        if (!cancelled) applySession(me.user, setUser, setStatus);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setStatus("unauthenticated");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = (): void => {
      setUser(null);
      setStatus("unauthenticated");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    setAppTimeZone(user?.timeZone ?? null);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password);
    applySession(result.user ?? null, setUser, setStatus);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const result = await api.auth.register(email, password);
    applySession(result.user ?? null, setUser, setStatus);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: {
      name?: string;
      image?: string | null;
      country?: string | null;
    }): Promise<AuthUser> => {
      const updated = await api.auth.updateProfile(patch);
      setUser(updated);
      return updated;
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, updateProfile }),
    [status, user, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
