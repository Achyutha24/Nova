import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.database.database import get_db
from backend.app.database import models
from evaluation.benchmark_runner import BenchmarkRunner

router = APIRouter(prefix="/experiments", tags=["Experiments"])

@router.get("")
def list_experiments(db: Session = Depends(get_db)):
    runs = db.query(models.ExperimentRun).order_by(models.ExperimentRun.timestamp.desc()).all()
    if not runs:
        # If not yet executed, run benchmark runner once to establish reproducible reference
        runner = BenchmarkRunner()
        results = runner.run_and_persist_all_benchmarks()
        return {
            "status": "evaluated",
            "active_run": results,
            "all_runs": [results]
        }
    
    results = []
    for r in runs:
        results.append({
            "id": r.id,
            "experiment_name": r.experiment_name,
            "architecture": r.architecture,
            "modalities_used": r.modalities_used,
            "dataset_version": r.dataset_version,
            "timestamp": r.timestamp,
            "metrics": json.loads(r.metrics_json)
        })
    return {
        "status": "evaluated",
        "active_run": results[0]["metrics"] if results else None,
        "all_runs": results
    }

@router.post("/run")
def trigger_benchmark_run():
    runner = BenchmarkRunner()
    results = runner.run_and_persist_all_benchmarks()
    return {
        "message": "Benchmark run completed successfully",
        "results": results
    }
