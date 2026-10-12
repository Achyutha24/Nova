from typing import Dict, Any, Set, List

class RewardCalculator:
    def __init__(
        self,
        w_infogain: float = 1.0,
        w_coverage: float = 1.0,
        w_engagement: float = 0.5,
        w_repetition: float = 2.0,
        w_irrelevance: float = 0.5,
        w_safety: float = 10.0
    ):
        self.w1 = w_infogain
        self.w2 = w_coverage
        self.w3 = w_engagement
        self.w4 = w_repetition
        self.w5 = w_irrelevance
        self.w6 = w_safety

    def calculate_reward(
        self,
        question_id: str,
        topic: str,
        asked_questions: Set[str],
        covered_topics: Set[str],
        prior_prediction: float,
        current_prediction: float,
        transcript_tokens: int,
        modality_qualities: Dict[str, float],
        is_safe: bool
    ) -> Dict[str, float]:
        """
        R = w1·InfoGain + w2·TopicCoverage + w3·Engagement - w4·Repetition - w5·Irrelevance - w6·SafetyViolation
        """
        # 1. Information Gain: change in confidence / predictive clarity
        prior_uncertainty = 1.0 - 2.0 * abs(prior_prediction - 0.5)
        current_uncertainty = 1.0 - 2.0 * abs(current_prediction - 0.5)
        info_gain = max(0.0, prior_uncertainty - current_uncertainty) + 0.1 * abs(current_prediction - prior_prediction)

        # 2. Topic Coverage: bonus for novel topic coverage
        is_new_topic = topic not in covered_topics
        topic_coverage_reward = 1.0 if is_new_topic else 0.2

        # 3. Engagement: verbal output + sensor quality
        verbal_term = min(1.0, transcript_tokens / 15.0)
        sensor_term = sum(modality_qualities.values()) / max(1, len(modality_qualities))
        engagement = 0.5 * verbal_term + 0.5 * sensor_term

        # 4. Repetition Penalty
        repetition_penalty = 1.0 if question_id in asked_questions else 0.0

        # 5. Irrelevance / Jumps: small penalty if jumping to sensitive without rapport
        irrelevance_penalty = 0.0
        if "rapport" not in covered_topics and topic in ["stressful_event", "avoidance"]:
            irrelevance_penalty = 0.8

        # 6. Safety Violation: penalty if invalid question or constraint violated
        safety_penalty = 0.0 if is_safe else 1.0

        total_reward = (
            self.w1 * info_gain
            + self.w2 * topic_coverage_reward
            + self.w3 * engagement
            - self.w4 * repetition_penalty
            - self.w5 * irrelevance_penalty
            - self.w6 * safety_penalty
        )

        return {
            "total_reward": round(total_reward, 4),
            "info_gain": round(info_gain, 4),
            "topic_coverage": round(topic_coverage_reward, 4),
            "engagement": round(engagement, 4),
            "repetition_penalty": round(repetition_penalty, 4),
            "irrelevance_penalty": round(irrelevance_penalty, 4),
            "safety_penalty": round(safety_penalty, 4)
        }
