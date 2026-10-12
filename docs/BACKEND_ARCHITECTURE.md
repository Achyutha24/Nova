# NOVA: Backend Architecture & Implementation Design

## 1. Directory Structure

The backend and machine learning infrastructure is organized into clean, modular Python packages adhering to separation of concerns:

```
Nova/
├── backend/
│   └── app/
│       ├── main.py                  # FastAPI application entrypoint & lifecycle
│       ├── core/                    # Application configuration, settings & logging
│       │   ├── config.py
│       │   └── logging.py
│       ├── database/                # SQLAlchemy models, sessions & database init
│       │   ├── database.py
│       │   ├── models.py
│       │   └── crud.py
│       ├── schemas/                 # Pydantic v2 schemas for request/response payloads
│       │   ├── session.py
│       │   ├── turn.py
│       │   ├── features.py
│       │   ├── ppo.py
│       │   └── timeline.py
│       ├── api/                     # REST API route endpoints
│       │   ├── sessions.py
│       │   ├── turns.py
│       │   ├── participants.py
│       │   ├── models.py
│       │   └── system.py
│       ├── services/                # Business logic & orchestration services
│       │   ├── session_service.py
│       │   ├── pipeline_service.py
│       │   └── model_registry.py
│       └── websocket/               # Real-time WebSocket connection managers
│           ├── session_ws.py
│           └── dashboard_ws.py
├── ml/                              # Modality processing, fusion & reinforcement learning
│   ├── asr/                         # Whisper speech-to-text service
│   ├── text/                        # BERT-family / DistilRoBERTa embedding service
│   ├── voice/                       # MFCC, pitch, jitter, shimmer, HNR extraction
│   ├── face/                        # MediaPipe / OpenFace landmark & AU extraction
│   ├── gaze/                        # MediaPipe Iris / GazeML ocular extraction
│   ├── rppg/                        # Contactless rPPG extraction & signal validation
│   ├── unimodal/                    # Unimodal classification & regression heads
│   ├── fusion/                      # Cross-Modal Transformer & baseline fusion
│   │   ├── cross_modal_transformer.py
│   │   ├── early_fusion.py
│   │   └── late_fusion.py
│   └── rl/                          # PPO adaptive questioning environment & policy
│       ├── environment.py
│       ├── policy.py
│       └── rewards.py
├── question_bank/                   # Clinically reviewed safe question bank catalog
│   ├── catalog.json
│   └── manager.py
├── preprocessing/                   # Normalization, temporal alignment, modality masking
│   ├── aligner.py
│   ├── masker.py
│   └── normalizer.py
├── evaluation/                      # Offline benchmarks, ablation (E0-E4), metrics
│   ├── metrics.py
│   └── benchmark_runner.py
├── research/                        # Longitudinal aggregation & export utilities
│   ├── longitudinal.py
│   └── exporter.py
├── dashboard/                       # Researcher Dashboard UI (Vite + React / Tailwind)
├── docs/                            # Formal specifications, registry & schemas
└── tests/                           # Comprehensive automated test suites
```

---

## 2. Real-Time Processing Pipeline

The interactive assessment pipeline executes the following deterministic loop:

```
Participant speaks / acts (Unity Avatar)
          │
          ▼
Unity captures microphone audio & webcam frames
          │
          ▼ HTTP POST /api/sessions/{session_id}/turn (or /turn)
FastAPI receives request & generates Turn ID
          │
          ▼
Timestamp Event Recorded (ISO-8601 UTC)
          │
          ├─────────────────────────────────────────────────┐
          ▼                                                 ▼
Audio Stream Processing                           Video Stream Processing
  ├─ Whisper ASR (Timestamped Transcript)           ├─ Face Mesh / Landmarks
  ├─ DistilRoBERTa Text Embeddings (768-d)          ├─ Action Units (13 AUs)
  └─ Acoustic DSP (MFCC, Pitch, Jitter, Shimmer,    ├─ Ocular / Gaze (Gaze vector, EAR, Pupil)
                  HNR)                              └─ Optional rPPG (CHROM/POS, HR, HRV)
          │                                                 │
          └───────────────────────┬─────────────────────────┘
                                  ▼
                     Modality Quality Validation
                                  ▼
                     Modality Projections & Normalization
                                  ▼
                     Turn-Level Temporal Alignment
                                  ▼
                     Missing-Modality Masking m ∈ {0, 1}^M
                                  ▼
                     Cross-Modal Transformer
                       ├─ Cross-Attention Across Modalities
                       ├─ Pooled Fused Latent State z_t
                       ├─ Assessment Prediction Head
                       └─ Per-Modality Attention Evidence Weights
                                  ▼
                     PPO State Construction
                       s_t = z_t ⊕ History ⊕ Coverage ⊕ Context
                                  ▼
                     PPO Policy Evaluation & Action Selection
                       a_t ∈ Safe Question Bank Q
                                  ▼
                     Retrieve Predefined Safe Question Text
                                  ▼
    ┌─────────────────────────────┴─────────────────────────────┐
    ▼                                                           ▼
Return JSON to Unity Avatar                        Push Live Update to Dashboard
  ├─ Question ID & Spoken Text                       ├─ Event Timeline Entry
  ├─ Transcript & Extracted Features                 ├─ Modality Traces (Gaze, Voice, AU)
  └─ Modality Quality Indicators                     └─ Modality Availability (Green/Gold/Gray)
```

---

## 3. Timestamp Synchronization Architecture

Every event in the session timeline is anchored to precise, synchronized timestamps:
- `session_start_timestamp`
- `session_end_timestamp`
- `question_presented_timestamp`
- `participant_response_start_timestamp`
- `participant_response_end_timestamp`
- `asr_transcript_timestamp`
- `audio_feature_timestamp`
- `face_feature_timestamp`
- `gaze_feature_timestamp`
- `rppg_feature_timestamp` (if enabled & validated)
- `fusion_inference_timestamp`
- `ppo_action_timestamp`
- `quality_check_timestamp`

This ensures researchers can align any dialogue turn to exact vocal instability peaks, facial AU activations, and gaze shifts on the dashboard timeline.

---

## 4. Persistent Research Data Model

The database stores detailed research observations using SQLAlchemy with SQLite:

- **Participants**: `participant_id` (pseudonymous), `created_at`, `notes`, `demographics` (optional).
- **Sessions**: `session_id`, `participant_id`, `started_at`, `ended_at`, `status` (`created`, `active`, `completed`, `aborted`), `protocol_version`.
- **Turns**: `turn_id`, `session_id`, `turn_index`, `question_id`, `question_text`, `transcript`, `created_at`.
- **ModalityObservations**: `observation_id`, `turn_id`, `modality_type` (`audio`, `face`, `gaze`, `text`, `rppg`), `features_json`, `quality_score`, `is_masked`, `timestamp`.
- **FusionRecords**: `fusion_id`, `turn_id`, `fused_state_vector`, `attention_weights_json`, `prediction_score`, `confidence`, `timestamp`.
- **PPODecisions**: `decision_id`, `turn_id`, `state_vector`, `selected_action_id`, `info_gain`, `topic_coverage_after`, `reward_calculated`, `timestamp`.
- **SystemEvents**: `event_id`, `session_id`, `event_type`, `severity`, `details_json`, `timestamp`.
- **ExperimentRuns**: `experiment_id`, `model_version`, `dataset_version`, `participant_split_hash`, `metrics_json`, `created_at`.
