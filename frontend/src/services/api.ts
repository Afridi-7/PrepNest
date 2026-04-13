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
export const API_ORIGIN = (() => {
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

export interface SignupResponse {
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
  is_verified: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface Subject {
  id: number;
  name: string;
  exam_type: string;
  created_at: string;
}

export interface USATCategory {
  code: string;
  title: string;
  description: string;
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

export interface Tip {
  id: number;
  title: string;
  content: string;
  subject_id: number;
  created_at: string;
}

export interface Resource {
  id: number;
  title: string;
  url: string;
  chapter_id: number;
  created_at: string;
}

export interface SubjectResource {
  id: number;
  title: string;
  url: string;
  subject_id: number;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  subject_id: number | null;
  chapter_id: number | null;
  created_at: string;
}

export interface PastPaper {
  id: number;
  title: string;
  file_path: string;
  subject_id: number;
  chapter_id: number | null;
  created_at: string;
}

export interface UserNote {
  id: number;
  title: string;
  file_path: string;
  subject_id: number;
  user_id: string;
  created_at: string;
}

export interface AIResponse {
  answer: string;
  context_materials: Array<Record<string, unknown>>;
  context_mcqs: Array<Record<string, unknown>>;
  web_results: Array<Record<string, unknown>>;
}

export interface DashboardSubjectStat {
  id: number;
  name: string;
  topic_count: number;
  mcq_count: number;
}

export interface DashboardStats {
  user_name: string;
  total_subjects: number;
  total_topics: number;
  total_mcqs: number;
  subjects: DashboardSubjectStat[];
}

export interface ContactInfo {
  id: number;
  name: string;
  bio: string;
  image_url: string | null;
  email: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  discord_url: string | null;
  twitter_url: string | null;
  whatsapp_url: string | null;
  updated_at: string;
}

export interface ContactInfoUpdate {
  name?: string;
  bio?: string;
  image_url?: string | null;
  email?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  discord_url?: string | null;
  twitter_url?: string | null;
  whatsapp_url?: string | null;
}

class ApiClient {
  private token: string | null = null;
  private _adminCache: boolean | null = null;

  constructor() {
    this.token = localStorage.getItem("access_token");
  }

  setToken(token: string) {
    this.token = token;
    this._adminCache = null;
    localStorage.setItem("access_token", token);
  }

  clearToken() {
    this.token = null;
    this._adminCache = null;
    localStorage.removeItem("access_token");
  }

  /** Cached admin check – avoids repeated /users/me calls */
  async checkIsAdmin(): Promise<boolean> {
    if (!this.isAuthenticated()) return false;
    if (this._adminCache !== null) return this._adminCache;
    try {
      const profile = await this.getCurrentUser();
      this._adminCache = profile.is_admin;
      return this._adminCache;
    } catch {
      return false;
    }
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

    // 204 No Content — nothing to parse
    if (response.status === 204) return undefined as unknown as T;

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
  ): Promise<SignupResponse> {
    const response = await this.request<SignupResponse>("/auth/signup", "POST", {
      email,
      password,
      full_name: fullName,
    });
    return response;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/resend-verification", "POST", { email });
  }

  async googleAuth(credential: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/google", "POST", { credential });
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

  async getCurrentUser(): Promise<UserProfile> {
    return this.request<UserProfile>("/users/me");
  }

  async listSubjects(): Promise<Subject[]> {
    return this.request<Subject[]>("/usat/subjects");
  }

  async listUSATCategories(): Promise<USATCategory[]> {
    return this.request<USATCategory[]>("/usat/categories");
  }

  async listUSATCategorySubjects(category: string): Promise<Subject[]> {
    return this.request<Subject[]>(`/usat/${encodeURIComponent(category)}/subjects`);
  }

  async listTopics(subjectId: number): Promise<Topic[]> {
    return this.request<Topic[]>(`/usat/subjects/${subjectId}/chapters`);
  }

  async listMaterials(topicId: number): Promise<Material[]> {
    return this.request<Material[]>(`/usat/chapters/${topicId}/materials`);
  }

  async listMCQs(topicId: number): Promise<MCQ[]> {
    return this.request<MCQ[]>(`/usat/chapters/${topicId}/mcqs`);
  }

  async listSubjectMaterials(subjectId: number): Promise<Material[]> {
    return this.request<Material[]>(`/usat/subjects/${subjectId}/materials`);
  }

  async listSubjectPastPapers(subjectId: number): Promise<Material[]> {
    return this.request<Material[]>(`/usat/subjects/${subjectId}/past-papers`);
  }

  async listSubjectTips(subjectId: number): Promise<Tip[]> {
    return this.request<Tip[]>(`/usat/subjects/${subjectId}/tips`);
  }

  // ── New dedicated endpoints ──────────────────────────────────────────────

  async listChapterResources(chapterId: number): Promise<Resource[]> {
    return this.request<Resource[]>(`/usat/chapters/${chapterId}/resources`);
  }

  async listSubjectNotes(subjectId: number): Promise<Note[]> {
    return this.request<Note[]>(`/usat/subjects/${subjectId}/notes`);
  }

  async listChapterNotes(chapterId: number): Promise<Note[]> {
    return this.request<Note[]>(`/usat/chapters/${chapterId}/notes`);
  }

  async listSubjectPapers(subjectId: number): Promise<PastPaper[]> {
    return this.request<PastPaper[]>(`/usat/subjects/${subjectId}/papers`);
  }

  // ── User Notes (user-uploaded PDFs, view-only) ───────────────────────────

  async listUserNotes(subjectId: number): Promise<UserNote[]> {
    return this.request<UserNote[]>(`/usat/subjects/${subjectId}/user-notes`);
  }

  async uploadUserNote(subjectId: number, title: string, file: File): Promise<UserNote> {
    const apiUrl = `${API_BASE_URL}/usat/subjects/${subjectId}/user-notes`;
    const form = new FormData();
    form.append("title", title);
    form.append("file", file);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: this.getAuthHeaders(),
      mode: "cors",
      body: form,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.detail || err.message || `API error: ${response.status}`);
    }
    return response.json();
  }

  async deleteUserNote(noteId: number): Promise<void> {
    await this.request<void>(`/usat/user-notes/${noteId}`, "DELETE");
  }

  getUserNoteViewUrl(noteId: number): string {
    return `${API_BASE_URL}/usat/user-notes/${noteId}/view`;
  }

  async getUserNoteDirectUrl(noteId: number): Promise<string> {
    const token = this.getToken();
    const res = await this.request<{ url: string }>(
      `/usat/user-notes/${noteId}/url?token=${encodeURIComponent(token || "")}`
    );
    return res.url;
  }

  async listChapterMCQsPaginated(chapterId: number, limit = 30, offset = 0): Promise<MCQ[]> {
    return this.request<MCQ[]>(
      `/usat/chapters/${chapterId}/mcqs?limit=${limit}&offset=${offset}`
    );
  }

  async listSubjectPracticeMCQs(subjectId: number, limit = 20): Promise<MCQ[]> {
    return this.request<MCQ[]>(`/usat/subjects/${subjectId}/practice-mcqs?limit=${limit}`);
  }

  // ── Resource admin ───────────────────────────────────────────────────────

  async createResource(payload: { title: string; url: string; chapter_id: number }): Promise<Resource> {
    return this.request<Resource>("/admin/resources", "POST", payload);
  }

  async updateResource(
    resourceId: number,
    payload: Partial<{ title: string; url: string }>
  ): Promise<Resource> {
    return this.request<Resource>(`/admin/resources/${resourceId}`, "PATCH", payload);
  }

  async deleteResource(resourceId: number): Promise<void> {
    await this.request<void>(`/admin/resources/${resourceId}`, "DELETE");
  }

  // ── Subject Resource ─────────────────────────────────────────────────────

  async listSubjectResources(subjectId: number): Promise<SubjectResource[]> {
    return this.request<SubjectResource[]>(`/usat/subjects/${subjectId}/resources`);
  }

  async createSubjectResource(payload: { title: string; url: string; subject_id: number }): Promise<SubjectResource> {
    return this.request<SubjectResource>("/admin/subject-resources", "POST", payload);
  }

  async deleteSubjectResource(resourceId: number): Promise<void> {
    await this.request<void>(`/admin/subject-resources/${resourceId}`, "DELETE");
  }

  // ── Note admin ───────────────────────────────────────────────────────────

  async createNote(payload: {
    title: string;
    content: string;
    subject_id?: number;
    chapter_id?: number;
  }): Promise<Note> {
    return this.request<Note>("/admin/notes", "POST", payload);
  }

  async deleteNote(noteId: number): Promise<void> {
    await this.request<void>(`/admin/notes/${noteId}`, "DELETE");
  }

  // ── PastPaper admin (new dedicated table) ────────────────────────────────

  async createPaper(payload: {
    subject_id: number;
    title: string;
    chapter_id?: number;
    url?: string;
    file?: File;
  }): Promise<PastPaper> {
    const apiUrl = `${API_BASE_URL}/admin/papers`;
    const form = new FormData();
    form.append("subject_id", String(payload.subject_id));
    form.append("title", payload.title);
    if (payload.chapter_id != null) form.append("chapter_id", String(payload.chapter_id));
    if (payload.url) form.append("url", payload.url);
    if (payload.file) form.append("file", payload.file);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: this.getAuthHeaders(),
      mode: "cors",
      body: form,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.detail || err.message || `API error: ${response.status}`);
    }
    return response.json();
  }

  async deletePaper(paperId: number): Promise<void> {
    await this.request<void>(`/admin/papers/${paperId}`, "DELETE");
  }

  // ── MCQ CSV upload ───────────────────────────────────────────────────────

  async uploadMCQCSV(
    file: File,
    examType = "USAT-E"
  ): Promise<{ created: number; skipped: number; total_rows: number }> {
    const apiUrl = `${API_BASE_URL}/admin/mcqs/upload-csv`;
    const form = new FormData();
    form.append("exam_type", examType);
    form.append("file", file);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: this.getAuthHeaders(),
      mode: "cors",
      body: form,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.detail || err.message || `API error: ${response.status}`);
    }
    return response.json();
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

  async createPastPaper(payload: {
    subject_id: number;
    year: number;
    title?: string;
    content?: string;
    file?: File;
  }): Promise<Material> {
    const url = `${API_BASE_URL}/admin/past-papers`;
    const form = new FormData();
    form.append("subject_id", String(payload.subject_id));
    form.append("year", String(payload.year));
    if (payload.title) {
      form.append("title", payload.title);
    }
    if (payload.content) {
      form.append("content", payload.content);
    }
    if (payload.file) {
      form.append("file", payload.file);
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

  async createTip(payload: { title: string; content: string; subject_id: number }): Promise<Tip> {
    return this.request<Tip>("/admin/tips", "POST", payload);
  }

  async deleteTip(tipId: number): Promise<void> {
    await this.request<void>(`/admin/tips/${tipId}`, "DELETE");
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

  async seedDemoContent(): Promise<{
    created_subjects: number;
    created_topics: number;
    created_materials: number;
    created_mcqs: number;
  }> {
    return this.request("/admin/seed-demo", "POST", {});
  }

  async dedupeSubjects(): Promise<{
    removed_subjects: number;
    merged_topics: number;
    moved_materials: number;
    moved_mcqs: number;
  }> {
    return this.request("/admin/dedupe-subjects", "POST", {});
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

  /** Streaming variants – return a ReadableStream of SSE events */
  async aiChatStream(question: string, includeWeb: boolean = true): Promise<ReadableStream<Uint8Array>> {
    return this._aiStream("/ai/chat/stream", { question, include_web: includeWeb });
  }

  async aiExplainStream(topic: string, includeWeb: boolean = true): Promise<ReadableStream<Uint8Array>> {
    return this._aiStream("/ai/explain/stream", { topic, include_web: includeWeb });
  }

  async aiSolveStream(prompt: string, mode: "mcq" | "math" | "essay" = "mcq", includeWeb: boolean = true): Promise<ReadableStream<Uint8Array>> {
    return this._aiStream("/ai/solve/stream", { prompt, mode, include_web: includeWeb });
  }

  private async _aiStream(path: string, body: Record<string, unknown>): Promise<ReadableStream<Uint8Array>> {
    const url = `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      mode: "cors",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API error: ${response.status}`);
    }
    if (!response.body) throw new Error("No response body");
    return response.body;
  }

  getToken(): string | null {
    return this.token || localStorage.getItem("access_token");
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>("/dashboard/stats");
  }

  // ── Contact ──────────────────────────────────────────────────────────────

  async getContactInfo(): Promise<ContactInfo> {
    return this.request<ContactInfo>("/contact");
  }

  async updateContactInfo(payload: ContactInfoUpdate): Promise<ContactInfo> {
    return this.request<ContactInfo>("/contact", "PUT", payload);
  }

  async uploadContactImage(file: File): Promise<ContactInfo> {
    const url = `${API_BASE_URL}/contact/image`;
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      mode: "cors",
      body: form,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.detail || err.message || `API error: ${response.status}`);
    }
    return response.json();
  }
}

export const apiClient = new ApiClient();
