import os
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from typing import Dict, Any, List, Tuple, Optional, Set
from question_bank.manager import question_bank
from ml.rl.environment import AdaptiveQuestioningEnv

MODEL_WEIGHTS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "ppo_question_policy.pt"))

class ActorCriticNetwork(nn.Module):
    def __init__(self, state_dim: int = 158, action_dim: int = 15, hidden_dim: int = 128):
        super().__init__()
        # Shared feature trunk
        self.trunk = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 64),
            nn.Tanh()
        )
        # Policy Actor head (logits over question bank)
        self.actor = nn.Linear(64, action_dim)
        # Value Critic head
        self.critic = nn.Linear(64, 1)

    def forward(self, state: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        feat = self.trunk(state)
        logits = self.actor(feat)
        value = self.critic(feat)
        return logits, value

    def get_action_distribution(self, state: torch.Tensor, mask_already_asked: Optional[torch.Tensor] = None):
        logits, value = self.forward(state)
        if mask_already_asked is not None:
            # Mask already asked questions with large negative penalty to disfavor repetition
            logits = logits - (mask_already_asked * 1e4)
        dist = torch.distributions.Categorical(logits=logits)
        return dist, value

class PPOQuestionPolicyService:
    def __init__(self, weights_path: str = MODEL_WEIGHTS_PATH, device: Optional[str] = None):
        self.weights_path = weights_path
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.env = AdaptiveQuestioningEnv()
        self.model = ActorCriticNetwork(
            state_dim=self.env.state_dim,
            action_dim=self.env.num_actions
        ).to(self.device)
        self.question_ids = self.env.question_ids
        self.all_topics = self.env.all_topics
        self._load_or_train_weights()

    def _load_or_train_weights(self):
        if os.path.exists(self.weights_path):
            try:
                state_dict = torch.load(self.weights_path, map_location=self.device)
                self.model.load_state_dict(state_dict)
                self.model.eval()
                return
            except Exception:
                pass
        # If no saved checkpoint, train policy online for 100 episodes
        self.train_policy(episodes=150, lr=1e-3)

    def train_policy(self, episodes: int = 150, lr: float = 1e-3) -> Dict[str, Any]:
        """Trains the PPO question selection policy inside the environment."""
        self.model.train()
        optimizer = optim.Adam(self.model.parameters(), lr=lr)
        total_rewards = []

        for ep in range(episodes):
            state, _ = self.env.reset(seed=ep)
            ep_reward = 0.0
            done = False
            
            states_buf = []
            actions_buf = []
            rewards_buf = []
            log_probs_buf = []
            values_buf = []

            while not done:
                t_state = torch.tensor(state, dtype=torch.float32, device=self.device).unsqueeze(0)
                
                # Mask asked questions
                q_asked = torch.tensor(
                    [1.0 if q in self.env.asked_questions else 0.0 for q in self.question_ids],
                    dtype=torch.float32, device=self.device
                ).unsqueeze(0)
                
                # If all questions asked, don't mask
                if q_asked.sum() >= self.env.num_actions:
                    q_asked = None

                dist, val = self.model.get_action_distribution(t_state, q_asked)
                action = dist.sample()
                log_prob = dist.log_prob(action)

                next_state, reward, term, trunc, info = self.env.step(action.item())
                done = term or trunc
                ep_reward += reward

                states_buf.append(t_state)
                actions_buf.append(action)
                rewards_buf.append(reward)
                log_probs_buf.append(log_prob)
                values_buf.append(val)

                state = next_state

            total_rewards.append(ep_reward)

            # Compute discounted returns
            gamma = 0.95
            returns = []
            G = 0.0
            for r in reversed(rewards_buf):
                G = r + gamma * G
                returns.insert(0, G)
            returns = torch.tensor(returns, dtype=torch.float32, device=self.device)

            # PPO optimization step
            states_t = torch.cat(states_buf, dim=0)
            actions_t = torch.cat(actions_buf, dim=0)
            old_log_probs_t = torch.cat(log_probs_buf, dim=0).detach()
            values_t = torch.cat(values_buf, dim=0).squeeze(-1)
            advantages = (returns - values_t).detach()
            advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

            # 3 epochs of mini-updates
            for _ in range(3):
                dist, values_new = self.model.get_action_distribution(states_t)
                new_log_probs = dist.log_prob(actions_t)
                ratios = torch.exp(new_log_probs - old_log_probs_t)

                surr1 = ratios * advantages
                surr2 = torch.clamp(ratios, 0.8, 1.2) * advantages
                actor_loss = -torch.min(surr1, surr2).mean()

                critic_loss = nn.MSELoss()(values_new.squeeze(-1), returns)
                entropy_loss = -dist.entropy().mean() * 0.01

                loss = actor_loss + 0.5 * critic_loss + entropy_loss

                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

        self.model.eval()
        os.makedirs(os.path.dirname(self.weights_path), exist_ok=True)
        torch.save(self.model.state_dict(), self.weights_path)
        
        return {
            "episodes_trained": episodes,
            "final_mean_reward": round(float(np.mean(total_rewards[-20:])), 4),
            "checkpoint_saved": self.weights_path
        }

    def select_next_question(
        self,
        fused_state_z: List[float],
        asked_questions: List[str],
        covered_topics: List[str],
        turn_index: int,
        prediction_score: float = 0.5,
        modality_mask: Optional[Dict[str, bool]] = None
    ) -> Dict[str, Any]:
        """
        Executes PPO policy inference to select next best question from safe question bank.
        Guaranteed: strictly returns a valid question from question_bank.
        """
        self.model.eval()
        z_arr = np.array(fused_state_z[:128], dtype=np.float32)
        if len(z_arr) < 128:
            z_arr = np.pad(z_arr, (0, 128 - len(z_arr)))

        # Build state vector
        q_vec = np.zeros(len(self.question_ids), dtype=np.float32)
        for i, q_id in enumerate(self.question_ids):
            if q_id in asked_questions:
                q_vec[i] = 1.0

        top_vec = np.zeros(len(self.all_topics), dtype=np.float32)
        for i, t in enumerate(self.all_topics):
            if t in covered_topics:
                top_vec[i] = 1.0

        turn_norm = float(turn_index) / float(self.env.question_budget)
        mask_arr = np.ones(5, dtype=np.float32)
        if modality_mask:
            mods = ["voice", "face", "gaze", "text", "rppg"]
            for i, m in enumerate(mods):
                mask_arr[i] = 1.0 if modality_mask.get(m, False) else 0.0

        context = np.concatenate([np.array([turn_norm, prediction_score], dtype=np.float32), mask_arr])
        full_state = np.concatenate([z_arr, q_vec, top_vec, context]).astype(np.float32)

        t_state = torch.tensor(full_state, dtype=torch.float32, device=self.device).unsqueeze(0)
        
        # Mask already asked questions
        mask_t = torch.tensor(q_vec, dtype=torch.float32, device=self.device).unsqueeze(0)
        if np.sum(q_vec) >= len(self.question_ids):
            mask_t = None

        with torch.no_grad():
            dist, val = self.model.get_action_distribution(t_state, mask_t)
            action_idx = int(torch.argmax(dist.probs).item())

        selected_id = self.question_ids[action_idx]
        q_obj = question_bank.get_question(selected_id)
        if not q_obj:
            # Fallback safe question
            q_obj = question_bank.get_initial_question()

        return {
            "question_id": q_obj.question_id,
            "text": q_obj.text,
            "topic": q_obj.topic,
            "difficulty": q_obj.difficulty,
            "selection_policy": "PPO",
            "expected_info_gain": round(float(dist.probs[0, action_idx].item()), 4),
            "state_vector": [round(float(x), 4) for x in full_state]
        }
