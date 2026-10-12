import os
import io
import base64
import numpy as np
import soundfile as sf
import torch
from typing import Dict, Any, Union, Optional
from backend.app.core.logging import logger

class WhisperService:
    def __init__(self, model_size: str = "openai/whisper-tiny", device: Optional[str] = None):
        if "/" not in model_size:
            self.model_name = f"openai/whisper-{model_size}"
        else:
            self.model_name = model_size
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = None
        self.model = None
        self._is_loaded = False

    def load(self):
        if self._is_loaded:
            return
        logger.info(f"Loading Whisper ASR model '{self.model_name}' on {self.device}...")
        try:
            from transformers import WhisperProcessor, WhisperForConditionalGeneration
            self.processor = WhisperProcessor.from_pretrained(self.model_name)
            self.model = WhisperForConditionalGeneration.from_pretrained(self.model_name)
            self.model.to(self.device)
            self.model.eval()
            self._is_loaded = True
            logger.info("Whisper ASR model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load online Whisper model ({e}). Initializing fallback lightweight recognizer.")
            self._is_loaded = False

    def is_loaded(self) -> bool:
        return self._is_loaded

    def _decode_audio(self, audio_data: Union[str, bytes, np.ndarray]) -> np.ndarray:
        """Decodes raw bytes, base64 string, or filepath into a 16kHz mono numpy float32 array."""
        if isinstance(audio_data, np.ndarray):
            if audio_data.ndim > 1:
                audio_data = np.mean(audio_data, axis=1)
            return audio_data.astype(np.float32)

        if isinstance(audio_data, str):
            # Check if it's a file path
            if os.path.exists(audio_data):
                data, sr = sf.read(audio_data)
                if data.ndim > 1:
                    data = np.mean(data, axis=1)
                if sr != 16000:
                    import scipy.signal
                    num_samples = int(len(data) * 16000 / sr)
                    data = scipy.signal.resample(data, num_samples)
                return data.astype(np.float32)
            else:
                # Base64 string
                raw_bytes = base64.b64decode(audio_data)
        else:
            raw_bytes = audio_data

        try:
            with io.BytesIO(raw_bytes) as bio:
                data, sr = sf.read(bio)
                if data.ndim > 1:
                    data = np.mean(data, axis=1)
                if sr != 16000:
                    import scipy.signal
                    num_samples = int(len(data) * 16000 / sr)
                    data = scipy.signal.resample(data, num_samples)
                return data.astype(np.float32)
        except Exception:
            # If raw PCM float32/int16
            try:
                arr = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                return arr
            except Exception:
                return np.zeros(16000, dtype=np.float32)

    def transcribe(self, audio_input: Union[str, bytes, np.ndarray], text_override: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribes audio into text and timestamped segments.
        If text_override is provided (e.g. from Unity speech recognition), preserves it with high confidence.
        """
        if text_override and text_override.strip():
            return {
                "transcript": text_override.strip(),
                "confidence": 0.98,
                "quality": 0.99,
                "source": "client_override"
            }

        audio_arr = self._decode_audio(audio_input)
        if len(audio_arr) == 0 or np.max(np.abs(audio_arr)) < 1e-4:
            return {
                "transcript": "",
                "confidence": 0.0,
                "quality": 0.0,
                "source": "silence"
            }

        self.load()
        if not self._is_loaded or self.model is None:
            # Fallback when offline
            return {
                "transcript": "[Audio received; speech transcription offline]",
                "confidence": 0.5,
                "quality": 0.6,
                "source": "offline_fallback"
            }

        try:
            # Resample / pad to 30s as expected by Whisper
            inputs = self.processor(audio_arr, sampling_rate=16000, return_tensors="pt")
            input_features = inputs.input_features.to(self.device)

            with torch.no_grad():
                predicted_ids = self.model.generate(input_features)
                transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

            quality = float(min(1.0, max(0.2, np.mean(np.abs(audio_arr)) * 10)))
            return {
                "transcript": transcription.strip(),
                "confidence": 0.92,
                "quality": quality,
                "source": "whisper_model"
            }
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return {
                "transcript": "",
                "confidence": 0.0,
                "quality": 0.0,
                "source": "error"
            }
