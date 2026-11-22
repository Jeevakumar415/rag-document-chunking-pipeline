import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AUTH_REQUIRED_EVENT,
  authApi,
  TOKEN_KEY,
} from "../services/api";

const EMAIL_KEY = "enterpriseiq.user_email";

interface AuthContextValue {
  token: string | null;
  email: string | null;
  reauthRequired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [email, setEmail] = useState<string | null>(() =>
    localStorage.getItem(EMAIL_KEY),
  );
  const [reauthRequired, setReauthRequired] = useState(false);

  useEffect(() => {
    const handleAuthRequired = () => {
      setToken(null);
      setReauthRequired(true);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, []);

  const login = async (userEmail: string, password: string) => {
    const result = await authApi.login(userEmail, password);
    localStorage.setItem(TOKEN_KEY, result.access_token);
    localStorage.setItem(EMAIL_KEY, userEmail);
    setToken(result.access_token);
    setEmail(userEmail);
    setReauthRequired(false);
  };

  const register = async (
    userEmail: string,
    password: string,
    fullName: string,
  ) => {
    await authApi.register({
      email: userEmail,
      password,
      full_name: fullName,
    });
    await login(userEmail, password);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setToken(null);
    setEmail(null);
    setReauthRequired(false);
  };

  const value = useMemo(
    () => ({ token, email, reauthRequired, login, register, logout }),
    [token, email, reauthRequired],
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
