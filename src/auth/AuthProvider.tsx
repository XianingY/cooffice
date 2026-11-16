import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Api } from "../api/endpoints";
import { ApiError } from "../api/errors";
import { tokenStore } from "./tokenStore";

export interface AuthState {
  user: { id: string; email: string; displayName: string; role: "user" | "admin" } | null;
  ready: boolean;
  error: string;
}

interface AuthContextValue extends AuthState {
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
  clearError(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Holds the session in memory and restores it via the HttpOnly refresh cookie. */
export function AuthProvider({ api, children, enabled = true }: { api: Api; children: ReactNode; enabled?: boolean }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: enabled, error: "" });

  const applyTokens = useCallback(
    (response: { accessToken: string; user: AuthState["user"] }) => {
      tokenStore.set(response.accessToken);
      setState({ user: response.user, ready: true, error: "" });
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    api.auth.refresh()
      .then((response) => { if (active) applyTokens(response); })
      .catch(() => { if (active) setState({ user: null, ready: true, error: "" }); });
    return () => { active = false; };
  }, [api, applyTokens, enabled]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      applyTokens(await api.auth.login({ email, password }));
    } catch (error) {
      // Login failures are credential problems, not expired sessions.
      const message = error instanceof ApiError && error.status === 401
        ? "邮箱或密码不正确"
        : error instanceof ApiError ? error.displayMessage : "登录失败，请稍后重试";
      setState((previous) => ({ ...previous, error: message }));
      throw error;
    }
  }, [api, applyTokens]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      applyTokens(await api.auth.register({ email, password, displayName }));
    } catch (error) {
      const message = error instanceof ApiError ? error.displayMessage : "注册失败，请稍后重试";
      setState((previous) => ({ ...previous, error: message }));
      throw error;
    }
  }, [api, applyTokens]);

  const signOut = useCallback(async () => {
    try { await api.auth.logout(); } catch { /* local logout still proceeds */ }
    tokenStore.clear();
    setState({ user: null, ready: true, error: "" });
  }, [api]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    signIn,
    signUp,
    signOut,
    clearError: () => setState((previous) => ({ ...previous, error: "" })),
  }), [state, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Default no-op context keeps the local-first app usable without a provider. */
const LOCAL_CONTEXT: AuthContextValue = {
  user: null,
  ready: true,
  error: "",
  signIn: async () => { throw new Error("Auth is not configured"); },
  signUp: async () => { throw new Error("Auth is not configured"); },
  signOut: async () => {},
  clearError: () => {},
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? LOCAL_CONTEXT;
}
