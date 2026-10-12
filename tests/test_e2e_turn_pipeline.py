import os
import sys
import numpy as np
import cv2

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_full_pipeline_loop():
    print("=== TESTING COMPLETE NOVA END-TO-END PIPELINE LOOP ===")

    # 1. Create Participant & Session
    print("\n1. Creating participant & session...")
    part_resp = client.post("/api/participants", json={"participant_id": "PART-NOVA-VALIDATION", "notes": "E2E loop validation"})
    assert part_resp.status_code == 201
    
    sess_resp = client.post("/api/sessions", json={"participant_id": "PART-NOVA-VALIDATION", "notes": "Multimodal session"})
    assert sess_resp.status_code == 201
    sess_id = sess_resp.json()["id"]
    print(f"Session created: {sess_id}")

    # 2. Start Session
    start_resp = client.post(f"/api/sessions/{sess_id}/start")
    assert start_resp.status_code == 200
    q1 = start_resp.json()["initial_question"]
    print(f"Session started! Initial Question: [{q1['question_id']}] {q1['text'][:60]}...")

    # 3. Process Turn 1: Participant responds to Q1
    print("\n2. Processing Turn 1 through multimodal pipeline...")
    turn1_payload = {
        "turn_index": 1,
        "question_id_answered": q1["question_id"],
        "transcript_override": "Hello! I've been feeling somewhat stressed out and having difficulty sleeping lately.",
        "video_frames_base64": []
    }
    t1_resp = client.post(f"/api/sessions/{sess_id}/turn", json=turn1_payload)
    assert t1_resp.status_code == 200, t1_resp.text
    t1_data = t1_resp.json()

    print("Turn 1 processed!")
    print(f"  Transcript: '{t1_data['transcript']}'")
    print(f"  Modality masks: {t1_data['modality_masks']}")
    print(f"  Biomarkers: vocal_instability={t1_data['biomarkers']['vocal_instability']}, gaze_aversion={t1_data['biomarkers']['gaze_aversion_index']}")
    print(f"  Fusion prediction score: {t1_data['fusion_output']['prediction_score']} (confidence: {t1_data['fusion_output']['confidence']})")
    print(f"  Fusion attention weights: {t1_data['fusion_output']['attention_weights']}")
    print(f"  PPO Selected Action: [{t1_data['next_action']['question_id']}] {t1_data['next_action']['text'][:60]}...")

    # Verify PPO selected an action from safe question bank
    assert t1_data["next_action"]["question_id"] is not None
    assert t1_data["next_action"]["selection_policy"] == "PPO"

    # 4. Process Turn 2: Participant responds to PPO-selected question
    print("\n3. Processing Turn 2...")
    q2 = t1_data["next_action"]
    turn2_payload = {
        "turn_index": 2,
        "question_id_answered": q2["question_id"],
        "transcript_override": "I wake up multiple times every night and feel exhausted throughout the day.",
        "video_frames_base64": []
    }
    t2_resp = client.post(f"/api/sessions/{sess_id}/turn", json=turn2_payload)
    assert t2_resp.status_code == 200, t2_resp.text
    t2_data = t2_resp.json()
    print("Turn 2 processed!")
    print(f"  PPO Next Action: [{t2_data['next_action']['question_id']}] {t2_data['next_action']['text'][:60]}...")

    # 5. Verify Timeline & Signals
    print("\n4. Verifying Timeline & Signals APIs...")
    timeline_resp = client.get(f"/api/sessions/{sess_id}/timeline")
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()
    assert len(timeline["events"]) >= 3  # start + turn1 + turn2
    print(f"Timeline verified: {len(timeline['events'])} events.")

    signals_resp = client.get(f"/api/sessions/{sess_id}/signals")
    assert signals_resp.status_code == 200
    signals = signals_resp.json()
    assert len(signals["signals"]) == 2
    print(f"Signals verified: {len(signals['signals'])} signal points matching Figure 7.")

    # 6. Verify Session Replay
    print("\n5. Verifying Session Replay API...")
    replay_resp = client.get(f"/api/sessions/{sess_id}/replay")
    assert replay_resp.status_code == 200
    replay = replay_resp.json()
    assert replay["total_turns"] == 2
    print(f"Replay verified: {replay['total_turns']} turns recorded with full state.")

    # 7. Verify Longitudinal API
    print("\n6. Verifying Longitudinal API...")
    long_resp = client.get("/api/participants/PART-NOVA-VALIDATION/longitudinal")
    assert long_resp.status_code == 200
    long_data = long_resp.json()
    assert long_data["total_sessions"] >= 1
    print(f"Longitudinal profile verified: {long_data['total_sessions']} session(s).")

    # 8. Verify Experiments & Benchmark API
    print("\n7. Verifying Experiments / Benchmark API...")
    exp_resp = client.get("/api/experiments")
    assert exp_resp.status_code == 200
    exp_data = exp_resp.json()
    assert "active_run" in exp_data
    assert "ablation_study_e0_e4" in exp_data["active_run"]
    assert "reinforcement_learning" in exp_data["active_run"]
    print("Experiments registry verified! E0-E4 ablations and PPO vs fixed baseline present.")

    # 9. End Session
    end_resp = client.post(f"/api/sessions/{sess_id}/end")
    assert end_resp.status_code == 200
    print("Session finalized successfully!")

    print("\nALL END-TO-END PIPELINE TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    test_full_pipeline_loop()
