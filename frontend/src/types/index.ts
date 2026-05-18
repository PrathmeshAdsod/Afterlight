// API Types

export interface MemorySpace {
  id: string;
  presence_name: string;
  relationship_type: string;
  birth_year?: number;
  death_year?: number;
  still_living: boolean;
  primary_language: string;
  description?: string;
  created_at: string;
  has_agreement: boolean;
}

export interface Asset {
  id: string;
  original_filename: string;
  asset_type: "audio" | "video" | "image" | "document" | "text";
  file_size_bytes?: number;
  duration_seconds?: number;
  processing_status: string;
  uploaded_at: string;
}

export interface MemoryCard {
  id: string;
  space_id: string;
  title: string;
  summary: string;
  source_quote?: string;
  source_start_time?: number;
  source_end_time?: number;
  people_mentioned: string[];
  places_mentioned: string[];
  places?: string[];
  themes: string[];
  values: string[];
  tone_signals: string[];
  confidence: number;
  status: "pending_review" | "approved" | "flagged" | "rejected";
  language: string;
  created_at: string;
}

export type TrustChip =
  | "recorded"
  | "memory_backed"
  | "style_inferred"
  | "unknown"
  | "restricted"
  | "system_boundary";

export interface Message {
  id: string;
  role: "user" | "presence";
  content: string;
  trust_chip?: TrustChip;
  source_memory_ids: string[];
  model_used?: string;
  created_at: string;
}

export interface TalkReply {
  content: string;
  trust_chip: TrustChip;
  source_memory_ids: string[];
  model_used: string;
  is_unknown: boolean;
  is_safety_redirect: boolean;
}

export interface TalkResponse {
  conversation_id: string;
  reply?: TalkReply;
  error?: string;
  ollama_not_connected?: boolean;
  setup_instruction?: string;
}

export interface SetupStep {
  step_index: number;
  step_name: string;
  status: "not_started" | "pending" | "running" | "done" | "error" | "tool_missing";
  error?: string;
  tool_missing?: string;
  setup_instruction?: string;
  metrics?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
}

export interface SetupStatus {
  space_id: string;
  steps: SetupStep[];
  summary: {
    total_steps: number;
    completed_steps: number;
    memory_cards_created: number;
    approved_cards: number;
    has_persona_capsule: boolean;
  };
}

export interface PersonaCapsule {
  exists: boolean;
  tone?: string;
  advice_style?: string;
  humor_style?: string;
  language_mix?: string;
  relationship_style?: string;
  top_phrases: string[];
  top_values: string[];
  top_themes: string[];
  memory_card_count: number;
  created_at?: string;
}

export interface AdapterJob {
  job_id?: string;
  status: "not_started" | "running" | "completed" | "failed";
  artifact_exists: boolean;
  adapter_ready: boolean;
  base_model?: string;
  training_command?: string;
  metrics?: Record<string, unknown>;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

export interface OllamaStatus {
  status: "connected" | "model_missing" | "not_connected" | "error";
  ollama_running: boolean;
  model_requested: string;
  models_available: string[];
  model_available: boolean;
  setup_instruction?: string;
}

export interface HealthResponse {
  status: string;
  ollama: OllamaStatus;
  tools: Record<string, { available: boolean; version?: string; setup_instruction?: string }>;
}

export interface TrainingData {
  validation_result?: {
    total_generated: number;
    total_valid: number;
    total_invalid: number;
    jsonl_path?: string;
    validated_at?: string;
  };
  examples_preview: { type: string; user: string; assistant: string }[];
}

export interface PendingMemory {
  id: string;
  title: string;
  description: string;
  contributor?: string;
  people?: string[];
  place?: string;
  date_hint?: string;
  status: string;
  created_at: string;
}
