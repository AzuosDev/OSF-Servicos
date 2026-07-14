import axios from "axios";

const REFRESH_TOKEN_KEY = "contacerta.refreshToken";
const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens(): void {
  accessToken = null;
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(accessToken);
}

export function hasRefreshToken(): boolean {
  return Boolean(getRefreshToken());
}

// Singleton: garante que no máximo UMA requisição de refresh viaja por vez.
// Resolve o bug de double-invoke do React StrictMode + tokens rotativos:
// sem isso, duas chamadas paralelas enviam o mesmo token ao backend; a segunda
// chega com o token já rotacionado → 401 → clearTokens() → logout indevido.
let _refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefresh().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

async function _doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const { data } = await axios.post(
      `${baseURL}/api/auth/refresh`,
      { refreshToken },
      { headers: { "Content-Type": "application/json" } },
    );

    if (!data?.accessToken) {
      clearTokens();
      return null;
    }

    setTokens(data.accessToken, data.refreshToken ?? refreshToken);
    return data.accessToken;
  } catch (err) {
    // Só limpa tokens quando o servidor explicitamente rejeita (401).
    // Erros de rede ou servidor offline não devem apagar uma sessão ainda válida.
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      clearTokens();
    }
    return null;
  }
}
