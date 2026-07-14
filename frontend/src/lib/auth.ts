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

export async function refreshAccessToken(): Promise<string | null> {
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
    // Only clear tokens when the server explicitly rejects the refresh token.
    // Network errors or server failures should not wipe a still-valid session.
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      clearTokens();
    }
    return null;
  }
}
