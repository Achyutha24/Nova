import React, { useState, useEffect } from "react";
import { RetroWindow } from "./RetroWindow";
import { LiveSessionWindow } from "./LiveSessionWindow";
import { RealtimeAnalysisWindow } from "./RealtimeAnalysisWindow";
import { MultimodalSignalsRow } from "./MultimodalSignalsRow";
import { SessionTimelineWindow } from "./SessionTimelineWindow";
import { ModelOutputsWindow } from "./ModelOutputsWindow";
import { ResearcherNotesWindow } from "./ResearcherNotesWindow";
import type {
  SessionSummary,
  TimelineSignalPoint,
  ParticipantRecord,
} from "../../api";
import { api, wsManager } from "../../api";

interface HomeConsoleViewProps {
  session: SessionSummary | null;
  sessions?: SessionSummary[];
  participants?: ParticipantRecord[];
  selectedParticipant?: ParticipantRecord | null;
  signals: TimelineSignalPoint[];
  onRefreshData?: () => void;
  onAddNewParticipant?: () => void;
  onSelectExistingParticipant?: () => void;
  onOpenParticipantProfile?: (participantId?: string) => void;
  onStartNewSessionWizard?: () => void;
  onOpenSessionHistory?: () => void;
  onSelectSession?: (s: SessionSummary) => void;
  onOpenReportModal?: (s: SessionSummary) => void;
  researcherId?: string;
}

export const HomeConsoleView: React.FC<HomeConsoleViewProps> = ({
  session,
  sessions = [],
  participants = [],
  selectedParticipant,
  signals,
  onRefreshData,
  onAddNewParticipant,
  onSelectExistingParticipant,
  onOpenParticipantProfile,
  onStartNewSessionWizard,
  onOpenSessionHistory,
  onSelectSession,
  onOpenReportModal,
  researcherId = "RES-NOVA-01",
}) => {
  const [showRecentActivity, setShowRecentActivity] = useState(false);
  const [confirmEndHomeSession, setConfirmEndHomeSession] = useState(false);

  const [activeQuestion, setActiveQuestion] = useState(
    "How have you been feeling overall this week? You can take your time to share."
  );
  const [activeQuestionId, setActiveQuestionId] = useState("Q_RAP_01");

  const [transcriptHistory, setTranscriptHistory] = useState<
    Array<{ sender: "NOVA" | "You"; text: string; time: string; isAudio?: boolean }>
  >([
    {
      sender: "NOVA",
      text: "How have you been feeling overall this week?",
      time: "10:18 AM",
    },
  ]);

  const [biomarkers, setBiomarkers] = useState({
    stress: 0.58,
    anxiety: 0.45,
    arousal: 0.42,
    engagement: 0.75,
    positiveAffect: 0.38,
    overallState: "Moderate Stress",
    confidence: 0.78,
    dataQuality: "Good",
  });

  const [vocalFeatures, setVocalFeatures] = useState<Record<string, number>>({});
  const [gazeFeatures, setGazeFeatures] = useState<Record<string, any>>({
    gaze_aversion_index: 0.38,
    blink_rate: 14.0,
    pupil_diameter: 3.1,
    gaze_direction: { x: -0.12, y: 0.08, z: 0.95 },
  });
  const [faceFeatures, setFaceFeatures] = useState<Record<string, any>>({
    action_units: { AU01: 0.15, AU02: 0.28, AU04: 0.32, AU06: 0.24, AU12: 0.18 },
    au_distress_activation: 0.28,
  });
  const [attentionWeights, setAttentionWeights] = useState<Record<string, number>>({
    text: 0.35,
    voice: 0.25,
    face: 0.22,
    gaze: 0.18,
  });

  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isAudioSpeech, setIsAudioSpeech] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Real summary counters from backend/storage
  const totalParticipantsCount = participants.length;
  const totalSessionsCount = sessions.length;
  const completedSessionsCount = sessions.filter((s) => s.status === "completed").length;
  const reviewOrIncompleteCount = sessions.filter(
    (s) => s.status !== "completed" || s.turn_count === 0
  ).length;

  // Load existing session history on mount or when session changes
  useEffect(() => {
    if (!session) return;

    api
      .getReplay(session.id)
      .then((replay) => {
        if (replay && replay.turns && replay.turns.length > 0) {
          const history: Array<{
            sender: "NOVA" | "You";
            text: string;
            time: string;
            isAudio?: boolean;
          }> = [];

          replay.turns.forEach((t) => {
            const timeStr = t.timestamp
              ? new Date(t.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "00:00";

            const vFeats = t.observations?.voice?.features || {};
            const isAudioTurn = vFeats.f0_mean !== undefined;

            if (t.transcript) {
              history.push({
                sender: "You",
                text: t.transcript,
                time: timeStr,
                isAudio: isAudioTurn,
              });
            }
            if (t.decision?.question_text) {
              history.push({
                sender: "NOVA",
                text: t.decision.question_text,
                time: timeStr,
              });
            }
          });

          if (history.length > 0) {
            setTranscriptHistory(history);
            const lastTurn = replay.turns[replay.turns.length - 1];
            if (lastTurn.transcript) {
              setCurrentTranscript(lastTurn.transcript);
            }
            if (lastTurn.decision?.question_text) {
              setActiveQuestion(lastTurn.decision.question_text);
            }
            if (lastTurn.decision?.action_id) {
              setActiveQuestionId(lastTurn.decision.action_id);
            }

            // Populate telemetry from last turn
            const vf = lastTurn.observations?.voice?.features;
            if (vf && vf.f0_mean !== undefined) {
              setVocalFeatures(vf);
              setIsAudioSpeech(true);
            }
            const gf = lastTurn.observations?.gaze?.features;
            if (gf) setGazeFeatures(gf);
            const ff = lastTurn.observations?.face?.features;
            if (ff) setFaceFeatures(ff);
            if (lastTurn.fusion?.attention_weights) {
              setAttentionWeights(lastTurn.fusion.attention_weights);
            }
          }
        }
      })
      .catch((err) => console.warn("Failed to load session replay turns:", err));

    // Subscribe to WebSocket updates for real-time turn sync
    const unsubscribe = wsManager.subscribe((msg) => {
      if (msg.type === "turn_completed" && msg.data) {
        applyTurnData(msg.data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [session?.id]);

  const applyTurnData = (turnRes: any) => {
    const timeNow = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const isSpeech = turnRes.input_source === "speech" || turnRes.asr_source === "whisper";
    setIsAudioSpeech(isSpeech);

    if (turnRes.transcript) {
      setCurrentTranscript(turnRes.transcript);
      setTranscriptHistory((prev) => [
        ...prev,
        { sender: "You", text: turnRes.transcript, time: timeNow, isAudio: isSpeech },
      ]);
    }

    if (turnRes.next_action?.text) {
      setActiveQuestion(turnRes.next_action.text);
      setActiveQuestionId(turnRes.next_action.question_id);
      setTranscriptHistory((prev) => [
        ...prev,
        { sender: "NOVA", text: turnRes.next_action.text, time: timeNow },
      ]);
    }

    if (turnRes.acoustic_details && isSpeech) {
      setVocalFeatures(turnRes.acoustic_details);
    }
    if (turnRes.gaze_details) {
      setGazeFeatures(turnRes.gaze_details);
    }
    if (turnRes.face_details) {
      setFaceFeatures(turnRes.face_details);
    }
    if (turnRes.fusion_output?.attention_weights) {
      setAttentionWeights(turnRes.fusion_output.attention_weights);
    }

    if (turnRes.biomarkers) {
      const vInst = isSpeech ? turnRes.biomarkers.vocal_instability || 0.4 : 0.2;
      const gAv = turnRes.biomarkers.gaze_aversion_index || 0.35;
      const auDist = turnRes.biomarkers.facial_au_activation || 0.3;
      const score = turnRes.fusion_output?.prediction_score || 0.5;

      setBiomarkers({
        stress: Math.min(1, Math.max(0, (vInst + auDist) / 2)),
        anxiety: Math.min(1, Math.max(0, (gAv + vInst) / 2)),
        arousal: Math.min(1, Math.max(0, vInst * 0.8 + 0.1)),
        engagement: Math.max(0.2, 1 - gAv),
        positiveAffect: Math.max(0.1, 0.6 - auDist * 0.5),
        overallState:
          score > 0.7
            ? "Elevated Distress"
            : score > 0.4
            ? "Moderate Stress"
            : "Low Stress",
        confidence: turnRes.fusion_output?.confidence || 0.78,
        dataQuality: isSpeech ? "Good (Multimodal)" : "Good (Textual)",
      });
    }
  };

  // Handler for manual typed message
  const handleSendMessage = async (text: string) => {
    if (!session || submitting) return;
    setSubmitting(true);

    try {
      const requestId = `req_text_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      const turnRes = await api.submitTurn(session.id, {
        transcript_override: text,
        turn_index: transcriptHistory.length + 1,
        question_id_answered: activeQuestionId,
        input_source: "manual_text",
        request_id: requestId,
      });

      applyTurnData(turnRes);
      onRefreshData?.();
    } catch (err) {
      console.error("Error submitting manual text in retro console:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for recorded audio submission (from Speak button)
  const handleSendAudio = async (audioBlob: Blob) => {
    if (!session || submitting) return;
    setSubmitting(true);

    try {
      const requestId = `req_audio_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      const turnRes = await api.submitTurnAudio(session.id, audioBlob, {
        turn_index: transcriptHistory.length + 1,
        question_id_answered: activeQuestionId,
        request_id: requestId,
      });

      applyTurnData(turnRes);
      onRefreshData?.();
    } catch (err) {
      console.error("Error submitting speech audio in retro console:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndSession = async () => {
    if (!session || submitting) return;
    setConfirmEndHomeSession(true);
  };

  const confirmAndFinalizeSession = async () => {
    if (!session) return;
    setConfirmEndHomeSession(false);
    try {
      await api.endSession(session.id);
      onRefreshData?.();
      onOpenReportModal?.({
        ...session,
        status: "completed",
        ended_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error ending session:", err);
    }
  };

  return (
    <div className="flex flex-col gap-2 pb-14 text-left">
      {/* =====================================================================
          0. RESEARCHER WORKFLOW COMMAND CENTER (Dashboard Home Entry Hub)
         ===================================================================== */}
      <RetroWindow
        title="Dashboard Home — Researcher Workflow &amp; Participant Command Center"
        icon={<span>&#128203;</span>}
      >
        <div className="retro-inset bg-[#FFFDF6] p-2.5 space-y-2 text-xs text-[#211F1A]">
          {/* Top Row: Primary Choose Action Buttons + Real Summary Counters */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 items-center">
            {/* Primary Workflow Actions */}
            <div className="xl:col-span-6 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onAddNewParticipant}
                className="retro-button px-3 py-1.5 font-bold text-xs bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
              >
                + Add New Participant
              </button>
              <button
                type="button"
                onClick={onSelectExistingParticipant}
                className="retro-button px-3 py-1.5 font-bold text-xs text-[#073E3B]"
              >
                &#128100; Select Existing Participant
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenParticipantProfile?.(
                    selectedParticipant?.id || session?.participant_id
                  )
                }
                className="retro-button px-2.5 py-1.5 font-bold text-xs text-[#211F1A]"
              >
                Participant Profile ({selectedParticipant?.id || session?.participant_id || "P_0012"})
              </button>
              <button
                type="button"
                onClick={onStartNewSessionWizard}
                className="retro-button px-2.5 py-1.5 font-bold text-xs text-[#073E3B]"
              >
                &#9654; Start New Session
              </button>
              <button
                type="button"
                onClick={onOpenSessionHistory}
                className="retro-button px-2.5 py-1.5 text-xs text-[#211F1A]"
              >
                &#128194; Session History
              </button>
              {session && (
                <button
                  type="button"
                  onClick={() => onOpenReportModal?.(session)}
                  className="retro-button px-2.5 py-1.5 font-bold text-xs text-[#073E3B]"
                >
                  &#128196; HTML Report
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowRecentActivity(!showRecentActivity)}
                className="retro-button px-2 py-1.5 text-[11px] text-[#453E32]"
              >
                {showRecentActivity ? "Hide Recent Activity" : "Recent Activity Table"}
              </button>
            </div>

            {/* 4 Real Summary Counters from Backend/Storage */}
            <div className="xl:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono">
              <div className="retro-inset bg-[#E8DFCB] px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] text-[#686253] font-sans">Participants:</span>
                <strong className="text-xs text-[#073E3B]" data-testid="counter-participants">
                  {totalParticipantsCount}
                </strong>
              </div>
              <div className="retro-inset bg-[#E8DFCB] px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] text-[#686253] font-sans">Total Sessions:</span>
                <strong className="text-xs text-[#073E3B]" data-testid="counter-sessions">
                  {totalSessionsCount}
                </strong>
              </div>
              <div className="retro-inset bg-[#E8DFCB] px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] text-[#686253] font-sans">Completed:</span>
                <strong className="text-xs text-emerald-800" data-testid="counter-completed">
                  {completedSessionsCount}
                </strong>
              </div>
              <div className="retro-inset bg-[#E8DFCB] px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] text-[#686253] font-sans">Needs Review:</span>
                <strong className="text-xs text-amber-800" data-testid="counter-review">
                  {reviewOrIncompleteCount}
                </strong>
              </div>
            </div>
          </div>

          {/* Inline End Session Confirmation Banner when triggered from Home Live Window */}
          {confirmEndHomeSession && session && (
            <div className="p-2 bg-amber-100 border border-amber-600 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                <strong>Confirm End Session:</strong> Finalize session{" "}
                <strong className="font-mono">{session.id}</strong> for participant{" "}
                <strong className="font-mono">{session.participant_id}</strong> and generate HTML Research Report?
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={confirmAndFinalizeSession}
                  className="retro-button px-3 py-1 font-bold text-xs bg-[#073E3B] text-white"
                >
                  Confirm End &amp; Generate HTML Report
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEndHomeSession(false)}
                  className="retro-button px-2.5 py-1 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Expandable Recent Session Activity Table */}
          {showRecentActivity && (
            <div className="retro-inset bg-[#E8DFCB] p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#073E3B] font-bold">
                <span>RECENT RESEARCH SESSION ACTIVITY (REAL DATABASE RECORDS)</span>
                <span>Logged Researcher: {researcherId}</span>
              </div>
              <div className="overflow-x-auto max-h-36 overflow-y-auto">
                <table className="w-full border-collapse text-[11px] bg-[#FFFDF6]">
                  <thead>
                    <tr className="bg-[#E8DFCB] text-[#073E3B] font-mono text-[10px] uppercase">
                      <th className="border border-[#8C8472] px-2 py-1 text-left">Session ID</th>
                      <th className="border border-[#8C8472] px-2 py-1 text-left">Participant</th>
                      <th className="border border-[#8C8472] px-2 py-1 text-center">Status</th>
                      <th className="border border-[#8C8472] px-2 py-1 text-center">Turns</th>
                      <th className="border border-[#8C8472] px-2 py-1 text-left">Started</th>
                      <th className="border border-[#8C8472] px-2 py-1 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 8).map((s) => (
                      <tr key={s.id} className="odd:bg-[#FFFDF6] even:bg-[#F5EFE0]">
                        <td className="border border-[#8C8472] px-2 py-1 font-mono font-bold text-[#073E3B]">
                          {s.id}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 font-mono">
                          {s.participant_id}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center uppercase font-mono text-[10px]">
                          {s.status}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center font-mono">
                          {s.turn_count}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 font-mono text-[10px]">
                          {s.started_at
                            ? new Date(s.started_at).toLocaleString([], {
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Not started"}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectSession?.(s)}
                              className="retro-button px-2 py-0.5 text-[10px]"
                            >
                              Focus
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenParticipantProfile?.(s.participant_id)}
                              className="retro-button px-2 py-0.5 text-[10px]"
                            >
                              Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenReportModal?.(s)}
                              className="retro-button px-2 py-0.5 text-[10px] font-bold text-[#073E3B]"
                            >
                              Report
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </RetroWindow>

      {/* 1. TOP ROW: Live Research Session (left) & Real-time Analysis (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">
        <div className="lg:col-span-7">
          <LiveSessionWindow
            session={session}
            activeQuestionText={activeQuestion}
            transcriptHistory={transcriptHistory}
            onSendMessage={handleSendMessage}
            onSendAudio={handleSendAudio}
            onEndSession={handleEndSession}
            submitting={submitting}
          />
        </div>
        <div className="lg:col-span-5">
          <RealtimeAnalysisWindow
            biomarkers={biomarkers}
            facialAus={faceFeatures.action_units}
            vocalFeatures={vocalFeatures}
            gazeFeatures={gazeFeatures}
            attentionWeights={attentionWeights}
          />
        </div>
      </div>

      {/* 2. MIDDLE ROW: Multimodal Signals Row (4 Windows) */}
      <MultimodalSignalsRow
        currentTranscript={currentTranscript}
        acousticDetails={vocalFeatures}
        gazeDetails={gazeFeatures}
        faceDetails={faceFeatures}
        isAudioSpeech={isAudioSpeech}
      />

      {/* 3. BOTTOM ROW: Session Timeline, Model Outputs, and Researcher Notes */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-stretch">
        <div className="md:col-span-5">
          <SessionTimelineWindow signals={signals} />
        </div>
        <div className="md:col-span-4">
          <ModelOutputsWindow />
        </div>
        <div className="md:col-span-3">
          <ResearcherNotesWindow session={session} />
        </div>
      </div>
    </div>
  );
};
