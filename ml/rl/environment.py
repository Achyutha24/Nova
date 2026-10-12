import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Any, Tuple, Optional, Set
from question_bank.manager import question_bank
from ml.rl.rewards import RewardCalculator

class AdaptiveQuestioningEnv(gym.Env):
    """
    Gymnasium MDP environment for adaptive clinical assessment question selection.
    State: s_t = z_t (128) ⊕ questions_asked (15) ⊕ topics_covered (8) ⊕ context (7) = 158-dim.
    Action: Discrete selection of one question index from safe question bank.
    """
    metadata = {"render_modes": ["human"]}

    def __init__(self, question_budget: int = 10, d_model: int = 128):
        super().__init__()
        self.question_budget = question_budget
        self.d_model = d_model
        
        self.question_ids = question_bank.get_question_ids()
        self.num_actions = len(self.question_ids)
        self.all_topics = question_bank.get_all_topics()
        self.num_topics = len(self.all_topics)
        
        # State dimension: 128 (z_t) + 15 (questions) + 8 (topics) + 7 (context: turn_idx, pred, 5 masks) = 158
        self.state_dim = self.d_model + self.num_actions + self.num_topics + 7
        
        self.observation_space = spaces.Box(
            low=-5.0, high=5.0, shape=(self.state_dim,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(self.num_actions)

        self.reward_calculator = RewardCalculator()
        
        # Session state variables
        self.current_turn = 0
        self.asked_questions: Set[str] = set()
        self.covered_topics: Set[str] = set()
        self.prior_prediction = 0.5
        self.current_z = np.zeros(self.d_model, dtype=np.float32)
        self.current_mask = np.ones(5, dtype=np.float32)

    def _build_state(self) -> np.ndarray:
        q_asked_vec = np.zeros(self.num_actions, dtype=np.float32)
        for i, q_id in enumerate(self.question_ids):
            if q_id in self.asked_questions:
                q_asked_vec[i] = 1.0

        top_cov_vec = np.zeros(self.num_topics, dtype=np.float32)
        for i, t in enumerate(self.all_topics):
            if t in self.covered_topics:
                top_cov_vec[i] = 1.0

        turn_norm = float(self.current_turn) / float(self.question_budget)
        context_vec = np.concatenate([
            np.array([turn_norm, self.prior_prediction], dtype=np.float32),
            self.current_mask
        ])

        state = np.concatenate([self.current_z, q_asked_vec, top_cov_vec, context_vec])
        return state.astype(np.float32)

    def reset(self, seed: Optional[int] = None, options: Optional[Dict[str, Any]] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        self.current_turn = 0
        self.asked_questions.clear()
        self.covered_topics.clear()
        self.prior_prediction = 0.5
        
        # Initialize synthetic baseline state z
        rng = np.random.RandomState(seed)
        self.current_z = (rng.randn(self.d_model) * 0.1).astype(np.float32)
        self.current_mask = np.array([1.0, 1.0, 1.0, 1.0, 0.0], dtype=np.float32)

        state = self._build_state()
        return state, {"asked_questions": list(self.asked_questions), "turn": 0}

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        assert self.action_space.contains(action), f"Invalid action {action}"

        selected_q_id = self.question_ids[action]
        q_obj = question_bank.get_question(selected_q_id)
        is_safe = q_obj is not None and q_obj.enabled
        topic = q_obj.topic if q_obj else "unknown"

        # Simulate participant response trajectory transition
        self.current_turn += 1
        
        # Simulated response metrics
        token_count = np.random.randint(8, 25)
        # Prediction evolves as topics are covered
        topic_bias = 0.15 if topic in ["stressful_event", "avoidance", "sleep"] else -0.05
        current_pred = float(np.clip(self.prior_prediction + topic_bias + np.random.randn() * 0.05, 0.05, 0.95))
        
        qualities = {"voice": 0.9, "face": 0.85, "gaze": 0.8, "text": 0.95, "rppg": 0.0}

        # Calculate reward
        rew_dict = self.reward_calculator.calculate_reward(
            question_id=selected_q_id,
            topic=topic,
            asked_questions=self.asked_questions,
            covered_topics=self.covered_topics,
            prior_prediction=self.prior_prediction,
            current_prediction=current_pred,
            transcript_tokens=token_count,
            modality_qualities=qualities,
            is_safe=is_safe
        )

        # Update state
        self.asked_questions.add(selected_q_id)
        self.covered_topics.add(topic)
        self.prior_prediction = current_pred
        self.current_z = (self.current_z * 0.8 + np.random.randn(self.d_model) * 0.1).astype(np.float32)

        terminated = self.current_turn >= self.question_budget
        truncated = False

        state = self._build_state()
        info = {
            "question_id": selected_q_id,
            "topic": topic,
            "reward_breakdown": rew_dict,
            "topic_coverage_ratio": len(self.covered_topics) / float(self.num_topics),
            "turn": self.current_turn
        }

        return state, rew_dict["total_reward"], terminated, truncated, info
