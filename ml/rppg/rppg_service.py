import os
import cv2
import numpy as np
from typing import Dict, Any, List, Optional
from backend.app.core.config import settings
from backend.app.core.logging import logger

class RPPGService:
    def __init__(self, enabled: bool = settings.RPPG_ENABLED):
        self.enabled = enabled

    def extract_features(self, frames_input: Optional[List[Any]]) -> Dict[str, Any]:
        """
        Extracts contactless heart rate (HR) and heart rate variability (HRV) from video frames.
        Strictly guarded: if disabled or signal quality fails checks, returns null values and masks modality.
        Never fabricates physiological measurements.
        """
        if not self.enabled:
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "rppg_available": False,
                "reason": "disabled_by_feature_flag",
                "features": {
                    "heart_rate_bpm": None,
                    "hrv_rmssd": None,
                    "hrv_sdnn": None,
                    "snr_db": None,
                    "signal_quality": 0.0
                }
            }

        if not frames_input or len(frames_input) < 60:
            # Need at least 2 seconds (~60 frames) for any physiological estimation
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "rppg_available": False,
                "reason": "insufficient_frame_duration",
                "features": {
                    "heart_rate_bpm": None,
                    "hrv_rmssd": None,
                    "hrv_sdnn": None,
                    "snr_db": None,
                    "signal_quality": 0.0
                }
            }

        try:
            # Spatial ROI color extraction (forehead / cheek regions)
            # CHROM / Green channel intensity over time
            g_means = []
            r_means = []
            b_means = []

            for f in frames_input:
                if isinstance(f, np.ndarray):
                    img = f
                else:
                    continue
                # Simple central forehead ROI
                h, w, _ = img.shape
                roi = img[int(h*0.2):int(h*0.4), int(w*0.35):int(w*0.65)]
                if roi.size == 0:
                    continue
                b_means.append(np.mean(roi[:, :, 0]))
                g_means.append(np.mean(roi[:, :, 1]))
                r_means.append(np.mean(roi[:, :, 2]))

            if len(g_means) < 60:
                return {
                    "quality_score": 0.0,
                    "is_masked": True,
                    "rppg_available": False,
                    "reason": "poor_roi_extraction",
                    "features": {
                        "heart_rate_bpm": None,
                        "hrv_rmssd": None,
                        "hrv_sdnn": None,
                        "snr_db": None,
                        "signal_quality": 0.0
                    }
                }

            # CHROM chrominance pulse signal
            fps = 30.0
            r_sig = np.array(r_means)
            g_sig = np.array(g_means)
            b_sig = np.array(b_means)

            # Normalization
            r_norm = r_sig / (np.mean(r_sig) + 1e-6)
            g_norm = g_sig / (np.mean(g_sig) + 1e-6)
            b_norm = b_sig / (np.mean(b_sig) + 1e-6)

            xs = 3.0 * r_norm - 2.0 * g_norm
            ys = 1.5 * r_norm + g_norm - 1.5 * b_norm
            alpha = np.std(xs) / (np.std(ys) + 1e-6)
            bvp = xs - alpha * ys

            # Bandpass filter between 0.7 Hz (42 BPM) and 3.5 Hz (210 BPM)
            import scipy.signal
            b_filt, a_filt = scipy.signal.butter(2, [0.7 / (fps / 2.0), 3.5 / (fps / 2.0)], btype="bandpass")
            bvp_filtered = scipy.signal.filtfilt(b_filt, a_filt, bvp)

            # FFT power spectrum to calculate HR and SNR
            freqs = np.fft.rfftfreq(len(bvp_filtered), d=1.0/fps)
            fft_mag = np.abs(np.fft.rfft(bvp_filtered))
            valid_idx = np.where((freqs >= 0.7) & (freqs <= 3.5))[0]
            
            if len(valid_idx) == 0:
                raise ValueError("No valid frequency bins in physiological band")

            peak_bin = valid_idx[np.argmax(fft_mag[valid_idx])]
            peak_freq = freqs[peak_bin]
            peak_power = fft_mag[peak_bin] ** 2
            total_power = np.sum(fft_mag[valid_idx] ** 2)
            snr = peak_power / (total_power - peak_power + 1e-6)
            snr_db = 10.0 * np.log10(max(1e-4, snr))

            # Quality validation check: SNR must exceed minimum threshold
            if snr_db < 2.0:
                # Poor physiological signal
                return {
                    "quality_score": 0.25,
                    "is_masked": True,
                    "rppg_available": False,
                    "reason": "low_signal_to_noise_ratio",
                    "features": {
                        "heart_rate_bpm": None,
                        "hrv_rmssd": None,
                        "hrv_sdnn": None,
                        "snr_db": round(float(snr_db), 2),
                        "signal_quality": 0.25
                    }
                }

            hr_bpm = float(peak_freq * 60.0)
            # Find peaks for HRV RMSSD
            peaks, _ = scipy.signal.find_peaks(bvp_filtered, distance=int(fps * 0.4))
            if len(peaks) > 3:
                ibi_ms = np.diff(peaks) * (1000.0 / fps)
                rmssd = float(np.sqrt(np.mean(np.diff(ibi_ms) ** 2)))
                sdnn = float(np.std(ibi_ms))
            else:
                rmssd = None
                sdnn = None

            return {
                "quality_score": round(min(1.0, max(0.5, (snr_db + 2.0) / 10.0)), 3),
                "is_masked": False,
                "rppg_available": True,
                "reason": "validated",
                "features": {
                    "heart_rate_bpm": round(hr_bpm, 1),
                    "hrv_rmssd": round(rmssd, 1) if rmssd else None,
                    "hrv_sdnn": round(sdnn, 1) if sdnn else None,
                    "snr_db": round(float(snr_db), 2),
                    "signal_quality": round(min(1.0, max(0.5, (snr_db + 2.0) / 10.0)), 3)
                }
            }
        except Exception as e:
            logger.debug(f"rPPG processing failed: {e}")
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "rppg_available": False,
                "reason": f"processing_error: {str(e)}",
                "features": {
                    "heart_rate_bpm": None,
                    "hrv_rmssd": None,
                    "hrv_sdnn": None,
                    "snr_db": None,
                    "signal_quality": 0.0
                }
            }
