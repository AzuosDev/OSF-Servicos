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

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function resolveRefreshQueue(token: string | null) {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
}

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

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

      if (isRefreshing) {
        const queuedToken = await new Promise<string | null>((resolve) => {
          refreshQueue.push(resolve);
        });

        if (queuedToken) {
          originalRequest.headers.Authorization = `Bearer ${queuedToken}`;
          return api(originalRequest);
        }

        clearTokens();
        redirectToLogin();
        return Promise.reject(error);
      }

      isRefreshing = true;
      const newAccessToken = await refreshAccessToken();
      isRefreshing = false;
      resolveRefreshQueue(newAccessToken);

      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }

      clearTokens();
      redirectToLogin();
    }

    return Promise.reject(error);
  },
);
