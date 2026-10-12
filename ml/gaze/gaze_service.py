import os
import io
import base64
import numpy as np
import cv2
from typing import Dict, Any, Union, List, Optional
from backend.app.core.logging import logger

MODEL_TASK_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "face_landmarker.task"))

class OcularFeatureService:
    def __init__(self, model_path: str = MODEL_TASK_PATH):
        self.model_path = model_path
        self.detector = None
        self._is_loaded = False
        self._init_detector()

    def _init_detector(self):
        try:
            import mediapipe as mp
            from mediapipe.tasks.python import vision
            from mediapipe.tasks import python

            if not os.path.exists(self.model_path):
                logger.warning(f"Face landmarker model task file not found at {self.model_path}")
                return

            base_options = python.BaseOptions(model_asset_path=self.model_path)
            options = vision.FaceLandmarkerOptions(
                base_options=base_options,
                output_face_blendshapes=True,
                output_facial_transformation_matrixes=True,
                num_faces=1
            )
            self.detector = vision.FaceLandmarker.create_from_options(options)
            self._is_loaded = True
            logger.info("MediaPipe Ocular/Iris FaceLandmarker successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe Ocular detector: {e}")
            self._is_loaded = False

    def _decode_frame(self, frame_input: Union[str, bytes, np.ndarray]) -> Optional[np.ndarray]:
        if isinstance(frame_input, np.ndarray):
            return frame_input
        if isinstance(frame_input, str):
            if os.path.exists(frame_input):
                return cv2.imread(frame_input)
            else:
                raw_bytes = base64.b64decode(frame_input)
        else:
            raw_bytes = frame_input

        try:
            nparr = np.frombuffer(raw_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception:
            return None

    def extract_features(self, frames_input: Union[List[Any], Any]) -> Dict[str, Any]:
        """
        Extracts ocular biomarkers: gaze direction (yaw, pitch), gaze aversion index,
        eye aspect ratio (EAR), blink rate estimate, and pupil variation.
        """
        if not isinstance(frames_input, list):
            frames = [frames_input]
        else:
            frames = frames_input

        if not frames or not self._is_loaded or self.detector is None:
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "gaze_pitch": 0.0,
                    "gaze_yaw": 0.0,
                    "gaze_aversion_index": 0.0,
                    "eye_aspect_ratio": 0.0,
                    "blink_rate_bpm": 0.0,
                    "pupil_dilation_variation": 0.0
                }
            }

        import mediapipe as mp

        gaze_yaws = []
        gaze_pitches = []
        blink_scores = []
        valid_frames_count = 0

        for frame_raw in frames:
            img_bgr = self._decode_frame(frame_raw)
            if img_bgr is None:
                continue

            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

            try:
                result = self.detector.detect(mp_image)
                if result.face_blendshapes and len(result.face_blendshapes) > 0:
                    valid_frames_count += 1
                    bs = {category.category_name: category.score for category in result.face_blendshapes[0]}

                    # Ocular look directions
                    in_l = bs.get("eyeLookInLeft", 0.0)
                    out_l = bs.get("eyeLookOutLeft", 0.0)
                    up_l = bs.get("eyeLookUpLeft", 0.0)
                    down_l = bs.get("eyeLookDownLeft", 0.0)

                    in_r = bs.get("eyeLookInRight", 0.0)
                    out_r = bs.get("eyeLookOutRight", 0.0)
                    up_r = bs.get("eyeLookUpRight", 0.0)
                    down_r = bs.get("eyeLookDownRight", 0.0)

                    # Yaw: negative is looking right, positive is looking left
                    yaw = ((out_l - in_l) + (in_r - out_r)) / 2.0
                    # Pitch: positive is up, negative is down
                    pitch = ((up_l - down_l) + (up_r - down_r)) / 2.0

                    gaze_yaws.append(yaw)
                    gaze_pitches.append(pitch)

                    # Blink score: higher means eye is closed
                    blink_score = (bs.get("eyeBlinkLeft", 0.0) + bs.get("eyeBlinkRight", 0.0)) / 2.0
                    blink_scores.append(blink_score)
            except Exception as e:
                logger.debug(f"Frame gaze processing error: {e}")
                continue

        if valid_frames_count == 0 or len(gaze_yaws) == 0:
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "gaze_pitch": 0.0,
                    "gaze_yaw": 0.0,
                    "gaze_aversion_index": 0.0,
                    "eye_aspect_ratio": 0.0,
                    "blink_rate_bpm": 0.0,
                    "pupil_dilation_variation": 0.0
                }
            }

        mean_yaw = float(np.mean(gaze_yaws))
        mean_pitch = float(np.mean(gaze_pitches))

        # Gaze Aversion Index: normalized Euclidean distance from center (avatar gaze fixation)
        # Offset > 0.35 indicates looking away from the virtual interviewer
        raw_aversion = np.sqrt(mean_yaw ** 2 + mean_pitch ** 2)
        gaze_aversion_index = float(min(1.0, max(0.0, raw_aversion * 1.8)))

        # Eye Aspect Ratio (EAR) inverse of blink score
        mean_blink = float(np.mean(blink_scores))
        ear = float(max(0.0, 1.0 - mean_blink))

        # Blink count: number of transitions exceeding blink threshold 0.5
        blink_threshold = 0.5
        is_blinking = [b > blink_threshold for b in blink_scores]
        blink_transitions = sum(1 for i in range(1, len(is_blinking)) if is_blinking[i] and not is_blinking[i - 1])
        # Approximate blink rate per minute (assuming ~30 fps or turn duration ~5 sec)
        est_duration_min = max(0.05, len(frames) / (30.0 * 60.0))
        blink_rate_bpm = float(min(60.0, blink_transitions / est_duration_min)) if blink_transitions > 0 else 18.0

        # Pupil variation proxy via squinting / wide variance
        pupil_var = float(np.std(gaze_pitches) * 0.5 + np.std(gaze_yaws) * 0.5)

        quality_score = float(valid_frames_count / max(1, len(frames)))
        is_masked = quality_score < 0.40

        return {
            "quality_score": round(quality_score, 3),
            "is_masked": is_masked,
            "features": {
                "gaze_pitch": round(mean_pitch, 3),
                "gaze_yaw": round(mean_yaw, 3),
                "gaze_aversion_index": round(gaze_aversion_index, 3),
                "eye_aspect_ratio": round(ear, 3),
                "blink_rate_bpm": round(blink_rate_bpm, 1),
                "pupil_dilation_variation": round(pupil_var, 3)
            }
        }
