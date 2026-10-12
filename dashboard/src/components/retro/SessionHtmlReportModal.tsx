import React, { useState, useEffect } from "react";
import { RetroWindow } from "./RetroWindow";
import { api } from "../../api";
import type {
  SessionSummary,
  ParticipantRecord,
} from "../../api";
import {
  analyzeSessionReportData,
  downloadHtmlReport,
  openHtmlReportInNewTab,
} from "../../utils/htmlReportGenerator";
import type { ComputedSessionReport, ModalityProcessStatus } from "../../utils/htmlReportGenerator";

interface SessionHtmlReportModalProps {
  session: SessionSummary;
  participant?: ParticipantRecord | null;
  onClose: () => void;
  onReturnToProfile?: (participantId: string) => void;
  onReturnToHistory?: () => void;
}

export const SessionHtmlReportModal: React.FC<SessionHtmlReportModalProps> = ({
  session,
  participant,
  onClose,
  onReturnToProfile,
  onReturnToHistory,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ComputedSessionReport | null>(null);
  const [activeSection, setActiveSection] = useState<
    "all" | "audio" | "face_gaze" | "fusion"
  >("all");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getReplay(session.id).catch(() => null),
      api.getSignals(session.id).catch(() => ({ session_id: session.id, participant_id: session.participant_id, signals: [] })),
    ])
      .then(([replayData, signalsData]) => {
        if (!mounted) return;
        const computed = analyzeSessionReportData(
          session,
          replayData,
          signalsData?.signals || [],
          participant
        );
        setReport(computed);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "Failed to generate session report.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [session.id, participant?.id]);

  const statusBadgeClass = (st: ModalityProcessStatus) => {
    switch (st) {
      case "Processed":
        return "bg-emerald-100 text-emerald-900 border-emerald-600";
      case "Partially Available":
        return "bg-amber-100 text-amber-900 border-amber-600";
      case "Not Processed":
        return "bg-gray-200 text-gray-800 border-gray-500";
      case "Unavailable":
      default:
        return "bg-rose-100 text-rose-900 border-rose-600";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col">
        <RetroWindow
          title={`Research HTML Report — Review Audio, Face, Gaze & Fusion [${session.id}]`}
          icon={<span>&#128196;</span>}
          onClose={onClose}
        >
          <div className="retro-inset bg-[#FFFDF6] p-3 text-left text-xs space-y-3 max-h-[82vh] overflow-y-auto text-[#211F1A]">
            {loading && (
              <div className="p-8 text-center retro-inset bg-[#E8DFCB] font-mono text-xs text-[#073E3B]">
                Compiling session transcripts, acoustic DSP features, facial AUs, ocular gaze vectors, and cross-modal fusion outputs...
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-100 border border-rose-500 text-rose-900 text-xs">
                <strong>Report Generation Error:</strong> {error}
              </div>
            )}

            {report && (
              <>
                {/* Top Action Bar */}
                <div className="retro-window bg-[#E8DFCB] p-2.5 flex flex-wrap items-center justify-between gap-2 border border-[#453E32]">
                  <div>
                    <div className="font-bold text-sm text-[#073E3B]">
                      NOVA Research Session Report — {report.participantId} ({report.pseudonym})
                    </div>
                    <div className="text-[11px] text-[#686253] font-mono">
                      Session: {report.sessionId} &bull; Status: {report.status.toUpperCase()} &bull; Turns: {report.totalTurns} &bull; Duration: {report.durationFormatted}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openHtmlReportInNewTab(report)}
                      className="retro-button px-3 py-1 font-bold text-xs bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                    >
                      &#128196; Open HTML Report (New Tab)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadHtmlReport(report)}
                      className="retro-button px-3 py-1 font-bold text-xs text-[#073E3B]"
                    >
                      &#128190; Download HTML Report (.html)
                    </button>
                    {onReturnToProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onReturnToProfile(report.participantId);
                        }}
                        className="retro-button px-2.5 py-1 font-bold text-xs text-[#211F1A]"
                      >
                        &#128100; Return to Participant Profile
                      </button>
                    )}
                    {onReturnToHistory && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onReturnToHistory();
                        }}
                        className="retro-button px-2.5 py-1 font-bold text-xs text-[#211F1A]"
                      >
                        &#128194; Return to Session History
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Tabs for Review */}
                <div className="flex flex-wrap gap-1 border-b border-[#453E32] pb-1">
                  {[
                    { id: "all", label: "Full Report (All Modalities)" },
                    { id: "audio", label: "Audio / Voice & Speech" },
                    { id: "face_gaze", label: "Face AUs & Gaze / Ocular" },
                    { id: "fusion", label: "Cross-Modal Fusion & PPO" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveSection(t.id as any)}
                      className={`retro-tab text-xs ${activeSection === t.id ? "active" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* 1. Metadata & Modality Processing Status Grid */}
                <div className="retro-inset bg-[#E8DFCB] p-2.5 space-y-2">
                  <div className="text-[11px] font-bold font-mono text-[#073E3B] uppercase border-b border-[#8C8472] pb-1">
                    1. Session Metadata &amp; Modality Processing Status
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    <div className="retro-inset bg-[#FFFDF6] p-2">
                      <span className="text-[#686253] block text-[10px]">Participant ID</span>
                      <strong className="font-mono text-[#073E3B]">{report.participantId}</strong>
                    </div>
                    <div className="retro-inset bg-[#FFFDF6] p-2">
                      <span className="text-[#686253] block text-[10px]">Start / End Time</span>
                      <strong className="font-mono text-[#211F1A] text-[10px]">{report.startedAt}</strong>
                    </div>
                    <div className="retro-inset bg-[#FFFDF6] p-2">
                      <span className="text-[#686253] block text-[10px]">Conversational Turns</span>
                      <strong className="font-mono text-[#073E3B]">
                        {report.totalTurns} ({report.speechTurnCount} Speech, {report.textTurnCount} Text)
                      </strong>
                    </div>
                    <div className="retro-inset bg-[#FFFDF6] p-2">
                      <span className="text-[#686253] block text-[10px]">Consent &amp; Protocol</span>
                      <strong className="font-mono text-[#211F1A] text-[10px]">{report.consentStatus}</strong>
                    </div>
                  </div>

                  {/* Modality Processing Status Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 pt-1">
                    {[
                      { label: "Speech ASR", status: report.modalityStatuses.speechAsr },
                      { label: "Voice DSP", status: report.modalityStatuses.voiceAcoustic },
                      { label: "Face AUs", status: report.modalityStatuses.faceExpression },
                      { label: "Gaze/Ocular", status: report.modalityStatuses.gazeOcular },
                      { label: "Transformer Fusion", status: report.modalityStatuses.multimodalFusion },
                      { label: "PPO Policy", status: report.modalityStatuses.ppoPolicy },
                    ].map((m) => (
                      <div key={m.label} className="retro-inset bg-[#FFFDF6] p-1.5 text-center">
                        <span className="block text-[9px] text-[#686253] font-bold uppercase">{m.label}</span>
                        <span
                          className={`inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-mono font-bold border rounded-[2px] ${statusBadgeClass(
                            m.status
                          )}`}
                        >
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Audio / Voice & Speech Review */}
                {(activeSection === "all" || activeSection === "audio") && (
                  <div className="retro-inset bg-[#FFFDF6] p-2.5 space-y-2 border border-[#8C8472]">
                    <div className="flex items-center justify-between border-b border-[#453E32] pb-1">
                      <span className="text-[11px] font-bold font-mono text-[#073E3B] uppercase">
                        2. Audio, Voice Biomarkers &amp; Speech Transcript Review
                      </span>
                      <span className="text-[10px] font-mono text-[#686253]">
                        Audio Turns: {report.speechTurnCount} / {report.totalTurns}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean F0 Pitch</span>
                        <strong className="text-[#073E3B]">
                          {report.audioSummary.meanF0Hz !== null
                            ? `${report.audioSummary.meanF0Hz.toFixed(1)} Hz`
                            : "Not Processed (Masked)"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean Jitter / Shimmer</span>
                        <strong className="text-rose-800">
                          {report.audioSummary.meanJitter !== null
                            ? `${report.audioSummary.meanJitter.toFixed(4)} / ${(report.audioSummary.meanShimmer ?? 0).toFixed(4)}`
                            : "Not Processed"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean HNR (dB)</span>
                        <strong className="text-[#073E3B]">
                          {report.audioSummary.meanHnrDb !== null
                            ? `${report.audioSummary.meanHnrDb.toFixed(1)} dB`
                            : "Not Processed"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean Vocal Instability</span>
                        <strong className="text-rose-800">
                          {report.audioSummary.meanVocalInstability !== null
                            ? report.audioSummary.meanVocalInstability.toFixed(3)
                            : "Not Processed"}
                        </strong>
                      </div>
                    </div>

                    {/* Turn-by-turn Transcripts Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-[#E8DFCB] text-[#073E3B] font-mono">
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Turn</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Question Prompt</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Participant Transcript</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Source</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Acoustic Features</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.audioSummary.transcripts.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="border border-[#8C8472] p-3 text-center text-[#686253]">
                                No conversational turns recorded in this session.
                              </td>
                            </tr>
                          ) : (
                            report.audioSummary.transcripts.map((t) => (
                              <tr key={t.turnIndex} className="odd:bg-[#FFFDF6] even:bg-[#F5EFE0]">
                                <td className="border border-[#8C8472] px-2 py-1 font-mono font-bold">
                                  #{t.turnIndex}
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1">
                                  <strong className="font-mono text-[#073E3B]">[{t.questionId}]</strong>{" "}
                                  {t.questionText}
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1 italic">
                                  "{t.transcript}"
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1 font-mono text-[10px]">
                                  {t.source}
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1 font-mono text-[10px]">
                                  {t.f0Mean !== null
                                    ? `F0: ${t.f0Mean.toFixed(1)}Hz | HNR: ${(t.hnr ?? 0).toFixed(1)}dB`
                                    : "Voice Masked"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Face & Gaze Review */}
                {(activeSection === "all" || activeSection === "face_gaze") && (
                  <div className="retro-inset bg-[#FFFDF6] p-2.5 space-y-2 border border-[#8C8472]">
                    <div className="flex items-center justify-between border-b border-[#453E32] pb-1">
                      <span className="text-[11px] font-bold font-mono text-[#073E3B] uppercase">
                        3. Facial Expression (FACS Action Units) &amp; Gaze / Ocular Review
                      </span>
                      <span className="text-[10px] font-mono text-[#686253]">
                        Face Turns: {report.faceSummary.observedTurns} &bull; Gaze Turns: {report.gazeSummary.observedTurns}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean AU Distress Index</span>
                        <strong className="text-emerald-800">
                          {report.faceSummary.meanAuDistress !== null
                            ? report.faceSummary.meanAuDistress.toFixed(3)
                            : "Not Processed"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean Gaze Aversion</span>
                        <strong className="text-sky-800">
                          {report.gazeSummary.meanGazeAversion !== null
                            ? report.gazeSummary.meanGazeAversion.toFixed(3)
                            : "Not Processed"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Blink Rate / Pupil Diam</span>
                        <strong className="text-[#073E3B]">
                          {report.gazeSummary.meanBlinkRate !== null
                            ? `${report.gazeSummary.meanBlinkRate.toFixed(1)}/m | ${(report.gazeSummary.meanPupilDiameter ?? 3.2).toFixed(2)}mm`
                            : "Not Processed"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean 3D Gaze Vector</span>
                        <strong className="text-[#073E3B]">
                          {report.gazeSummary.meanVector
                            ? `(${report.gazeSummary.meanVector.x}, ${report.gazeSummary.meanVector.y}, ${report.gazeSummary.meanVector.z})`
                            : "Not Processed"}
                        </strong>
                      </div>
                    </div>

                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] font-bold text-[#453E32] uppercase block mb-1">
                        Extracted Action Unit (AU) Session Averages:
                      </span>
                      {Object.keys(report.faceSummary.actionUnitAverages).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 font-mono">
                          {Object.entries(report.faceSummary.actionUnitAverages).map(([au, val]) => (
                            <span
                              key={au}
                              className="px-2 py-0.5 retro-inset bg-[#FFFDF6] text-[#211F1A] text-[11px] font-bold"
                            >
                              {au}: {val.toFixed(3)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#686253] italic">
                          No facial Action Unit observations recorded in this session.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Multimodal Fusion & PPO Review */}
                {(activeSection === "all" || activeSection === "fusion") && (
                  <div className="retro-inset bg-[#FFFDF6] p-2.5 space-y-2 border border-[#8C8472]">
                    <div className="flex items-center justify-between border-b border-[#453E32] pb-1">
                      <span className="text-[11px] font-bold font-mono text-[#073E3B] uppercase">
                        4. Cross-Modal Transformer Fusion &amp; PPO Adaptive Questioning Log
                      </span>
                      <span className="text-[10px] font-mono text-[#686253]">
                        PPO Decisions: {report.ppoDecisions.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-xs">
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean / Peak Fusion Score</span>
                        <strong className="text-purple-800">
                          {report.fusionSummary.meanPredictionScore !== null
                            ? `${report.fusionSummary.meanPredictionScore.toFixed(3)} (Peak: ${(report.fusionSummary.peakPredictionScore ?? 0).toFixed(3)})`
                            : "Not Processed"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2">
                        <span className="text-[10px] text-[#686253] block">Mean Fusion Confidence</span>
                        <strong className="text-[#073E3B]">
                          {report.fusionSummary.meanConfidence !== null
                            ? `${(report.fusionSummary.meanConfidence * 100).toFixed(1)}%`
                            : "Not Processed"}
                        </strong>
                      </div>
                      <div className="retro-inset bg-[#E8DFCB] p-2 font-sans">
                        <span className="text-[10px] text-[#686253] block font-mono">Affective Summary</span>
                        <strong className="text-[#073E3B] text-[11px]">
                          {report.fusionSummary.affectiveInterpretation}
                        </strong>
                      </div>
                    </div>

                    {/* Cross-Modal Attention Weights */}
                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] font-bold text-[#453E32] uppercase block mb-1">
                        Mean Cross-Modal Attention Distribution:
                      </span>
                      {Object.keys(report.fusionSummary.meanAttentionWeights).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                          {Object.entries(report.fusionSummary.meanAttentionWeights).map(([mod, wt]) => (
                            <div key={mod} className="retro-inset bg-[#FFFDF6] p-1.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="uppercase font-bold text-[#073E3B]">{mod}</span>
                                <span>{(wt * 100).toFixed(1)}%</span>
                              </div>
                              <div className="retro-progress-well h-2 mt-1">
                                <div
                                  className="bg-[#073E3B] h-full"
                                  style={{ width: `${Math.min(100, wt * 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#686253] italic">
                          Attention weights not computed for this session.
                        </span>
                      )}
                    </div>

                    {/* PPO Decision Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-[#E8DFCB] text-[#073E3B] font-mono">
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Turn</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">PPO Action ID</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Selected Follow-Up Question</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Info Gain</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Topic Cov.</th>
                            <th className="border border-[#8C8472] px-2 py-1 text-left">Reward</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.ppoDecisions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="border border-[#8C8472] p-3 text-center text-[#686253]">
                                No PPO adaptive questioning decisions recorded for this session.
                              </td>
                            </tr>
                          ) : (
                            report.ppoDecisions.map((d) => (
                              <tr key={d.turnIndex} className="odd:bg-[#FFFDF6] even:bg-[#F5EFE0]">
                                <td className="border border-[#8C8472] px-2 py-1 font-mono font-bold">
                                  #{d.turnIndex}
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1 font-mono font-bold text-[#073E3B]">
                                  {d.actionId}
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1">{d.questionText}</td>
                                <td className="border border-[#8C8472] px-2 py-1 font-mono">
                                  {d.infoGain.toFixed(4)}
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1 font-mono">
                                  {(d.topicCoverage * 100).toFixed(1)}%
                                </td>
                                <td className="border border-[#8C8472] px-2 py-1 font-mono font-bold text-[#073E3B]">
                                  {d.reward.toFixed(4)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Non-Clinical Disclaimer Footer */}
                <div className="retro-window p-2 bg-[#FFF3C4] border border-[#D4C366] text-[10px] text-[#453E32] flex items-center justify-between">
                  <span>
                    <strong>Non-Clinical Disclaimer:</strong> Experimental affective computing research report. Not a clinical or psychiatric diagnostic instrument.
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="retro-button px-4 py-1 font-bold text-xs ml-3"
                  >
                    Close Report
                  </button>
                </div>
              </>
            )}
          </div>
        </RetroWindow>
      </div>
    </div>
  );
};
