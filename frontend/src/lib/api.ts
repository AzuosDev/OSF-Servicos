import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearTokens, getAccessToken, refreshAccessToken } from "./auth";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const isRefreshRequest = originalRequest?.url?.includes("/api/auth/refresh");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshRequest
    ) {
      originalRequest._retry = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newAccessToken = await refreshPromise;
      refreshPromise = null;

      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }

      clearTokens();
      window.location.assign("/login");
    }

    return Promise.reject(error);
  },
);
