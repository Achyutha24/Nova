import uuid
import datetime
import json
from sqlalchemy.orm import Session as DBSession
from backend.app.database import models
from backend.app.schemas import session as session_schemas

def get_or_create_participant(db: DBSession, participant_id: str, notes: str = None, demographics: dict = None) -> models.Participant:
    p = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if not p:
        p = models.Participant(
            id=participant_id,
            notes=notes,
            demographics_json=json.dumps(demographics) if demographics else None
        )
        db.add(p)
        db.commit()
        db.refresh(p)
    return p

def list_participants(db: DBSession, limit: int = 50, offset: int = 0):
    participants = db.query(models.Participant).offset(offset).limit(limit).all()
    results = []
    for p in participants:
        results.append({
            "id": p.id,
            "created_at": p.created_at,
            "notes": p.notes,
            "demographics": json.loads(p.demographics_json) if p.demographics_json else None,
            "session_count": len(p.sessions)
        })
    return results

def create_session(db: DBSession, participant_id: str, protocol_version: str = "v1.0", notes: str = None) -> models.Session:
    # Ensure participant exists
    get_or_create_participant(db, participant_id)
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    s = models.Session(
        id=session_id,
        participant_id=participant_id,
        protocol_version=protocol_version,
        status="created",
        notes=notes
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

def get_session(db: DBSession, session_id: str) -> models.Session:
    return db.query(models.Session).filter(models.Session.id == session_id).first()

def list_sessions(db: DBSession, limit: int = 50, offset: int = 0, status: str = None):
    query = db.query(models.Session)
    if status:
        query = query.filter(models.Session.status == status)
    sessions = query.order_by(models.Session.started_at.desc().nullslast()).offset(offset).limit(limit).all()
    results = []
    for s in sessions:
        results.append({
            "id": s.id,
            "participant_id": s.participant_id,
            "protocol_version": s.protocol_version,
            "status": s.status,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "notes": s.notes,
            "turn_count": len(s.turns)
        })
    return results

def start_session(db: DBSession, session_id: str) -> models.Session:
    s = get_session(db, session_id)
    if s:
        s.status = "active"
        s.started_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(s)
    return s

def end_session(db: DBSession, session_id: str, metrics: dict = None) -> models.Session:
    s = get_session(db, session_id)
    if s:
        s.status = "completed"
        s.ended_at = datetime.datetime.utcnow()
        if metrics:
            s.metrics_json = json.dumps(metrics)
        db.commit()
        db.refresh(s)
    return s

def create_turn(db: DBSession, session_id: str, turn_index: int, question_id: str = None, 
                question_text: str = None, transcript: str = None, asr_confidence: float = None,
                client_timestamp: datetime.datetime = None) -> models.Turn:
    turn_id = f"turn_{uuid.uuid4().hex[:12]}"
    turn = models.Turn(
        id=turn_id,
        session_id=session_id,
        turn_index=turn_index,
        question_id=question_id,
        question_text=question_text,
        transcript=transcript,
        asr_confidence=asr_confidence,
        client_timestamp=client_timestamp,
        server_timestamp=datetime.datetime.utcnow()
    )
    db.add(turn)
    db.commit()
    db.refresh(turn)
    return turn

def add_modality_observation(db: DBSession, turn_id: str, modality_type: str, quality_score: float, 
                             is_masked: bool, features: dict) -> models.ModalityObservation:
    obs_id = f"obs_{uuid.uuid4().hex[:12]}"
    obs = models.ModalityObservation(
        id=obs_id,
        turn_id=turn_id,
        modality_type=modality_type,
        quality_score=quality_score,
        is_masked=is_masked,
        features_json=json.dumps(features),
        timestamp=datetime.datetime.utcnow()
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return obs

def add_fusion_record(db: DBSession, turn_id: str, fused_state: list, prediction_score: float,
                      confidence: float, attention_weights: dict) -> models.FusionRecord:
    rec_id = f"fus_{uuid.uuid4().hex[:12]}"
    rec = models.FusionRecord(
        id=rec_id,
        turn_id=turn_id,
        fused_state_json=json.dumps(fused_state),
        prediction_score=prediction_score,
        confidence=confidence,
        attention_weights_json=json.dumps(attention_weights),
        timestamp=datetime.datetime.utcnow()
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

def add_ppo_decision(db: DBSession, turn_id: str, action_id: str, question_text: str,
                     info_gain: float, topic_coverage: float, engagement_score: float,
                     repetition_penalty: float, safety_penalty: float, reward: float,
                     state_vector: list = None) -> models.PPODecision:
    dec_id = f"ppo_{uuid.uuid4().hex[:12]}"
    dec = models.PPODecision(
        id=dec_id,
        turn_id=turn_id,
        selected_action_id=action_id,
        selected_question_text=question_text,
        info_gain=info_gain,
        topic_coverage=topic_coverage,
        engagement_score=engagement_score,
        repetition_penalty=repetition_penalty,
        safety_penalty=safety_penalty,
        reward_calculated=reward,
        state_vector_json=json.dumps(state_vector) if state_vector else None,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(dec)
    db.commit()
    db.refresh(dec)
    return dec

def log_system_event(db: DBSession, session_id: str, event_type: str, severity: str = "info", details: dict = None):
    evt_id = f"evt_{uuid.uuid4().hex[:12]}"
    evt = models.SystemEvent(
        id=evt_id,
        session_id=session_id,
        event_type=event_type,
        severity=severity,
        details_json=json.dumps(details) if details else None,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(evt)
    db.commit()
    return evt
