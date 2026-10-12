import numpy as np
from typing import Dict, Any
from preprocessing.normalizer import MultimodalNormalizer
from preprocessing.masker import MissingModalityMasker, MODALITIES

class TemporalTurnAligner:
    """
    Synchronizes and packs extracted turn features into a standardized aligned tensor dictionary.
    """
    @staticmethod
    def align_turn_modalities(
        turn_index: int,
        voice_res: Dict[str, Any],
        face_res: Dict[str, Any],
        gaze_res: Dict[str, Any],
        text_res: Dict[str, Any],
        rppg_res: Dict[str, Any]
    ) -> Dict[str, Any]:
        # 1. Normalize feature vectors
        v_vec = MultimodalNormalizer.normalize_voice(voice_res.get("features", {}))
        f_vec = MultimodalNormalizer.normalize_face(face_res.get("features", {}))
        g_vec = MultimodalNormalizer.normalize_gaze(gaze_res.get("features", {}))
        t_vec = MultimodalNormalizer.normalize_text(text_res.get("features", {}))
        r_vec = MultimodalNormalizer.normalize_rppg(rppg_res.get("features", {}))

        # 2. Extract quality and explicit masked states
        qualities = {
            "voice": voice_res.get("quality_score", 0.0),
            "face": face_res.get("quality_score", 0.0),
            "gaze": gaze_res.get("quality_score", 0.0),
            "text": text_res.get("quality_score", 0.0),
            "rppg": rppg_res.get("quality_score", 0.0)
        }

        explicit_masks = {
            "voice": voice_res.get("is_masked", False),
            "face": face_res.get("is_masked", False),
            "gaze": gaze_res.get("is_masked", False),
            "text": text_res.get("is_masked", False),
            "rppg": rppg_res.get("is_masked", True)
        }

        # 3. Compute explicit binary mask
        mask_vec = MissingModalityMasker.compute_mask(qualities, explicit_masks)

        # Zero out features if modality is masked (never fabricate)
        if mask_vec[0] == 0: v_vec = np.zeros_like(v_vec)
        if mask_vec[1] == 0: f_vec = np.zeros_like(f_vec)
        if mask_vec[2] == 0: g_vec = np.zeros_like(g_vec)
        if mask_vec[3] == 0: t_vec = np.zeros_like(t_vec)
        if mask_vec[4] == 0: r_vec = np.zeros_like(r_vec)

        return {
            "turn_index": turn_index,
            "vectors": {
                "voice": v_vec,
                "face": f_vec,
                "gaze": g_vec,
                "text": t_vec,
                "rppg": r_vec
            },
            "qualities": qualities,
            "mask_vector": mask_vec,
            "mask_dict": MissingModalityMasker.to_mask_dict(mask_vec)
        }
