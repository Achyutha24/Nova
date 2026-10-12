import torch
import torch.nn as nn
import numpy as np
from typing import Dict, Any, Tuple

class UnimodalTaskHead(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)

class UnimodalBaselines:
    def __init__(self, device: str = "cpu"):
        self.device = device
        # Approved input dimensions from preprocessing/normalizer.py
        self.models = {
            "voice": UnimodalTaskHead(input_dim=20, hidden_dim=32).to(device),
            "face": UnimodalTaskHead(input_dim=18, hidden_dim=32).to(device),
            "gaze": UnimodalTaskHead(input_dim=6, hidden_dim=16).to(device),
            "text": UnimodalTaskHead(input_dim=768, hidden_dim=64).to(device),
            "rppg": UnimodalTaskHead(input_dim=4, hidden_dim=16).to(device)
        }
        for m in self.models.values():
            m.eval()

    def predict_modality(self, modality: str, feature_vector: np.ndarray) -> Dict[str, Any]:
        """
        Runs unimodal task head inference on a single modality feature vector.
        """
        if modality not in self.models:
            raise ValueError(f"Unknown modality '{modality}'")

        if feature_vector is None or np.all(feature_vector == 0):
            return {
                "modality": modality,
                "prediction_score": 0.0,
                "confidence": 0.0,
                "is_available": False,
                "model_version": "unimodal-v1.0"
            }

        model = self.models[modality]
        tensor_x = torch.tensor(feature_vector, dtype=torch.float32, device=self.device).unsqueeze(0)
        
        with torch.no_grad():
            logit = model(tensor_x).item()
            prob = float(torch.sigmoid(torch.tensor(logit)).item())
            # Confidence based on distance from decision boundary 0.5
            conf = float(0.5 + abs(prob - 0.5))

        return {
            "modality": modality,
            "prediction_score": round(prob, 4),
            "confidence": round(conf, 4),
            "is_available": True,
            "model_version": "unimodal-v1.0"
        }
