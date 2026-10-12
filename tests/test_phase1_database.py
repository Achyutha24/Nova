import os
import sys

# Ensure Nova root is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.database.database import init_db, SessionLocal
from backend.app.database import crud, models

def test_database_lifecycle():
    print("Initializing test database...")
    init_db()
    
    db = SessionLocal()
    try:
        # 1. Test participant creation
        print("Testing participant creation...")
        part = crud.get_or_create_participant(db, participant_id="TEST-PART-001", notes="Integration test participant")
        assert part.id == "TEST-PART-001"
        print(f"Created participant: {part.id}")
        
        # 2. Test session creation
        print("Testing session creation...")
        sess = crud.create_session(db, participant_id="TEST-PART-001", protocol_version="v1.0")
        assert sess.status == "created"
        assert sess.participant_id == "TEST-PART-001"
        print(f"Created session: {sess.id}")
        
        # 3. Test start session
        sess = crud.start_session(db, sess.id)
        assert sess.status == "active"
        assert sess.started_at is not None
        print(f"Started session at: {sess.started_at}")
        
        # 4. Test turn creation
        turn = crud.create_turn(
            db, 
            session_id=sess.id, 
            turn_index=1, 
            question_id="Q01_RAPPORT",
            question_text="How are you feeling today?",
            transcript="I am feeling a bit tired lately."
        )
        assert turn.turn_index == 1
        print(f"Created turn: {turn.id}")
        
        # 5. Test modality observation
        obs_voice = crud.add_modality_observation(
            db,
            turn_id=turn.id,
            modality_type="voice",
            quality_score=0.92,
            is_masked=False,
            features={"jitter": 0.021, "shimmer": 0.045, "hnr": 18.4}
        )
        assert obs_voice.modality_type == "voice"
        print(f"Added voice observation: {obs_voice.id}")
        
        # 6. Test fusion record
        fus = crud.add_fusion_record(
            db,
            turn_id=turn.id,
            fused_state=[0.1, 0.2, 0.3],
            prediction_score=0.35,
            confidence=0.88,
            attention_weights={"voice": 0.4, "face": 0.3, "text": 0.3}
        )
        assert fus.confidence == 0.88
        print(f"Added fusion record: {fus.id}")
        
        # 7. Test PPO decision
        ppo = crud.add_ppo_decision(
            db,
            turn_id=turn.id,
            action_id="Q02_SLEEP",
            question_text="Could you describe your sleep patterns?",
            info_gain=0.65,
            topic_coverage=0.3,
            engagement_score=0.8,
            repetition_penalty=0.0,
            safety_penalty=0.0,
            reward=0.75
        )
        assert ppo.selected_action_id == "Q02_SLEEP"
        print(f"Added PPO decision: {ppo.id}")
        
        # 8. Test session completion
        sess = crud.end_session(db, sess.id, metrics={"total_turns": 1, "avg_quality": 0.92})
        assert sess.status == "completed"
        assert sess.ended_at is not None
        print(f"Completed session: {sess.id} at {sess.ended_at}")
        
        # 9. Test queries
        parts = crud.list_participants(db)
        assert len(parts) >= 1
        sessions = crud.list_sessions(db)
        assert len(sessions) >= 1
        print(f"Query verification passed! Total participants: {len(parts)}, Sessions: {len(sessions)}")
        
        print("ALL PHASE 1 DATABASE TESTS PASSED SUCCESSFULLY!")
    finally:
        db.close()

if __name__ == "__main__":
    test_database_lifecycle()
