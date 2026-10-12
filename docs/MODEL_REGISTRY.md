# NOVA: Model & Technique Registry

## 1. Strict Non-Negotiable Model Lock Policy

This project strictly locks all modeling, signal-processing, and reinforcement learning components to the approved, documented techniques specified in the NOVA project documents and research papers.

### Explicit Prohibitions
Under NO circumstances may any developer or agent introduce substitute foundation models or unconstrained generators into the NOVA research pipeline:
- **PROHIBITED LLMs**: GPT-3.5/GPT-4, Claude, Gemini API (as project inference engine), Llama family, Mistral family, Falcon, or any arbitrary generative LLM.
- **PROHIBITED GENERATION**: No free-form LLM question generation. The dialogue action space is strictly confined to the safe, reviewed question bank.
- **PROHIBITED ARBITRARY CLASSIFIERS**: No arbitrary sentiment, emotion, or diagnostic models outside the documented pipeline.
- **PROTOTYPE COMPONENTS POLICY**: Prototype components such as Qwen3-4B or Kokoro-82M referenced in legacy notes must NOT be introduced into new research/model logic. All speech transcription, NLP encoding, multimodal fusion, and adaptive question selection must use the approved components below.

---

## 2. Approved Model & Technique Registry

| Modality / Layer | Approved Technique / Model | Specification / Architecture | Role & Output |
| :--- | :--- | :--- | :--- |
| **Speech / ASR** | **Whisper** (`openai/whisper-tiny` or `whisper-base` / `faster-whisper`) | Pretrained Transformer encoder-decoder for speech recognition | Transcribes participant audio into timestamped text strings. |
| **Text / NLP** | **BERT-Family Encoder** (`distilroberta-base` / `bert-base-uncased`) | Transformer text encoder; 768-dim embeddings with pooled output | Encodes participant transcript text into dense semantic representations. |
| **Voice / Audio** | **Acoustic Signal Processing** (+ optional **Wav2Vec 2.0**) | MFCC (13-39 coefs), Fundamental frequency ($F_0$ / pitch), Jitter (cycle-to-cycle perturbation), Shimmer (amplitude perturbation), HNR (Harmonics-to-Noise Ratio) | Characterizes vocal prosody, tremor, and instability indicators. |
| **Face Analysis** | **OpenFace / MediaPipe Face Mesh** | 468 3D facial landmarks, Facial Action Units (AU01, AU02, AU04, AU06, AU07, AU12, AU14, AU15, AU17, AU20, AU23, AU25, AU26), Head pose (pitch, yaw, roll) | Quantifies facial affect, psychomotor blunting, and muscle activation. |
| **Eyes / Gaze** | **MediaPipe Iris / GazeML-style Processing** | Iris landmarks (left/right), 3D gaze direction vector, blink rate / eye aspect ratio (EAR), pupil size variations | Captures ocular biomarkers, gaze aversion index, and fixation dynamics. |
| **Physiological (Optional)** | **rPPG (Remote Photoplethysmography)** | Chrominance (CHROM) / POS facial ROI temporal color difference filtering; bandpass 0.7–3.5 Hz | Contactless estimation of Heart Rate (BPM) and HRV (RMSSD, SDNN). Guarded by strict quality checks; missing-modality masked if corrupted. |
| **Multimodal Fusion** | **Cross-Modal Transformer** | Multi-head cross-attention across modality tokens + temporal alignment + binary modality mask $m \in \{0, 1\}^M$ + FeedForward + LayerNorm ($\times L$ blocks) | Unifies all perceptual signals into joint latent state $z_t$, research prediction head, and explainability cross-attention maps. |
| **Reinforcement Learning** | **PPO (Proximal Policy Optimization)** | Actor-Critic architecture over state vector $s_t = z_t \oplus \text{history} \oplus \text{coverage} \oplus \text{context}$ | Selects optimal question $a_t \in \mathcal{Q}$ from safe predefined question bank to maximize information gain while avoiding repetition and safety violations. |
| **Action Space** | **Safe Predefined Question Bank** | Curated catalog of validated clinical assessment prompts categorized by construct/topic | Enforces safety, ordering constraints, difficulty tiers, and prevents open-ended generation. |

---

## 3. Centralized Model Service Architecture

To prevent memory thrashing and duplicate model loading across requests, all AI components are centralized in the backend singleton `MODEL_REGISTRY`:

```python
MODEL_REGISTRY = {
    "asr": WhisperService(model_size="base", device=device),
    "text": TextEmbeddingService(model_name="distilroberta-base", device=device),
    "voice": AcousticFeatureService(sample_rate=16000),
    "face": FaceFeatureService(),
    "gaze": OcularFeatureService(),
    "rppg": RPPGService(enabled=False),
    "fusion": CrossModalTransformerService(d_model=128, n_heads=4, n_layers=2, device=device),
    "rl": PPOQuestionPolicyService(device=device)
}
```

### Component Status Contract
Every registered model service exposes standard telemetry:
- `name`: String identifier
- `version`: Model artifact/checkpoint version
- `device`: Current device (`cpu` or `cuda`)
- `loaded`: Boolean indicating operational readiness
- `checkpoint_path`: Local path to active model weights
- `health_status`: Operational status string (`ready`, `degraded`, `unavailable`)
- `metadata`: Modality-specific parameters (e.g., input dimensions, sample rate)
