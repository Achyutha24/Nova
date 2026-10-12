from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.database import get_db
from backend.app.database import crud
from backend.app.schemas.session import ParticipantCreate, ParticipantRead

router = APIRouter(prefix="/participants", tags=["Participants"])

@router.post("", response_model=ParticipantRead, status_code=201)
def create_participant(data: ParticipantCreate, db: Session = Depends(get_db)):
    if not data.participant_id:
        import uuid
        data.participant_id = f"PART-{uuid.uuid4().hex[:6].upper()}"
    p = crud.get_or_create_participant(db, data.participant_id, data.notes, data.demographics)
    return {
        "id": p.id,
        "created_at": p.created_at,
        "notes": p.notes,
        "demographics": data.demographics,
        "session_count": len(p.sessions)
    }

@router.get("", response_model=List[ParticipantRead])
def get_participants(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    return crud.list_participants(db, limit, offset)

@router.get("/{participant_id}", response_model=ParticipantRead)
def get_participant_detail(participant_id: str, db: Session = Depends(get_db)):
    p = crud.get_or_create_participant(db, participant_id)
    return {
        "id": p.id,
        "created_at": p.created_at,
        "notes": p.notes,
        "demographics": None,
        "session_count": len(p.sessions)
    }

@router.get("/{participant_id}/sessions")
def get_participant_sessions(participant_id: str, db: Session = Depends(get_db)):
    p = crud.get_or_create_participant(db, participant_id)
    return [
        {
            "id": s.id,
            "protocol_version": s.protocol_version,
            "status": s.status,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "notes": s.notes,
            "turn_count": len(s.turns)
        }
        for s in p.sessions
    ]

@router.get("/{participant_id}/longitudinal")
def get_participant_longitudinal(participant_id: str, db: Session = Depends(get_db)):
    from research.longitudinal import LongitudinalAnalyzer
    return LongitudinalAnalyzer.get_participant_longitudinal_profile(db, participant_id)
