from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class AudioFeatures(BaseModel):
    mfcc: List[float] = Field(default_factory=list, description="Mean MFCC coefficients (13-dim)")
    f0_mean: float = Field(0.0, description="Mean fundamental frequency (pitch) in Hz")
    f0_std: float = Field(0.0, description="Pitch standard deviation")
    jitter: float = Field(0.0, description="Cycle-to-cycle pitch perturbation (local jitter)")
    shimmer: float = Field(0.0, description="Cycle-to-cycle amplitude perturbation (local shimmer)")
    hnr: float = Field(0.0, description="Harmonics-to-Noise Ratio in dB")
    spectral_centroid: float = 0.0
    zero_crossing_rate: float = 0.0

class FaceFeatures(BaseModel):
    # Action Units: 13 key units
    action_units: Dict[str, float] = Field(
        default_factory=lambda: {
            "AU01": 0.0, "AU02": 0.0, "AU04": 0.0, "AU06": 0.0, "AU07": 0.0,
            "AU12": 0.0, "AU14": 0.0, "AU15": 0.0, "AU17": 0.0, "AU20": 0.0,
            "AU23": 0.0, "AU25": 0.0, "AU26": 0.0
        }
    )
    head_pose_pitch: float = 0.0
    head_pose_yaw: float = 0.0
    head_pose_roll: float = 0.0
    expressivity_index: float = 0.0
    au_distress_activation: float = 0.0  # composite AU04 + AU07

class GazeFeatures(BaseModel):
    gaze_pitch: float = 0.0
    gaze_yaw: float = 0.0
    gaze_aversion_index: float = 0.0  # [0.0, 1.0] deviation from central avatar fixation
    eye_aspect_ratio: float = 0.0    # EAR for blink detection
    blink_rate_bpm: float = 0.0
    pupil_dilation_variation: float = 0.0

class TextFeatures(BaseModel):
    token_count: int = 0
    embedding_norm: float = 0.0
    sentiment_score: Optional[float] = None
    distress_indicators: List[str] = Field(default_factory=list)

class RPPGFeatures(BaseModel):
    heart_rate_bpm: Optional[float] = None
    hrv_rmssd: Optional[float] = None
    hrv_sdnn: Optional[float] = None
    snr_db: Optional[float] = None
    signal_quality: float = 0.0  # [0.0, 1.0]

class ModalityQuality(BaseModel):
    face: Optional[float] = None
    gaze: Optional[float] = None
    voice: Optional[float] = None
    text: Optional[float] = None
    rppg: Optional[float] = None

class ModalityMasks(BaseModel):
    face: bool = False
    gaze: bool = False
    voice: bool = False
    text: bool = False
    rppg: bool = False

class BiomarkersSummary(BaseModel):
    gaze_aversion_index: float = 0.0
    vocal_instability: float = 0.0
    facial_au_activation: float = 0.0
    hr_bpm: Optional[float] = None
    hrv_rmssd: Optional[float] = None
