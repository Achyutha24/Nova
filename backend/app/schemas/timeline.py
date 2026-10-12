from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class TimelineEvent(BaseModel):
    event_type: str  # question, response, observation, decision, system
    timestamp: datetime
    label: str
    details: Dict[str, Any] = Field(default_factory=dict)

class SignalPoint(BaseModel):
    time_sec: float
    gaze_aversion: float
    vocal_instability: float
    au_distress: float
    face_status: str   # available, degraded, masked
    gaze_status: str   # available, degraded, masked
    voice_status: str  # available, degraded, masked
    text_status: str   # available, degraded, masked
    rppg_status: str   # available, degraded, masked

class SessionTimeline(BaseModel):
    session_id: str
    participant_id: str
    status: str
    duration_seconds: float
    events: List[TimelineEvent] = []
    signals: List[SignalPoint] = []
