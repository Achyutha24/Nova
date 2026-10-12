import numpy as np
from typing import Dict, Any, List

# Standard benchmark reference statistics derived from multimodal affective computing benchmarks
NORM_STATS = {
    "f0_mean": {"mean": 180.0, "std": 50.0},
    "jitter": {"mean": 0.02, "std": 0.015},
    "shimmer": {"mean": 0.05, "std": 0.03},
    "hnr": {"mean": 15.0, "std": 6.0},
    "spectral_centroid": {"mean": 2000.0, "std": 800.0},
    "zero_crossing_rate": {"mean": 0.08, "std": 0.04},
    "blink_rate_bpm": {"mean": 20.0, "std": 10.0},
    "hr_bpm": {"mean": 75.0, "std": 12.0},
    "hrv_rmssd": {"mean": 35.0, "std": 15.0}
}

class MultimodalNormalizer:
    @staticmethod
    def normalize_voice(features: Dict[str, Any]) -> np.ndarray:
        """Projects voice features into a normalized 20-dim feature vector."""
        mfcc = features.get("mfcc", [0.0] * 13)
        if len(mfcc) < 13:
            mfcc = mfcc + [0.0] * (13 - len(mfcc))
        mfcc_norm = np.array(mfcc[:13], dtype=np.float32) / 100.0  # approximate scale

        f0_m = (features.get("f0_mean", 0.0) - NORM_STATS["f0_mean"]["mean"]) / NORM_STATS["f0_mean"]["std"]
        f0_s = features.get("f0_std", 0.0) / 30.0
        jit = (features.get("jitter", 0.0) - NORM_STATS["jitter"]["mean"]) / NORM_STATS["jitter"]["std"]
        shim = (features.get("shimmer", 0.0) - NORM_STATS["shimmer"]["mean"]) / NORM_STATS["shimmer"]["std"]
        hnr = (features.get("hnr", 0.0) - NORM_STATS["hnr"]["mean"]) / NORM_STATS["hnr"]["std"]
        sc = (features.get("spectral_centroid", 0.0) - NORM_STATS["spectral_centroid"]["mean"]) / NORM_STATS["spectral_centroid"]["std"]
        zcr = (features.get("zero_crossing_rate", 0.0) - NORM_STATS["zero_crossing_rate"]["mean"]) / NORM_STATS["zero_crossing_rate"]["std"]

        scalars = np.array([f0_m, f0_s, jit, shim, hnr, sc, zcr], dtype=np.float32)
        vec = np.concatenate([mfcc_norm, scalars])
        return np.clip(vec, -5.0, 5.0)

    @staticmethod
    def normalize_face(features: Dict[str, Any]) -> np.ndarray:
        """Projects face features into a normalized 18-dim feature vector."""
        aus = features.get("action_units", {})
        au_keys = [f"AU{i:02d}" for i in [1, 2, 4, 6, 7, 12, 14, 15, 17, 20, 23, 25, 26]]
        au_vec = np.array([aus.get(k, 0.0) for k in au_keys], dtype=np.float32)  # already [0, 1]

        pitch = features.get("head_pose_pitch", 0.0)
        yaw = features.get("head_pose_yaw", 0.0)
        roll = features.get("head_pose_roll", 0.0)
        exp = features.get("expressivity_index", 0.0)
        dist = features.get("au_distress_activation", 0.0)

        pose_vec = np.array([pitch, yaw, roll, exp, dist], dtype=np.float32)
        return np.concatenate([au_vec, pose_vec])

    @staticmethod
    def normalize_gaze(features: Dict[str, Any]) -> np.ndarray:
        """Projects gaze features into a normalized 6-dim feature vector."""
        pitch = features.get("gaze_pitch", 0.0)
        yaw = features.get("gaze_yaw", 0.0)
        av = features.get("gaze_aversion_index", 0.0)
        ear = features.get("eye_aspect_ratio", 0.0)
        br = (features.get("blink_rate_bpm", 20.0) - NORM_STATS["blink_rate_bpm"]["mean"]) / NORM_STATS["blink_rate_bpm"]["std"]
        pup = features.get("pupil_dilation_variation", 0.0)

        return np.array([pitch, yaw, av, ear, br, pup], dtype=np.float32)

    @staticmethod
    def normalize_text(features: Dict[str, Any]) -> np.ndarray:
        """Extracts 768-dim text embedding vector."""
        emb = features.get("embedding", [0.0] * 768)
        if len(emb) < 768:
            emb = emb + [0.0] * (768 - len(emb))
        return np.array(emb[:768], dtype=np.float32)

    @staticmethod
    def normalize_rppg(features: Dict[str, Any]) -> np.ndarray:
        """Projects rPPG features into a 4-dim feature vector. Returns zeros if unavailable."""
        hr = features.get("heart_rate_bpm")
        rmssd = features.get("hrv_rmssd")
        sdnn = features.get("hrv_sdnn")
        snr = features.get("snr_db")

        if hr is None:
            return np.zeros(4, dtype=np.float32)

        hr_norm = (hr - NORM_STATS["hr_bpm"]["mean"]) / NORM_STATS["hr_bpm"]["std"]
        rmssd_norm = ((rmssd or 35.0) - NORM_STATS["hrv_rmssd"]["mean"]) / NORM_STATS["hrv_rmssd"]["std"]
        sdnn_norm = ((sdnn or 40.0) - 40.0) / 20.0
        snr_norm = (snr or 5.0) / 10.0

        return np.array([hr_norm, rmssd_norm, sdnn_norm, snr_norm], dtype=np.float32)
