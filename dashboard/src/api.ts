const getApiBase = () => {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return "http://localhost:8000/api";
};

const getWsBase = () => {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:8000/ws`;
  }
  return "ws://localhost:8000/ws";
};

const API_BASE = getApiBase();
const WS_BASE = getWsBase();


export interface SystemHealth {
  status: string;
  platform: string;
  python_version: string;
  torch_device: string;
  cuda_available: boolean;
  memory_total_gb: number;
  memory_used_gb: number;
  memory_percent: number;
  disk_free_gb: number;
  active_models: Record<string, string>;
}

export interface ModelStatus {
  device: string;
  models: Record<string, {
    name: string;
    version: string;
    loaded: boolean;
    device: string;
    enabled?: boolean;
  }>;
}

export interface SafeQuestion {
  question_id: string;
  text: string;
  topic: string;
  difficulty: number;
  follow_up_purpose?: string;
  safety_classification: string;
  enabled: boolean;
}

export interface ParticipantRecord {
  id: string;
  created_at: string;
  notes?: string | null;
  demographics?: {
    pseudonym?: string;
    consent_status?: string;
    study_group?: string;
    created_by?: string;
    [key: string]: any;
  } | null;
  session_count: number;
}

export interface SessionSummary {
  id: string;
  participant_id: string;
  protocol_version: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  notes?: string;
  turn_count: number;
}

export interface TurnData {
  turn_id: string;
  turn_index: number;
  transcript: string;
  input_source?: "speech" | "manual_text" | "unity" | string;
  request_id?: string;
  asr_source?: string;
  latency_ms?: number;
  modality_quality: Record<string, number | null>;
  modality_masks: Record<string, boolean>;
  biomarkers: {
    gaze_aversion_index: number;
    vocal_instability: number;
    facial_au_activation: number;
    hr_bpm: number | null;
    hrv_rmssd: number | null;
  };
  acoustic_details?: {
    f0_mean?: number;
    f0_std?: number;
    jitter?: number;
    shimmer?: number;
    hnr?: number;
    spectral_centroid?: number;
    vocal_instability?: number;
    mfcc?: number[];
  };
  gaze_details?: {
    gaze_aversion_index?: number;
    blink_rate?: number;
    pupil_diameter?: number;
    gaze_direction?: { x: number; y: number; z: number };
  };
  face_details?: {
    action_units?: Record<string, number>;
    au_distress_activation?: number;
    head_pose_pitch?: number;
    head_pose_yaw?: number;
    head_pose_roll?: number;
  };
  fusion_output: {
    prediction_score: number;
    confidence: number;
    attention_weights: Record<string, number>;
  };
  next_action: {
    question_id: string;
    text: string;
    topic: string;
    difficulty: number;
    selection_policy: string;
    expected_info_gain: number;
  };
  session_completed: boolean;
  timestamp: string;
}

export interface TimelineSignalPoint {
  time_sec: number;
  turn_index?: number;
  question_id?: string;
  gaze_aversion: number;
  vocal_instability: number;
  au_distress: number;
  face_status: "available" | "degraded" | "masked";
  gaze_status: "available" | "degraded" | "masked";
  voice_status: "available" | "degraded" | "masked";
  text_status: "available" | "degraded" | "masked";
  rppg_status: "available" | "degraded" | "masked";
}

export interface SessionTimelineResponse {
  session_id: string;
  participant_id: string;
  signals: TimelineSignalPoint[];
}

export interface ReplayTurn {
  turn_id: string;
  turn_index: number;
  question_id?: string;
  question_text?: string;
  transcript?: string;
  timestamp: string;
  observations: Record<string, {
    quality: number;
    masked: boolean;
    features: any;
  }>;
  fusion?: {
    prediction_score: number;
    confidence: number;
    attention_weights: Record<string, number>;
  };
  decision?: {
    action_id: string;
    question_text: string;
    info_gain: number;
    topic_coverage: number;
    reward: number;
  };
}

export interface ReplayResponse {
  session_id: string;
  participant_id: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  total_turns: number;
  turns: ReplayTurn[];
}

export interface LongitudinalProfile {
  participant_id: string;
  total_sessions: number;
  sessions: Array<{
    session_id: string;
    date: string;
    status: string;
    turn_count: number;
    duration_seconds: number;
    avg_vocal_instability: number;
    avg_gaze_aversion: number;
    avg_au_distress: number;
    avg_prediction_score: number;
  }>;
}

export interface BenchmarkMetrics {
  auroc: number;
  f1: number;
  precision: number;
  recall: number;
  accuracy: number;
}

export interface ExperimentsResponse {
  status: string;
  active_run?: {
    unimodal_baselines: Record<string, BenchmarkMetrics>;
    ablation_study_e0_e4: Record<string, BenchmarkMetrics>;
    fusion_architectures: Record<string, BenchmarkMetrics>;
    reinforcement_learning: {
      PPO_Adaptive_Questioning: {
        mean_cumulative_reward: number;
        topic_coverage_rate: number;
        turns_to_target_coverage: number;
        repetition_rate: number;
        safety_violations: number;
      };
      Fixed_Script_Baseline: {
        mean_cumulative_reward: number;
        topic_coverage_rate: number;
        turns_to_target_coverage: number;
        repetition_rate: number;
        safety_violations: number;
      };
    };
    benchmark_timestamp: string;
  };
}

export const api = {
  async getHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/system/health`);
    return res.json();
  },

  async getModelStatus(): Promise<ModelStatus> {
    const res = await fetch(`${API_BASE}/models/status`);
    return res.json();
  },

  async getQuestions(): Promise<SafeQuestion[]> {
    const res = await fetch(`${API_BASE}/questions`);
    return res.json();
  },

  async listSessions(): Promise<SessionSummary[]> {
    const res = await fetch(`${API_BASE}/sessions`);
    return res.json();
  },

  async createSession(participantId: string, notes?: string): Promise<SessionSummary> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participantId, notes }),
    });
    return res.json();
  },

  async startSession(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/start`, { method: "POST" });
    return res.json();
  },

  async endSession(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/end`, { method: "POST" });
    return res.json();
  },

  async submitTurn(sessionId: string, payload: {
    turn_index: number;
    question_id_answered?: string;
    transcript_override?: string;
    audio_base64?: string;
    video_frames_base64?: string[];
    request_id?: string;
    input_source?: "speech" | "manual_text" | "unity" | string;
  }): Promise<TurnData> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Submit turn failed (${res.status}): ${err}`);
    }
    return res.json();
  },

  async submitTurnAudio(
    sessionId: string,
    audioBlob: Blob,
    options?: {
      turn_index?: number;
      question_id_answered?: string;
      request_id?: string;
    }
  ): Promise<TurnData> {
    const formData = new FormData();
    formData.append("audio_file", audioBlob, "participant_mic.wav");
    if (options?.question_id_answered) {
      formData.append("question_id_answered", options.question_id_answered);
    }
    if (options?.turn_index !== undefined) {
      formData.append("turn_index", String(options.turn_index));
    }
    if (options?.request_id) {
      formData.append("request_id", options.request_id);
    }
    formData.append("input_source", "speech");

    const res = await fetch(`${API_BASE}/sessions/${sessionId}/turn`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Audio submission failed (${res.status}): ${err}`);
    }
    return res.json();
  },

  async getSignals(sessionId: string): Promise<SessionTimelineResponse> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/signals`);
    return res.json();
  },

  async getReplay(sessionId: string): Promise<ReplayResponse> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/replay`);
    return res.json();
  },

  async listParticipants(): Promise<ParticipantRecord[]> {
    const res = await fetch(`${API_BASE}/participants`);
    if (!res.ok) throw new Error(`Failed to list participants (${res.status})`);
    return res.json();
  },

  async createParticipant(payload: {
    participant_id?: string;
    notes?: string;
    demographics?: Record<string, any>;
  }): Promise<ParticipantRecord> {
    const res = await fetch(`${API_BASE}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create participant (${res.status}): ${errText}`);
    }
    return res.json();
  },

  async getParticipantDetail(participantId: string): Promise<ParticipantRecord> {
    const res = await fetch(`${API_BASE}/participants/${encodeURIComponent(participantId)}`);
    if (!res.ok) throw new Error(`Failed to load participant (${res.status})`);
    return res.json();
  },

  async getParticipantSessions(participantId: string): Promise<SessionSummary[]> {
    const res = await fetch(`${API_BASE}/participants/${encodeURIComponent(participantId)}/sessions`);
    if (!res.ok) throw new Error(`Failed to load participant sessions (${res.status})`);
    return res.json();
  },

  async getSessionDetail(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(`Failed to load session detail (${res.status})`);
    return res.json();
  },

  async getSessionTimeline(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/timeline`);
    if (!res.ok) throw new Error(`Failed to load session timeline (${res.status})`);
    return res.json();
  },

  async getLongitudinal(participantId: string): Promise<LongitudinalProfile> {
    const res = await fetch(`${API_BASE}/participants/${encodeURIComponent(participantId)}/longitudinal`);
    return res.json();
  },

  async getExperiments(): Promise<ExperimentsResponse> {
    const res = await fetch(`${API_BASE}/experiments`);
    return res.json();
  },

  async triggerBenchmark(): Promise<any> {
    const res = await fetch(`${API_BASE}/experiments/run`, { method: "POST" });
    return res.json();
  },

  createWebSocket(sessionId: string): WebSocket {
    return new WebSocket(`${WS_BASE}/dashboard/${sessionId}`);
  }
};

/**
 * Singleton WebSocket Manager preventing duplicate socket instances and reconnect loops.
 */
class SessionWebSocketManager {
  private ws: WebSocket | null = null;
  private currentSessionId: string | null = null;
  private listeners: Set<(event: any) => void> = new Set();
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private reconnectTimer: any = null;

  public connect(sessionId: string) {
    if (this.currentSessionId === sessionId && this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.disconnect();
    this.currentSessionId = sessionId;

    try {
      const ws = new WebSocket(`${WS_BASE}/dashboard/${sessionId}`);
      this.ws = ws;

      ws.onopen = () => {
        this.statusListeners.forEach((cb) => cb(true));
      };

      ws.onclose = () => {
        this.statusListeners.forEach((cb) => cb(false));
      };

      ws.onerror = (err) => {
        console.warn("[WS] Socket error:", err);
        this.statusListeners.forEach((cb) => cb(false));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(msg));
        } catch (e) {
          console.error("[WS] Parse error:", e);
        }
      };
    } catch (err) {
      console.error("[WS] Failed to create WebSocket connection:", err);
      this.statusListeners.forEach((cb) => cb(false));
    }
  }

  public subscribe(
    onMessage: (msg: any) => void,
    onStatusChange?: (connected: boolean) => void
  ): () => void {
    this.listeners.add(onMessage);
    if (onStatusChange) {
      this.statusListeners.add(onStatusChange);
      if (this.ws) {
        onStatusChange(this.ws.readyState === WebSocket.OPEN);
      }
    }

    return () => {
      this.listeners.delete(onMessage);
      if (onStatusChange) {
        this.statusListeners.delete(onStatusChange);
      }
    };
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.currentSessionId = null;
    this.statusListeners.forEach((cb) => cb(false));
  }
}

export const wsManager = new SessionWebSocketManager();
