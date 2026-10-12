import numpy as np
from typing import Dict, Any

MODALITIES = ["voice", "face", "gaze", "text", "rppg"]

class MissingModalityMasker:
    QUALITY_THRESHOLD = 0.40

    @classmethod
    def compute_mask(cls, qualities: Dict[str, float], explicit_masked: Dict[str, bool]) -> np.ndarray:
        """
        Computes binary modality mask m in {0, 1}^M for [voice, face, gaze, text, rppg].
        m_i = 1 if modality is present, unmasked, and quality >= 0.40; otherwise 0.
        """
        mask = np.zeros(len(MODALITIES), dtype=np.float32)
        for i, mod in enumerate(MODALITIES):
            q = qualities.get(mod, 0.0) or 0.0
            is_m = explicit_masked.get(mod, False)
            if not is_m and q >= cls.QUALITY_THRESHOLD:
                mask[i] = 1.0
            else:
                mask[i] = 0.0
        return mask

    @classmethod
    def to_mask_dict(cls, mask_vector: np.ndarray) -> Dict[str, bool]:
        return {mod: bool(mask_vector[i] > 0.5) for i, mod in enumerate(MODALITIES)}
