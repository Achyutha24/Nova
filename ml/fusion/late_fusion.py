import numpy as np
from typing import Dict, Any
from ml.unimodal.baselines import UnimodalBaselines

class LateFusionBaseline:
    def __init__(self, device: str = "cpu"):
        self.baselines = UnimodalBaselines(device=device)
        # Default empirical weights across unimodal channels
        self.weights = {
            "voice": 0.25,
            "face": 0.25,
            "gaze": 0.15,
            "text": 0.30,
            "rppg": 0.05
        }

    def predict(self, aligned_dict: Dict[str, Any]) -> Dict[str, Any]:
        vectors = aligned_dict["vectors"]
        mask = aligned_dict["mask_dict"]

        weighted_sum = 0.0
        total_weight = 0.0

        for mod, vec in vectors.items():
            if mask.get(mod, False):
                res = self.baselines.predict_modality(mod, vec)
                w = self.weights.get(mod, 0.2)
                weighted_sum += res["prediction_score"] * w
                total_weight += w

        final_score = (weighted_sum / max(1e-5, total_weight)) if total_weight > 0 else 0.5
        return {
            "fusion_type": "late_fusion",
            "prediction_score": round(final_score, 4),
            "confidence": round(0.5 + abs(final_score - 0.5), 4),
            "modalities_fused": [k for k, v in mask.items() if v]
        }
