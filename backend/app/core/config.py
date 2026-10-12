import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "NOVA Multimodal Research Platform"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Storage & Database
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    DATABASE_URL: str = f"sqlite:///{os.path.join(DATA_DIR, 'nova_research.db')}"
    
    # Models & Checkpoints
    MODELS_DIR: str = os.path.join(BASE_DIR, "models")
    TEXT_MODEL_NAME: str = "distilbert/distilroberta-base"
    WHISPER_MODEL_SIZE: str = "openai/whisper-tiny"
    
    # Modality Flags
    RPPG_ENABLED: bool = False  # Isolated optional physiological channel
    
    # RL Settings
    MAX_TURNS_PER_SESSION: int = 15
    QUESTION_BUDGET: int = 10
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "*"
    ]

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.MODELS_DIR, exist_ok=True)
