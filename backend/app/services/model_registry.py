import torch
from typing import Dict, Any
from backend.app.core.config import settings
from backend.app.core.logging import logger
from ml.asr.whisper_service import WhisperService
from ml.text.text_service import TextEmbeddingService
from ml.voice.acoustic_service import AcousticFeatureService
from ml.face.face_service import FaceFeatureService
from ml.gaze.gaze_service import OcularFeatureService
from ml.rppg.rppg_service import RPPGService
from ml.fusion.cross_modal_transformer import CrossModalTransformerService
from ml.rl.policy import PPOQuestionPolicyService

class ModelRegistry:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Initializing ModelRegistry on device: {self.device}")
        
        self.asr = WhisperService(model_size=settings.WHISPER_MODEL_SIZE, device=self.device)
        self.text = TextEmbeddingService(model_name=settings.TEXT_MODEL_NAME, device=self.device)
        self.voice = AcousticFeatureService(target_sr=16000)
        self.face = FaceFeatureService()
        self.gaze = OcularFeatureService()
        self.rppg = RPPGService(enabled=settings.RPPG_ENABLED)
        self.fusion = CrossModalTransformerService(d_model=128, device=self.device)
        self.rl = PPOQuestionPolicyService(device=self.device)

    def get_status(self) -> Dict[str, Any]:
        return {
            "device": self.device,
            "models": {
                "asr": {
                    "name": "Whisper",
                    "version": settings.WHISPER_MODEL_SIZE,
                    "loaded": self.asr.is_loaded(),
                    "device": self.device
                },
                "text": {
                    "name": "BERT-family / DistilRoBERTa",
                    "version": settings.TEXT_MODEL_NAME,
                    "loaded": self.text.is_loaded(),
                    "device": self.device
                },
                "voice": {
                    "name": "Acoustic DSP (MFCC/Pitch/Jitter/Shimmer/HNR)",
                    "version": "1.0.0",
                    "loaded": True,
                    "device": "cpu"
                },
                "face": {
                    "name": "MediaPipe FaceMesh",
                    "version": "1.1.0",
                    "loaded": self.face._is_loaded,
                    "device": "cpu"
                },
                "gaze": {
                    "name": "MediaPipe Iris / Ocular",
                    "version": "1.1.0",
                    "loaded": self.gaze._is_loaded,
                    "device": "cpu"
                },
                "rppg": {
                    "name": "Remote Photoplethysmography (Isolated)",
                    "version": "CHROM-1.0",
                    "enabled": self.rppg.enabled,
                    "loaded": self.rppg.enabled,
                    "device": "cpu"
                },
                "fusion": {
                    "name": "Cross-Modal Transformer",
                    "version": "1.0.0",
                    "loaded": self.fusion is not None,
                    "device": self.device
                },
                "rl": {
                    "name": "PPO Adaptive Question Policy",
                    "version": "1.0.0",
                    "loaded": self.rl is not None,
                    "device": self.device
                }
            }
        }

model_registry = ModelRegistry()
