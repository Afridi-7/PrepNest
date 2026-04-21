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

      const apiHostIsLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
      if (import.meta.env.DEV && browserIsLocal && apiHostIsLocal) {
        return ensureApiPrefix(url.pathname);
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
  user_name?: string;
}

export interface SignupResponse {
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
  is_pro: boolean;
  is_verified: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface UserAdminView {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_pro: boolean;
  is_active: boolean;
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
  subject_name?: string;
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

export interface SubjectAttemptedStat {
  subject_name: string;
  attempted: number;
  correct: number;
}

export interface DashboardStats {
  user_name: string;
  is_pro: boolean;
  total_subjects: number;
  total_topics: number;
  total_mcqs: number;
  subjects: DashboardSubjectStat[];
  mcqs_solved?: number;
  mcqs_attempted?: number;
  tests_taken?: number;
  accuracy?: number;
  subject_attempted?: SubjectAttemptedStat[];
}

export interface LeaderboardEntry {
  rank: number;
  user_name: string;
  mcqs_solved: number;
  tests_taken: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  updated_at: string;
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

export interface Acknowledgment {
  id: number;
  name: string;
  image_url: string | null;
  link_url: string | null;
  display_order: number;
}

export interface AcknowledgmentCreate {
  name: string;
  link_url?: string | null;
  display_order?: number;
}

export interface AcknowledgmentUpdate {
  name?: string;
  link_url?: string | null;
  display_order?: number;
}

// ── Mock Test types ──────────────────────────────────────────────────────────

export interface MockTestMCQQuestion {
  id: number;
  question: string;
  options: string[];
  subject: string;
}

export interface MockTestEssayQuestion {
  id: number;
  essay_type: string;
  prompt_text: string;
}

export interface MockTestSection {
  label: string;
  type: "mcq" | "essay" | "empty";
  questions: (MockTestMCQQuestion | MockTestEssayQuestion)[];
}

export interface MockTestGenerated {
  mock_test_id: string;
  category: string;
  sections: MockTestSection[];
  total_mcqs: number;
  total_essays: number;
  pdf_url?: string | null;
}

export interface MCQResultItem {
  question_id: number;
  question: string;
  selected: string | null;
  correct: string;
  is_correct: boolean;
  explanation: string;
}

export interface EssayResultItem {
  question_id: number;
  essay_type: string;
  prompt: string;
  user_answer: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface MockTestAISummary {
  overall_verdict: string;
  performance_level: string;
  strong_areas: { area: string; detail: string }[];
  weak_areas: { area: string; detail: string }[];
  study_plan: string[];
  motivational_note: string;
}

export interface MockTestResult {
  mock_test_id: string;
  category: string;
  status: string;
  total_score: number;
  max_score: number;
  percentage: number;
  mcq_score: number;
  mcq_total: number;
  essay_score: number;
  essay_total: number;
  mcq_results: MCQResultItem[];
  essay_results: EssayResultItem[];
  ai_summary: MockTestAISummary | null;
  created_at: string;
  submitted_at: string | null;
}

class ApiClient {
  private token: string | null = null;
  private _adminCache: boolean | null = null;

  constructor() {
    this.token = localStorage.getItem("access_token");
  }

  setToken(token: string, userName?: string) {
    this.token = token;
    this._adminCache = null;
    localStorage.setItem("access_token", token);
    if (userName) localStorage.setItem("user_name", userName);
  }

  clearToken() {
    this.token = null;
    this._adminCache = null;
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_name");
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

  /** Check if user has pro access (cached via getCurrentUser) */
  async checkIsPro(): Promise<boolean> {
    if (!this.isAuthenticated()) return false;
    try {
      const profile = await this.getCurrentUser();
      return profile.is_pro || profile.is_admin;
    } catch {
      return false;
    }
  }

  /** Get practice status for today (tests taken, pro status) */
  async getPracticeStatus(): Promise<{ tests_today: number; is_pro: boolean }> {
    const res = await this.request<{ tests_today: number; is_pro: boolean }>("/usat/practice-status");
    return res;
  }

  /** Get real-time public platform stats (no auth needed) */
  async getPublicStats(): Promise<{ users: number; mcqs: number }> {
    const res = await fetch(`${API_BASE_URL}/public/stats`);
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
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

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/forgot-password", "POST", { email });
  }

  async validateResetPasswordToken(token: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/reset-password/validate", "POST", { token });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/reset-password", "POST", {
      token,
      new_password: newPassword,
    });
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
      throw new Error(error.detail || error.message || `API error: ${response.status}`);
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

  // ── Admin: User Management ──────────────────────────────────────────────

  async listAllUsers(): Promise<UserAdminView[]> {
    return this.request<UserAdminView[]>("/users");
  }

  async setUserProStatus(userId: string, isPro: boolean): Promise<UserAdminView> {
    return this.request<UserAdminView>(`/users/${userId}/pro`, "PATCH", { is_pro: isPro });
  }

  async grantProByEmail(email: string, days: number = 30): Promise<{ success: boolean; email: string; expires_at: string; message: string }> {
    return this.request("/admin/grant-pro-by-email", "POST", { email, days });
  }

  async revokeProByEmail(email: string): Promise<{ success: boolean; email: string; message: string }> {
    return this.request("/admin/revoke-pro-by-email", "POST", { email });
  }

  async listSubjects(): Promise<Subject[]> {
    return this.request<Subject[]>("/usat/subjects");
  }

  async listUSATCategories(): Promise<USATCategory[]> {
    return this.request<USATCategory[]>("/usat/categories");
  }

  async getSubjectBulkData(category: string, slug: string): Promise<{
    subject: Subject;
    chapters: Topic[];
    papers: PastPaper[];
    tips: Tip[];
    resources: SubjectResource[];
    user_notes: UserNote[];
  }> {
    return this.request(`/usat/${encodeURIComponent(category)}/subject-by-slug/${encodeURIComponent(slug)}/bulk`);
  }

  async listUSATCategorySubjects(category: string): Promise<Subject[]> {
    return this.request<Subject[]>(`/usat/${encodeURIComponent(category)}/subjects`);
  }

  async listTopics(subjectId: number): Promise<Topic[]> {
    return this.request<Topic[]>(`/usat/subjects/${subjectId}/chapters`);
  }

  async listAllTopics(): Promise<Topic[]> {
    return this.request<Topic[]>(`/usat/all-topics`);
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

  async listCategoryPracticeMCQs(
    category: string,
    limit = 20,
    subjectIds?: number[],
  ): Promise<MCQ[]> {
    let url = `/usat/${encodeURIComponent(category)}/practice-mcqs?limit=${limit}`;
    if (subjectIds && subjectIds.length > 0) {
      url += `&subject_ids=${subjectIds.join(",")}`;
    }
    return this.request<MCQ[]>(url);
  }

  async submitPracticeResult(payload: {
    total_questions: number;
    correct_answers: number;
    category?: string;
    subject_name?: string;
  }): Promise<void> {
    await this.request<unknown>("/usat/practice-results", "POST", payload);
  }

  // ── Essay Practice ───────────────────────────────────────────────────────

  async getRandomEssayPrompt(essayType: "argumentative" | "narrative"): Promise<{
    id: number;
    essay_type: string;
    prompt_text: string;
    max_score: number;
  }> {
    return this.request(`/usat/essay-prompts/random?essay_type=${essayType}`);
  }

  async evaluateEssay(payload: {
    essay_type: string;
    prompt_text: string;
    user_essay: string;
  }): Promise<{
    score: number;
    max_score: number;
    feedback: string | {
      overall_feedback: string;
      criteria: Array<{ name: string; score: number; comment: string }>;
      mistakes: Array<{ type: string; quote: string; issue: string; fix: string }>;
      strengths: string[];
      improvement_tips: string[];
    };
    essay_type: string;
  }> {
    return this.request("/usat/essay-evaluate", "POST", payload);
  }

  // ── Interactive Mock Tests ───────────────────────────────────────────────

  async generateMockTest(categoryCode: string): Promise<MockTestGenerated> {
    return this.request<MockTestGenerated>("/mock-tests/generate", "POST", {
      category_code: categoryCode,
    });
  }

  async submitMockTest(
    mockTestId: string,
    mcqAnswers: Record<string, string>,
    essayAnswers: Record<string, string>
  ): Promise<MockTestResult> {
    return this.request<MockTestResult>(`/mock-tests/${mockTestId}/submit`, "POST", {
      mcq_answers: mcqAnswers,
      essay_answers: essayAnswers,
    });
  }

  async getMockTestResult(mockTestId: string): Promise<MockTestResult> {
    return this.request<MockTestResult>(`/mock-tests/${mockTestId}/result`);
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

    const doUpload = async () => {
      const form = new FormData();
      form.append("exam_type", examType);
      form.append("file", file);
      return fetch(apiUrl, {
        method: "POST",
        headers: this.getAuthHeaders(),
        mode: "cors",
        body: form,
      });
    };

    let response: Response;
    try {
      response = await doUpload();
    } catch {
      // Server may have been sleeping (Render cold start) — wait and retry once
      await new Promise((r) => setTimeout(r, 4000));
      response = await doUpload();
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.detail || err.message || `API error: ${response.status}`);
    }
    return response.json();
  }

  async uploadEssayCSV(
    file: File
  ): Promise<{ created: number; skipped: number; total_rows: number }> {
    const apiUrl = `${API_BASE_URL}/admin/essay-prompts/upload-csv`;
    const form = new FormData();
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
      throw new Error(error.detail || error.message || `API error: ${response.status}`);
    }
    if (!response.body) throw new Error("No response body");
    return response.body;
  }

  getToken(): string | null {
    return this.token || localStorage.getItem("access_token");
  }

  // ── Conversations (server-side history) ──────────────────────────────────

  async listConversations(): Promise<Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string | null;
  }>> {
    return this.request("/conversations");
  }

  async getConversation(conversationId: string): Promise<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string | null;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      created_at: string;
      metadata: Record<string, unknown>;
    }>;
  }> {
    return this.request(`/conversations/${conversationId}`);
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>("/dashboard/stats");
  }

  // ── Leaderboard ──────────────────────────────────────────────────────────

  async getLeaderboard(): Promise<LeaderboardResponse> {
    return this.request<LeaderboardResponse>("/leaderboard");
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

  // ── Acknowledgments ──────────────────────────────────────────────────────

  async getAcknowledgments(): Promise<Acknowledgment[]> {
    return this.request<Acknowledgment[]>("/acknowledgments");
  }

  async createAcknowledgment(payload: AcknowledgmentCreate): Promise<Acknowledgment> {
    return this.request<Acknowledgment>("/acknowledgments", "POST", payload);
  }

  async updateAcknowledgment(id: number, payload: AcknowledgmentUpdate): Promise<Acknowledgment> {
    return this.request<Acknowledgment>(`/acknowledgments/${id}`, "PUT", payload);
  }

  async deleteAcknowledgment(id: number): Promise<void> {
    await this.request<void>(`/acknowledgments/${id}`, "DELETE");
  }

  async uploadAcknowledgmentImage(id: number, file: File): Promise<Acknowledgment> {
    const url = `${API_BASE_URL}/acknowledgments/${id}/image`;
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
