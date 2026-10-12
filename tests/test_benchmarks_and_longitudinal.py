import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from research.longitudinal import LongitudinalAnalyzer
from evaluation.benchmark_runner import BenchmarkRunner


def test_longitudinal_tracker_and_benchmarks():
    client = TestClient(app)
    
    # 1. Test Benchmark Runner
    runner = BenchmarkRunner()
    results = runner.run_and_persist_all_benchmarks()
    
    assert "unimodal_baselines" in results
    assert "ablation_study_e0_e4" in results
    assert "fusion_architectures" in results
    assert "reinforcement_learning" in results
    
    # Verify Cross-Modal Transformer is evaluated
    assert "Cross-Modal Transformer (Primary)" in results["fusion_architectures"]
    cmt = results["fusion_architectures"]["Cross-Modal Transformer (Primary)"]
    assert cmt["auroc"] >= 0.70
    assert cmt["f1"] >= 0.70

    
    # Verify PPO evaluation
    assert "PPO_Adaptive_Questioning" in results["reinforcement_learning"]
    ppo = results["reinforcement_learning"]["PPO_Adaptive_Questioning"]
    assert isinstance(ppo["mean_cumulative_reward"], (int, float))
    assert ppo["topic_coverage_rate"] >= 0.0

    
    # 2. Test Experiments API Endpoints
    exp_get = client.get("/api/experiments")
    assert exp_get.status_code == 200
    exp_data = exp_get.json()
    assert exp_data["status"] == "evaluated"
    assert "active_run" in exp_data
    
    # 3. Test Longitudinal API Endpoint
    # Ensure participant exists
    client.post("/api/participants/", json={"participant_id": "PART-LONG-TEST", "name": "Longitudinal Test Participant"})
    long_res = client.get("/api/participants/PART-LONG-TEST/longitudinal")
    assert long_res.status_code == 200
    long_data = long_res.json()
    assert long_data["participant_id"] == "PART-LONG-TEST"
    assert "sessions" in long_data
    assert "total_sessions" in long_data


