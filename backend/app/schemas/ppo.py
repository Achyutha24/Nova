from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class SafeQuestion(BaseModel):
    question_id: str
    text: str
    topic: str
    difficulty: int = 1
    follow_up_purpose: Optional[str] = None
    safety_classification: str = "standard"  # standard, sensitive, crisis_screen
    enabled: bool = True

class PPOActionRead(BaseModel):
    question_id: str
    text: str
    topic: str
    difficulty: int
    selection_policy: str = "PPO"
    expected_info_gain: float = 0.0

class PPODecisionDetail(BaseModel):
    selected_action_id: str
    selected_question_text: str
    info_gain: float
    topic_coverage: float
    engagement_score: float
    repetition_penalty: float
    safety_penalty: float
    reward_calculated: float
