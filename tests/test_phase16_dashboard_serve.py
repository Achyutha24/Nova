import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

def test_dashboard_served_and_endpoints():
    client = TestClient(app)
    
    # 1. Root info endpoint
    root_resp = client.get("/")
    assert root_resp.status_code == 200
    data = root_resp.json()
    assert data["status"] == "operational"
    assert data["dashboard"] == "/dashboard"
    
    # 2. Static dashboard endpoint
    dash_resp = client.get("/dashboard/")
    assert dash_resp.status_code == 200
    assert "<!doctype html>" in dash_resp.text.lower() or "<div id=\"root\">" in dash_resp.text.lower()
    
    # 3. Questions endpoint for dashboard
    q_resp = client.get("/api/questions")
    assert q_resp.status_code == 200
    questions = q_resp.json()
    assert len(questions) == 15
    
    # 4. System health
    health_resp = client.get("/api/system/health")
    assert health_resp.status_code == 200

    health = health_resp.json()
    assert health["status"] == "healthy"
