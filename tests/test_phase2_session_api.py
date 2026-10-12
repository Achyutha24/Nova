import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_participant_and_session_apis():
    # 1. System health check
    res = client.get("/api/system/health")
    assert res.status_code == 200, res.text
    health_data = res.json()
    assert health_data["status"] == "healthy"
    print("Health check OK:", health_data["torch_device"])
    
    # 2. Get safe question bank
    res = client.get("/api/questions")
    assert res.status_code == 200, res.text
    questions = res.json()
    assert len(questions) >= 10
    print(f"Safe question bank verified! {len(questions)} safe questions available.")
    
    # 3. Create participant
    res = client.post("/api/participants", json={"participant_id": "PART-E2E-TEST", "notes": "Automated API verification"})
    assert res.status_code == 201, res.text
    part_data = res.json()
    assert part_data["id"] == "PART-E2E-TEST"
    print("Created participant:", part_data["id"])
    
    # 4. Create session
    res = client.post("/api/sessions", json={"participant_id": "PART-E2E-TEST", "notes": "Session API test"})
    assert res.status_code == 201, res.text
    sess_data = res.json()
    sess_id = sess_data["id"]
    assert sess_data["status"] == "created"
    print(f"Created session: {sess_id}")
    
    # 5. Start session
    res = client.post(f"/api/sessions/{sess_id}/start")
    assert res.status_code == 200, res.text
    start_data = res.json()
    assert start_data["status"] == "active"
    assert "initial_question" in start_data
    assert start_data["initial_question"]["topic"] == "rapport"
    print(f"Session started! Initial question: {start_data['initial_question']['text'][:60]}...")
    
    # 6. Check session timeline
    res = client.get(f"/api/sessions/{sess_id}/timeline")
    assert res.status_code == 200, res.text
    timeline = res.json()
    assert len(timeline["events"]) >= 1
    print("Timeline verified with events:", len(timeline["events"]))
    
    # 7. Check session signals
    res = client.get(f"/api/sessions/{sess_id}/signals")
    assert res.status_code == 200, res.text
    signals = res.json()
    print("Signals endpoint verified!")
    
    # 8. Check session replay
    res = client.get(f"/api/sessions/{sess_id}/replay")
    assert res.status_code == 200, res.text
    replay = res.json()
    assert replay["session_id"] == sess_id
    print("Replay endpoint verified!")
    
    # 9. End session
    res = client.post(f"/api/sessions/{sess_id}/end")
    assert res.status_code == 200, res.text
    end_data = res.json()
    assert end_data["status"] == "completed"
    print(f"Session ended! Metrics: {end_data['metrics']}")
    
    print("\nALL PHASE 2 REST API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_participant_and_session_apis()
