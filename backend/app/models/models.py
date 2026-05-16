"""
All 25 SQLAlchemy ORM models for Afterlight.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime, JSON,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


def gen_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.utcnow()


# ─── Enums ────────────────────────────────────────────────────────────────────

class AssetType(str, enum.Enum):
    audio = "audio"
    video = "video"
    image = "image"
    document = "document"
    text = "text"

class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    error = "error"
    tool_missing = "tool_missing"

class MemoryStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    flagged = "flagged"
    rejected = "rejected"

class TrustChip(str, enum.Enum):
    recorded = "recorded"
    memory_backed = "memory_backed"
    style_inferred = "style_inferred"
    unknown = "unknown"
    restricted = "restricted"
    system_boundary = "system_boundary"

class AdapterJobStatus(str, enum.Enum):
    not_started = "not_started"
    running = "running"
    completed = "completed"
    failed = "failed"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    memory_spaces: Mapped[list["MemorySpace"]] = relationship(back_populates="owner")


class MemorySpace(Base):
    __tablename__ = "memory_spaces"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    presence_name: Mapped[str] = mapped_column(String(255))
    relationship_type: Mapped[str] = mapped_column(String(100))
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    death_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    still_living: Mapped[bool] = mapped_column(Boolean, default=False)
    primary_language: Mapped[str] = mapped_column(String(100), default="English")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    owner: Mapped["User"] = relationship(back_populates="memory_spaces")
    agreement: Mapped["StewardAgreement | None"] = relationship(back_populates="space", uselist=False)
    assets: Mapped[list["Asset"]] = relationship(back_populates="space")
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(back_populates="space")
    memory_cards: Mapped[list["MemoryCard"]] = relationship(back_populates="space")
    persona_capsule: Mapped["PersonaCapsule | None"] = relationship(back_populates="space", uselist=False)
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="space")
    pending_memories: Mapped[list["PendingMemory"]] = relationship(back_populates="space")
    adapter_jobs: Mapped[list["AdapterJob"]] = relationship(back_populates="space")
    settings: Mapped[list["Setting"]] = relationship(back_populates="space")


class StewardAgreement(Base):
    __tablename__ = "steward_agreements"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"), unique=True)
    is_authorized_steward: Mapped[bool] = mapped_column(Boolean, default=False)
    has_upload_rights: Mapped[bool] = mapped_column(Boolean, default=False)
    understands_preserved_presence: Mapped[bool] = mapped_column(Boolean, default=False)
    understands_unsupported_facts: Mapped[bool] = mapped_column(Boolean, default=False)
    understands_sensitive_topics: Mapped[bool] = mapped_column(Boolean, default=False)
    allows_persona_adapter: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    space: Mapped["MemorySpace"] = relationship(back_populates="agreement")


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    original_filename: Mapped[str] = mapped_column(String(500))
    asset_type: Mapped[AssetType] = mapped_column(SAEnum(AssetType))
    file_path: Mapped[str] = mapped_column(String)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    language: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    processing_status: Mapped[JobStatus] = mapped_column(SAEnum(JobStatus), default=JobStatus.pending)
    space: Mapped["MemorySpace"] = relationship(back_populates="assets")
    memory_cards: Mapped[list["MemoryCard"]] = relationship(back_populates="source_asset")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    step_name: Mapped[str] = mapped_column(String(200))
    step_index: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[JobStatus] = mapped_column(SAEnum(JobStatus), default=JobStatus.pending)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_missing: Mapped[str | None] = mapped_column(String(200), nullable=True)
    setup_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    space: Mapped["MemorySpace"] = relationship(back_populates="processing_jobs")


class EvidenceScript(Base):
    __tablename__ = "evidence_scripts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    start_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class MemoryCard(Base):
    __tablename__ = "memory_cards"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    source_asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text)
    source_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_start_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_end_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    people_mentioned: Mapped[list | None] = mapped_column(JSON, nullable=True)
    places_mentioned: Mapped[list | None] = mapped_column(JSON, nullable=True)
    themes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    values: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tone_signals: Mapped[list | None] = mapped_column(JSON, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    status: Mapped[MemoryStatus] = mapped_column(SAEnum(MemoryStatus), default=MemoryStatus.pending_review)
    language: Mapped[str] = mapped_column(String(100), default="English")
    vector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    space: Mapped["MemorySpace"] = relationship(back_populates="memory_cards")
    source_asset: Mapped["Asset | None"] = relationship(back_populates="memory_cards")
    evidence_sources: Mapped[list["EvidenceSource"]] = relationship(back_populates="memory_card")


class PersonEntity(Base):
    __tablename__ = "person_entities"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    name: Mapped[str] = mapped_column(String(300))
    person_relationship: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mention_count: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class PlaceEntity(Base):
    __tablename__ = "place_entities"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    name: Mapped[str] = mapped_column(String(300))
    place_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mention_count: Mapped[int] = mapped_column(Integer, default=1)


class EventEntity(Base):
    __tablename__ = "event_entities"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    title: Mapped[str] = mapped_column(String(500))
    date_hint: Mapped[str | None] = mapped_column(String(200), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    people: Mapped[list | None] = mapped_column(JSON, nullable=True)
    place: Mapped[str | None] = mapped_column(String(300), nullable=True)
    memory_card_id: Mapped[str | None] = mapped_column(ForeignKey("memory_cards.id"), nullable=True)


class RelationshipEdge(Base):
    __tablename__ = "relationship_edges"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    person_a: Mapped[str] = mapped_column(String(300))
    person_b: Mapped[str] = mapped_column(String(300))
    relationship_type: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ValueSignal(Base):
    __tablename__ = "value_signals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    value: Mapped[str] = mapped_column(String(300))
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency: Mapped[int] = mapped_column(Integer, default=1)


class PhraseSignal(Base):
    __tablename__ = "phrase_signals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    phrase: Mapped[str] = mapped_column(Text)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency: Mapped[int] = mapped_column(Integer, default=1)
    language: Mapped[str] = mapped_column(String(100), default="English")


class PreferenceSignal(Base):
    __tablename__ = "preference_signals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    category: Mapped[str] = mapped_column(String(200))
    preference: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)


class PersonaCapsule(Base):
    __tablename__ = "persona_capsules"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"), unique=True)
    tone: Mapped[str | None] = mapped_column(Text, nullable=True)
    advice_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    humor_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    language_mix: Mapped[str | None] = mapped_column(Text, nullable=True)
    relationship_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    boundaries: Mapped[list | None] = mapped_column(JSON, nullable=True)
    top_phrases: Mapped[list | None] = mapped_column(JSON, nullable=True)
    top_values: Mapped[list | None] = mapped_column(JSON, nullable=True)
    top_themes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    system_prompt_base: Mapped[str | None] = mapped_column(Text, nullable=True)
    memory_card_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    space: Mapped["MemorySpace"] = relationship(back_populates="persona_capsule")


class TrainingExample(Base):
    __tablename__ = "training_examples"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    example_type: Mapped[str] = mapped_column(String(100))
    user_message: Mapped[str] = mapped_column(Text)
    assistant_response: Mapped[str] = mapped_column(Text)
    source_memory_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class TrainingValidationResult(Base):
    __tablename__ = "training_validation_results"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    total_generated: Mapped[int] = mapped_column(Integer, default=0)
    total_valid: Mapped[int] = mapped_column(Integer, default=0)
    total_invalid: Mapped[int] = mapped_column(Integer, default=0)
    rejection_reasons: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    jsonl_path: Mapped[str | None] = mapped_column(String, nullable=True)
    validated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AdapterJob(Base):
    __tablename__ = "adapter_jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    status: Mapped[AdapterJobStatus] = mapped_column(SAEnum(AdapterJobStatus), default=AdapterJobStatus.not_started)
    base_model: Mapped[str] = mapped_column(String(500), default="google/gemma-4-e2b-it")
    dataset_path: Mapped[str | None] = mapped_column(String, nullable=True)
    output_adapter_path: Mapped[str | None] = mapped_column(String, nullable=True)
    training_command: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs_path: Mapped[str | None] = mapped_column(String, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    space: Mapped["MemorySpace"] = relationship(back_populates="adapter_jobs")


class EvaluationMetric(Base):
    __tablename__ = "evaluation_metrics"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    adapter_job_id: Mapped[str | None] = mapped_column(ForeignKey("adapter_jobs.id"), nullable=True)
    presence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    grounding_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    safety_pass: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    unknown_handling_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    space: Mapped["MemorySpace"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String(20))  # "user" | "presence"
    content: Mapped[str] = mapped_column(Text)
    trust_chip: Mapped[TrustChip | None] = mapped_column(SAEnum(TrustChip), nullable=True)
    source_memory_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class EvidenceSource(Base):
    __tablename__ = "evidence_sources"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    memory_card_id: Mapped[str] = mapped_column(ForeignKey("memory_cards.id"))
    message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"), nullable=True)
    source_type: Mapped[str] = mapped_column(String(100))
    content: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_card: Mapped["MemoryCard"] = relationship(back_populates="evidence_sources")


class PendingMemory(Base):
    __tablename__ = "pending_memories"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text)
    contributor: Mapped[str | None] = mapped_column(String(300), nullable=True)
    people: Mapped[list | None] = mapped_column(JSON, nullable=True)
    place: Mapped[str | None] = mapped_column(String(300), nullable=True)
    date_hint: Mapped[str | None] = mapped_column(String(200), nullable=True)
    triggered_by_message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending_verification")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    space: Mapped["MemorySpace"] = relationship(back_populates="pending_memories")


class LegacyCapsule(Base):
    __tablename__ = "legacy_capsules"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unlock_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recipients: Mapped[list | None] = mapped_column(JSON, nullable=True)
    memory_card_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sealed: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Setting(Base):
    __tablename__ = "settings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str] = mapped_column(ForeignKey("memory_spaces.id"))
    key: Mapped[str] = mapped_column(String(200))
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    space: Mapped["MemorySpace"] = relationship(back_populates="settings")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    space_id: Mapped[str | None] = mapped_column(ForeignKey("memory_spaces.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(300))
    actor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AppSetting(Base):
    """App-level key/value settings — stores user API keys like ElevenLabs."""
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)
