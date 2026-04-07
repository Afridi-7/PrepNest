const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api/v1";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem("access_token");
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("access_token", token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("access_token");
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    method: string = "GET",
    body?: any
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      mode: "cors",
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/login", "POST", {
      email,
      password,
    });
    return response;
  }

  async signup(
    email: string,
    password: string,
    fullName?: string
  ): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/signup", "POST", {
      email,
      password,
      full_name: fullName,
    });
    return response;
  }

  async getHealth() {
    try {
      const response = await fetch(`${API_BASE_URL.replace("/api/v1", "")}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async chatStream(
    message: string,
    conversationId?: string,
    learningLevel?: "beginner" | "intermediate" | "advanced",
    attachments?: Array<{ type: string; name: string; data: string }>
  ): Promise<ReadableStream<any>> {
    const url = `${API_BASE_URL}/chat/stream`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      mode: "cors",
      body: JSON.stringify({
        message,
        conversation_id: conversationId || null,
        learning_level: learningLevel || "intermediate",
        attachments: attachments || [],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    return response.body;
  }

  async chat(
    message: string,
    conversationId?: string,
    learningLevel?: "beginner" | "intermediate" | "advanced",
    attachments?: Array<{ type: string; name: string; data: string }>
  ): Promise<any> {
    return this.request("/chat", "POST", {
      message,
      conversation_id: conversationId || null,
      learning_level: learningLevel || "intermediate",
      attachments: attachments || [],
    });
  }

  getToken(): string | null {
    return this.token || localStorage.getItem("access_token");
  }
}

export const apiClient = new ApiClient();
