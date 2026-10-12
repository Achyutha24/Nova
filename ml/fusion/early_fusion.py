import torch
import torch.nn as nn
import numpy as np
from typing import Dict, Any

class EarlyFusionMLP(nn.Module):
    def __init__(self, total_dim: int = 20 + 18 + 6 + 768 + 4, hidden_dim: int = 128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(total_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.net(x)).squeeze(-1)

class EarlyFusionBaseline:
    def __init__(self, device: str = "cpu"):
        self.device = device
        self.model = EarlyFusionMLP().to(device)
        self.model.eval()

    def predict(self, aligned_dict: Dict[str, Any]) -> Dict[str, Any]:
        vectors = aligned_dict["vectors"]
        concat = np.concatenate([
            vectors["voice"],
            vectors["face"],
            vectors["gaze"],
            vectors["text"],
            vectors["rppg"]
        ])
        t_x = torch.tensor(concat, dtype=torch.float32, device=self.device).unsqueeze(0)
        with torch.no_grad():
            score = float(self.model(t_x).item())
        return {
            "fusion_type": "early_fusion",
            "prediction_score": round(score, 4),
            "confidence": round(0.5 + abs(score - 0.5), 4)
        }
