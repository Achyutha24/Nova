from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ParticipantCreate(BaseModel):
    participant_id: Optional[str] = Field(None, description="Pseudonymous participant ID")
    notes: Optional[str] = None
    demographics: Optional[Dict[str, Any]] = None

class ParticipantRead(BaseModel):
    id: str
    created_at: datetime
    notes: Optional[str] = None
    demographics: Optional[Dict[str, Any]] = None
    session_count: int = 0

    class Config:
        from_attributes = True

class SessionCreate(BaseModel):
    participant_id: str
    protocol_version: str = "v1.0"
    notes: Optional[str] = None

class SessionRead(BaseModel):
    id: str
    participant_id: str
    protocol_version: str
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    notes: Optional[str] = None
    turn_count: int = 0

    class Config:
        from_attributes = True

class SessionDetail(SessionRead):
    turns: List[Any] = []
    metrics: Optional[Dict[str, Any]] = None
