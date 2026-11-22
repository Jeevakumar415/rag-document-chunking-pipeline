import axios from "axios";

import type {
  DocumentItem,
  RAGResponse,
  TokenResponse,
  UserResponse,
} from "../types";

const TOKEN_KEY = "enterpriseiq.access_token";
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");
export const AUTH_REQUIRED_EVENT = "enterpriseiq:auth-required";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.startsWith("/auth/")
    ) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  async login(email: string, password: string): Promise<TokenResponse> {
    const body = new URLSearchParams({ username: email, password });
    const { data } = await apiClient.post<TokenResponse>("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  async register(input: {
    email: string;
    password: string;
    full_name: string;
  }): Promise<UserResponse> {
    const { data } = await apiClient.post<UserResponse>(
      "/auth/register",
      input,
    );
    return data;
  },
};

export const documentsApi = {
  async list(): Promise<DocumentItem[]> {
    const { data } = await apiClient.get<DocumentItem[]>("/documents/");
    return data;
  },

  async upload(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<DocumentItem> {
    const body = new FormData();
    body.append("file", file);
    const { data } = await apiClient.post<DocumentItem>(
      "/documents/upload",
      body,
      {
        onUploadProgress: (event) => {
          if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
        },
      },
    );
    return data;
  },

  async process(documentId: number): Promise<DocumentItem> {
    const { data } = await apiClient.post<DocumentItem>(
      `/documents/${documentId}/process`,
    );
    return data;
  },
};

export const ragApi = {
  async query(question: string): Promise<RAGResponse> {
    const { data } = await apiClient.post<RAGResponse>(
      "/rag/query",
      { question },
      { timeout: 150_000 },
    );
    return data;
  },
};

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ detail?: string }>(error)) {
    if (error.code === "ERR_NETWORK") {
      return `Unable to reach the RAG pipeline API at ${API_BASE_URL}. Check that the backend is running and its CORS policy allows this frontend origin.`;
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "The request timed out. Please try again.";
    }
    return (
      error.response?.data?.detail ??
      error.message ??
      "The request could not be completed."
    );
  }
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

export { TOKEN_KEY };
