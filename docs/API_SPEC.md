# NOVA: API Specification

## 1. REST API Endpoints

All endpoints use standard JSON payloads and return structured responses with ISO-8601 UTC timestamps.

### Base URL: `http://localhost:8000`

---

### A. Session Management

#### `POST /api/sessions`
Create a new research assessment session.
- **Request Body**:
  ```json
  {
    "participant_id": "PART-001",
    "protocol_version": "v1.0",
    "notes": "Intake baseline session"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "session_id": "sess_8f3a1c9e",
    "participant_id": "PART-001",
    "status": "created",
    "created_at": "2026-10-07T11:00:00.000Z",
    "protocol_version": "v1.0"
  }
  ```

#### `GET /api/sessions`
List all sessions with summary statistics.
- **Query Params**: `limit` (int, default 50), `offset` (int, default 0), `status` (string, optional).
- **Response** (`200 OK`): Array of session objects.

#### `GET /api/sessions/{session_id}`
Retrieve complete session details and current state.

#### `POST /api/sessions/{session_id}/start`
Transition session to `active`. Returns initial opening question from the safe question bank.
- **Response** (`200 OK`):
  ```json
  {
    "session_id": "sess_8f3a1c9e",
    "status": "active",
    "started_at": "2026-10-07T11:01:00.000Z",
    "initial_question": {
      "question_id": "Q_RAP_01",
      "text": "Hello, thank you for coming in today. How have things been going for you lately?",
      "topic": "rapport",
      "difficulty": 1
    }
  }
  ```

#### `POST /api/sessions/{session_id}/end`
Finalize the session, calculate summary research metrics, and set status to `completed`.

---

### B. Interactive Turn & Ingestion Pipeline

#### `POST /api/sessions/{session_id}/turn`
The core conversational turn endpoint executed on each participant response. Receives audio, frame data, or pre-extracted features, runs full perceptual processing, Cross-Modal Transformer fusion, and PPO question selection.
- **Request Body**:
  ```json
  {
    "turn_index": 1,
    "question_id_answered": "Q_RAP_01",
    "audio_base64": "<optional base64 wav/ogg audio>",
    "video_frames_base64": ["<optional base64 jpeg frames>"],
    "transcript_override": "<optional text transcript if pre-transcribed>",
    "client_timestamp": "2026-10-07T11:01:25.500Z"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "turn_id": "turn_c4b910a2",
    "turn_index": 1,
    "transcript": "I've been feeling somewhat exhausted and having trouble sleeping lately.",
    "modality_quality": {
      "face": 0.94,
      "gaze": 0.88,
      "voice": 0.91,
      "text": 0.99,
      "rppg": null
    },
    "modality_masks": {
      "face": true,
      "gaze": true,
      "voice": true,
      "text": true,
      "rppg": false
    },
    "biomarkers": {
      "gaze_aversion_index": 0.32,
      "vocal_instability": 0.41,
      "facial_au_activation": 0.28,
      "hr_bpm": null,
      "hrv_rmssd": null
    },
    "fusion_output": {
      "prediction_score": 0.35,
      "confidence": 0.82,
      "attention_weights": {
        "face": 0.22,
        "gaze": 0.18,
        "voice": 0.31,
        "text": 0.29,
        "rppg": 0.0
      }
    },
    "next_action": {
      "question_id": "Q_SLP_01",
      "text": "Could you tell me a little more about what your sleep has been like recently?",
      "topic": "sleep",
      "difficulty": 1,
      "selection_policy": "PPO",
      "expected_info_gain": 0.74
    },
    "session_completed": false,
    "timestamp": "2026-10-07T11:01:26.120Z"
  }
  ```

#### `POST /api/sessions/{session_id}/audio`
Upload raw audio recording for the turn (multipart/form-data).

#### `POST /api/sessions/{session_id}/video`
Upload video file or frame sequence for the turn (multipart/form-data).

#### `POST /api/sessions/{session_id}/response`
Alternative lightweight JSON endpoint to submit textual or sensor responses.

---

### C. Research & Dashboard Telemetry

#### `GET /api/sessions/{session_id}/timeline`
Returns the chronological timeline of all dialogue milestones, questions, transcripts, and model decisions.

#### `GET /api/sessions/{session_id}/signals`
Returns continuous time-series data for dashboard charts (matching Figure 7):
- `time_seconds`: Array of float timestamps
- `gaze_aversion_index`: Array of floats $[0.0, 1.0]$
- `vocal_instability`: Array of floats $[0.0, 1.0]$
- `facial_au_activation`: Array of floats $[0.0, 1.0]$
- `modality_status`: Array of per-modality status bands (`available`, `degraded`, `masked`)
- `events`: Array of question/milestone point annotations

#### `GET /api/sessions/{session_id}/metrics`
Returns summary metrics (duration, turn count, topic coverage %, signal completion %, average biomarker levels).

#### `GET /api/sessions/{session_id}/replay`
Returns full turn-by-turn state payload for interactive scrubbable session playback.

---

### D. Participant & Longitudinal Endpoints

#### `GET /api/participants`
List registered pseudonymous participants with historical session counts.

#### `GET /api/participants/{participant_id}`
Retrieve participant profile and aggregate statistics.

#### `GET /api/participants/{participant_id}/sessions`
List all historical sessions for the specified participant.

#### `GET /api/participants/{participant_id}/longitudinal`
Returns cross-session longitudinal trends:
- Session dates and durations
- Vocal instability progression across sessions
- Facial expressivity / AU activation progression
- Ocular stability index progression
- Assessment prediction trajectory

---

### E. Model Health & Benchmark Results

#### `GET /api/models/status`
Returns status, version, device, and readiness of all models in `MODEL_REGISTRY`.

#### `GET /api/system/health`
System hardware telemetry (CPU/GPU, RAM, active connections, disk storage).

#### `GET /api/experiments`
Returns reproducible benchmark results for:
- Unimodal baselines (Voice, Text, Face, Gaze)
- Multimodal ablation ($E_0$ through $E_4$)
- Fusion comparison (Early vs. Late vs. Cross-Modal Transformer)
- RL vs. Fixed Questioning comparison
- Unrun experiments flagged as `"Not evaluated"`

#### `GET /api/questions`
Returns complete safe question bank catalog with topics, difficulty, and safety categories.

---

## 2. WebSocket Real-Time Protocols

### A. Live Dashboard Socket: `/ws/dashboard/{session_id}`
- Pushes JSON frames to researcher dashboard immediately when a turn is processed.
- Frame message types:
  - `turn_completed`: Contains turn transcript, biomarker features, fusion attention, and PPO selection.
  - `modality_alert`: Emitted if a sensor quality drops below threshold.
  - `session_status_changed`: Emitted when session starts or ends.

### B. Unity Avatar Socket: `/ws/session/{session_id}`
- Bi-directional socket enabling streaming audio/frames from Unity and returning synthesized question prompts and lip-sync cues in real time.
