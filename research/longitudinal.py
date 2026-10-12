import json
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session as DBSession
from backend.app.database import crud, models

class LongitudinalAnalyzer:
    @staticmethod
    def get_participant_longitudinal_profile(db: DBSession, participant_id: str) -> Dict[str, Any]:
        p = crud.get_or_create_participant(db, participant_id)
        def _get_session_dt(sess: models.Session):
            if sess.started_at is not None:
                return sess.started_at
            if sess.ended_at is not None:
                return sess.ended_at
            if sess.turns and len(sess.turns) > 0 and sess.turns[0].server_timestamp is not None:
                return sess.turns[0].server_timestamp
            return datetime.datetime.min

        sessions = sorted(p.sessions, key=_get_session_dt)

        session_summaries = []
        for s in sessions:
            vocal_instabilities = []
            gaze_aversions = []
            au_distresses = []
            prediction_scores = []

            for t in s.turns:
                for obs in t.observations:
                    feats = json.loads(obs.features_json) if obs.features_json else {}
                    if obs.modality_type == "voice" and not obs.is_masked:
                        vocal_instabilities.append(feats.get("vocal_instability", 0.0))
                    elif obs.modality_type == "gaze" and not obs.is_masked:
                        gaze_aversions.append(feats.get("gaze_aversion_index", 0.0))
                    elif obs.modality_type == "face" and not obs.is_masked:
                        au_distresses.append(feats.get("au_distress_activation", 0.0))
                if t.fusion_record:
                    prediction_scores.append(t.fusion_record.prediction_score)

            # Compute averages for this session
            avg_vocal = float(sum(vocal_instabilities) / max(1, len(vocal_instabilities)))
            avg_gaze = float(sum(gaze_aversions) / max(1, len(gaze_aversions)))
            avg_au = float(sum(au_distresses) / max(1, len(au_distresses)))
            avg_pred = float(sum(prediction_scores) / max(1, len(prediction_scores)))

            dur = 0.0
            if s.started_at and s.ended_at:
                dur = (s.ended_at - s.started_at).total_seconds()
            elif len(s.turns) > 0:
                dur = len(s.turns) * 25.0

            dt = _get_session_dt(s)
            date_str = dt.strftime("%Y-%m-%d %H:%M") if dt != datetime.datetime.min else "Unscheduled"

            session_summaries.append({
                "session_id": s.id,
                "date": date_str,
                "status": s.status,
                "turn_count": len(s.turns),
                "duration_seconds": round(dur, 1),
                "avg_vocal_instability": round(avg_vocal, 3),
                "avg_gaze_aversion": round(avg_gaze, 3),
                "avg_au_distress": round(avg_au, 3),
                "avg_prediction_score": round(avg_pred, 3)
            })

        return {
            "participant_id": participant_id,
            "total_sessions": len(sessions),
            "sessions": session_summaries
        }
