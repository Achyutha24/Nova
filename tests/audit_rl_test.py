import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.database import SessionLocal
from backend.app.database import models
from ml.rl.rewards import RewardCalculator
from question_bank.manager import question_bank

client = TestClient(app)
calc = RewardCalculator()

def run_audit():
    # 1. Create session
    c_res = client.post('/api/sessions', json={'participant_id': 'P_AUDIT_RL', 'notes': 'RL Audit Session'})
    sess_id = c_res.json()['id']
    client.post(f'/api/sessions/{sess_id}/start')

    print('=== SESSION CREATED ===', sess_id)

    # 2. Turn 1: Manual text submission
    turn1_payload = {
        'turn_index': 1,
        'question_id_answered': 'Q_RAP_01',
        'transcript_override': 'I feel completely exhausted and have bad anxiety when I wake up.',
        'input_source': 'manual_text',
        'request_id': 'audit_turn_1'
    }
    r1 = client.post(f'/api/sessions/{sess_id}/turn', json=turn1_payload)
    assert r1.status_code == 200
    data1 = r1.json()

    print('\n--- TURN 1 RESULTS ---')
    print('Turn 1 Question Answered:', turn1_payload['question_id_answered'])
    print('PPO Next Action Selected:', data1['next_action']['question_id'])
    print('Next Question Text:', data1['next_action']['text'])
    print('Next Question Topic:', data1['next_action']['topic'])
    print('Expected Info Gain (reported in payload):', data1['next_action']['expected_info_gain'])
    print('Next Question field sent to Unity (turn_response["next_question"]):', data1['next_question'])

    # Inspect DB for Turn 1 PPO Decision
    db = SessionLocal()
    t1_rec = db.query(models.Turn).filter(models.Turn.session_id == sess_id, models.Turn.turn_index == 1).first()
    ppo1 = t1_rec.ppo_decision if t1_rec else None
    if ppo1:
        print('DB Stored ppo_decision action_id:', ppo1.selected_action_id)
        print('DB Stored ppo_decision info_gain:', ppo1.info_gain)
        print('DB Stored ppo_decision reward:', ppo1.reward_calculated)
        print('DB Stored ppo_decision repetition_penalty:', ppo1.repetition_penalty)
        print('DB Stored ppo_decision safety_penalty:', ppo1.safety_penalty)
        print('DB Stored ppo_decision topic_coverage:', ppo1.topic_coverage)
        print('DB Stored ppo_decision engagement_score:', ppo1.engagement_score)

    # Calculate what RewardCalculator would give
    qual1 = data1['modality_quality']
    true_rew1 = calc.calculate_reward(
        question_id=data1['next_action']['question_id'],
        topic=data1['next_action']['topic'],
        asked_questions={'Q_RAP_01'},
        covered_topics={'rapport'},
        prior_prediction=0.5,
        current_prediction=data1['fusion_output']['prediction_score'],
        transcript_tokens=len(turn1_payload['transcript_override'].split()),
        modality_qualities=qual1,
        is_safe=True
    )
    print('Dynamic RewardCalculator output for Turn 1:', true_rew1)

    # 3. Turn 2: Next submission
    q_answered_2 = data1['next_action']['question_id']
    turn2_payload = {
        'turn_index': 2,
        'question_id_answered': q_answered_2,
        'transcript_override': 'I sleep only 3 hours a night and have recurrent panic attacks.',
        'input_source': 'manual_text',
        'request_id': 'audit_turn_2'
    }
    r2 = client.post(f'/api/sessions/{sess_id}/turn', json=turn2_payload)
    assert r2.status_code == 200
    data2 = r2.json()

    print('\n--- TURN 2 RESULTS ---')
    print('Turn 2 Question Answered:', q_answered_2)
    print('PPO Next Action Selected:', data2['next_action']['question_id'])
    print('Next Question Text:', data2['next_action']['text'])
    print('Next Question Topic:', data2['next_action']['topic'])
    print('Expected Info Gain (reported in payload):', data2['next_action']['expected_info_gain'])

    # Check for repetition
    print('Did Turn 2 repeat Turn 1 answer or Turn 1 next action?:', data2['next_action']['question_id'] in ['Q_RAP_01', q_answered_2])

    # 4. Test duplicate submission (Idempotency)
    r2_dup = client.post(f'/api/sessions/{sess_id}/turn', json=turn2_payload)
    print('\n--- DUPLICATE SUBMISSION TEST ---')
    print('r2_dup status code:', r2_dup.status_code)
    print('r2_dup same turn_id:', r2_dup.json()['turn_id'] == data2['turn_id'])
    print('r2_dup same question_id:', r2_dup.json()['next_action']['question_id'] == data2['next_action']['question_id'])

    # Check total turns in DB
    total_db_turns = db.query(models.Turn).filter(models.Turn.session_id == sess_id).count()
    print('Total DB turns after duplicate submission:', total_db_turns)
    db.close()

if __name__ == '__main__':
    run_audit()
