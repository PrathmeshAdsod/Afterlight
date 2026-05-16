// ─── API Client ───────────────────────────────────────────────────────────────
// Typed fetch wrapper for all Afterlight backend endpoints

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const r = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ─── Health ───────────────────────────────────────────────────────────────────
export const api = {
  health: () => request("/api/health"),

  // ─── Memory Spaces ──────────────────────────────────────────────────────────
  createSpace: (data: {
    presence_name: string;
    relationship_type: string;
    birth_year?: number;
    death_year?: number;
    still_living?: boolean;
    primary_language?: string;
    description?: string;
  }) => request("/api/memory-spaces", { method: "POST", body: JSON.stringify(data) }),

  listSpaces: () => request("/api/memory-spaces"),
  getSpace: (id: string) => request(`/api/memory-spaces/${id}`),
  updateSpace: (id: string, data: Record<string, unknown>) =>
    request(`/api/memory-spaces/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // ─── Agreement ──────────────────────────────────────────────────────────────
  submitAgreement: (spaceId: string, data: Record<string, boolean>) =>
    request(`/api/memory-spaces/${spaceId}/agreement`, { method: "POST", body: JSON.stringify(data) }),

  // ─── Assets ─────────────────────────────────────────────────────────────────
  uploadAsset: async (spaceId: string, file: File, language?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (language) formData.append("language", language);
    const res = await fetch(`${BASE_URL}/api/memory-spaces/${spaceId}/assets`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || `Upload failed ${res.status}`);
    }
    return res.json();
  },
  listAssets: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/assets`),

  // ─── Processing ─────────────────────────────────────────────────────────────
  triggerProcessing: (spaceId: string) =>
    request(`/api/memory-spaces/${spaceId}/process`, { method: "POST" }),
  getSetupStatus: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/setup-status`),

  // ─── Memories ───────────────────────────────────────────────────────────────
  listMemories: (spaceId: string, status?: string) =>
    request(`/api/memory-spaces/${spaceId}/memories${status ? `?status=${status}` : ""}`),
  updateMemory: (memoryId: string, data: Record<string, unknown>) =>
    request(`/api/memories/${memoryId}`, { method: "PATCH", body: JSON.stringify(data) }),

  // ─── Training ───────────────────────────────────────────────────────────────
  generateTrainingData: (spaceId: string) =>
    request(`/api/memory-spaces/${spaceId}/generate-training-data`, { method: "POST" }),
  getTrainingData: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/training-data`),
  createAdapterJob: (spaceId: string) =>
    request(`/api/memory-spaces/${spaceId}/train-adapter`, { method: "POST" }),
  getAdapterJob: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/adapter-job`),

  // ─── Talk ────────────────────────────────────────────────────────────────────
  talk: (spaceId: string, data: { message: string; conversation_id?: string; tts?: boolean; voice_id?: string }) =>
    request(`/api/memory-spaces/${spaceId}/talk`, { method: "POST", body: JSON.stringify(data) }),
  listConversations: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/conversations`),
  getMessages: (spaceId: string, convId: string) =>
    request(`/api/memory-spaces/${spaceId}/conversations/${convId}/messages`),

  // ─── Persona ─────────────────────────────────────────────────────────────────
  getPersonaCapsule: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/persona-capsule`),
  getTimeline: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/timeline`),

  // ─── Pending Memories ─────────────────────────────────────────────────────
  createPendingMemory: (spaceId: string, data: Record<string, unknown>) =>
    request(`/api/memory-spaces/${spaceId}/pending-memories`, { method: "POST", body: JSON.stringify(data) }),
  listPendingMemories: (spaceId: string) =>
    request(`/api/memory-spaces/${spaceId}/pending-memories`),

  // ─── Capsules ─────────────────────────────────────────────────────────────
  listCapsules: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/capsules`),
  createCapsule: (spaceId: string, data: Record<string, unknown>) =>
    request(`/api/memory-spaces/${spaceId}/capsules`, { method: "POST", body: JSON.stringify(data) }),

  // ─── Settings ─────────────────────────────────────────────────────────────
  getSettings: (spaceId: string) => request(`/api/memory-spaces/${spaceId}/settings`),
  updateSettings: (spaceId: string, settings: Record<string, string>) =>
    request(`/api/memory-spaces/${spaceId}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    }),
};
