import os
import json
from typing import List, Dict, Optional, Set
from backend.app.schemas.ppo import SafeQuestion

CATALOG_PATH = os.path.join(os.path.dirname(__file__), "catalog.json")

class QuestionBankManager:
    def __init__(self, catalog_path: str = CATALOG_PATH):
        self.catalog_path = catalog_path
        self.questions: Dict[str, SafeQuestion] = {}
        self.topics: Dict[str, List[SafeQuestion]] = {}
        self._load_catalog()

    def _load_catalog(self):
        if not os.path.exists(self.catalog_path):
            raise FileNotFoundError(f"Question bank catalog not found at {self.catalog_path}")
        with open(self.catalog_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.questions.clear()
        self.topics.clear()
        for item in data:
            q = SafeQuestion(**item)
            self.questions[q.question_id] = q
            if q.topic not in self.topics:
                self.topics[q.topic] = []
            self.topics[q.topic].append(q)

    def get_question(self, question_id: str) -> Optional[SafeQuestion]:
        q = self.questions.get(question_id)
        if q and q.enabled:
            return q
        return None

    def list_all_questions(self, enabled_only: bool = True) -> List[SafeQuestion]:
        if enabled_only:
            return [q for q in self.questions.values() if q.enabled]
        return list(self.questions.values())

    def get_questions_by_topic(self, topic: str) -> List[SafeQuestion]:
        return [q for q in self.topics.get(topic, []) if q.enabled]

    def get_all_topics(self) -> List[str]:
        return sorted(list(self.topics.keys()))

    def get_initial_question(self) -> SafeQuestion:
        # Default opening question from rapport topic
        rapport_qs = self.get_questions_by_topic("rapport")
        if rapport_qs:
            return rapport_qs[0]
        return list(self.questions.values())[0]

    def validate_action(self, action_id: str) -> bool:
        """Strict safety check: returns True iff action_id exists and is an enabled question."""
        return action_id in self.questions and self.questions[action_id].enabled

    def get_action_space_size(self) -> int:
        return len(self.list_all_questions(enabled_only=True))

    def get_question_ids(self) -> List[str]:
        return [q.question_id for q in self.list_all_questions(enabled_only=True)]

question_bank = QuestionBankManager()
