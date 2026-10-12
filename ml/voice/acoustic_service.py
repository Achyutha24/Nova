import os
import io
import base64
import numpy as np
import scipy.signal
import soundfile as sf
import librosa
from typing import Dict, Any, Union, Optional
from backend.app.core.logging import logger

class AcousticFeatureService:
    def __init__(self, target_sr: int = 16000, n_mfcc: int = 13):
        self.target_sr = target_sr
        self.n_mfcc = n_mfcc

    def _decode_audio(self, audio_data: Union[str, bytes, np.ndarray]) -> np.ndarray:
        if isinstance(audio_data, np.ndarray):
            if audio_data.ndim > 1:
                audio_data = np.mean(audio_data, axis=1)
            return audio_data.astype(np.float32)

        if isinstance(audio_data, str):
            if os.path.exists(audio_data):
                y, sr = librosa.load(audio_data, sr=self.target_sr, mono=True)
                return y.astype(np.float32)
            else:
                raw_bytes = base64.b64decode(audio_data)
        else:
            raw_bytes = audio_data

        try:
            with io.BytesIO(raw_bytes) as bio:
                data, sr = sf.read(bio)
                if data.ndim > 1:
                    data = np.mean(data, axis=1)
                if sr != self.target_sr:
                    num_samples = int(len(data) * self.target_sr / sr)
                    data = scipy.signal.resample(data, num_samples)
                return data.astype(np.float32)
        except Exception:
            try:
                arr = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                return arr
            except Exception:
                return np.zeros(self.target_sr, dtype=np.float32)

    def extract_features(self, audio_input: Union[str, bytes, np.ndarray]) -> Dict[str, Any]:
        """
        Extracts vocal biomarkers: MFCC, pitch (F0), jitter, shimmer, HNR, and vocal instability composite.
        """
        y = self._decode_audio(audio_input)
        if len(y) < self.target_sr * 0.1 or np.max(np.abs(y)) < 1e-4:
            # Insufficient audio / silence
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "mfcc": [0.0] * self.n_mfcc,
                    "f0_mean": 0.0,
                    "f0_std": 0.0,
                    "jitter": 0.0,
                    "shimmer": 0.0,
                    "hnr": 0.0,
                    "spectral_centroid": 0.0,
                    "zero_crossing_rate": 0.0,
                    "vocal_instability": 0.0
                }
            }

        try:
            # 1. MFCC
            mfcc_mat = librosa.feature.mfcc(y=y, sr=self.target_sr, n_mfcc=self.n_mfcc)
            mfcc_mean = [float(x) for x in np.mean(mfcc_mat, axis=1)]

            # 2. Pitch / F0 via probabilistic YIN / pyin
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=self.target_sr
            )
            valid_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])
            
            if len(valid_f0) > 2:
                f0_mean = float(np.mean(valid_f0))
                f0_std = float(np.std(valid_f0))
                # Jitter (Relative cycle-to-cycle perturbation of pitch periods)
                periods = 1.0 / np.maximum(valid_f0, 1.0)
                period_diffs = np.abs(np.diff(periods))
                jitter = float(np.mean(period_diffs) / max(1e-6, np.mean(periods)))
            else:
                f0_mean = 0.0
                f0_std = 0.0
                jitter = 0.0

            # 3. Shimmer (Cycle-to-cycle amplitude perturbation)
            frame_length = 512
            hop_length = 256
            rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
            if len(rms) > 2 and np.mean(rms) > 1e-5:
                rms_diffs = np.abs(np.diff(rms))
                shimmer = float(np.mean(rms_diffs) / max(1e-6, np.mean(rms)))
            else:
                shimmer = 0.0

            # 4. Harmonics-to-Noise Ratio (HNR) via harmonic-percussive separation
            y_harm, y_perc = librosa.effects.hpss(y)
            harm_energy = np.sum(y_harm ** 2)
            noise_energy = max(1e-7, np.sum(y_perc ** 2))
            hnr = float(10.0 * np.log10(max(1e-5, harm_energy / noise_energy)))

            # 5. Spectral Centroid & ZCR
            cent = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=self.target_sr)))
            zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))

            # 6. Composite Vocal Instability Index [0.0, 1.0]
            # Higher jitter and shimmer and lower HNR correlate with vocal instability
            norm_jitter = min(1.0, jitter * 15.0)
            norm_shimmer = min(1.0, shimmer * 8.0)
            norm_hnr_inv = min(1.0, max(0.0, (20.0 - hnr) / 20.0))
            vocal_instability = float(0.4 * norm_jitter + 0.3 * norm_shimmer + 0.3 * norm_hnr_inv)

            # Quality validation
            snr = harm_energy / (noise_energy + 1e-6)
            quality_score = float(min(1.0, max(0.3, 0.5 + 0.5 * (snr / (snr + 1.0)))))
            is_masked = quality_score < 0.40 or len(valid_f0) == 0

            return {
                "quality_score": round(quality_score, 3),
                "is_masked": is_masked,
                "features": {
                    "mfcc": [round(c, 4) for c in mfcc_mean],
                    "f0_mean": round(f0_mean, 2),
                    "f0_std": round(f0_std, 2),
                    "jitter": round(jitter, 5),
                    "shimmer": round(shimmer, 5),
                    "hnr": round(hnr, 2),
                    "spectral_centroid": round(cent, 2),
                    "zero_crossing_rate": round(zcr, 4),
                    "vocal_instability": round(vocal_instability, 3)
                }
            }
        except Exception as e:
            logger.error(f"Error extracting acoustic features: {e}")
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "mfcc": [0.0] * self.n_mfcc,
                    "f0_mean": 0.0,
                    "f0_std": 0.0,
                    "jitter": 0.0,
                    "shimmer": 0.0,
                    "hnr": 0.0,
                    "spectral_centroid": 0.0,
                    "zero_crossing_rate": 0.0,
                    "vocal_instability": 0.0
                }
            }
