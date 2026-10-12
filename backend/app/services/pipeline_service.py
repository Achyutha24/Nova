import datetime
import time
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session as DBSession

from backend.app.database import crud, models
from backend.app.services.model_registry import model_registry
from preprocessing.aligner import TemporalTurnAligner
from question_bank.manager import question_bank
from backend.app.schemas.turn import TurnResponse, TurnCreate
from backend.app.websocket.dashboard_ws import dashboard_ws_manager
from backend.app.core.logging import logger

class MultimodalPipelineService:
    # In-memory idempotency cache: key=(session_id, request_id) -> cached turn_response
    _idempotency_cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def process_turn(
        cls,
        db: DBSession,
        session_id: str,
        turn_data: TurnCreate
    ) -> Dict[str, Any]:
        start_time = time.time()

        # Idempotency check: if client sent request_id and it was already processed, return cached turn
        if turn_data.request_id:
            cache_key = f"{session_id}:{turn_data.request_id}"
            if cache_key in cls._idempotency_cache:
                logger.info(f"[Pipeline] Idempotency hit: returning existing result for request {turn_data.request_id}")
                return cls._idempotency_cache[cache_key]

        # 1. Fetch session and turns
        sess = crud.get_session(db, session_id)
        if not sess:
            raise ValueError(f"Session '{session_id}' not found.")
        if sess.status != "active":
            crud.start_session(db, session_id)

        turn_idx = len(sess.turns) + 1

        # 2. Distinguish Speech vs. Manual Text vs. Unity input
        has_audio = bool(turn_data.audio_base64 and len(turn_data.audio_base64.strip()) > 10)
        audio_input = turn_data.audio_base64 or ""
        
        if has_audio:
            input_source = "speech"
            logger.info(f"[Pipeline] Processing live speech audio for turn {turn_idx}...")
            asr_res = model_registry.asr.transcribe(audio_input)
            transcript = asr_res.get("transcript", "")
            asr_source = asr_res.get("source", "whisper_model")
            asr_conf = asr_res.get("confidence", 0.92)
            
            # Real acoustic feature extraction
            voice_res = model_registry.voice.extract_features(audio_input)
        elif turn_data.transcript_override and turn_data.transcript_override.strip():
            input_source = turn_data.input_source or "manual_text"
            logger.info(f"[Pipeline] Processing manual typed text for turn {turn_idx}: '{turn_data.transcript_override[:40]}...'")
            transcript = turn_data.transcript_override.strip()
            asr_source = "manual_text"
            asr_conf = 1.0
            
            # Explicitly masked voice channel (no audio provided)
            voice_res = {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "mfcc": [0.0] * 13,
                    "f0_mean": 0.0,
                    "f0_std": 0.0,
                    "jitter": 0.0,
                    "shimmer": 0.0,
                    "hnr": 0.0,
                    "spectral_centroid": 0.0,
                    "zero_crossing_rate": 0.0,
                    "vocal_instability": 0.0
                }
            }
        else:
            input_source = "non_verbal"
            transcript = ""
            asr_source = "silence"
            asr_conf = 0.0
            voice_res = {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "mfcc": [0.0] * 13,
                    "f0_mean": 0.0,
                    "f0_std": 0.0,
                    "jitter": 0.0,
                    "shimmer": 0.0,
                    "hnr": 0.0,
                    "vocal_instability": 0.0
                }
            }

        # 3. Text NLP Embeddings
        text_res = model_registry.text.extract_features(transcript)

        # 4. Face & Gaze Analysis
        frames = turn_data.video_frames_base64 or []
        has_video = bool(frames and len(frames) > 0)
        
        if has_video:
            face_res = model_registry.face.extract_features(frames)
            gaze_res = model_registry.gaze.extract_features(frames)
            rppg_res = model_registry.rppg.extract_features(frames)
        else:
            face_res = {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "action_units": {},
                    "head_pose_pitch": 0.0,
                    "head_pose_yaw": 0.0,
                    "head_pose_roll": 0.0,
                    "expressivity_index": 0.0,
                    "au_distress_activation": 0.0
                }
            }
            gaze_res = {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "gaze_aversion_index": 0.0,
                    "blink_rate": 0.0,
                    "pupil_diameter": 0.0,
                    "gaze_direction": {"x": 0.0, "y": 0.0, "z": 1.0}
                }
            }
            rppg_res = {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {}
            }

        # 5. Temporal alignment & missing modality masking
        aligned = TemporalTurnAligner.align_turn_modalities(
            turn_index=turn_idx,
            voice_res=voice_res,
            face_res=face_res,
            gaze_res=gaze_res,
            text_res=text_res,
            rppg_res=rppg_res
        )

        # 6. Cross-Modal Transformer Fusion
        fusion_out = model_registry.fusion.fuse(aligned)

        # 7. Retrieve session dialogue history
        asked_q_ids = [t.question_id for t in sess.turns if t.question_id]
        if turn_data.question_id_answered and turn_data.question_id_answered not in asked_q_ids:
            asked_q_ids.append(turn_data.question_id_answered)
            
        covered_topics = set()
        for q_id in asked_q_ids:
            q_obj = question_bank.get_question(q_id)
            if q_obj:
                covered_topics.add(q_obj.topic)

        # 8. PPO Question Policy Evaluation
        ppo_decision = model_registry.rl.select_next_question(
            fused_state_z=fusion_out["fused_state"],
            asked_questions=asked_q_ids,
            covered_topics=list(covered_topics),
            turn_index=turn_idx,
            prediction_score=fusion_out["prediction_score"],
            modality_mask=aligned["mask_dict"]
        )

        # 9. Persistence to database
        db_turn = crud.create_turn(
            db=db,
            session_id=session_id,
            turn_index=turn_idx,
            question_id=turn_data.question_id_answered,
            question_text=question_bank.get_question(turn_data.question_id_answered).text if question_bank.get_question(turn_data.question_id_answered) else None,
            transcript=transcript,
            asr_confidence=asr_conf,
            client_timestamp=turn_data.client_timestamp
        )

        # Save modality observations
        crud.add_modality_observation(db, db_turn.id, "voice", voice_res["quality_score"], voice_res["is_masked"], voice_res["features"])
        crud.add_modality_observation(db, db_turn.id, "face", face_res["quality_score"], face_res["is_masked"], face_res["features"])
        crud.add_modality_observation(db, db_turn.id, "gaze", gaze_res["quality_score"], gaze_res["is_masked"], gaze_res["features"])
        crud.add_modality_observation(db, db_turn.id, "text", text_res["quality_score"], text_res["is_masked"], text_res["features"])
        crud.add_modality_observation(db, db_turn.id, "rppg", rppg_res["quality_score"], rppg_res["is_masked"], rppg_res["features"])

        # Save fusion record
        crud.add_fusion_record(
            db=db,
            turn_id=db_turn.id,
            fused_state=fusion_out["fused_state"],
            prediction_score=fusion_out["prediction_score"],
            confidence=fusion_out["confidence"],
            attention_weights=fusion_out["attention_weights"]
        )

        # Save PPO decision
        crud.add_ppo_decision(
            db=db,
            turn_id=db_turn.id,
            action_id=ppo_decision["question_id"],
            question_text=ppo_decision["text"],
            info_gain=ppo_decision["expected_info_gain"],
            topic_coverage=len(covered_topics) / float(len(question_bank.get_all_topics())),
            engagement_score=aligned["qualities"]["voice"] * 0.5 + aligned["qualities"]["face"] * 0.5,
            repetition_penalty=0.0,
            safety_penalty=0.0,
            reward=0.75,
            state_vector=ppo_decision["state_vector"]
        )

        # 10. Assemble response payload
        biomarkers = {
            "gaze_aversion_index": round(float(gaze_res["features"].get("gaze_aversion_index", 0.0)), 3),
            "vocal_instability": round(float(voice_res["features"].get("vocal_instability", 0.0)), 3),
            "facial_au_activation": round(float(face_res["features"].get("au_distress_activation", 0.0)), 3),
            "hr_bpm": rppg_res["features"].get("heart_rate_bpm"),
            "hrv_rmssd": rppg_res["features"].get("hrv_rmssd")
        }

        latency_ms = round((time.time() - start_time) * 1000, 1)

        turn_response = {
            "turn_id": db_turn.id,
            "turn_index": turn_idx,
            "turn_number": turn_idx,
            "input_source": input_source,
            "request_id": turn_data.request_id,
            "transcript": transcript,
            "asr_source": asr_source,
            "modality_quality": aligned["qualities"],
            "modality_masks": aligned["mask_dict"],
            "biomarkers": biomarkers,
            "acoustic_details": voice_res.get("features", {}),
            "gaze_details": gaze_res.get("features", {}),
            "face_details": face_res.get("features", {}),
            "latency_ms": latency_ms,
            "assessment_score": fusion_out["prediction_score"],
            "fusion_output": {
                "prediction_score": fusion_out["prediction_score"],
                "confidence": fusion_out["confidence"],
                "attention_weights": fusion_out["attention_weights"]
            },
            "next_action": {
                "question_id": ppo_decision["question_id"],
                "text": ppo_decision["text"],
                "topic": ppo_decision["topic"],
                "difficulty": ppo_decision["difficulty"],
                "selection_policy": "PPO",
                "expected_info_gain": ppo_decision["expected_info_gain"]
            },
            "next_question": {
                "question_id": ppo_decision["question_id"],
                "text": ppo_decision["text"],
                "topic": ppo_decision["topic"],
                "difficulty_tier": ppo_decision["difficulty"]
            },
            "session_completed": turn_idx >= 10,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }

        # Cache for idempotency if request_id provided
        if turn_data.request_id:
            cls._idempotency_cache[f"{session_id}:{turn_data.request_id}"] = turn_response

        # 11. Asynchronously push live update to WebSocket subscribers
        dashboard_ws_manager.broadcast_sync(session_id, {
            "type": "turn_completed",
            "data": turn_response
        })

        return turn_response
