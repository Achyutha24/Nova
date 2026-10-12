import os
import io
import base64
import numpy as np
import cv2
from typing import Dict, Any, Union, List, Optional
from backend.app.core.logging import logger

MODEL_TASK_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "face_landmarker.task"))

class FaceFeatureService:
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
            logger.info("MediaPipe FaceLandmarker successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe FaceLandmarker: {e}")
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
        Extracts 13 FACS Action Units, head pose, distress activation composite, and quality score.
        Accepts a single frame or a list of frames across a conversational turn.
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
                    "action_units": {f"AU{i:02d}": 0.0 for i in [1, 2, 4, 6, 7, 12, 14, 15, 17, 20, 23, 25, 26]},
                    "head_pose_pitch": 0.0,
                    "head_pose_yaw": 0.0,
                    "head_pose_roll": 0.0,
                    "expressivity_index": 0.0,
                    "au_distress_activation": 0.0
                }
            }

        import mediapipe as mp

        detected_blendshapes = []
        head_poses = []
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
                    bs_dict = {category.category_name: category.score for category in result.face_blendshapes[0]}
                    detected_blendshapes.append(bs_dict)

                    # Extract rotation if available
                    if result.facial_transformation_matrixes and len(result.facial_transformation_matrixes) > 0:
                        mat = result.facial_transformation_matrixes[0]
                        # Extract Euler angles from rotation matrix
                        sy = np.sqrt(mat[0, 0] * mat[0, 0] + mat[1, 0] * mat[1, 0])
                        if sy > 1e-6:
                            x = np.arctan2(mat[2, 1], mat[2, 2])
                            y = np.arctan2(-mat[2, 0], sy)
                            z = np.arctan2(mat[1, 0], mat[0, 0])
                        else:
                            x = np.arctan2(-mat[1, 2], mat[1, 1])
                            y = np.arctan2(-mat[2, 0], sy)
                            z = 0.0
                        head_poses.append((float(x), float(y), float(z)))
            except Exception as e:
                logger.debug(f"Frame face processing error: {e}")
                continue

        if valid_frames_count == 0 or len(detected_blendshapes) == 0:
            return {
                "quality_score": 0.0,
                "is_masked": True,
                "features": {
                    "action_units": {f"AU{i:02d}": 0.0 for i in [1, 2, 4, 6, 7, 12, 14, 15, 17, 20, 23, 25, 26]},
                    "head_pose_pitch": 0.0,
                    "head_pose_yaw": 0.0,
                    "head_pose_roll": 0.0,
                    "expressivity_index": 0.0,
                    "au_distress_activation": 0.0
                }
            }

        # Average blendshapes across turn frames
        mean_bs = {}
        for k in detected_blendshapes[0].keys():
            mean_bs[k] = float(np.mean([bs.get(k, 0.0) for bs in detected_blendshapes]))

        # Map blendshapes to FACS Action Units
        au01 = mean_bs.get("browInnerUp", 0.0)
        au02 = (mean_bs.get("browOuterUpLeft", 0.0) + mean_bs.get("browOuterUpRight", 0.0)) / 2.0
        au04 = (mean_bs.get("browDownLeft", 0.0) + mean_bs.get("browDownRight", 0.0)) / 2.0
        au06 = (mean_bs.get("cheekSquintLeft", 0.0) + mean_bs.get("cheekSquintRight", 0.0)) / 2.0
        au07 = (mean_bs.get("eyeSquintLeft", 0.0) + mean_bs.get("eyeSquintRight", 0.0)) / 2.0
        au12 = (mean_bs.get("mouthSmileLeft", 0.0) + mean_bs.get("mouthSmileRight", 0.0)) / 2.0
        au14 = (mean_bs.get("mouthDimpleLeft", 0.0) + mean_bs.get("mouthDimpleRight", 0.0)) / 2.0
        au15 = (mean_bs.get("mouthFrownLeft", 0.0) + mean_bs.get("mouthFrownRight", 0.0)) / 2.0
        au17 = mean_bs.get("mouthShrugLower", 0.0)
        au20 = (mean_bs.get("mouthStretchLeft", 0.0) + mean_bs.get("mouthStretchRight", 0.0)) / 2.0
        au23 = (mean_bs.get("mouthPressLeft", 0.0) + mean_bs.get("mouthPressRight", 0.0)) / 2.0
        au25 = (mean_bs.get("mouthPucker", 0.0) + mean_bs.get("mouthRollLower", 0.0)) / 2.0
        au26 = mean_bs.get("jawOpen", 0.0)

        action_units = {
            "AU01": round(au01, 3), "AU02": round(au02, 3), "AU04": round(au04, 3),
            "AU06": round(au06, 3), "AU07": round(au07, 3), "AU12": round(au12, 3),
            "AU14": round(au14, 3), "AU15": round(au15, 3), "AU17": round(au17, 3),
            "AU20": round(au20, 3), "AU23": round(au23, 3), "AU25": round(au25, 3),
            "AU26": round(au26, 3)
        }

        # Head pose
        pitch, yaw, roll = 0.0, 0.0, 0.0
        if head_poses:
            pitch = float(np.mean([p[0] for p in head_poses]))
            yaw = float(np.mean([p[1] for p in head_poses]))
            roll = float(np.mean([p[2] for p in head_poses]))

        # Expressivity & Distress Composite (AU04 Brow Lowerer + AU07 Lid Tightener)
        expressivity = float(np.mean(list(action_units.values())))
        au_distress = float(min(1.0, 0.6 * au04 + 0.4 * au07))

        quality_score = float(valid_frames_count / max(1, len(frames)))
        is_masked = quality_score < 0.40

        return {
            "quality_score": round(quality_score, 3),
            "is_masked": is_masked,
            "features": {
                "action_units": action_units,
                "head_pose_pitch": round(pitch, 3),
                "head_pose_yaw": round(yaw, 3),
                "head_pose_roll": round(roll, 3),
                "expressivity_index": round(expressivity, 3),
                "au_distress_activation": round(au_distress, 3)
            }
        }
