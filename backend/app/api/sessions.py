from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import datetime
from backend.app.database.database import get_db
from backend.app.database import crud, models
from backend.app.schemas.session import SessionCreate, SessionRead, SessionDetail
from backend.app.schemas.timeline import SessionTimeline, TimelineEvent, SignalPoint
from backend.app.schemas.ppo import SafeQuestion
from question_bank.manager import question_bank

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("", response_model=SessionRead, status_code=201)
def create_session(data: SessionCreate, db: Session = Depends(get_db)):
    s = crud.create_session(db, data.participant_id, data.protocol_version, data.notes)
    crud.log_system_event(db, s.id, "session_created", "info", {"participant_id": s.participant_id})
    return {
        "id": s.id,
        "participant_id": s.participant_id,
        "protocol_version": s.protocol_version,
        "status": s.status,
        "started_at": s.started_at,
        "ended_at": s.ended_at,
        "notes": s.notes,
        "turn_count": 0
    }

@router.get("", response_model=List[SessionRead])
def list_sessions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.list_sessions(db, limit, offset, status)

@router.get("/{session_id}", response_model=SessionDetail)
def get_session_detail(session_id: str, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    
    turns_data = []
    for t in s.turns:
        turns_data.append({
            "id": t.id,
            "turn_index": t.turn_index,
            "question_id": t.question_id,
            "question_text": t.question_text,
            "transcript": t.transcript,
            "server_timestamp": t.server_timestamp
        })
    
    metrics = json.loads(s.metrics_json) if s.metrics_json else None
    return {
        "id": s.id,
        "participant_id": s.participant_id,
        "protocol_version": s.protocol_version,
        "status": s.status,
        "started_at": s.started_at,
        "ended_at": s.ended_at,
        "notes": s.notes,
        "turn_count": len(s.turns),
        "turns": turns_data,
        "metrics": metrics
    }

@router.post("/{session_id}/start")
def start_session(session_id: str, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if s.status == "active":
        initial_q = question_bank.get_initial_question()
        return {
            "session_id": s.id,
            "status": s.status,
            "started_at": s.started_at,
            "initial_question": initial_q.dict()
        }
    
    s = crud.start_session(db, session_id)
    crud.log_system_event(db, s.id, "session_started", "info", {"started_at": str(s.started_at)})
    initial_q = question_bank.get_initial_question()
    return {
        "session_id": s.id,
        "status": s.status,
        "started_at": s.started_at,
        "initial_question": initial_q.dict()
    }

@router.post("/{session_id}/end")
def end_session(session_id: str, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    
    duration = 0.0
    if s.started_at:
        duration = (datetime.datetime.utcnow() - s.started_at).total_seconds()
        
    metrics = {
        "total_turns": len(s.turns),
        "duration_seconds": round(duration, 2),
        "topics_covered": list(set([t.question_id.split('_')[1] for t in s.turns if t.question_id and '_' in t.question_id]))
    }
    
    s = crud.end_session(db, session_id, metrics)
    crud.log_system_event(db, s.id, "session_ended", "info", metrics)
    return {
        "session_id": s.id,
        "status": s.status,
        "ended_at": s.ended_at,
        "total_turns": metrics["total_turns"],
        "metrics": metrics
    }


@router.get("/{session_id}/timeline")
def get_session_timeline(session_id: str, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    
    events = []
    if s.started_at:
        events.append({
            "event_type": "session_start",
            "timestamp": s.started_at,
            "label": "Session Started",
            "details": {"status": "started"}
        })
        
    for t in s.turns:
        if t.question_text:
            events.append({
                "event_type": "question",
                "timestamp": t.server_timestamp,
                "label": f"Turn {t.turn_index}: {t.question_id or 'Question'}",
                "details": {"question_id": t.question_id, "text": t.question_text}
            })
        if t.transcript:
            events.append({
                "event_type": "response",
                "timestamp": t.server_timestamp,
                "label": f"Response {t.turn_index}",
                "details": {"transcript": t.transcript}
            })
            
    if s.ended_at:
        events.append({
            "event_type": "session_end",
            "timestamp": s.ended_at,
            "label": "Session Completed",
            "details": {"status": "completed"}
        })
        
    return {
        "session_id": s.id,
        "participant_id": s.participant_id,
        "status": s.status,
        "events": events
    }

@router.get("/{session_id}/signals")
def get_session_signals(session_id: str, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
        
    start_time = s.started_at or datetime.datetime.utcnow()
    signal_points = []
    
    for t in s.turns:
        t_sec = max(0.0, (t.server_timestamp - start_time).total_seconds()) if s.started_at else float(t.turn_index * 15.0)
        
        # Aggregate observation values
        gaze_av = 0.2
        vocal_in = 0.2
        au_dist = 0.2
        face_st = "available"
        gaze_st = "available"
        voice_st = "available"
        text_st = "available"
        rppg_st = "masked"
        
        for obs in t.observations:
            feats = json.loads(obs.features_json) if obs.features_json else {}
            st = "masked" if obs.is_masked else ("degraded" if obs.quality_score < 0.7 else "available")
            
            if obs.modality_type == "gaze":
                gaze_st = st
                gaze_av = feats.get("gaze_aversion_index", gaze_av)
            elif obs.modality_type == "voice":
                voice_st = st
                vocal_in = feats.get("jitter", 0.02) * 10 + feats.get("shimmer", 0.04) * 5
                vocal_in = min(1.0, max(0.0, vocal_in))
            elif obs.modality_type == "face":
                face_st = st
                au_dist = feats.get("au_distress_activation", au_dist)
            elif obs.modality_type == "text":
                text_st = st
            elif obs.modality_type == "rppg":
                rppg_st = st
                
        signal_points.append({
            "time_sec": round(t_sec, 2),
            "turn_index": t.turn_index,
            "question_id": t.question_id,
            "gaze_aversion": round(gaze_av, 3),
            "vocal_instability": round(vocal_in, 3),
            "au_distress": round(au_dist, 3),
            "face_status": face_st,
            "gaze_status": gaze_st,
            "voice_status": voice_st,
            "text_status": text_st,
            "rppg_status": rppg_st
        })
        
    return {
        "session_id": s.id,
        "participant_id": s.participant_id,
        "signals": signal_points
    }

@router.get("/{session_id}/replay")
def get_session_replay(session_id: str, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
        
    replay_turns = []
    for t in s.turns:
        obs_dict = {}
        for o in t.observations:
            obs_dict[o.modality_type] = {
                "quality": o.quality_score,
                "masked": o.is_masked,
                "features": json.loads(o.features_json) if o.features_json else {}
            }
            
        fusion_info = None
        if t.fusion_record:
            fusion_info = {
                "prediction_score": t.fusion_record.prediction_score,
                "confidence": t.fusion_record.confidence,
                "attention_weights": json.loads(t.fusion_record.attention_weights_json) if t.fusion_record.attention_weights_json else {}
            }
            
        ppo_info = None
        if t.ppo_decision:
            ppo_info = {
                "action_id": t.ppo_decision.selected_action_id,
                "question_text": t.ppo_decision.selected_question_text,
                "info_gain": t.ppo_decision.info_gain,
                "topic_coverage": t.ppo_decision.topic_coverage,
                "reward": t.ppo_decision.reward_calculated
            }
            
        replay_turns.append({
            "turn_id": t.id,
            "turn_index": t.turn_index,
            "question_id": t.question_id,
            "question_text": t.question_text,
            "transcript": t.transcript,
            "timestamp": t.server_timestamp,
            "observations": obs_dict,
            "fusion": fusion_info,
            "decision": ppo_info
        })
        
    return {
        "session_id": s.id,
        "participant_id": s.participant_id,
        "status": s.status,
        "started_at": s.started_at,
        "ended_at": s.ended_at,
        "total_turns": len(replay_turns),
        "turns": replay_turns
    }
