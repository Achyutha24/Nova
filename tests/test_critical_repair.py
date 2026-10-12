import io
import wave
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.database.database import get_db, SessionLocal
from backend.app.database import crud, models
from research.longitudinal import LongitudinalAnalyzer
from backend.app.services.pipeline_service import MultimodalPipelineService
from backend.app.schemas.turn import TurnCreate

client = TestClient(app)

def generate_test_wav_bytes(duration_sec: float = 0.5, freq_hz: float = 440.0) -> bytes:
    """Generate in-memory 16kHz 16-bit PCM mono sine wave WAV."""
    sample_rate = 16000
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    samples = (0.5 * np.sin(2 * np.pi * freq_hz * t) * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())
    return buf.getvalue()


def test_regression_longitudinal_profile_none_started_at():
    """Verify that sessions with started_at=None do NOT trigger AttributeError ('created_at')."""
    db: Session = SessionLocal()
    try:
        part_id = "P_REGRESSION_TEST"
        # Create participant & session
        crud.get_or_create_participant(db, part_id, "Regression Group")
        sess = crud.create_session(db, part_id, "v1.0", "Regression test session")
        # Ensure started_at is explicitly None
        sess.started_at = None
        db.commit()

        # Build profile - must not raise AttributeError: 'Session' object has no attribute 'created_at'
        profile = LongitudinalAnalyzer.get_participant_longitudinal_profile(db, part_id)
        assert profile is not None
        assert profile["participant_id"] == part_id
        assert profile["total_sessions"] >= 1

        # Also test via API endpoint
        api_res = client.get(f"/api/participants/{part_id}/longitudinal")
        assert api_res.status_code == 200
        assert api_res.json()["participant_id"] == part_id
    finally:
        db.close()


def test_idempotency_cache_duplicate_turn_protection():
    """Verify that calling process_turn with the same request_id returns cached response without duplicate."""
    db: Session = SessionLocal()
    try:
        part_id = "P_IDEMPOTENCY_TEST"
        crud.get_or_create_participant(db, part_id, "Test")
        sess = crud.create_session(db, part_id, "v1.0")
        crud.start_session(db, sess.id)

        req_id = f"test_idemp_{sess.id}_turn1"
        turn_create = TurnCreate(
            turn_index=1,
            transcript_override="Testing idempotency turn submission",
            input_source="manual_text",
            request_id=req_id
        )

        res1 = MultimodalPipelineService.process_turn(db, sess.id, turn_create)
        res2 = MultimodalPipelineService.process_turn(db, sess.id, turn_create)

        assert res1["turn_id"] == res2["turn_id"]
        assert res1["request_id"] == req_id
        assert res2["request_id"] == req_id

        # Verify only 1 turn exists in database
        turns = db.query(models.Turn).filter(models.Turn.session_id == sess.id).all()
        assert len(turns) == 1
    finally:
        db.close()


def test_manual_text_turn_masks_acoustic_features():
    """Verify manual text submission marks voice modality mask as inactive."""
    db: Session = SessionLocal()
    try:
        part_id = "P_TEXT_MASK_TEST"
        crud.get_or_create_participant(db, part_id, "Test")
        sess = crud.create_session(db, part_id, "v1.0")
        crud.start_session(db, sess.id)

        turn_create = TurnCreate(
            turn_index=1,
            transcript_override="I feel overwhelmed with work deadlines.",
            input_source="manual_text",
            request_id="req_text_mask_1"
        )

        res = MultimodalPipelineService.process_turn(db, sess.id, turn_create)
        assert res["input_source"] == "manual_text"
        assert res["modality_masks"]["voice"] is False  # Voice mask is False = inactive/masked
        assert res["transcript"] == "I feel overwhelmed with work deadlines."
        # Acoustic details should have 0 f0_mean since no speech was recorded
        assert res["acoustic_details"].get("f0_mean", 0.0) == 0.0
    finally:
        db.close()


def test_audio_submission_whisper_and_acoustic_dsp():
    """Verify audio submission processes real Whisper ASR and acoustic DSP."""
    create_res = client.post("/api/sessions", json={"participant_id": "P_AUDIO_TEST", "notes": "Audio test"})
    assert create_res.status_code == 201
    sess_id = create_res.json()["id"]

    start_res = client.post(f"/api/sessions/{sess_id}/start")
    assert start_res.status_code == 200

    wav_bytes = generate_test_wav_bytes(duration_sec=0.5, freq_hz=440.0)

    # Submit audio via multipart form
    files = {"audio_file": ("test.wav", wav_bytes, "audio/wav")}
    data = {
        "turn_index": "1",
        "question_id": "Q_RAP_01",
        "request_id": f"req_audio_live_{sess_id}",
        "input_source": "speech",
    }
    turn_res = client.post(f"/api/sessions/{sess_id}/turn", data=data, files=files)
    assert turn_res.status_code == 200
    res_data = turn_res.json()

    assert res_data["input_source"] == "speech"
    assert "whisper" in res_data["asr_source"].lower()
    assert "latency_ms" in res_data
    assert res_data["modality_masks"]["voice"] is True  # Active voice channel
    assert res_data["acoustic_details"] is not None
    # F0 mean should be extracted
    assert "f0_mean" in res_data["acoustic_details"]
    assert "hnr" in res_data["acoustic_details"]
    assert "jitter" in res_data["acoustic_details"]
    assert "shimmer" in res_data["acoustic_details"]
    assert res_data["next_action"] is not None


def test_sequential_dialogue_turns_adaptation():
    """Verify sequential turns increment indices and adapt dialogue actions."""
    create_res = client.post("/api/sessions", json={"participant_id": "P_SEQ_TEST"})
    sess_id = create_res.json()["id"]
    client.post(f"/api/sessions/{sess_id}/start")

    # Turn 1
    t1 = client.post(f"/api/sessions/{sess_id}/turn", json={
        "turn_index": 1,
        "transcript_override": "I have not been sleeping well.",
        "input_source": "manual_text",
        "request_id": f"seq_{sess_id}_1"
    })
    assert t1.status_code == 200
    data1 = t1.json()
    assert data1["turn_index"] == 1
    next_q = data1["next_action"]["question_id"]

    # Turn 2
    t2 = client.post(f"/api/sessions/{sess_id}/turn", json={
        "turn_index": 2,
        "question_id_answered": next_q,
        "transcript_override": "About four hours each night.",
        "input_source": "manual_text",
        "request_id": f"seq_{sess_id}_2"
    })
    assert t2.status_code == 200
    data2 = t2.json()
    assert data2["turn_index"] == 2
    assert data2["next_action"] is not None
