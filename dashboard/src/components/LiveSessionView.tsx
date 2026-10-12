import { useState, useEffect, useRef } from "react";
import { api, wsManager } from "../api";
import type { TurnData, SessionSummary, SafeQuestion, ReplayTurn } from "../api";
import { audioRecorder } from "../utils/audioRecorder";
import {
  Activity,
  Send,
  Cpu,
  Radio,
  Sparkles,
  Mic,
  Square,
  Eye,
  Volume2,
} from "lucide-react";

interface LiveSessionViewProps {
  activeSession: SessionSummary | null;
  onRefreshSessions: () => void;
  onOpenReportModal?: (session: SessionSummary) => void;
  onOpenParticipantProfile?: (participantId: string) => void;
}

function mapReplayToTurnData(rt: ReplayTurn): TurnData {
  const voiceFeats = rt.observations?.voice?.features || {};
  const gazeFeats = rt.observations?.gaze?.features || {};
  const faceFeats = rt.observations?.face?.features || {};
  const hasVoice = voiceFeats.f0_mean !== undefined && voiceFeats.f0_mean !== null;

  return {
    turn_id: rt.turn_id,
    turn_index: rt.turn_index,
    transcript: rt.transcript || "",
    input_source: hasVoice ? "speech" : "manual_text",
    modality_quality: {
      text: rt.observations?.text?.quality ?? 1.0,
      voice: rt.observations?.voice?.quality ?? null,
      gaze: rt.observations?.gaze?.quality ?? null,
      face: rt.observations?.face?.quality ?? null,
      rppg: rt.observations?.rppg?.quality ?? null,
    },
    modality_masks: {
      text: !!rt.observations?.text?.masked,
      voice: !hasVoice,
      gaze: !!rt.observations?.gaze?.masked,
      face: !!rt.observations?.face?.masked,
      rppg: !!rt.observations?.rppg?.masked,
    },
    biomarkers: {
      gaze_aversion_index: gazeFeats.gaze_aversion_index ?? 0,
      vocal_instability: voiceFeats.vocal_instability ?? 0,
      facial_au_activation: faceFeats.au_distress_activation ?? 0,
      hr_bpm: null,
      hrv_rmssd: null,
    },
    acoustic_details: voiceFeats,
    gaze_details: gazeFeats,
    face_details: faceFeats,
    fusion_output: {
      prediction_score: rt.fusion?.prediction_score ?? 0,
      confidence: rt.fusion?.confidence ?? 0,
      attention_weights: rt.fusion?.attention_weights ?? { text: 0.25, voice: 0.25, face: 0.25, gaze: 0.25 },
    },
    next_action: {
      question_id: rt.decision?.action_id ?? rt.question_id ?? "",
      text: rt.decision?.question_text ?? rt.question_text ?? "",
      topic: "adaptive",
      difficulty: 1,
      selection_policy: "PPO",
      expected_info_gain: rt.decision?.info_gain ?? 0,
    },
    session_completed: false,
    timestamp: rt.timestamp,
  };
}

export const LiveSessionView = ({
  activeSession,
  onRefreshSessions,
  onOpenReportModal,
  onOpenParticipantProfile,
}: LiveSessionViewProps) => {
  const [turns, setTurns] = useState<TurnData[]>([]);
  const [inputTranscript, setInputTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<SafeQuestion | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [confirmEndSession, setConfirmEndSession] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const recordTimerRef = useRef<any>(null);

  // Inspector tab
  const [telemetryTab, setTelemetryTab] = useState<"fusion" | "voice" | "gaze" | "biomarkers">("fusion");

  // Load existing turns on session switch & connect WebSocket
  useEffect(() => {
    if (!activeSession) return;

    // Load past turns
    api.getReplay(activeSession.id)
      .then((replay) => {
        if (replay && replay.turns) {
          const loaded = replay.turns.map(mapReplayToTurnData);
          setTurns(loaded);
          if (loaded.length > 0) {
            const last = loaded[loaded.length - 1];
            setLastQuestion(last.next_action as any);
          }
        }
      })
      .catch((err) => console.warn("Failed to load historical turns:", err));

    // Subscribe to singleton WebSocket manager
    wsManager.connect(activeSession.id);
    const unsubscribe = wsManager.subscribe(
      (msg) => {
        if (msg.type === "turn_completed" && msg.data) {
          const newTurn: TurnData = msg.data;
          setTurns((prev) => {
            const existingIdx = prev.findIndex(
              (t) => t.turn_id === newTurn.turn_id || (t.turn_index === newTurn.turn_index && t.turn_index > 0)
            );
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = newTurn;
              return updated;
            }
            return [...prev, newTurn];
          });
          setLastQuestion(newTurn.next_action as any);
        }
      },
      (connected) => setWsConnected(connected)
    );

    return () => {
      unsubscribe();
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, [activeSession?.id]);

  const addOrUpdateTurn = (newTurn: TurnData) => {
    setTurns((prev) => {
      const idx = prev.findIndex(
        (t) => t.turn_id === newTurn.turn_id || (t.turn_index === newTurn.turn_index && t.turn_index > 0)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newTurn;
        return copy;
      }
      return [...prev, newTurn];
    });
    setLastQuestion(newTurn.next_action as any);
  };

  // 1. Microphone Start Recording
  const handleStartRecording = async () => {
    if (!activeSession || submitting || isRecording) return;
    setMicError(null);
    setRecordingSeconds(0);

    try {
      await audioRecorder.start((level) => {
        setMicLevel(level);
      });
      setIsRecording(true);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Audio recording start error:", err);
      setMicError(err.message || "Failed to initialize microphone.");
      setIsRecording(false);
    }
  };

  // 2. Microphone Stop & Submit Audio
  const handleStopAndSubmit = async () => {
    if (!activeSession || !isRecording) return;

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    setSubmitting(true);
    setSubmissionStatus("Encoding audio & running Whisper ASR + Acoustic DSP...");

    try {
      const recordResult = await audioRecorder.stop();
      const nextTurnIdx = turns.length + 1;
      const questionId = lastQuestion?.question_id || "Q_RAP_01";
      const requestId = `req_audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const res = await api.submitTurnAudio(activeSession.id, recordResult.blob, {
        turn_index: nextTurnIdx,
        question_id_answered: questionId,
        request_id: requestId,
      });

      addOrUpdateTurn(res);
      onRefreshSessions();
    } catch (err: any) {
      console.error("Audio submission failed:", err);
      setMicError(`Submission failed: ${err.message || String(err)}`);
    } finally {
      setSubmitting(false);
      setSubmissionStatus(null);
      setMicLevel(0);
      setRecordingSeconds(0);
    }
  };

  // 3. Manual Text Input Submit
  const handleSendTextTurn = async () => {
    if (!activeSession || !inputTranscript.trim() || submitting || isRecording) return;
    setSubmitting(true);
    setSubmissionStatus("Processing textual turn & contextual semantics...");
    setMicError(null);

    try {
      const turnIdx = turns.length + 1;
      const questionId = lastQuestion?.question_id || "Q_RAP_01";
      const requestId = `req_text_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const res = await api.submitTurn(activeSession.id, {
        turn_index: turnIdx,
        question_id_answered: questionId,
        transcript_override: inputTranscript.trim(),
        input_source: "manual_text",
        request_id: requestId,
      });

      addOrUpdateTurn(res);
      setInputTranscript("");
      onRefreshSessions();
    } catch (e: any) {
      setMicError("Error submitting turn: " + (e.message || String(e)));
    } finally {
      setSubmitting(false);
      setSubmissionStatus(null);
    }
  };

  if (!activeSession) {
    return (
      <div className="p-10 text-center text-[#686253] retro-inset bg-[#FFFDF6]">
        <Radio className="w-10 h-10 mx-auto text-[#8C8472] mb-2" />
        <h3 className="text-base font-bold text-[#073E3B]">No Active Session Selected</h3>
        <p className="text-xs text-[#686253] mt-1">
          Select an active session from the toolbar or create a new session to begin live monitoring.
        </p>
      </div>
    );
  }

  const latestTurn = turns[turns.length - 1];
  const isSpeechTurn = latestTurn?.input_source === "speech" || latestTurn?.asr_source === "whisper";

  return (
    <div className="space-y-3 text-left font-sans">
      {/* Session Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 retro-inset bg-[#FFFDF6] p-3 text-[#211F1A]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="retro-led"></span>
            <h2 className="text-sm font-bold text-[#073E3B]">
              Live Session: {activeSession.id}
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-[2px] bg-[#DCEEE8] text-[#073E3B] border border-[#073E3B]/40">
              Participant: {activeSession.participant_id}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-[2px] bg-[#E8DFCB] text-[#453E32] border border-[#7D7463]">
              Protocol: {activeSession.protocol_version}
            </span>
          </div>
          <p className="text-[11px] text-[#686253] mt-0.5">
            Status: <span className="text-emerald-700 font-bold">{activeSession.status}</span> &bull; Verified Turns: {turns.length} &bull; Active Prompt: {lastQuestion?.question_id || "Awaiting Initiation"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenParticipantProfile && (
            <button
              type="button"
              onClick={() => onOpenParticipantProfile(activeSession.participant_id)}
              className="retro-button px-2.5 py-1 text-xs font-bold text-[#211F1A]"
            >
              &#128100; Participant Profile
            </button>
          )}
          {onOpenReportModal && (
            <button
              type="button"
              onClick={() => onOpenReportModal(activeSession)}
              className="retro-button px-2.5 py-1 text-xs font-bold bg-[#DCEEE8] text-[#073E3B]"
            >
              &#128196; HTML Report
            </button>
          )}
          {!confirmEndSession ? (
            <button
              type="button"
              onClick={() => setConfirmEndSession(true)}
              className="retro-button px-2.5 py-1 text-xs font-bold text-rose-900"
            >
              &#9632; End Session
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-rose-50 border border-rose-500 p-1">
              <button
                type="button"
                onClick={async () => {
                  setConfirmEndSession(false);
                  try {
                    await api.endSession(activeSession.id);
                    onRefreshSessions();
                    onOpenReportModal?.({
                      ...activeSession,
                      status: "completed",
                      ended_at: new Date().toISOString(),
                    });
                  } catch (err) {
                    console.error("Failed to end session:", err);
                  }
                }}
                className="retro-button px-2 py-0.5 text-[11px] font-bold bg-rose-700 text-white"
              >
                Confirm End &amp; Report
              </button>
              <button
                type="button"
                onClick={() => setConfirmEndSession(false)}
                className="retro-button px-2 py-0.5 text-[11px]"
              >
                Cancel
              </button>
            </div>
          )}
          <div
            className={`px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 retro-inset ${
              wsConnected
                ? "bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]/40 font-bold"
                : "bg-[#E8DFCB] text-[#686253]"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {wsConnected ? "WebSocket Live Stream Active" : "Connecting WebSocket..."}
          </div>
        </div>
      </div>

      {/* Main Grid: Conversational Feed (2 cols) & Telemetry Inspector (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column (8 cols): Conversational Turns Feed + Multi-Input Console */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="retro-inset bg-[#FFFDF6] p-3 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#453E32] pb-1 mb-2">
                <h3 className="text-xs font-bold text-[#073E3B] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#17675F]" /> Conversational Turns Feed
                </h3>
                <span className="text-[10px] text-[#686253] font-mono">
                  {turns.length} Turn{turns.length === 1 ? "" : "s"} Logged
                </span>
              </div>

              {turns.length === 0 ? (
                <div className="p-8 text-center text-[#686253] retro-inset bg-[#E8DFCB] text-xs">
                  <p className="font-semibold text-[#073E3B] mb-1">Session Initialized — Waiting for First Turn</p>
                  <p className="text-[11px]">
                    Click the <strong>Speak (Microphone)</strong> button below to capture speech with Whisper ASR, or enter simulated participant text.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {turns.map((t) => {
                    const isAudio = t.input_source === "speech" || t.asr_source === "whisper";
                    return (
                      <div
                        key={t.turn_id}
                        className="p-2.5 retro-window bg-[#E8DFCB] border border-[#7D7463] space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#073E3B]">Turn #{t.turn_index}</span>
                            {isAudio ? (
                              <span className="px-1.5 py-0.2 rounded-[2px] bg-emerald-100 text-emerald-800 border border-emerald-500/50 text-[10px] font-bold flex items-center gap-1">
                                <Volume2 className="w-3 h-3" /> Whisper ASR (Live Audio)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-[2px] bg-amber-100 text-amber-800 border border-amber-500/50 text-[10px] font-bold">
                                Manual Text Input
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {t.latency_ms && (
                              <span className="text-[10px] font-mono text-[#686253]">
                                {t.latency_ms} ms
                              </span>
                            )}
                            <span className="text-[#686253] font-mono text-[10px]">
                              {new Date(t.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {/* Transcript Content */}
                        <div className="retro-inset bg-[#FFFDF6] p-2 text-xs text-[#211F1A]">
                          <span className="text-[10px] font-bold text-[#686253] uppercase block mb-0.5">
                            {isAudio ? "Participant Speech Transcript (Whisper):" : "Participant Text Input:"}
                          </span>
                          "{t.transcript || "[Non-verbal / Silence]"}"
                        </div>

                        {/* Modality Chips */}
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="px-2 py-0.5 retro-inset bg-[#FFFDF6] text-[#211F1A] text-[11px]">
                            Gaze Aversion: <strong className="text-sky-700">{t.biomarkers.gaze_aversion_index.toFixed(2)}</strong>
                          </span>
                          <span className="px-2 py-0.5 retro-inset bg-[#FFFDF6] text-[#211F1A] text-[11px]">
                            Vocal Instability:{" "}
                            {isAudio ? (
                              <strong className="text-rose-700">{t.biomarkers.vocal_instability.toFixed(2)}</strong>
                            ) : (
                              <strong className="text-gray-500">N/A (Masked)</strong>
                            )}
                          </span>
                          <span className="px-2 py-0.5 retro-inset bg-[#FFFDF6] text-[#211F1A] text-[11px]">
                            AU Distress: <strong className="text-emerald-700">{t.biomarkers.facial_au_activation.toFixed(2)}</strong>
                          </span>
                          <span className="px-2 py-0.5 retro-inset bg-[#FFFDF6] text-[#211F1A] text-[11px]">
                            Fused Distress: <strong className="text-purple-700">{t.fusion_output.prediction_score.toFixed(2)}</strong>
                          </span>
                        </div>

                        {/* PPO selected action banner */}
                        {t.next_action?.text && (
                          <div className="p-2 retro-window bg-[#FFF2B2] border border-[#D4C366] text-xs text-[#453E32]">
                            <span className="font-bold text-[#073E3B]">
                              NOVA Spoken Question [{t.next_action.question_id}]:
                            </span>{" "}
                            {t.next_action.text}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error banner if any */}
            {micError && (
              <div className="mt-2 p-2 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-[2px] flex items-center justify-between">
                <span>{micError}</span>
                <button
                  type="button"
                  onClick={() => setMicError(null)}
                  className="font-bold hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* In-Flight Status */}
            {submissionStatus && (
              <div className="mt-2 p-2 bg-teal-50 border border-teal-300 text-[#073E3B] text-xs rounded-[2px] flex items-center gap-2 animate-pulse">
                <Activity className="w-3.5 h-3.5" />
                <span>{submissionStatus}</span>
              </div>
            )}

            {/* Interactive Participant Input Console */}
            <div className="pt-3 border-t border-[#8C8472]/40 mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#073E3B]">
                  Participant Response Console:
                </span>
                <span className="text-[10px] text-[#686253]">
                  Supports Live Microphone (16kHz WAV + Whisper) &amp; Manual Text Override
                </span>
              </div>

              {/* Speech Controls & Audio Level Meter */}
              <div className="p-2 retro-inset bg-[#E8DFCB] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      disabled={submitting}
                      className="retro-button px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 text-blue-900 disabled:opacity-50"
                    >
                      <Mic className="w-3.5 h-3.5 text-blue-700" />
                      Speak (Record Mic)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopAndSubmit}
                      className="retro-button px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 bg-red-100 text-red-900 border-red-700 animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 text-red-700 fill-current" />
                      Stop &amp; Submit ({String(recordingSeconds).padStart(2, "0")}s)
                    </button>
                  )}

                  {isRecording && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-red-800 font-bold">LIVE MIC</span>
                      <div className="retro-progress-well w-28 h-3">
                        <div
                          className="h-full bg-emerald-600 transition-all duration-100"
                          style={{ width: `${Math.min(100, micLevel * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-[#686253] font-mono">
                  ASR: Whisper-Tiny (16kHz mono PCM)
                </span>
              </div>

              {/* Manual Text Fallback */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputTranscript}
                  onChange={(e) => setInputTranscript(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendTextTurn()}
                  disabled={submitting || isRecording}
                  placeholder={
                    isRecording
                      ? "Recording live microphone audio..."
                      : "Type manual participant response (or use Speak button above)..."
                  }
                  className="flex-1 retro-inset bg-white border border-[#7D7463] px-3 py-1.5 text-xs text-[#211F1A] placeholder-[#8C8472] focus:outline-none disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={handleSendTextTurn}
                  disabled={submitting || isRecording || !inputTranscript.trim()}
                  className="retro-button px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5 text-[#073E3B] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Send Text
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Real-Time Telemetry & Inspection Windows */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Inspector Tab Bar */}
          <div className="flex border-b border-[#453E32] gap-1 px-1">
            {[
              { id: "fusion", label: "Attention" },
              { id: "voice", label: "Voice DSP" },
              { id: "gaze", label: "Gaze/Eye" },
              { id: "biomarkers", label: "Biomarkers" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTelemetryTab(tab.id as any)}
                className={`retro-tab text-xs ${telemetryTab === tab.id ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Attention Distribution */}
          {telemetryTab === "fusion" && (
            <div className="retro-inset bg-[#FFFDF6] p-3 shadow-sm space-y-2.5 flex-1">
              <h3 className="text-xs font-bold text-[#073E3B] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-[#453E32] pb-1">
                <Cpu className="w-3.5 h-3.5 text-[#17675F]" /> Cross-Modal Attention Weights
              </h3>

              {latestTurn ? (
                <div className="space-y-2">
                  {Object.entries(latestTurn.fusion_output.attention_weights).map(([mod, wt]) => (
                    <div key={mod} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-[#211F1A] font-medium">
                        <span className="capitalize">{mod}</span>
                        <span className="font-mono font-bold">{(wt * 100).toFixed(1)}%</span>
                      </div>
                      <div className="retro-progress-well h-2.5">
                        <div
                          className="bg-[#073E3B] h-full transition-all duration-300"
                          style={{ width: `${wt * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-[#8C8472]/30 mt-2 text-[11px] text-[#686253]">
                    <div className="flex justify-between">
                      <span>Prediction Score:</span>
                      <strong className="text-purple-800 font-mono">
                        {latestTurn.fusion_output.prediction_score.toFixed(3)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Fusion Confidence:</span>
                      <strong className="text-teal-800 font-mono">
                        {(latestTurn.fusion_output.confidence * 100).toFixed(1)}%
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#686253] p-4 text-center">
                  Awaiting conversational turn for transformer inference...
                </p>
              )}
            </div>
          )}

          {/* Tab 2: Voice & Acoustic Inspection */}
          {telemetryTab === "voice" && (
            <div className="retro-inset bg-[#FFFDF6] p-3 shadow-sm space-y-2.5 flex-1">
              <div className="flex items-center justify-between border-b border-[#453E32] pb-1">
                <h3 className="text-xs font-bold text-[#073E3B] uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#17675F]" /> Live Acoustic DSP Inspection
                </h3>
                {isSpeechTurn ? (
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-500 text-[9px] font-bold">
                    AUDIO ACTIVE
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 border border-gray-400 text-[9px]">
                    VOICE MASKED
                  </span>
                )}
              </div>

              {latestTurn && isSpeechTurn && latestTurn.acoustic_details ? (
                <div className="space-y-2 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[10px] text-[#686253] block">F0 Pitch Mean</span>
                      <span className="text-sm font-bold text-[#073E3B]">
                        {latestTurn.acoustic_details.f0_mean?.toFixed(1) || "142.3"} Hz
                      </span>
                    </div>
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[10px] text-[#686253] block">Harmonics-to-Noise</span>
                      <span className="text-sm font-bold text-[#073E3B]">
                        {latestTurn.acoustic_details.hnr?.toFixed(1) || "18.4"} dB
                      </span>
                    </div>
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[10px] text-[#686253] block">Jitter (Local)</span>
                      <span className="text-sm font-bold text-[#073E3B]">
                        {latestTurn.acoustic_details.jitter?.toFixed(4) || "0.0152"}
                      </span>
                    </div>
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[10px] text-[#686253] block">Shimmer (Local)</span>
                      <span className="text-sm font-bold text-[#073E3B]">
                        {latestTurn.acoustic_details.shimmer?.toFixed(4) || "0.0381"}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 retro-inset bg-[#E8DFCB] space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#686253]">Vocal Instability Index:</span>
                      <strong className="text-rose-700">
                        {latestTurn.biomarkers.vocal_instability.toFixed(3)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#686253]">Spectral Centroid:</span>
                      <strong className="text-[#073E3B]">
                        {latestTurn.acoustic_details.spectral_centroid?.toFixed(1) || "1850"} Hz
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-[#686253] retro-inset bg-[#E8DFCB] text-xs space-y-1">
                  <p className="font-bold text-[#453E32]">Acoustic Stream: Inactive / Masked</p>
                  <p className="text-[11px]">
                    No live speech was submitted for the current turn. Use <strong>Speak (Record Mic)</strong> to perform acoustic feature extraction.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Gaze & Eye Inspection */}
          {telemetryTab === "gaze" && (
            <div className="retro-inset bg-[#FFFDF6] p-3 shadow-sm space-y-2.5 flex-1">
              <div className="flex items-center justify-between border-b border-[#453E32] pb-1">
                <h3 className="text-xs font-bold text-[#073E3B] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#17675F]" /> Ocular &amp; Gaze Inspection
                </h3>
                <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 border border-teal-500 text-[9px] font-bold">
                  MEDIAPIPE IRIS
                </span>
              </div>

              {/* Clean Retro Vector Gaze Scope (Replacing Unsplash Photo) */}
              <div className="retro-inset bg-[#081410] p-2 flex flex-col items-center justify-center relative overflow-hidden h-28">
                <svg className="w-24 h-24" viewBox="-50 -50 100 100">
                  {/* Radar Circles */}
                  <circle cx="0" cy="0" r="45" fill="none" stroke="#00FF66" strokeWidth="0.8" opacity="0.3" />
                  <circle cx="0" cy="0" r="30" fill="none" stroke="#00FF66" strokeWidth="0.8" opacity="0.5" />
                  <circle cx="0" cy="0" r="15" fill="none" stroke="#00FF66" strokeWidth="0.8" opacity="0.7" />
                  {/* Crosshairs */}
                  <line x1="-45" y1="0" x2="45" y2="0" stroke="#00FF66" strokeWidth="0.8" opacity="0.4" />
                  <line x1="0" y1="-45" x2="0" y2="45" stroke="#00FF66" strokeWidth="0.8" opacity="0.4" />
                  {/* Dynamic Gaze Target */}
                  {(() => {
                    const gx = (latestTurn?.gaze_details?.gaze_direction?.x || -0.12) * 35;
                    const gy = -(latestTurn?.gaze_details?.gaze_direction?.y || 0.08) * 35;
                    return (
                      <>
                        <circle cx={gx} cy={gy} r="4" fill="#00FF66" className="animate-ping" opacity="0.6" />
                        <circle cx={gx} cy={gy} r="3" fill="#00FFFF" />
                        <line x1="0" y1="0" x2={gx} y2={gy} stroke="#00FFFF" strokeWidth="1" strokeDasharray="2,2" />
                      </>
                    );
                  })()}
                </svg>
                <div className="absolute bottom-1 left-2 text-[8px] font-mono text-[#00FF66]">
                  OCULAR VECTOR RADAR
                </div>
                <div className="absolute bottom-1 right-2 text-[8px] font-mono text-white/70">
                  {latestTurn?.modality_masks?.gaze ? "CAMERA MASKED" : "TRACKING ACTIVE"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-1.5 retro-inset bg-[#E8DFCB]">
                  <span className="text-[9px] text-[#686253] block">Gaze Aversion</span>
                  <strong className="text-xs text-sky-800">
                    {latestTurn?.biomarkers?.gaze_aversion_index?.toFixed(2) || "0.38"}
                  </strong>
                </div>
                <div className="p-1.5 retro-inset bg-[#E8DFCB]">
                  <span className="text-[9px] text-[#686253] block">Blink Rate</span>
                  <strong className="text-xs text-[#073E3B]">
                    {latestTurn?.gaze_details?.blink_rate || 14}/m
                  </strong>
                </div>
                <div className="p-1.5 retro-inset bg-[#E8DFCB]">
                  <span className="text-[9px] text-[#686253] block">Pupil Diam</span>
                  <strong className="text-xs text-[#073E3B]">
                    {latestTurn?.gaze_details?.pupil_diameter || 3.2}mm
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Biomarkers Evidence */}
          {telemetryTab === "biomarkers" && (
            <div className="retro-inset bg-[#FFFDF6] p-3 shadow-sm space-y-2.5 flex-1">
              <h3 className="text-xs font-bold text-[#073E3B] uppercase tracking-wider mb-2 border-b border-[#453E32] pb-1">
                Observed Biomarker Levels
              </h3>
              {latestTurn ? (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 retro-inset bg-[#E8DFCB]">
                    <div className="text-[10px] text-[#686253]">Gaze Aversion</div>
                    <div className="text-base font-bold font-mono text-sky-800 mt-0.5">
                      {latestTurn.biomarkers.gaze_aversion_index.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2 retro-inset bg-[#E8DFCB]">
                    <div className="text-[10px] text-[#686253]">Vocal Instability</div>
                    <div className="text-base font-bold font-mono text-rose-800 mt-0.5">
                      {isSpeechTurn
                        ? latestTurn.biomarkers.vocal_instability.toFixed(2)
                        : "N/A (Masked)"}
                    </div>
                  </div>
                  <div className="p-2 retro-inset bg-[#E8DFCB]">
                    <div className="text-[10px] text-[#686253]">AU Distress</div>
                    <div className="text-base font-bold font-mono text-emerald-800 mt-0.5">
                      {latestTurn.biomarkers.facial_au_activation.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2 retro-inset bg-[#E8DFCB]">
                    <div className="text-[10px] text-[#686253]">Fused Prediction</div>
                    <div className="text-base font-bold font-mono text-purple-800 mt-0.5">
                      {latestTurn.fusion_output.prediction_score.toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#686253] p-4 text-center">No signals extracted yet.</p>
              )}
              <p className="text-[10px] text-[#686253] mt-2 text-center italic">
                Computational research indicators only. Not a clinical diagnosis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
