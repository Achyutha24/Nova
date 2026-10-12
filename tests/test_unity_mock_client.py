import pytest
import io
import soundfile as sf
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app
from question_bank.manager import question_bank

def generate_dummy_wav():
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    sig = 0.2 * np.sin(2 * np.pi * 220 * t)
    buf = io.BytesIO()
    sf.write(buf, sig.astype(np.float32), sr, format='WAV')
    buf.seek(0)
    return buf.read()

def test_unity_avatar_full_interaction_loop():
    client = TestClient(app)
    
    # Step 1: Unity client creates participant & session
    client.post("/api/participants/", json={"participant_id": "PART-UNITY-TEST", "name": "Avatar Test Participant"})
    
    session_res = client.post("/api/sessions/", json={
        "participant_id": "PART-UNITY-TEST",
        "notes": "Unity 3D Avatar Client Test Session",
        "environment_metadata": {"client": "Unity Avatar Mock"}
    })
    assert session_res.status_code == 201
    session_data = session_res.json()

    session_id = session_data["id"]
    
    # Step 2: Unity client starts session and retrieves initial safe question
    start_res = client.post(f"/api/sessions/{session_id}/start")
    assert start_res.status_code == 200
    start_data = start_res.json()
    assert start_data["status"] == "active"
    initial_q = start_data["initial_question"]
    assert initial_q is not None
    assert initial_q["question_id"] in [q.question_id for q in question_bank.list_all_questions()]
    
    # Step 3: Unity client sends 3 consecutive turns
    sample_dialogues = [
        "I have been feeling quite exhausted recently, especially waking up in the morning.",
        "Yes, my sleep patterns have been irregular for a couple of weeks.",
        "I try to walk in the evenings, which helps ease the tension a bit."
    ]
    
    audio_bytes = generate_dummy_wav()
    
    current_q_id = initial_q["question_id"]
    for turn_idx, text in enumerate(sample_dialogues, start=1):
        files = {
            "audio_file": ("mic.wav", audio_bytes, "audio/wav")
        }
        data = {
            "question_id": current_q_id,
            "transcript_text": text
        }
        turn_res = client.post(f"/api/sessions/{session_id}/turn", files=files, data=data)
        assert turn_res.status_code == 200
        turn_data = turn_res.json()
        
        assert turn_data["turn_number"] == turn_idx
        assert turn_data["next_question"] is not None
        # Verify next question is from safe catalog
        assert question_bank.get_question(turn_data["next_question"]["question_id"]) is not None
        assert "biomarkers" in turn_data
        assert "vocal_instability" in turn_data["biomarkers"]
        
        current_q_id = turn_data["next_question"]["question_id"]
    
    # Step 4: Unity client ends session
    end_res = client.post(f"/api/sessions/{session_id}/end")
    assert end_res.status_code == 200
    end_data = end_res.json()
    assert end_data["status"] == "completed"
    assert end_data["total_turns"] == 3
    
    # Step 5: Verification of Replay and Continuous Signals for Dashboard
    replay_res = client.get(f"/api/sessions/{session_id}/replay")
    assert replay_res.status_code == 200
    replay_data = replay_res.json()
    assert len(replay_data["turns"]) == 3
    
    signals_res = client.get(f"/api/sessions/{session_id}/signals")
    assert signals_res.status_code == 200
    signals_data = signals_res.json()
    points = signals_data["signals"]
    assert len(points) == 3
    assert points[0]["vocal_instability"] >= 0.0

