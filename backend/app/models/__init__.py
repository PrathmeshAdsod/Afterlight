"""
All SQLAlchemy ORM models for Afterlight.
Import this module to register all models with the metadata.
"""
from app.models.models import (
    User,
    MemorySpace,
    StewardAgreement,
    Asset,
    ProcessingJob,
    EvidenceScript,
    MemoryCard,
    PersonEntity,
    PlaceEntity,
    EventEntity,
    RelationshipEdge,
    ValueSignal,
    PhraseSignal,
    PreferenceSignal,
    PersonaCapsule,
    TrainingExample,
    TrainingValidationResult,
    AdapterJob,
    EvaluationMetric,
    Conversation,
    Message,
    EvidenceSource,
    PendingMemory,
    LegacyCapsule,
    Setting,
    AuditLog,
)

all_models = [
    User, MemorySpace, StewardAgreement, Asset, ProcessingJob,
    EvidenceScript, MemoryCard, PersonEntity, PlaceEntity, EventEntity,
    RelationshipEdge, ValueSignal, PhraseSignal, PreferenceSignal,
    PersonaCapsule, TrainingExample, TrainingValidationResult, AdapterJob,
    EvaluationMetric, Conversation, Message, EvidenceSource, PendingMemory,
    LegacyCapsule, Setting, AuditLog,
]

__all__ = [m.__name__ for m in all_models]
