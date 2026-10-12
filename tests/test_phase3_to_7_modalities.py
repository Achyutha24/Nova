import os
import sys
import numpy as np
import cv2

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.model_registry import model_registry
from fastapi.testclient import TestClient
from backend.app.main import app

def test_all_modality_extractors():
    print("=== TESTING MODALITY EXTRACTORS ===")

    # 1. Test Text/NLP
    print("\n1. Testing Text/NLP Service...")
    text_sample = "I have been feeling quite overwhelmed, exhausted, and having trouble with insomnia."
    text_res = model_registry.text.extract_features(text_sample)
    assert not text_res["is_masked"], "Text should not be masked"
    assert text_res["quality_score"] > 0.8
    assert len(text_res["features"]["embedding"]) == 768
    assert len(text_res["features"]["distress_indicators"]) >= 2
    print("Text extraction PASSED! Token count:", text_res["features"]["token_count"], 
          "Indicators:", text_res["features"]["distress_indicators"])

    # 2. Test Voice/Acoustic
    print("\n2. Testing Voice/Acoustic Service...")
    # Generate 1 second of synthetic 16000Hz speech-like harmonic signal (440Hz + harmonics)
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    harmonic_audio = 0.5 * np.sin(2 * np.pi * 220 * t) + 0.25 * np.sin(2 * np.pi * 440 * t) + 0.1 * np.sin(2 * np.pi * 660 * t)
    harmonic_audio = harmonic_audio.astype(np.float32)
    
    voice_res = model_registry.voice.extract_features(harmonic_audio)
    assert not voice_res["is_masked"], "Voice should not be masked for clear audio"
    assert len(voice_res["features"]["mfcc"]) == 13
    assert voice_res["features"]["f0_mean"] > 150.0
    assert 0.0 <= voice_res["features"]["vocal_instability"] <= 1.0
    print("Voice extraction PASSED! F0 mean:", voice_res["features"]["f0_mean"], 
          "HNR:", voice_res["features"]["hnr"], 
          "Vocal instability:", voice_res["features"]["vocal_instability"])

    # 3. Test Face Analysis
    print("\n3. Testing Face Analysis Service...")
    # Create synthetic frame with synthetic face / circle
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.circle(dummy_frame, (320, 240), 120, (200, 180, 160), -1)
    face_res = model_registry.face.extract_features([dummy_frame])
    assert "action_units" in face_res["features"]
    assert len(face_res["features"]["action_units"]) == 13
    print("Face extraction PASSED! Action units keys:", list(face_res["features"]["action_units"].keys()))

    # 4. Test Gaze / Ocular
    print("\n4. Testing Gaze / Ocular Service...")
    gaze_res = model_registry.gaze.extract_features([dummy_frame])
    assert "gaze_aversion_index" in gaze_res["features"]
    print("Gaze extraction PASSED! Aversion index:", gaze_res["features"]["gaze_aversion_index"])

    # 5. Test rPPG Channel (Isolated)
    print("\n5. Testing rPPG Service...")
    rppg_res = model_registry.rppg.extract_features([dummy_frame] * 30)
    assert rppg_res["is_masked"] is True, "rPPG should be masked when disabled or insufficient"
    assert rppg_res["features"]["heart_rate_bpm"] is None, "Should NEVER fabricate heart rate"
    print("rPPG verification PASSED! Masked correctly without fabrication.")

    # 6. Test Model Registry API status
    print("\n6. Testing /api/models/status API...")
    client = TestClient(app)
    resp = client.get("/api/models/status")
    assert resp.status_code == 200
    status_data = resp.json()
    assert "models" in status_data
    assert "voice" in status_data["models"]
    assert "face" in status_data["models"]
    print("Models status API PASSED! Device:", status_data["device"])

    print("\nALL PHASES 3-7 MODALITY TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all_modality_extractors()
