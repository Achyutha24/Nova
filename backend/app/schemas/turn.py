from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from backend.app.schemas.features import ModalityQuality, ModalityMasks, BiomarkersSummary
from backend.app.schemas.ppo import PPOActionRead

class TurnCreate(BaseModel):
    turn_index: int = 1
    question_id_answered: Optional[str] = None
    audio_base64: Optional[str] = None
    video_frames_base64: Optional[List[str]] = None
    transcript_override: Optional[str] = None
    input_source: Optional[str] = "manual_text"  # "speech", "manual_text", "unity"
    request_id: Optional[str] = None
    client_timestamp: Optional[datetime] = None

class FusionOutputDetail(BaseModel):
    prediction_score: float = 0.0
    confidence: float = 0.0
    attention_weights: Dict[str, float] = Field(default_factory=dict)

class TurnResponse(BaseModel):
    turn_id: str
    turn_index: int
    transcript: str
    input_source: Optional[str] = "manual_text"
    request_id: Optional[str] = None
    modality_quality: ModalityQuality
    modality_masks: ModalityMasks
    biomarkers: BiomarkersSummary
    fusion_output: FusionOutputDetail
    next_action: PPOActionRead
    acoustic_details: Optional[Dict[str, Any]] = None
    gaze_details: Optional[Dict[str, Any]] = None
    face_details: Optional[Dict[str, Any]] = None
    latency_ms: Optional[float] = None
    asr_source: Optional[str] = None
    session_completed: bool = False
    timestamp: datetime

class TurnDetail(BaseModel):
    id: str
    session_id: str
    turn_index: int
    question_id: Optional[str] = None
    question_text: Optional[str] = None
    transcript: Optional[str] = None
    asr_confidence: Optional[float] = None
    client_timestamp: Optional[datetime] = None
    server_timestamp: datetime
    observations: List[Dict[str, Any]] = []
    fusion: Optional[Dict[str, Any]] = None
    decision: Optional[Dict[str, Any]] = None
