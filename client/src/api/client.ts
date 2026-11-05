import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError, ApiResponse } from '../types/api.js';

// Base URL: reads from VITE_API_URL or defaults to /api/v1
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// In-memory access token storage (never localStorage for XSS safety)
let accessToken: string | null = null;
let onAuthFailedCallback: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setOnAuthFailed(callback: () => void): void {
  onAuthFailedCallback = callback;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send httpOnly refresh cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: attach in-memory Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Concurrency lock for token refresh (prevent refresh stampedes)
let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  try {
    const res = await axios.post<ApiResponse<{ accessToken: string }>>(
      `${API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );

    const newToken = res.data.data.accessToken;
    setAccessToken(newToken);
    return newToken;
  } catch {
    setAccessToken(null);
    if (onAuthFailedCallback) {
      onAuthFailedCallback();
    }
    return null;
  } finally {
    refreshPromise = null;
  }
}

// Response Interceptor: handle 401 token expiration and error normalization
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if error is 401 and not already a retry or auth route
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = executeTokenRefresh();
      }

      const newToken = await refreshPromise;

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }

    // Normalize error response into ApiError
    const apiError: ApiError = {
      status: error.response?.status ?? 500,
      code: error.response?.data?.error?.code ?? 'UNKNOWN_ERROR',
      message:
        error.response?.data?.error?.message ?? error.message ?? 'An unexpected error occurred',
      details: error.response?.data?.error?.details,
    };

    return Promise.reject(apiError);
  },
);
