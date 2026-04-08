const DEFAULT_API_PATH = "/api/v1";

const ensureApiPrefix = (pathname: string): string => {
  const normalizedPath = pathname.replace(/\/+$/, "");
  if (!normalizedPath || normalizedPath === "/") {
    return DEFAULT_API_PATH;
  }

  return normalizedPath.endsWith(DEFAULT_API_PATH)
    ? normalizedPath
    : `${normalizedPath}${DEFAULT_API_PATH}`;
};

const inferBrowserDefaultApiBaseUrl = (): string => {
  if (typeof window === "undefined") {
    return DEFAULT_API_PATH;
  }

  const browserHost = window.location.hostname || "127.0.0.1";
  const browserIsLocal = browserHost === "localhost" || browserHost === "127.0.0.1" || browserHost === "::1";
  if (browserIsLocal) {
    const localHost = browserHost === "::1" ? "127.0.0.1" : browserHost;
    return `http://${localHost}:8000${DEFAULT_API_PATH}`;
  }

  const url = new URL(window.location.origin);
  url.pathname = DEFAULT_API_PATH;
  return url.toString().replace(/\/$/, "");
};

const normalizeApiBaseUrl = (rawValue?: string): string => {
  const configuredValue = (rawValue || "").trim();
  if (!configuredValue) {
    return inferBrowserDefaultApiBaseUrl();
  }

  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8000";
  const valueWithProtocol = configuredValue.startsWith("/")
    ? new URL(configuredValue, browserOrigin).toString()
    : /^https?:\/\//i.test(configuredValue)
      ? configuredValue
      : `http://${configuredValue}`;

  try {
    const url = new URL(valueWithProtocol);

    if (typeof window !== "undefined") {
      const browserHost = window.location.hostname || "127.0.0.1";
      const browserIsLocal = browserHost === "localhost" || browserHost === "127.0.0.1" || browserHost === "::1";
      const isDockerInternalHost =
        url.hostname === "prepnest-backend" ||
        url.hostname === "backend" ||
        url.hostname.endsWith("-backend") ||
        url.hostname.endsWith("-backend-dev");

      if (browserIsLocal) {
        if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "::1") {
          url.hostname = browserHost;
        }
      } else if (isDockerInternalHost) {
        url.hostname = browserHost;
      }
    }

    url.pathname = ensureApiPrefix(url.pathname);
    return url.toString().replace(/\/$/, "");
  } catch {
    return inferBrowserDefaultApiBaseUrl();
  }
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL);
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL, typeof window !== "undefined" ? window.location.origin : undefined).origin;
  } catch {
    return typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8000";
  }
})();

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

export interface VerificationResponse {
  message: string;
  verification_url?: string | null;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface Subject {
  id: number;
  name: string;
  exam_type: string;
  created_at: string;
}

export interface Topic {
  id: number;
  title: string;
  subject_id: number;
  created_at: string;
}

export interface Material {
  id: number;
  title: string;
  content: string;
  type: string;
  topic_id: number;
  created_at: string;
}

export interface MCQ {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  topic_id: number;
  created_at: string;
}

export interface AIResponse {
  answer: string;
  context_materials: Array<Record<string, unknown>>;
  context_mcqs: Array<Record<string, unknown>>;
  web_results: Array<Record<string, unknown>>;
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

  private isTokenExpired(token: string): boolean {
    try {
      const payloadBase64 = token.split(".")[1];
      if (!payloadBase64) {
        return true;
      }

      const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson) as { exp?: number };

      if (!payload.exp) {
        return false;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      return payload.exp <= nowSeconds;
    } catch {
      return true;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.clearToken();
      return false;
    }

    return true;
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

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {};
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
      const errorPayload = await response.json().catch(() => ({ message: response.statusText }));
      const detailMessage =
        typeof errorPayload?.detail === "string"
          ? errorPayload.detail
          : Array.isArray(errorPayload?.detail)
            ? errorPayload.detail.map((item: any) => item?.msg).filter(Boolean).join(", ")
            : undefined;
      throw new Error(detailMessage || errorPayload?.message || `API error: ${response.status}`);
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
  ): Promise<VerificationResponse> {
    const response = await this.request<VerificationResponse>("/auth/signup", "POST", {
      email,
      password,
      full_name: fullName,
    });
    return response;
  }

  async getHealth() {
    try {
      const response = await fetch(`${API_ORIGIN}/health`);
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

  async verifyEmail(token: string): Promise<VerificationResponse> {
    return this.request<VerificationResponse>("/auth/verify-email", "POST", {
      token,
    });
  }

  async resendVerification(email: string): Promise<VerificationResponse> {
    return this.request<VerificationResponse>("/auth/resend-verification", "POST", {
      email,
    });
  }

  async getCurrentUser(): Promise<UserProfile> {
    return this.request<UserProfile>("/users/me");
  }

  async listSubjects(): Promise<Subject[]> {
    return this.request<Subject[]>("/subjects");
  }

  async listTopics(subjectId: number): Promise<Topic[]> {
    return this.request<Topic[]>(`/subjects/${subjectId}/topics`);
  }

  async listMaterials(topicId: number): Promise<Material[]> {
    return this.request<Material[]>(`/topics/${topicId}/materials`);
  }

  async listMCQs(topicId: number): Promise<MCQ[]> {
    return this.request<MCQ[]>(`/topics/${topicId}/mcqs`);
  }

  async createSubject(payload: { name: string; exam_type: string }): Promise<Subject> {
    return this.request<Subject>("/admin/subjects", "POST", payload);
  }

  async updateSubject(subjectId: number, payload: Partial<{ name: string; exam_type: string }>): Promise<Subject> {
    return this.request<Subject>(`/admin/subjects/${subjectId}`, "PATCH", payload);
  }

  async deleteSubject(subjectId: number): Promise<void> {
    await this.request<void>(`/admin/subjects/${subjectId}`, "DELETE");
  }

  async createTopic(payload: { title: string; subject_id: number }): Promise<Topic> {
    return this.request<Topic>("/admin/topics", "POST", payload);
  }

  async updateTopic(topicId: number, payload: Partial<{ title: string; subject_id: number }>): Promise<Topic> {
    return this.request<Topic>(`/admin/topics/${topicId}`, "PATCH", payload);
  }

  async deleteTopic(topicId: number): Promise<void> {
    await this.request<void>(`/admin/topics/${topicId}`, "DELETE");
  }

  async createMaterial(payload: {
    title: string;
    content: string;
    type: "notes" | "past_paper";
    topic_id: number;
  }): Promise<Material> {
    return this.request<Material>("/admin/materials", "POST", payload);
  }

  async updateMaterial(
    materialId: number,
    payload: Partial<{ title: string; content: string; type: "notes" | "past_paper"; topic_id: number }>
  ): Promise<Material> {
    return this.request<Material>(`/admin/materials/${materialId}`, "PATCH", payload);
  }

  async deleteMaterial(materialId: number): Promise<void> {
    await this.request<void>(`/admin/materials/${materialId}`, "DELETE");
  }

  async uploadMaterialPDFs(topicId: number, files: File[]): Promise<Material[]> {
    const url = `${API_BASE_URL}/admin/materials/upload-pdfs`;
    const form = new FormData();
    form.append("topic_id", String(topicId));
    for (const file of files) {
      form.append("files", file);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      mode: "cors",
      body: form,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ message: response.statusText }));
      const detailMessage =
        typeof errorPayload?.detail === "string"
          ? errorPayload.detail
          : errorPayload?.message || `API error: ${response.status}`;
      throw new Error(detailMessage);
    }

    return response.json();
  }

  async createMCQ(payload: {
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: "A" | "B" | "C" | "D";
    explanation: string;
    topic_id: number;
  }): Promise<MCQ> {
    return this.request<MCQ>("/admin/mcqs", "POST", payload);
  }

  async updateMCQ(
    mcqId: number,
    payload: Partial<{
      question: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_answer: "A" | "B" | "C" | "D";
      explanation: string;
      topic_id: number;
    }>
  ): Promise<MCQ> {
    return this.request<MCQ>(`/admin/mcqs/${mcqId}`, "PATCH", payload);
  }

  async deleteMCQ(mcqId: number): Promise<void> {
    await this.request<void>(`/admin/mcqs/${mcqId}`, "DELETE");
  }

  async aiChat(question: string, includeWeb: boolean = true): Promise<AIResponse> {
    return this.request<AIResponse>("/ai/chat", "POST", { question, include_web: includeWeb });
  }

  async aiExplain(topic: string, includeWeb: boolean = true): Promise<AIResponse> {
    return this.request<AIResponse>("/ai/explain", "POST", { topic, include_web: includeWeb });
  }

  async aiSolve(
    prompt: string,
    mode: "mcq" | "math" | "essay" = "mcq",
    includeWeb: boolean = true
  ): Promise<AIResponse> {
    return this.request<AIResponse>("/ai/solve", "POST", { prompt, mode, include_web: includeWeb });
  }

  getToken(): string | null {
    return this.token || localStorage.getItem("access_token");
  }
}

export const apiClient = new ApiClient();
