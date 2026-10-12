import { useState, useEffect } from "react";
import { api } from "../api";
import type { ReplayResponse, ReplayTurn, SessionSummary } from "../api";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Clock,
  Mic,
  Award,
} from "lucide-react";

interface ReplayViewProps {
  sessionId: string;
  sessions?: SessionSummary[];
  showHistoryTable?: boolean;
  onSelectSession?: (s: SessionSummary) => void;
  onOpenReportModal?: (s: SessionSummary) => void;
  onOpenParticipantProfile?: (participantId: string) => void;
}

export const ReplayView = ({
  sessionId,
  sessions = [],
  showHistoryTable = false,
  onSelectSession,
  onOpenReportModal,
  onOpenParticipantProfile,
}: ReplayViewProps) => {
  const [replayData, setReplayData] = useState<ReplayResponse | null>(null);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Session History Table Filter State
  const [historySearch, setHistorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setIsPlaying(false);
    api
      .getReplay(sessionId)
      .then((data) => {
        setReplayData(data);
        setCurrentTurnIdx(0);
      })
      .catch((err) => console.error("Error loading replay:", err))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!isPlaying || !replayData || replayData.turns.length === 0) return;
    const interval = setInterval(() => {
      setCurrentTurnIdx((prev) => {
        if (prev >= replayData.turns.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isPlaying, replayData]);

  // Filter sessions for the Research Session History table
  const filteredSessions = sessions.filter((s) => {
    const q = historySearch.trim().toLowerCase();
    const matchText =
      !q ||
      s.id.toLowerCase().includes(q) ||
      s.participant_id.toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q);
    if (!matchText) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const formatDuration = (s: SessionSummary) => {
    if (s.started_at && s.ended_at) {
      const sec = Math.max(
        0,
        Math.round(
          (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000
        )
      );
      return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    }
    if (s.turn_count > 0) {
      return `~${s.turn_count * 15}s (${s.turn_count} turns)`;
    }
    return "0m 0s";
  };

  const getModalityBadge = (s: SessionSummary, mod: "audio" | "face" | "gaze" | "fusion") => {
    // If this is the currently loaded replayData session, inspect actual observations
    if (replayData && replayData.session_id === s.id) {
      if (replayData.turns.length === 0) {
        return { label: "Not Processed", cls: "bg-gray-100 text-gray-700 border-gray-400" };
      }
      if (mod === "audio") {
        const hasAudio = replayData.turns.some(
          (t) =>
            !t.observations?.voice?.masked &&
            t.observations?.voice?.features?.f0_mean !== undefined
        );
        return hasAudio
          ? { label: "Processed", cls: "bg-emerald-100 text-emerald-900 border-emerald-600" }
          : { label: "Text Only", cls: "bg-amber-100 text-amber-900 border-amber-600" };
      }
      if (mod === "face") {
        const hasFace = replayData.turns.some((t) => !t.observations?.face?.masked);
        return hasFace
          ? { label: "Processed", cls: "bg-emerald-100 text-emerald-900 border-emerald-600" }
          : { label: "Not Processed", cls: "bg-gray-100 text-gray-700 border-gray-400" };
      }
      if (mod === "gaze") {
        const hasGaze = replayData.turns.some((t) => !t.observations?.gaze?.masked);
        return hasGaze
          ? { label: "Processed", cls: "bg-emerald-100 text-emerald-900 border-emerald-600" }
          : { label: "Not Processed", cls: "bg-gray-100 text-gray-700 border-gray-400" };
      }
      if (mod === "fusion") {
        const hasFusion = replayData.turns.some((t) => !!t.fusion);
        return hasFusion
          ? { label: "Processed", cls: "bg-emerald-100 text-emerald-900 border-emerald-600" }
          : { label: "Not Processed", cls: "bg-gray-100 text-gray-700 border-gray-400" };
      }
    }

    // Fallback based on recorded turn_count
    if (s.turn_count > 0) {
      return { label: "Processed", cls: "bg-emerald-100 text-emerald-900 border-emerald-600" };
    }
    return { label: "Not Processed", cls: "bg-gray-100 text-gray-700 border-gray-400" };
  };

  const currentSessionObj = sessions.find((s) => s.id === sessionId) || null;

  return (
    <div className="space-y-3 text-left text-xs text-[#211F1A]">
      {/* =====================================================================
          RESEARCH SESSION HISTORY TABLE (When showHistoryTable is enabled)
         ===================================================================== */}
      {showHistoryTable && (
        <div className="retro-inset bg-[#FFFDF6] p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#453E32] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#073E3B]">
                Research Session History &amp; Modality Processing Registry
              </h3>
              <p className="text-[11px] text-[#686253]">
                Inspect all recorded sessions across participants, verify modality processing statuses, open turn-by-turn replay, or generate HTML reports.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Filter by Session ID or Participant ID..."
                className="retro-inset bg-white border border-[#7D7463] px-2.5 py-1 text-xs min-w-[210px] focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="retro-inset bg-white border border-[#7D7463] px-2 py-1 text-xs"
              >
                <option value="all">All Statuses ({sessions.length})</option>
                <option value="completed">Completed</option>
                <option value="active">Active</option>
                <option value="created">Created (0 Turns)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[290px] overflow-y-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#E8DFCB] text-[#073E3B] font-mono text-[10px] uppercase">
                  <th className="border border-[#8C8472] px-2 py-1.5 text-left">Session ID</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-left">Participant ID</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-left">Date / Time</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-left">Duration</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-center">Audio/Voice</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-center">Face</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-center">Gaze</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-center">Fusion</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-center">Session Status</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-center">HTML Report</th>
                  <th className="border border-[#8C8472] px-2 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="border border-[#8C8472] p-4 text-center text-[#686253]"
                    >
                      No sessions match the current search filter.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => {
                    const isActiveRow = s.id === sessionId;
                    const audioSt = getModalityBadge(s, "audio");
                    const faceSt = getModalityBadge(s, "face");
                    const gazeSt = getModalityBadge(s, "gaze");
                    const fusionSt = getModalityBadge(s, "fusion");

                    return (
                      <tr
                        key={s.id}
                        className={`${
                          isActiveRow
                            ? "bg-[#DCEEE8] font-semibold"
                            : "odd:bg-[#FFFDF6] even:bg-[#F5EFE0] hover:bg-[#EFE7D4]"
                        }`}
                      >
                        <td className="border border-[#8C8472] px-2 py-1 font-mono font-bold text-[#073E3B]">
                          {s.id}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 font-mono font-bold">
                          {s.participant_id}
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
                        <td className="border border-[#8C8472] px-2 py-1 font-mono text-[10px]">
                          {formatDuration(s)}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-mono border rounded-[2px] ${audioSt.cls}`}
                          >
                            {audioSt.label}
                          </span>
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-mono border rounded-[2px] ${faceSt.cls}`}
                          >
                            {faceSt.label}
                          </span>
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-mono border rounded-[2px] ${gazeSt.cls}`}
                          >
                            {gazeSt.label}
                          </span>
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-mono border rounded-[2px] ${fusionSt.cls}`}
                          >
                            {fusionSt.label}
                          </span>
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-mono font-bold border rounded-[2px] uppercase ${
                              s.status === "completed"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-600"
                                : s.status === "active"
                                ? "bg-sky-100 text-sky-900 border-sky-600"
                                : "bg-gray-100 text-gray-700 border-gray-400"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-center font-mono text-[10px]">
                          {s.turn_count > 0 ? (
                            <span className="text-emerald-800 font-bold">Ready ({s.turn_count}t)</span>
                          ) : (
                            <span className="text-[#686253]">Metadata Only</span>
                          )}
                        </td>
                        <td className="border border-[#8C8472] px-2 py-1 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectSession?.(s)}
                              className="retro-button px-2 py-0.5 text-[10px] font-bold text-[#073E3B]"
                            >
                              Open Session
                            </button>
                            {onOpenReportModal && (
                              <button
                                type="button"
                                onClick={() => onOpenReportModal(s)}
                                className="retro-button px-2 py-0.5 text-[10px] font-bold bg-[#DCEEE8] text-[#073E3B]"
                              >
                                Open Report
                              </button>
                            )}
                            {onOpenParticipantProfile && (
                              <button
                                type="button"
                                onClick={() => onOpenParticipantProfile(s.participant_id)}
                                className="retro-button px-2 py-0.5 text-[10px] text-[#211F1A]"
                              >
                                Profile
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          CHRONOLOGICAL TURN-BY-TURN REPLAY INSPECTOR
         ===================================================================== */}
      {loading ? (
        <div className="p-8 text-center text-[#686253] retro-inset bg-[#FFFDF6]">
          Loading session replay data...
        </div>
      ) : !replayData || replayData.turns.length === 0 ? (
        <div className="p-6 text-center text-[#686253] retro-inset bg-[#FFFDF6] space-y-2">
          <div>
            No recorded conversational turns found for session:{" "}
            <span className="font-mono font-bold text-[#073E3B]">{sessionId}</span>
          </div>
          {currentSessionObj && onOpenReportModal && (
            <button
              type="button"
              onClick={() => onOpenReportModal(currentSessionObj)}
              className="retro-button px-3 py-1 text-xs font-bold text-[#073E3B]"
            >
              &#128196; Open Session Metadata HTML Report
            </button>
          )}
        </div>
      ) : (
        (() => {
          const turn: ReplayTurn = replayData.turns[currentTurnIdx];
          const faceObs = turn.observations?.face?.features || {};
          const voiceObs = turn.observations?.voice?.features || {};
          const gazeObs = turn.observations?.gaze?.features || {};
          const aus = (faceObs.action_units as Record<string, number>) || {};

          return (
            <>
              {/* Replay Controller Header */}
              <div className="retro-inset bg-[#FFFDF6] p-3 text-[#211F1A] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#073E3B] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#17675F]" /> Chronological Session Replay:{" "}
                      <span className="font-mono text-[#073E3B]">{sessionId}</span>
                    </h3>
                    <p className="text-[11px] text-[#686253] mt-0.5">
                      Participant:{" "}
                      <span className="font-mono font-bold text-[#211F1A]">
                        {replayData.participant_id}
                      </span>{" "}
                      &bull; Total Turns:{" "}
                      <span className="font-mono font-bold text-[#211F1A]">
                        {replayData.total_turns}
                      </span>{" "}
                      &bull; Stored Artifacts:{" "}
                      <span className="font-semibold text-emerald-800">
                        Transcripts + Multimodal Feature Vectors + PPO Decisions
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {currentSessionObj && onOpenReportModal && (
                      <button
                        type="button"
                        onClick={() => onOpenReportModal(currentSessionObj)}
                        className="retro-button px-3 py-1 text-xs font-bold bg-[#DCEEE8] text-[#073E3B]"
                      >
                        &#128196; Generate / Review HTML Report
                      </button>
                    )}
                    {onOpenParticipantProfile && (
                      <button
                        type="button"
                        onClick={() => onOpenParticipantProfile(replayData.participant_id)}
                        className="retro-button px-2.5 py-1 text-xs font-bold text-[#211F1A]"
                      >
                        &#128100; Participant Profile
                      </button>
                    )}
                    <button
                      onClick={() => setCurrentTurnIdx((prev) => Math.max(0, prev - 1))}
                      disabled={currentTurnIdx === 0}
                      className="retro-window px-2.5 py-1 bg-[#E8DFCB] hover:bg-[#F3EAD7] active:border-[#453E32] text-[#211F1A] disabled:opacity-40 flex items-center justify-center font-mono text-xs cursor-pointer"
                      title="Previous Turn"
                    >
                      <SkipBack className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="retro-window px-3 py-1 bg-[#073E3B] text-white hover:bg-[#0B534E] active:border-[#032422] font-bold text-xs flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      {isPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {isPlaying ? "Pause Playback" : "Play Session"}
                    </button>
                    <button
                      onClick={() =>
                        setCurrentTurnIdx((prev) =>
                          Math.min(replayData.turns.length - 1, prev + 1)
                        )
                      }
                      disabled={currentTurnIdx === replayData.turns.length - 1}
                      className="retro-window px-2.5 py-1 bg-[#E8DFCB] hover:bg-[#F3EAD7] active:border-[#453E32] text-[#211F1A] disabled:opacity-40 flex items-center justify-center font-mono text-xs cursor-pointer"
                      title="Next Turn"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentTurnIdx(0);
                      }}
                      className="retro-window px-2.5 py-1 bg-[#E8DFCB] hover:bg-[#F3EAD7] active:border-[#453E32] text-[#211F1A] flex items-center justify-center font-mono text-xs cursor-pointer"
                      title="Reset to Turn 1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scrubber slider */}
                <div className="p-2.5 retro-inset bg-[#E8DFCB] space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono text-[#453E32]">
                    <span className="font-bold">
                      Turn {currentTurnIdx + 1} of {replayData.total_turns}
                    </span>
                    <span>Recorded at: {new Date(turn.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={replayData.total_turns - 1}
                    value={currentTurnIdx}
                    onChange={(e) => setCurrentTurnIdx(Number(e.target.value))}
                    className="w-full h-2 bg-[#D4CBBA] border border-[#7D7463] rounded appearance-none cursor-pointer accent-[#073E3B]"
                  />
                </div>
              </div>

              {/* Turn Inspection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Dialogue Card */}
                <div className="retro-inset bg-[#FFFDF6] p-3 space-y-2.5 text-[#211F1A]">
                  <div className="pb-1.5 border-b border-[#453E32]">
                    <h4 className="text-xs font-bold font-mono text-[#073E3B] uppercase tracking-wider">
                      Dialogue Exchange
                    </h4>
                  </div>
                  <div className="p-2.5 retro-inset bg-[#E8DFCB] space-y-1">
                    <span className="text-[10px] font-bold text-[#073E3B] uppercase block font-mono">
                      Avatar Spoken Question ({turn.question_id || "Initial"}):
                    </span>
                    <p className="text-xs text-[#211F1A] font-medium leading-relaxed">
                      {turn.question_text || "Opening interview prompt"}
                    </p>
                  </div>
                  <div className="p-2.5 retro-inset bg-[#FFFDF6] border border-[#7D7463] space-y-1">
                    <span className="text-[10px] font-bold text-[#064D49] uppercase block font-mono">
                      Participant Transcript (Whisper / Text):
                    </span>
                    <p className="text-xs text-[#211F1A] italic leading-relaxed">
                      "{turn.transcript || "No speech recorded"}"
                    </p>
                  </div>
                </div>

                {/* Acoustic & Ocular Features Card */}
                <div className="retro-inset bg-[#FFFDF6] p-3 space-y-2.5 text-[#211F1A]">
                  <div className="pb-1.5 border-b border-[#453E32]">
                    <h4 className="text-xs font-bold font-mono text-[#073E3B] uppercase tracking-wider flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-[#17675F]" /> Acoustic &amp; Ocular Evidence
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[#686253] block text-[10px]">Pitch F0 Mean</span>
                      <span className="font-bold text-[#211F1A]">
                        {voiceObs.f0_mean !== undefined
                          ? `${Number(voiceObs.f0_mean).toFixed(1)} Hz`
                          : "Masked (Text)"}
                      </span>
                    </div>
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[#686253] block text-[10px]">Jitter / Shimmer</span>
                      <span className="font-bold text-rose-800">
                        {voiceObs.jitter !== undefined
                          ? `${Number(voiceObs.jitter).toFixed(3)} / ${Number(
                              voiceObs.shimmer || 0
                            ).toFixed(3)}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[#686253] block text-[10px]">HNR (dB)</span>
                      <span className="font-bold text-[#211F1A]">
                        {voiceObs.hnr !== undefined
                          ? `${Number(voiceObs.hnr).toFixed(1)} dB`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[#686253] block text-[10px]">Gaze Aversion</span>
                      <span className="font-bold text-sky-800">
                        {gazeObs.gaze_aversion_index !== undefined
                          ? Number(gazeObs.gaze_aversion_index).toFixed(2)
                          : "0.00"}
                      </span>
                    </div>
                  </div>
                  {Object.keys(aus).length > 0 && (
                    <div className="p-2 retro-inset bg-[#E8DFCB]">
                      <span className="text-[#686253] block text-[10px] font-bold mb-1">
                        Key Action Units:
                      </span>
                      <div className="flex flex-wrap gap-1 font-mono">
                        {Object.entries(aus)
                          .slice(0, 6)
                          .map(([au, val]) => (
                            <span
                              key={au}
                              className="text-[10px] px-1.5 py-0.5 retro-inset bg-[#FFFDF6] text-[#211F1A] font-semibold"
                            >
                              {au}: {typeof val === "number" ? val.toFixed(2) : val}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* PPO Policy Recommendation Card */}
                <div className="retro-inset bg-[#FFFDF6] p-3 space-y-2.5 text-[#211F1A]">
                  <div className="pb-1.5 border-b border-[#453E32]">
                    <h4 className="text-xs font-bold font-mono text-[#073E3B] uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#17675F]" /> PPO Decision at Turn
                    </h4>
                  </div>
                  {turn.decision ? (
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 retro-window bg-[#FFF2B2] border border-[#D4C366]">
                        <span className="text-[#073E3B] font-bold block text-[10px] uppercase font-mono">
                          Selected Safe Action:
                        </span>
                        <span className="text-[#211F1A] font-bold font-mono text-xs">
                          [{turn.decision.action_id}]
                        </span>
                        <p className="text-[#453E32] text-[11px] mt-1 leading-snug">
                          {turn.decision.question_text}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-2 retro-inset bg-[#E8DFCB]">
                          <span className="text-[#686253] block text-[10px]">Info Gain:</span>
                          <span className="text-[#073E3B] font-bold text-xs">
                            {turn.decision.info_gain}
                          </span>
                        </div>
                        <div className="p-2 retro-inset bg-[#E8DFCB]">
                          <span className="text-[#686253] block text-[10px]">
                            Calculated Reward:
                          </span>
                          <span className="text-[#073E3B] font-bold text-xs">
                            {turn.decision.reward}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-[#686253] retro-inset bg-[#E8DFCB] text-xs">
                      No policy decision recorded for this turn.
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })()
      )}
    </div>
  );
};
