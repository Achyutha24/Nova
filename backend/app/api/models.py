from fastapi import APIRouter
from backend.app.services.model_registry import model_registry

router = APIRouter(prefix="/models", tags=["Models"])

@router.get("/status")
def get_model_status():
    return model_registry.get_status()
