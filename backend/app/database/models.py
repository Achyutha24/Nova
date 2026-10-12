import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.database.database import Base

class Participant(Base):
    __tablename__ = "participants"

    id = Column(String(64), primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    notes = Column(Text, nullable=True)
    demographics_json = Column(Text, nullable=True)

    sessions = relationship("Session", back_populates="participant", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True, index=True)
    participant_id = Column(String(64), ForeignKey("participants.id"), nullable=False, index=True)
    protocol_version = Column(String(32), default="v1.0")
    status = Column(String(32), default="created")  # created, active, completed, aborted
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    metrics_json = Column(Text, nullable=True)

    participant = relationship("Participant", back_populates="sessions")
    turns = relationship("Turn", back_populates="session", cascade="all, delete-orphan", order_by="Turn.turn_index")
    events = relationship("SystemEvent", back_populates="session", cascade="all, delete-orphan")


class Turn(Base):
    __tablename__ = "turns"

    id = Column(String(64), primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("sessions.id"), nullable=False, index=True)
    turn_index = Column(Integer, nullable=False)
    question_id = Column(String(64), nullable=True)
    question_text = Column(Text, nullable=True)
    transcript = Column(Text, nullable=True)
    asr_confidence = Column(Float, nullable=True)
    client_timestamp = Column(DateTime, nullable=True)
    server_timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("Session", back_populates="turns")
    observations = relationship("ModalityObservation", back_populates="turn", cascade="all, delete-orphan")
    fusion_record = relationship("FusionRecord", back_populates="turn", uselist=False, cascade="all, delete-orphan")
    ppo_decision = relationship("PPODecision", back_populates="turn", uselist=False, cascade="all, delete-orphan")


class ModalityObservation(Base):
    __tablename__ = "modality_observations"

    id = Column(String(64), primary_key=True, index=True)
    turn_id = Column(String(64), ForeignKey("turns.id"), nullable=False, index=True)
    modality_type = Column(String(32), nullable=False)  # audio, face, gaze, text, rppg
    quality_score = Column(Float, nullable=False, default=1.0)
    is_masked = Column(Boolean, nullable=False, default=False)
    features_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    turn = relationship("Turn", back_populates="observations")


class FusionRecord(Base):
    __tablename__ = "fusion_records"

    id = Column(String(64), primary_key=True, index=True)
    turn_id = Column(String(64), ForeignKey("turns.id"), nullable=False, unique=True, index=True)
    fused_state_json = Column(Text, nullable=True)
    prediction_score = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    attention_weights_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    turn = relationship("Turn", back_populates="fusion_record")


class PPODecision(Base):
    __tablename__ = "ppo_decisions"

    id = Column(String(64), primary_key=True, index=True)
    turn_id = Column(String(64), ForeignKey("turns.id"), nullable=False, unique=True, index=True)
    selected_action_id = Column(String(64), nullable=False)
    selected_question_text = Column(Text, nullable=False)
    info_gain = Column(Float, nullable=True)
    topic_coverage = Column(Float, nullable=True)
    engagement_score = Column(Float, nullable=True)
    repetition_penalty = Column(Float, nullable=True)
    safety_penalty = Column(Float, nullable=True)
    reward_calculated = Column(Float, nullable=True)
    state_vector_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    turn = relationship("Turn", back_populates="ppo_decision")


class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(String(64), primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("sessions.id"), nullable=True, index=True)
    event_type = Column(String(64), nullable=False)
    severity = Column(String(16), default="info")  # info, warning, error
    details_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("Session", back_populates="events")


class ExperimentRun(Base):
    __tablename__ = "experiment_runs"

    id = Column(String(64), primary_key=True, index=True)
    experiment_name = Column(String(128), nullable=False)
    architecture = Column(String(64), nullable=False)
    modalities_used = Column(String(128), nullable=False)
    dataset_version = Column(String(64), default="DAIC-WOZ-AVEC2017")
    split_hash = Column(String(64), nullable=True)
    metrics_json = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
