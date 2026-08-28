const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "delt_era_token";
const USER_KEY = "delt_era_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((d) => d.msg).join("; ")
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

const del = (path) => request(path, { method: "DELETE" });
const post = (path, body) => request(path, { method: "POST", body });
const patch = (path, body) => request(path, { method: "PATCH", body });

export const api = {
  signup: (b) => request("/auth/signup", { method: "POST", body: b, auth: false }),
  login: (b) => request("/auth/login", { method: "POST", body: b, auth: false }),

  me: () => request("/users/me"),
  updateMe: (b) => patch("/users/me", b),
  getUser: (id) => request(`/users/${id}`),
  listClients: (search) =>
    request(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createClient: (b) => post("/clients", b),
  updateClient: (id, b) => patch(`/clients/${id}`, b),
  resetClientPassword: (id, new_password) =>
    post(`/clients/${id}/reset-password`, { new_password }),
  changeMyPassword: (current_password, new_password) =>
    post("/users/me/change-password", { current_password, new_password }),

  getSchedule: (id) => request(`/clients/${id}/schedule`),
  setSchedule: (id, entries) =>
    request(`/clients/${id}/schedule`, { method: "PUT", body: { entries } }),

  listSessions: (id) => request(`/clients/${id}/sessions`),
  sessionSummary: (id) => request(`/clients/${id}/sessions/summary`),
  createSession: (id, b) => post(`/clients/${id}/sessions`, b),
  updateSession: (id, sid, b) => patch(`/clients/${id}/sessions/${sid}`, b),
  deleteSession: (id, sid) => del(`/clients/${id}/sessions/${sid}`),

  getMealPlan: (id) => request(`/clients/${id}/meal-plan`),
  saveMealPlan: (id, plan_text) =>
    request(`/clients/${id}/meal-plan`, { method: "PUT", body: { plan_text } }),

  listSupplements: (id) => request(`/clients/${id}/supplements`),
  addSupplement: (id, b) => post(`/clients/${id}/supplements`, b),
  updateSupplement: (id, sid, b) => patch(`/clients/${id}/supplements/${sid}`, b),
  deleteSupplement: (id, sid) => del(`/clients/${id}/supplements/${sid}`),

  listNotes: (id) => request(`/clients/${id}/notes`),
  addNote: (id, b) => post(`/clients/${id}/notes`, b),
  deleteNote: (id, nid) => del(`/clients/${id}/notes/${nid}`),

  listProgressLogs: (id, days = 7) => request(`/clients/${id}/progress-logs?days=${days}`),
  logWeight: (id, b) => post(`/clients/${id}/progress-logs`, b),

  listMeasurements: (id) => request(`/clients/${id}/weekly-measurements`),
  logMeasurements: (id, b) => post(`/clients/${id}/weekly-measurements`, b),

  listDietPhotos: (id) => request(`/clients/${id}/diet-photos`),
  saveDietPhotos: (id, photos, date) =>
    request(`/clients/${id}/diet-photos`, { method: "PUT", body: { photos, date } }),
  setDietReview: (id, entryId, body) =>
    patch(`/clients/${id}/diet-photos/${entryId}/review`, body),

  listReports: (id) => request(`/clients/${id}/reports`),
  uploadReport: (id, b) => post(`/clients/${id}/reports`, b),

  listPackages: (id) => request(`/clients/${id}/packages`),
  currentPackage: (id) => request(`/clients/${id}/packages/current`),
  createPackage: (id, total_sessions) =>
    post(`/clients/${id}/packages`, { total_sessions }),

  listPayments: (id) => request(`/clients/${id}/payments`),
  addPayment: (id, b) => post(`/clients/${id}/payments`, b),
  deletePayment: (id, pid) => del(`/clients/${id}/payments/${pid}`),

  analytics: () => request("/analytics"),
  latestAnnouncement: () => request("/announcements/latest"),
  listAnnouncements: () => request("/announcements"),
  postAnnouncement: (message) => post("/announcements", { message }),
};

// Consecutive "done" sessions ending at the most recent decided session.
// Breaks on "missed"; ignores "upcoming".
export function computeStreak(sessions) {
  const decided = sessions
    .filter((s) => s.status === "done" || s.status === "missed")
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  let n = 0;
  for (const s of decided) {
    if (s.status === "done") n++;
    else break;
  }
  return n;
}

export const MEAL_PLAN_WORD_LIMIT = 5000;
export const MAX_DIET_PHOTOS = 10;

export function phoneError(v) {
  if (!/^\d{10}$/.test(v)) return "Phone number must be exactly 10 digits";
  return "";
}
export function passwordError(v) {
  if ((v || "").length < 6) return "Password must be at least 6 characters";
  return "";
}
export function packageBannerText(pkg) {
  if (!pkg) return "";
  const who = pkg.trainer_name || "your trainer";
  if (pkg.sessions_remaining === 1)
    return `This is your last session — please contact ${who} for renewal.`;
  if (pkg.sessions_remaining <= 0)
    return `No sessions left — please contact ${who} for renewal.`;
  return "";
}

export function countWords(text) {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Monday=0 .. Sunday=6, matching the backend
export function isoWeekday(dateStr) {
  return (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;
}
