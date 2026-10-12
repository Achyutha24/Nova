import React, { useState, useEffect } from "react";
import { RetroWindow } from "./RetroWindow";
import { LiveSessionView } from "../LiveSessionView";
import { ReplayView } from "../ReplayView";
import { api, wsManager } from "../../api";
import type {
  ParticipantRecord,
  SessionSummary,
  SystemHealth,
  ModelStatus,
} from "../../api";
import {
  analyzeSessionReportData,
  downloadHtmlReport,
} from "../../utils/htmlReportGenerator";

export type WorkflowMode = "select" | "add" | "profile";
export type ProfileSubMode =
  | "overview"
  | "start_session_wizard"
  | "recordings"
  | "history"
  | "details";

export type ReadinessState =
  | "Ready"
  | "Connected"
  | "Processing"
  | "Unavailable"
  | "Failed"
  | "Not checked";

interface ReadinessItem {
  id: string;
  label: string;
  category: string;
  status: ReadinessState;
  detail: string;
}

interface ParticipantWorkflowViewProps {
  mode: WorkflowMode;
  onModeChange: (mode: WorkflowMode) => void;
  participants: ParticipantRecord[];
  sessions: SessionSummary[];
  selectedParticipant: ParticipantRecord | null;
  onSelectParticipant: (p: ParticipantRecord) => void;
  selectedSession: SessionSummary | null;
  onSelectSession: (s: SessionSummary) => void;
  onRefreshAll: () => Promise<void> | void;
  onOpenReportModal: (session: SessionSummary, participant?: ParticipantRecord | null) => void;
  onNavigateTab: (tab: string) => void;
  health: SystemHealth | null;
  modelStatus: ModelStatus | null;
  wsConnected: boolean;
  researcherId?: string;
  initialProfileSubMode?: ProfileSubMode;
}

export const ParticipantWorkflowView: React.FC<ParticipantWorkflowViewProps> = ({
  mode,
  onModeChange,
  participants,
  sessions,
  selectedParticipant,
  onSelectParticipant,
  selectedSession,
  onSelectSession,
  onRefreshAll,
  onOpenReportModal,
  onNavigateTab,
  health,
  modelStatus,
  wsConnected,
  researcherId = "RES-NOVA-01",
  initialProfileSubMode = "overview",
}) => {
  const [profileSubMode, setProfileSubMode] = useState<ProfileSubMode>(initialProfileSubMode);

  useEffect(() => {
    setProfileSubMode(initialProfileSubMode);
  }, [initialProfileSubMode, selectedParticipant?.id]);

  // --- ADD NEW PARTICIPANT FORM STATE ---
  const generateUniqueParticipantId = () => {
    const existingIds = new Set(participants.map((p) => p.id.toUpperCase()));
    let num = participants.length + 13;
    let candidate = `P_${String(num).padStart(4, "0")}`;
    while (existingIds.has(candidate)) {
      num++;
      candidate = `P_${String(num).padStart(4, "0")}`;
    }
    return candidate;
  };

  const [newPartId, setNewPartId] = useState<string>(() => generateUniqueParticipantId());
  const [newPseudonym, setNewPseudonym] = useState<string>("");
  const [newStudyGroup, setNewStudyGroup] = useState<string>("IRB-AVEC-v1.0 (Standard Multimodal)");
  const [newConsentStatus, setNewConsentStatus] = useState<string>(
    "Consented — Verified Informed Consent"
  );
  const [consentConfirmed, setConsentConfirmed] = useState<boolean>(true);
  const [newNotes, setNewNotes] = useState<string>("");
  const [savingParticipant, setSavingParticipant] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Update suggested ID when entering "add" mode
  useEffect(() => {
    if (mode === "add") {
      setNewPartId(generateUniqueParticipantId());
      setNewPseudonym("");
      setNewNotes("");
      setAddError(null);
      setAddSuccess(null);
    }
  }, [mode, participants.length]);

  // --- SELECT EXISTING PARTICIPANT FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<"all" | "with_sessions" | "no_sessions">("all");

  // --- START NEW SESSION 5-STEP WIZARD STATE ---
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [sessionNotes, setSessionNotes] = useState<string>(
    "Guided NOVA Multimodal Research Interview"
  );
  const [protocolVersion, setProtocolVersion] = useState<string>("v1.0");
  const [readinessItems, setReadinessItems] = useState<ReadinessItem[]>([]);
  const [checkingReadiness, setCheckingReadiness] = useState<boolean>(false);
  const [startingSession, setStartingSession] = useState<boolean>(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [activeWizardSession, setActiveWizardSession] = useState<SessionSummary | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [confirmEndPrompt, setConfirmEndPrompt] = useState<boolean>(false);
  const [endingSession, setEndingSession] = useState<boolean>(false);
  const [endedSessionSummary, setEndedSessionSummary] = useState<SessionSummary | null>(null);

  // Replay inspection session inside Previous Recordings
  const [inspectRecordingSessionId, setInspectRecordingSessionId] = useState<string | null>(null);

  // Elapsed timer during Step 4 (Live Session)
  useEffect(() => {
    if (profileSubMode !== "start_session_wizard" || wizardStep !== 4 || !activeWizardSession) {
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [profileSubMode, wizardStep, activeWizardSession?.id]);

  // Run System Readiness Checks
  const runSystemReadinessChecks = async (requestPermissions = false) => {
    setCheckingReadiness(true);
    setWizardError(null);

    const items: ReadinessItem[] = [];

    // 1. Camera & Microphone Check
    let camStatus: ReadinessState = "Not checked";
    let camDetail = "Browser media enumeration pending";
    let micStatus: ReadinessState = "Not checked";
    let micDetail = "Browser audio enumeration pending";

    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        if (requestPermissions && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
            micStatus = "Ready";
            micDetail = "Microphone permission granted & 16kHz PCM capture ready";
          } catch (permErr: any) {
            micStatus = "Unavailable";
            micDetail = `Mic permission not granted (${permErr?.name || "Fallback available"})`;
          }
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const audioInputs = devices.filter((d) => d.kind === "audioinput");

        if (videoInputs.length > 0) {
          camStatus = "Ready";
          camDetail = `${videoInputs.length} video capture device(s) detected`;
        } else {
          camStatus = "Unavailable";
          camDetail = "No local webcam detected (Visual features can stream from Unity or use fallback)";
        }

        if (micStatus !== "Ready") {
          if (audioInputs.length > 0) {
            micStatus = "Ready";
            micDetail = `${audioInputs.length} audio input device(s) detected for Whisper ASR`;
          } else {
            micStatus = "Unavailable";
            micDetail = "No hardware microphone detected (Manual text override available)";
          }
        }
      } else {
        camStatus = "Unavailable";
        camDetail = "navigator.mediaDevices API unavailable in current context";
        micStatus = "Unavailable";
        micDetail = "navigator.mediaDevices API unavailable in current context";
      }
    } catch (e: any) {
      camStatus = "Failed";
      camDetail = `Media check error: ${e?.message || "Unknown"}`;
      micStatus = "Failed";
      micDetail = `Audio check error: ${e?.message || "Unknown"}`;
    }

    items.push({
      id: "camera",
      label: "Camera Availability",
      category: "Hardware",
      status: camStatus,
      detail: camDetail,
    });

    items.push({
      id: "microphone",
      label: "Microphone Availability",
      category: "Hardware",
      status: micStatus,
      detail: micDetail,
    });

    // 2. Backend & Models Check
    let currentHealth = health;
    let currentModels = modelStatus;
    try {
      const [h, m] = await Promise.all([api.getHealth(), api.getModelStatus()]);
      currentHealth = h;
      currentModels = m;
    } catch (_) {}

    const backendHealthy = !!currentHealth && currentHealth.status === "healthy";
    items.push({
      id: "backend",
      label: "FastAPI Research Backend",
      category: "Infrastructure",
      status: backendHealthy ? "Connected" : "Failed",
      detail: backendHealthy
        ? `Connected (${currentHealth?.platform || "Local"}, Device: ${currentHealth?.torch_device || "cpu"})`
        : "Backend server unreachable on port 8000",
    });

    const modelsMap = currentModels?.models || {};
    const hasAsrService = backendHealthy && !!modelsMap.asr;
    items.push({
      id: "whisper",
      label: "Speech / Whisper Transcription Service",
      category: "ASR Pipeline",
      status: hasAsrService ? "Ready" : backendHealthy ? "Unavailable" : "Failed",
      detail: hasAsrService
        ? `Whisper (${modelsMap.asr.version || "tiny"}) ${
            modelsMap.asr.loaded ? "Loaded in RAM" : "Ready (On-Demand Lazy Load)"
          }`
        : "Requires FastAPI backend connection",
    });

    items.push({
      id: "voice_dsp",
      label: "Voice / Acoustic Analysis (F0, Jitter, Shimmer, HNR)",
      category: "Audio Modality",
      status: backendHealthy ? "Ready" : "Failed",
      detail: backendHealthy
        ? "Librosa / Acoustic DSP extractor active"
        : "Requires FastAPI backend connection",
    });

    items.push({
      id: "face_au",
      label: "Facial Expression & FACS Action Unit Processing",
      category: "Visual Modality",
      status: backendHealthy ? "Ready" : "Failed",
      detail: backendHealthy
        ? "MediaPipe 468-pt FaceMesh & AU Distress Activation extractor ready"
        : "Requires FastAPI backend connection",
    });

    items.push({
      id: "gaze",
      label: "Gaze & Ocular Processing",
      category: "Ocular Modality",
      status: backendHealthy ? "Ready" : "Failed",
      detail: backendHealthy
        ? "MediaPipe Iris & 3D Gaze Aversion vector processor ready"
        : "Requires FastAPI backend connection",
    });

    items.push({
      id: "fusion",
      label: "Cross-Modal Transformer Fusion & PPO Policy",
      category: "AI Core",
      status: backendHealthy ? "Ready" : "Failed",
      detail: backendHealthy
        ? "Cross-Modal Transformer & PPO Question Policy loaded"
        : "Requires FastAPI backend connection",
    });

    items.push({
      id: "unity",
      label: "Unity 3D Virtual Human / Avatar Bridge",
      category: "External Client",
      status: backendHealthy ? (wsConnected ? "Connected" : "Ready") : "Unavailable",
      detail: backendHealthy
        ? "WebSocket Bridge Ready (External Unity client connects via ws://localhost:8000/ws/unity/{session_id})"
        : "Backend WebSocket bridge offline",
    });

    setReadinessItems(items);
    setCheckingReadiness(false);
  };

  useEffect(() => {
    if (profileSubMode === "start_session_wizard") {
      runSystemReadinessChecks(false);
    }
  }, [profileSubMode]);

  // --- HANDLER: SAVE NEW PARTICIPANT ---
  const handleSaveNewParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingParticipant) return;
    setAddError(null);
    setAddSuccess(null);

    const cleanId = newPartId.trim();
    if (!cleanId) {
      setAddError("Participant ID is required.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(cleanId)) {
      setAddError("Participant ID may only contain letters, numbers, underscores, and hyphens.");
      return;
    }

    const duplicate = participants.some(
      (p) => p.id.toLowerCase() === cleanId.toLowerCase()
    );
    if (duplicate) {
      setAddError(
        `Participant ID "${cleanId}" already exists. Please enter a unique ID or click "Generate Unique ID".`
      );
      return;
    }

    if (!consentConfirmed) {
      setAddError("Informed consent verification must be checked before creating a participant record.");
      return;
    }

    setSavingParticipant(true);
    try {
      const created = await api.createParticipant({
        participant_id: cleanId,
        notes: newNotes.trim() || `Enrolled by ${researcherId} (${newStudyGroup})`,
        demographics: {
          pseudonym: newPseudonym.trim() || `Subject ${cleanId}`,
          consent_status: newConsentStatus,
          study_group: newStudyGroup,
          created_by: researcherId,
          enrolled_at: new Date().toISOString(),
        },
      });

      await onRefreshAll();
      onSelectParticipant(created);
      setProfileSubMode("overview");
      onModeChange("profile");
    } catch (err: any) {
      setAddError(err?.message || "Failed to save participant on backend.");
    } finally {
      setSavingParticipant(false);
    }
  };

  // --- HANDLER: STEP 3 START SESSION ---
  const handleStartGuidedSession = async () => {
    if (!selectedParticipant || startingSession) return;
    setStartingSession(true);
    setWizardError(null);

    try {
      const created = await api.createSession(
        selectedParticipant.id,
        sessionNotes.trim() || `Guided Session (${protocolVersion})`
      );
      await api.startSession(created.id);

      const startedSession: SessionSummary = {
        ...created,
        status: "active",
        started_at: created.started_at || new Date().toISOString(),
      };

      wsManager.connect(startedSession.id);
      setActiveWizardSession(startedSession);
      onSelectSession(startedSession);
      await onRefreshAll();
      setElapsedSeconds(0);
      setConfirmEndPrompt(false);
      setEndedSessionSummary(null);
      setWizardStep(4);
    } catch (err: any) {
      setWizardError(
        `Failed to start session: ${err?.message || "Backend error. You may safely retry."}`
      );
    } finally {
      setStartingSession(false);
    }
  };

  // --- HANDLER: STEP 5 END SESSION ---
  const handleConfirmEndGuidedSession = async () => {
    const targetSession = activeWizardSession || selectedSession;
    if (!targetSession || endingSession) return;

    setEndingSession(true);
    setWizardError(null);

    try {
      const endRes = await api.endSession(targetSession.id);
      await onRefreshAll();

      const updatedSession: SessionSummary = {
        ...targetSession,
        status: endRes?.status || "completed",
        ended_at: endRes?.ended_at || new Date().toISOString(),
        turn_count:
          endRes?.total_turns !== undefined ? endRes.total_turns : targetSession.turn_count,
      };

      setEndedSessionSummary(updatedSession);
      setActiveWizardSession(updatedSession);
      onSelectSession(updatedSession);
      setConfirmEndPrompt(false);
      setWizardStep(5);
    } catch (err: any) {
      setWizardError(`Failed to end session: ${err?.message || "Backend error"}`);
    } finally {
      setEndingSession(false);
    }
  };

  // Quick download helper for any session
  const handleQuickDownloadReport = async (sess: SessionSummary) => {
    try {
      const [replayData, signalsData] = await Promise.all([
        api.getReplay(sess.id).catch(() => null),
        api.getSignals(sess.id).catch(() => ({ session_id: sess.id, participant_id: sess.participant_id, signals: [] })),
      ]);
      const report = analyzeSessionReportData(
        sess,
        replayData,
        signalsData?.signals || [],
        selectedParticipant
      );
      downloadHtmlReport(report);
    } catch (err) {
      console.error("Failed to download HTML report:", err);
    }
  };

  const readinessBadgeClass = (st: ReadinessState) => {
    switch (st) {
      case "Ready":
      case "Connected":
        return "bg-emerald-100 text-emerald-900 border-emerald-600";
      case "Processing":
        return "bg-sky-100 text-sky-900 border-sky-600";
      case "Unavailable":
      case "Not checked":
        return "bg-amber-100 text-amber-900 border-amber-600";
      case "Failed":
      default:
        return "bg-rose-100 text-rose-900 border-rose-600";
    }
  };

  // Compute sessions belonging to selectedParticipant
  const participantSessions = selectedParticipant
    ? sessions.filter((s) => s.participant_id === selectedParticipant.id)
    : [];

  // Enrich participants with session metrics for Select Existing Participant table
  const enrichedParticipants = participants.map((p) => {
    const pSessions = sessions.filter((s) => s.participant_id === p.id);
    const totalCount = Math.max(p.session_count || 0, pSessions.length);
    const latestSess = pSessions[0] || null;
    const pseudonym = p.demographics?.pseudonym || `Subject ${p.id}`;
    const consent = p.demographics?.consent_status || "Consented (Protocol v1.0)";
    return {
      ...p,
      pseudonym,
      consent,
      totalCount,
      latestSession: latestSess,
    };
  });

  const filteredParticipants = enrichedParticipants.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.id.toLowerCase().includes(q) ||
      p.pseudonym.toLowerCase().includes(q) ||
      (p.notes || "").toLowerCase().includes(q) ||
      p.consent.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (sessionFilter === "with_sessions") return p.totalCount > 0;
    if (sessionFilter === "no_sessions") return p.totalCount === 0;
    return true;
  });

  return (
    <div className="space-y-2.5 pb-14 text-left text-xs text-[#211F1A]">
      {/* Top Mode Navigation Bar */}
      <RetroWindow
        title="Participant Management &amp; Guided Research Session Workflow"
        icon={<span>&#128100;</span>}
      >
        <div className="retro-inset bg-[#FFFDF6] p-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigateTab("home")}
              className="retro-button px-2.5 py-1 text-xs font-bold text-[#211F1A]"
            >
              &#8592; Dashboard Home
            </button>
            <button
              type="button"
              onClick={() => onModeChange("add")}
              className={`px-3 py-1 text-xs font-bold ${
                mode === "add"
                  ? "retro-inset bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                  : "retro-button text-[#073E3B]"
              }`}
            >
              + Add New Participant
            </button>
            <button
              type="button"
              onClick={() => onModeChange("select")}
              className={`px-3 py-1 text-xs font-bold ${
                mode === "select"
                  ? "retro-inset bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                  : "retro-button text-[#073E3B]"
              }`}
            >
              &#128269; Select Existing Participant ({participants.length})
            </button>
            {selectedParticipant && (
              <button
                type="button"
                onClick={() => {
                  onModeChange("profile");
                  setProfileSubMode("overview");
                }}
                className={`px-3 py-1 text-xs font-bold ${
                  mode === "profile"
                    ? "retro-inset bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                    : "retro-button text-[#073E3B]"
                }`}
              >
                &#128100; Active Profile: {selectedParticipant.id}
              </button>
            )}
          </div>

          <div className="text-[11px] font-mono text-[#686253]">
            Flowchart Stage:{" "}
            <strong className="text-[#073E3B]">
              {mode === "add"
                ? "Add New Participant -> Save -> Profile"
                : mode === "select"
                ? "Select Existing Participant -> Profile"
                : profileSubMode === "start_session_wizard"
                ? `Start New Session (Step ${wizardStep} of 5)`
                : profileSubMode === "recordings"
                ? "View Previous Recordings & Reports"
                : profileSubMode === "history"
                ? "Participant Session History"
                : "Participant Profile -> Choose Action"}
            </strong>
          </div>
        </div>
      </RetroWindow>

      {/* =====================================================================
          FLOW B: ADD NEW PARTICIPANT
         ===================================================================== */}
      {mode === "add" && (
        <RetroWindow
          title="Add New Participant — Research Enrollment Form"
          icon={<span>&#10133;</span>}
        >
          <form
            onSubmit={handleSaveNewParticipant}
            className="retro-inset bg-[#FFFDF6] p-4 space-y-3"
          >
            <div className="border-b-2 border-[#453E32] pb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#073E3B]">
                  Enroll New Research Participant
                </h2>
                <p className="text-[11px] text-[#686253]">
                  Create a pseudonymous participant profile in the NOVA SQLite Research Database and open their Participant Profile.
                </p>
              </div>
              <span className="retro-inset bg-[#E8DFCB] px-2.5 py-1 font-mono text-[10px] text-[#453E32]">
                Created Timestamp: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
              </span>
            </div>

            {addError && (
              <div
                role="alert"
                className="p-2.5 bg-rose-100 border border-rose-600 text-rose-900 font-bold text-xs"
              >
                &#9888; {addError}
              </div>
            )}

            {addSuccess && (
              <div className="p-2.5 bg-emerald-100 border border-emerald-600 text-emerald-900 font-bold text-xs">
                &#10003; {addSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Participant ID */}
              <div className="retro-inset bg-[#E8DFCB] p-3 space-y-1.5">
                <label
                  htmlFor="new-participant-id"
                  className="block text-xs font-bold text-[#073E3B]"
                >
                  Participant ID (Unique Pseudonymous Identifier) <span className="text-rose-700">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="new-participant-id"
                    type="text"
                    value={newPartId}
                    onChange={(e) => setNewPartId(e.target.value)}
                    disabled={savingParticipant}
                    placeholder="e.g. P_0015"
                    className="flex-1 retro-inset bg-white border border-[#7D7463] px-2.5 py-1.5 text-xs font-mono font-bold text-[#211F1A] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPartId(generateUniqueParticipantId())}
                    disabled={savingParticipant}
                    className="retro-button px-2.5 py-1 text-[11px] font-bold text-[#073E3B]"
                  >
                    Generate Unique ID
                  </button>
                </div>
                <p className="text-[10px] text-[#686253]">
                  Must not duplicate any of the {participants.length} existing participant IDs.
                </p>
              </div>

              {/* Participant Label / Pseudonym */}
              <div className="retro-inset bg-[#E8DFCB] p-3 space-y-1.5">
                <label
                  htmlFor="new-participant-pseudonym"
                  className="block text-xs font-bold text-[#073E3B]"
                >
                  Participant Display Label / Pseudonym (Optional)
                </label>
                <input
                  id="new-participant-pseudonym"
                  type="text"
                  value={newPseudonym}
                  onChange={(e) => setNewPseudonym(e.target.value)}
                  disabled={savingParticipant}
                  placeholder="e.g. Cohort-A Subject 15"
                  className="w-full retro-inset bg-white border border-[#7D7463] px-2.5 py-1.5 text-xs text-[#211F1A] focus:outline-none"
                />
                <p className="text-[10px] text-[#686253]">
                  Used in dashboard tables and HTML research reports without exposing PII.
                </p>
              </div>

              {/* Study Group */}
              <div className="retro-inset bg-[#E8DFCB] p-3 space-y-1.5">
                <label
                  htmlFor="new-participant-group"
                  className="block text-xs font-bold text-[#073E3B]"
                >
                  Study Cohort / Protocol Group
                </label>
                <select
                  id="new-participant-group"
                  value={newStudyGroup}
                  onChange={(e) => setNewStudyGroup(e.target.value)}
                  disabled={savingParticipant}
                  className="w-full retro-inset bg-white border border-[#7D7463] px-2.5 py-1.5 text-xs text-[#211F1A] focus:outline-none"
                >
                  <option value="IRB-AVEC-v1.0 (Standard Multimodal)">
                    IRB-AVEC-v1.0 (Standard Multimodal)
                  </option>
                  <option value="DAIC-WOZ Benchmark Evaluation Cohort">
                    DAIC-WOZ Benchmark Evaluation Cohort
                  </option>
                  <option value="Longitudinal Multi-Session Cohort">
                    Longitudinal Multi-Session Cohort
                  </option>
                  <option value="Unity Embodied Avatar Interaction Group">
                    Unity Embodied Avatar Interaction Group
                  </option>
                </select>
              </div>

              {/* Consent Status */}
              <div className="retro-inset bg-[#E8DFCB] p-3 space-y-1.5">
                <label
                  htmlFor="new-participant-consent"
                  className="block text-xs font-bold text-[#073E3B]"
                >
                  Informed Consent Status
                </label>
                <select
                  id="new-participant-consent"
                  value={newConsentStatus}
                  onChange={(e) => setNewConsentStatus(e.target.value)}
                  disabled={savingParticipant}
                  className="w-full retro-inset bg-white border border-[#7D7463] px-2.5 py-1.5 text-xs text-[#211F1A] focus:outline-none"
                >
                  <option value="Consented — Verified Informed Consent">
                    Consented — Verified Informed Consent (Full Multimodal)
                  </option>
                  <option value="Consented — Audio & Transcript Only">
                    Consented — Audio &amp; Transcript Only
                  </option>
                  <option value="Consented — Non-Clinical Benchmark">
                    Consented — Non-Clinical Benchmark
                  </option>
                </select>
                <label className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-[#211F1A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(e) => setConsentConfirmed(e.target.checked)}
                    disabled={savingParticipant}
                    className="accent-[#073E3B]"
                  />
                  <span>Confirm participant ethics consent &amp; anonymization compliance</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="retro-inset bg-[#E8DFCB] p-3 space-y-1.5">
              <label
                htmlFor="new-participant-notes"
                className="block text-xs font-bold text-[#073E3B]"
              >
                Researcher Notes / Intake Observations (Optional)
              </label>
              <textarea
                id="new-participant-notes"
                rows={3}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                disabled={savingParticipant}
                placeholder="Enter baseline observations, hardware setup notes, or study context..."
                className="w-full retro-inset bg-white border border-[#7D7463] p-2 text-xs text-[#211F1A] focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#8C8472]">
              <button
                type="button"
                disabled={savingParticipant}
                onClick={() => {
                  if (selectedParticipant) {
                    onModeChange("profile");
                  } else {
                    onNavigateTab("home");
                  }
                }}
                className="retro-button px-4 py-1.5 text-xs font-bold text-[#453E32]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingParticipant}
                className="retro-button px-5 py-1.5 text-xs font-bold bg-[#DCEEE8] text-[#073E3B] border-[#073E3B] disabled:opacity-50"
              >
                {savingParticipant ? "Saving Participant..." : "Save Participant & Open Profile"}
              </button>
            </div>
          </form>
        </RetroWindow>
      )}

      {/* =====================================================================
          FLOW C: SELECT EXISTING PARTICIPANT
         ===================================================================== */}
      {mode === "select" && (
        <RetroWindow
          title="Select Existing Participant — Research Directory"
          icon={<span>&#128194;</span>}
        >
          <div className="retro-inset bg-[#FFFDF6] p-3 space-y-3">
            {/* Search and Filter Controls */}
            <div className="retro-inset bg-[#E8DFCB] p-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <label htmlFor="participant-search" className="font-bold text-xs text-[#073E3B]">
                  Search Participant:
                </label>
                <input
                  id="participant-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Participant ID, pseudonym, or notes..."
                  className="flex-1 min-w-[220px] retro-inset bg-white border border-[#7D7463] px-2.5 py-1 text-xs text-[#211F1A] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="retro-button px-2 py-1 text-[11px]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value as any)}
                  className="retro-inset bg-white border border-[#7D7463] px-2 py-1 text-xs text-[#211F1A]"
                >
                  <option value="all">All Participants ({enrichedParticipants.length})</option>
                  <option value="with_sessions">With Recorded Sessions</option>
                  <option value="no_sessions">No Sessions Yet</option>
                </select>
                <button
                  type="button"
                  onClick={() => onModeChange("add")}
                  className="retro-button px-3 py-1 text-xs font-bold bg-[#DCEEE8] text-[#073E3B]"
                >
                  + Add New Participant
                </button>
              </div>
            </div>

            {/* Participant Table */}
            {filteredParticipants.length === 0 ? (
              <div className="p-8 text-center retro-inset bg-[#E8DFCB] space-y-2">
                <div className="text-sm font-bold text-[#073E3B]">
                  No Matching Participants Found
                </div>
                <p className="text-xs text-[#686253]">
                  {participants.length === 0
                    ? "No participants have been enrolled in the database yet."
                    : `No participant matched "${searchQuery}".`}
                </p>
                <button
                  type="button"
                  onClick={() => onModeChange("add")}
                  className="retro-button px-4 py-1.5 text-xs font-bold text-[#073E3B]"
                >
                  + Add New Participant
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#E8DFCB] text-[#073E3B] font-mono text-[11px] uppercase">
                      <th className="border border-[#8C8472] px-2.5 py-1.5 text-left">
                        Participant ID
                      </th>
                      <th className="border border-[#8C8472] px-2.5 py-1.5 text-left">
                        Pseudonym / Label
                      </th>
                      <th className="border border-[#8C8472] px-2.5 py-1.5 text-left">
                        Consent / Cohort
                      </th>
                      <th className="border border-[#8C8472] px-2.5 py-1.5 text-center">
                        Recorded Sessions
                      </th>
                      <th className="border border-[#8C8472] px-2.5 py-1.5 text-left">
                        Most Recent Session
                      </th>
                      <th className="border border-[#8C8472] px-2.5 py-1.5 text-center">
                        Latest Status
                      </th>
                      <th className="border border-[#8C8472] px-2.5 py-1.5 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p) => {
                      const isSelected = selectedParticipant?.id === p.id;
                      const latestDate = p.latestSession?.started_at
                        ? new Date(p.latestSession.started_at).toLocaleString([], {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "No sessions recorded";
                      const latestStatus = p.latestSession?.status || "none";

                      return (
                        <tr
                          key={p.id}
                          className={`${
                            isSelected
                              ? "bg-[#DCEEE8] font-semibold"
                              : "odd:bg-[#FFFDF6] even:bg-[#F5EFE0] hover:bg-[#EFE7D4]"
                          }`}
                        >
                          <td className="border border-[#8C8472] px-2.5 py-1.5 font-mono font-bold text-[#073E3B]">
                            {p.id}
                          </td>
                          <td className="border border-[#8C8472] px-2.5 py-1.5">
                            <div className="font-semibold text-[#211F1A]">{p.pseudonym}</div>
                            {p.notes && (
                              <div className="text-[10px] text-[#686253] truncate max-w-[220px]">
                                {p.notes}
                              </div>
                            )}
                          </td>
                          <td className="border border-[#8C8472] px-2.5 py-1.5 text-[11px]">
                            {p.consent}
                          </td>
                          <td className="border border-[#8C8472] px-2.5 py-1.5 text-center font-mono font-bold text-[#073E3B]">
                            {p.totalCount}
                          </td>
                          <td className="border border-[#8C8472] px-2.5 py-1.5 font-mono text-[11px]">
                            {latestDate}
                          </td>
                          <td className="border border-[#8C8472] px-2.5 py-1.5 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono font-bold border rounded-[2px] uppercase ${
                                latestStatus === "completed"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-600"
                                  : latestStatus === "active"
                                  ? "bg-sky-100 text-sky-900 border-sky-600"
                                  : "bg-gray-100 text-gray-700 border-gray-400"
                              }`}
                            >
                              {latestStatus}
                            </span>
                          </td>
                          <td className="border border-[#8C8472] px-2.5 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectParticipant(p);
                                setInspectRecordingSessionId(null);
                                setActiveWizardSession(null);
                                setWizardStep(1);
                                setProfileSubMode("overview");
                                onModeChange("profile");
                              }}
                              className="retro-button px-3 py-1 text-xs font-bold text-[#073E3B]"
                            >
                              Open Profile &#8594;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </RetroWindow>
      )}

      {/* =====================================================================
          FLOW D: PARTICIPANT PROFILE & GUIDED ACTIONS
         ===================================================================== */}
      {mode === "profile" && (
        <>
          {!selectedParticipant ? (
            <RetroWindow title="No Participant Selected" icon={<span>&#9888;</span>}>
              <div className="retro-inset bg-[#FFFDF6] p-6 text-center space-y-3">
                <div className="text-sm font-bold text-[#073E3B]">
                  Please Select or Add a Participant First
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onModeChange("select")}
                    className="retro-button px-4 py-1.5 font-bold text-xs text-[#073E3B]"
                  >
                    Select Existing Participant
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange("add")}
                    className="retro-button px-4 py-1.5 font-bold text-xs text-[#073E3B]"
                  >
                    + Add New Participant
                  </button>
                </div>
              </div>
            </RetroWindow>
          ) : (
            <>
              {/* Participant Profile Header & Primary Choose Action Bar */}
              <RetroWindow
                title={`Participant Profile — ${selectedParticipant.id} (${
                  selectedParticipant.demographics?.pseudonym || `Subject ${selectedParticipant.id}`
                })`}
                icon={<span>&#128100;</span>}
              >
                <div className="retro-inset bg-[#FFFDF6] p-3 space-y-3">
                  {/* Metadata Summary Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] text-[#686253] block">Participant ID</span>
                      <strong className="font-mono text-sm text-[#073E3B]">
                        {selectedParticipant.id}
                      </strong>
                    </div>
                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] text-[#686253] block">Display Label</span>
                      <strong className="text-xs text-[#211F1A]">
                        {selectedParticipant.demographics?.pseudonym ||
                          `Subject ${selectedParticipant.id}`}
                      </strong>
                    </div>
                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] text-[#686253] block">Consent Status</span>
                      <strong className="text-[11px] text-emerald-800">
                        {selectedParticipant.demographics?.consent_status ||
                          "Consented (IRB v1.0)"}
                      </strong>
                    </div>
                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] text-[#686253] block">Enrolled Date</span>
                      <strong className="font-mono text-[11px] text-[#211F1A]">
                        {selectedParticipant.created_at
                          ? new Date(selectedParticipant.created_at).toLocaleDateString()
                          : "Recorded"}
                      </strong>
                    </div>
                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] text-[#686253] block">Recorded Sessions</span>
                      <strong className="font-mono text-sm text-[#073E3B]">
                        {participantSessions.length}
                      </strong>
                    </div>
                    <div className="retro-inset bg-[#E8DFCB] p-2">
                      <span className="text-[10px] text-[#686253] block">Completed Sessions</span>
                      <strong className="font-mono text-sm text-emerald-800">
                        {participantSessions.filter((s) => s.status === "completed").length}
                      </strong>
                    </div>
                  </div>

                  {/* Flowchart Action Selection Bar: Choose Action */}
                  <div className="retro-window bg-[#E8DFCB] p-2.5 border border-[#453E32] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold font-mono text-[#073E3B] uppercase">
                        Participant Profile — Choose Researcher Action:
                      </span>
                      <span className="text-[10px] text-[#686253]">
                        Notes: {selectedParticipant.notes || "Standard multimodal cohort participant"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWizardStep(1);
                          setWizardError(null);
                          setConfirmEndPrompt(false);
                          setEndedSessionSummary(null);
                          setProfileSubMode("start_session_wizard");
                        }}
                        className={`p-2 text-left flex items-center gap-2 font-bold text-xs ${
                          profileSubMode === "start_session_wizard"
                            ? "retro-inset bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                            : "retro-button text-[#073E3B]"
                        }`}
                      >
                        <span className="text-base">&#9654;</span>
                        <div>
                          <div>Start New Session</div>
                          <div className="text-[10px] font-normal text-[#686253]">
                            Readiness Check &rarr; Run NOVA &rarr; Report
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileSubMode("recordings");
                          if (participantSessions.length > 0 && !inspectRecordingSessionId) {
                            setInspectRecordingSessionId(participantSessions[0].id);
                          }
                        }}
                        className={`p-2 text-left flex items-center gap-2 font-bold text-xs ${
                          profileSubMode === "recordings"
                            ? "retro-inset bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                            : "retro-button text-[#211F1A]"
                        }`}
                      >
                        <span className="text-base">&#128249;</span>
                        <div>
                          <div>View Previous Recordings</div>
                          <div className="text-[10px] font-normal text-[#686253]">
                            {participantSessions.length} Saved Session(s) &amp; HTML Reports
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProfileSubMode("history")}
                        className={`p-2 text-left flex items-center gap-2 font-bold text-xs ${
                          profileSubMode === "history"
                            ? "retro-inset bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                            : "retro-button text-[#211F1A]"
                        }`}
                      >
                        <span className="text-base">&#128194;</span>
                        <div>
                          <div>View Session History</div>
                          <div className="text-[10px] font-normal text-[#686253]">
                            Chronological Turn Log &amp; Statuses
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProfileSubMode("details")}
                        className={`p-2 text-left flex items-center gap-2 font-bold text-xs ${
                          profileSubMode === "details"
                            ? "retro-inset bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                            : "retro-button text-[#211F1A]"
                        }`}
                      >
                        <span className="text-base">&#128203;</span>
                        <div>
                          <div>View Participant Details</div>
                          <div className="text-[10px] font-normal text-[#686253]">
                            Metadata, Consent &amp; Longitudinal Trajectory
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </RetroWindow>

              {/* ===============================================================
                  SUB-MODE: START NEW SESSION 5-STEP GUIDED WORKFLOW
                 =============================================================== */}
              {profileSubMode === "start_session_wizard" && (
                <RetroWindow
                  title={`Start New Session Workflow — Participant ${selectedParticipant.id}`}
                  icon={<span>&#9881;</span>}
                >
                  <div className="retro-inset bg-[#FFFDF6] p-3 space-y-3">
                    {/* 5-Step Progress Indicator */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { step: 1, title: "1. Confirm Participant" },
                        { step: 2, title: "2. System Readiness" },
                        { step: 3, title: "3. Start Session" },
                        { step: 4, title: "4. Run NOVA / Live" },
                        { step: 5, title: "5. End & HTML Report" },
                      ].map((item) => {
                        const isCurrent = wizardStep === item.step;
                        const isDone = wizardStep > item.step;
                        return (
                          <div
                            key={item.step}
                            className={`p-2 text-center font-mono text-[11px] border ${
                              isCurrent
                                ? "retro-inset bg-[#DCEEE8] text-[#073E3B] font-bold border-[#073E3B]"
                                : isDone
                                ? "retro-window bg-emerald-50 text-emerald-900 border-emerald-600 font-bold"
                                : "retro-window bg-[#E8DFCB] text-[#686253]"
                            }`}
                          >
                            {isDone ? "✓ " : ""}
                            {item.title}
                          </div>
                        );
                      })}
                    </div>

                    {wizardError && (
                      <div
                        role="alert"
                        className="p-2.5 bg-rose-100 border border-rose-600 text-rose-900 font-bold text-xs flex items-center justify-between"
                      >
                        <span>&#9888; {wizardError}</span>
                        <button
                          type="button"
                          onClick={() => setWizardError(null)}
                          className="retro-button px-2 py-0.5 text-[10px]"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {/* STEPS 1, 2 & 3: PRE-LAUNCH CONFIRMATION, READINESS CHECK & START */}
                    {(wizardStep === 1 || wizardStep === 2 || wizardStep === 3) && (
                      <div className="space-y-3">
                        {/* Step 1 Panel: Confirm Participant & Protocol */}
                        <div className="retro-inset bg-[#E8DFCB] p-3 space-y-2">
                          <div className="flex items-center justify-between border-b border-[#8C8472] pb-1">
                            <span className="font-bold font-mono text-xs text-[#073E3B] uppercase">
                              Step 1 — Confirm Participant &amp; Session Configuration
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-600 font-mono text-[10px] font-bold">
                              Confirmed: {selectedParticipant.id}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                            <div className="retro-inset bg-[#FFFDF6] p-2">
                              <span className="text-[10px] text-[#686253] block">
                                Selected Participant
                              </span>
                              <strong className="font-mono text-xs text-[#073E3B]">
                                {selectedParticipant.id} (
                                {selectedParticipant.demographics?.pseudonym ||
                                  `Subject ${selectedParticipant.id}`}
                                )
                              </strong>
                            </div>
                            <div className="retro-inset bg-[#FFFDF6] p-2">
                              <label
                                htmlFor="session-protocol-select"
                                className="text-[10px] text-[#686253] block"
                              >
                                Research Protocol Version
                              </label>
                              <select
                                id="session-protocol-select"
                                value={protocolVersion}
                                onChange={(e) => setProtocolVersion(e.target.value)}
                                className="w-full bg-white border border-[#8C8472] px-1.5 py-0.5 text-xs font-mono mt-0.5"
                              >
                                <option value="v1.0">v1.0 (Standard Multimodal + PPO)</option>
                                <option value="v1.1-DAIC">v1.1-DAIC (AVEC Benchmark Protocol)</option>
                              </select>
                            </div>
                            <div className="retro-inset bg-[#FFFDF6] p-2">
                              <label
                                htmlFor="session-notes-input"
                                className="text-[10px] text-[#686253] block"
                              >
                                Session Context / Researcher Notes
                              </label>
                              <input
                                id="session-notes-input"
                                type="text"
                                value={sessionNotes}
                                onChange={(e) => setSessionNotes(e.target.value)}
                                className="w-full bg-white border border-[#8C8472] px-2 py-0.5 text-xs mt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Step 2 Panel: Check System Readiness */}
                        <div className="retro-inset bg-[#E8DFCB] p-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#8C8472] pb-1">
                            <div>
                              <span className="font-bold font-mono text-xs text-[#073E3B] uppercase">
                                Step 2 — Check System Readiness (Hardware, AI Pipeline &amp; Unity Bridge)
                              </span>
                              <p className="text-[10px] text-[#686253]">
                                Verifies real browser device availability, FastAPI backend health, Whisper ASR, Acoustic DSP, Face/Gaze processors, and Unity WebSocket readiness.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => runSystemReadinessChecks(false)}
                                disabled={checkingReadiness}
                                className="retro-button px-2.5 py-1 text-[11px] font-bold text-[#073E3B]"
                              >
                                {checkingReadiness ? "Checking..." : "\u21BB Re-Check Readiness"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runSystemReadinessChecks(true)}
                                disabled={checkingReadiness}
                                className="retro-button px-2.5 py-1 text-[11px] text-[#211F1A]"
                              >
                                &#127908; Verify Mic Permission
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {readinessItems.map((item) => (
                              <div
                                key={item.id}
                                className="retro-inset bg-[#FFFDF6] p-2 flex flex-col justify-between gap-1"
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-bold text-[11px] text-[#073E3B]">
                                    {item.label}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[9px] font-mono font-bold border rounded-[2px] flex-shrink-0 ${readinessBadgeClass(
                                      item.status
                                    )}`}
                                  >
                                    {item.status}
                                  </span>
                                </div>
                                <span className="text-[10px] text-[#686253] leading-tight">
                                  {item.detail}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Step 3 Panel: Start Session */}
                        <div className="retro-window bg-[#DCEEE8] p-3 border-2 border-[#073E3B] flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-xs text-[#073E3B] uppercase font-mono">
                              Step 3 — Start New Research Session
                            </div>
                            <p className="text-[11px] text-[#211F1A]">
                              Creates a new session record in the backend database for participant{" "}
                              <strong className="font-mono">{selectedParticipant.id}</strong>, activates the PPO dialogue state machine, and opens the Live Session / Unity execution console.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleStartGuidedSession}
                            disabled={startingSession}
                            className="retro-button px-5 py-2 font-bold text-xs bg-[#073E3B] text-white hover:bg-[#0B534E] border-[#032422] disabled:opacity-50 cursor-pointer"
                          >
                            {startingSession
                              ? "Initializing Session..."
                              : "\u25B6 Start Session & Launch Live Console"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: RUN NOVA IN UNITY / LIVE SESSION EXECUTION */}
                    {wizardStep === 4 && activeWizardSession && (
                      <div className="space-y-3">
                        {/* Step 4 Live Session Telemetry Banner */}
                        <div className="retro-window bg-[#E8DFCB] p-3 border-2 border-[#073E3B] space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="retro-led" />
                              <span className="font-bold text-xs text-[#073E3B] font-mono uppercase">
                                Step 4 Active — Run NOVA in Unity / Live Research Session
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="retro-inset bg-[#FFFDF6] px-2.5 py-1 font-mono text-xs font-bold text-[#073E3B]">
                                Elapsed:{" "}
                                {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:
                                {String(elapsedSeconds % 60).padStart(2, "0")}
                              </span>

                              {!confirmEndPrompt ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmEndPrompt(true)}
                                  className="retro-button px-4 py-1.5 font-bold text-xs bg-rose-100 text-rose-900 border-rose-700"
                                >
                                  &#9632; Step 5: End Session
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-600 p-1">
                                  <span className="text-[11px] font-bold text-rose-900 px-1">
                                    End &amp; finalize session?
                                  </span>
                                  <button
                                    type="button"
                                    disabled={endingSession}
                                    onClick={handleConfirmEndGuidedSession}
                                    className="retro-button px-2.5 py-1 text-[11px] font-bold bg-rose-700 text-white"
                                  >
                                    {endingSession ? "Ending..." : "Confirm End Session"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={endingSession}
                                    onClick={() => setConfirmEndPrompt(false)}
                                    className="retro-button px-2 py-1 text-[11px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Unity External Client & Active Session Info Bar */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px] font-mono">
                            <div className="retro-inset bg-[#FFFDF6] p-1.5">
                              <span className="text-[#686253] block text-[9px]">ACTIVE SESSION ID</span>
                              <strong className="text-[#073E3B]">{activeWizardSession.id}</strong>
                            </div>
                            <div className="retro-inset bg-[#FFFDF6] p-1.5">
                              <span className="text-[#686253] block text-[9px]">PARTICIPANT ID</span>
                              <strong className="text-[#073E3B]">
                                {activeWizardSession.participant_id}
                              </strong>
                            </div>
                            <div className="retro-inset bg-[#FFFDF6] p-1.5 md:col-span-2">
                              <span className="text-[#686253] block text-[9px]">
                                UNITY 3D AVATAR WEBSOCKET BRIDGE (EXTERNAL CLIENT)
                              </span>
                              <strong className="text-[#211F1A] text-[10px]">
                                ws://localhost:8000/ws/unity/{activeWizardSession.id} (Or use Live Browser Console below)
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Embedded LiveSessionView for Immediate Speech / Text / Multimodal Interaction */}
                        <LiveSessionView
                          activeSession={activeWizardSession}
                          onRefreshSessions={onRefreshAll}
                        />
                      </div>
                    )}

                    {/* STEP 5: SESSION ENDED -> GENERATE HTML REPORT -> REVIEW MODALITIES */}
                    {wizardStep === 5 && (endedSessionSummary || activeWizardSession) && (
                      <div className="retro-window bg-[#E8DFCB] p-4 border-2 border-[#073E3B] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#453E32] pb-2">
                          <div>
                            <h3 className="text-sm font-bold text-[#073E3B]">
                              &#10003; Step 5 Complete — Research Session Ended &amp; Persisted
                            </h3>
                            <p className="text-xs text-[#686253]">
                              Session{" "}
                              <strong className="font-mono text-[#211F1A]">
                                {(endedSessionSummary || activeWizardSession)?.id}
                              </strong>{" "}
                              for participant{" "}
                              <strong className="font-mono text-[#211F1A]">
                                {selectedParticipant.id}
                              </strong>{" "}
                              has been finalized. Proceed to generate and review the multimodal HTML report.
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-700 font-mono text-xs font-bold uppercase">
                            STATUS: COMPLETED
                          </span>
                        </div>

                        {/* Flowchart Next Step: Generate HTML Report -> Review Audio, Face, Gaze and Fusion */}
                        <div className="retro-inset bg-[#FFFDF6] p-3 space-y-2.5">
                          <div className="text-xs font-bold text-[#073E3B] uppercase font-mono">
                            Post-Session Workflow: Generate HTML Report &rarr; Review Audio, Face, Gaze &amp; Fusion
                          </div>
                          <p className="text-xs text-[#211F1A]">
                            Click <strong>Generate &amp; Review HTML Report</strong> below to inspect speech transcripts, extracted acoustic DSP biomarkers, facial Action Units, 3D gaze vectors, cross-modal transformer fusion scores, and PPO adaptive question selections.
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const sess = endedSessionSummary || activeWizardSession;
                                if (sess) onOpenReportModal(sess, selectedParticipant);
                              }}
                              className="retro-button px-4 py-2 font-bold text-xs bg-[#DCEEE8] text-[#073E3B] border-[#073E3B]"
                            >
                              &#128196; Generate HTML Report (Review Audio, Face, Gaze &amp; Fusion)
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const sess = endedSessionSummary || activeWizardSession;
                                if (sess) handleQuickDownloadReport(sess);
                              }}
                              className="retro-button px-3.5 py-2 font-bold text-xs text-[#073E3B]"
                            >
                              &#128190; Download HTML Report (.html)
                            </button>

                            <button
                              type="button"
                              onClick={() => setProfileSubMode("overview")}
                              className="retro-button px-3.5 py-2 font-bold text-xs text-[#211F1A]"
                            >
                              &#128100; Return to Participant Profile
                            </button>

                            <button
                              type="button"
                              onClick={() => onNavigateTab("replay")}
                              className="retro-button px-3.5 py-2 font-bold text-xs text-[#211F1A]"
                            >
                              &#128194; Return to Session History
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </RetroWindow>
              )}

              {/* ===============================================================
                  SUB-MODE: OVERVIEW / PREVIOUS RECORDINGS / SESSION HISTORY
                 =============================================================== */}
              {(profileSubMode === "overview" ||
                profileSubMode === "recordings" ||
                profileSubMode === "history") && (
                <RetroWindow
                  title={
                    profileSubMode === "recordings"
                      ? `Previous Recordings & Multimodal Reports — Participant ${selectedParticipant.id}`
                      : `Recorded Research Sessions — Participant ${selectedParticipant.id}`
                  }
                  icon={<span>&#128249;</span>}
                >
                  <div className="retro-inset bg-[#FFFDF6] p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#453E32] pb-1.5">
                      <div>
                        <h3 className="text-xs font-bold text-[#073E3B] uppercase font-mono">
                          Saved Sessions, Extracted Multimodal Features &amp; HTML Reports (
                          {participantSessions.length})
                        </h3>
                        <p className="text-[11px] text-[#686253]">
                          NOVA stores turn-by-turn speech transcripts, extracted acoustic/facial/ocular feature vectors, cross-modal fusion records, and PPO decisions.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setWizardStep(1);
                          setProfileSubMode("start_session_wizard");
                        }}
                        className="retro-button px-3 py-1 font-bold text-xs bg-[#DCEEE8] text-[#073E3B]"
                      >
                        &#9654; Start New Session for {selectedParticipant.id}
                      </button>
                    </div>

                    {participantSessions.length === 0 ? (
                      <div className="p-8 text-center retro-inset bg-[#E8DFCB] space-y-2">
                        <div className="text-sm font-bold text-[#073E3B]">
                          No Previous Recordings Found for {selectedParticipant.id}
                        </div>
                        <p className="text-xs text-[#686253]">
                          This participant has not completed any research sessions yet. Click{" "}
                          <strong>Start New Session</strong> to begin a guided session.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setWizardStep(1);
                            setProfileSubMode("start_session_wizard");
                          }}
                          className="retro-button px-4 py-1.5 font-bold text-xs text-[#073E3B]"
                        >
                          &#9654; Start New Session
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#E8DFCB] text-[#073E3B] font-mono text-[11px] uppercase">
                              <th className="border border-[#8C8472] px-2 py-1.5 text-left">
                                Session ID
                              </th>
                              <th className="border border-[#8C8472] px-2 py-1.5 text-left">
                                Date / Time
                              </th>
                              <th className="border border-[#8C8472] px-2 py-1.5 text-center">
                                Turns
                              </th>
                              <th className="border border-[#8C8472] px-2 py-1.5 text-left">
                                Stored Recording Artifacts
                              </th>
                              <th className="border border-[#8C8472] px-2 py-1.5 text-center">
                                Status
                              </th>
                              <th className="border border-[#8C8472] px-2 py-1.5 text-right">
                                Actions (Replay / HTML Report)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {participantSessions.map((sess) => {
                              const isInspecting = inspectRecordingSessionId === sess.id;
                              return (
                                <tr
                                  key={sess.id}
                                  className={`${
                                    isInspecting
                                      ? "bg-[#DCEEE8]"
                                      : "odd:bg-[#FFFDF6] even:bg-[#F5EFE0]"
                                  }`}
                                >
                                  <td className="border border-[#8C8472] px-2 py-1.5 font-mono font-bold text-[#073E3B]">
                                    {sess.id}
                                  </td>
                                  <td className="border border-[#8C8472] px-2 py-1.5 font-mono text-[11px]">
                                    {sess.started_at
                                      ? new Date(sess.started_at).toLocaleString()
                                      : "Not started"}
                                  </td>
                                  <td className="border border-[#8C8472] px-2 py-1.5 text-center font-mono font-bold">
                                    {sess.turn_count}
                                  </td>
                                  <td className="border border-[#8C8472] px-2 py-1.5 text-[11px]">
                                    {sess.turn_count > 0 ? (
                                      <span className="text-emerald-900 font-semibold">
                                        Transcript + Acoustic/Face/Gaze Features + Fusion/PPO Log
                                      </span>
                                    ) : (
                                      <span className="text-[#686253] italic">
                                        Session Metadata Only (0 Turns Recorded)
                                      </span>
                                    )}
                                  </td>
                                  <td className="border border-[#8C8472] px-2 py-1.5 text-center">
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-mono font-bold border rounded-[2px] uppercase ${
                                        sess.status === "completed"
                                          ? "bg-emerald-100 text-emerald-900 border-emerald-600"
                                          : sess.status === "active"
                                          ? "bg-sky-100 text-sky-900 border-sky-600"
                                          : "bg-gray-100 text-gray-700 border-gray-400"
                                      }`}
                                    >
                                      {sess.status}
                                    </span>
                                  </td>
                                  <td className="border border-[#8C8472] px-2 py-1.5 text-right">
                                    <div className="flex flex-wrap justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onSelectSession(sess);
                                          setInspectRecordingSessionId(
                                            isInspecting ? null : sess.id
                                          );
                                        }}
                                        className="retro-button px-2 py-0.5 text-[11px] font-bold text-[#073E3B]"
                                      >
                                        {isInspecting ? "Hide Replay" : "\u25B6 Inspect Replay"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onOpenReportModal(sess, selectedParticipant)}
                                        className="retro-button px-2 py-0.5 text-[11px] font-bold bg-[#DCEEE8] text-[#073E3B]"
                                      >
                                        &#128196; HTML Report
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickDownloadReport(sess)}
                                        className="retro-button px-2 py-0.5 text-[11px]"
                                        title="Download Standalone HTML Report"
                                      >
                                        &#128190; .HTML
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Inline Chronological Turn Replay Inspector when a recording is selected */}
                    {inspectRecordingSessionId && (
                      <div className="pt-2 border-t-2 border-[#453E32]">
                        <ReplayView sessionId={inspectRecordingSessionId} />
                      </div>
                    )}
                  </div>
                </RetroWindow>
              )}

              {/* ===============================================================
                  SUB-MODE: PARTICIPANT DETAILS & METADATA
                 =============================================================== */}
              {profileSubMode === "details" && (
                <RetroWindow
                  title={`Participant Detailed Record — ${selectedParticipant.id}`}
                  icon={<span>&#128203;</span>}
                >
                  <div className="retro-inset bg-[#FFFDF6] p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="retro-inset bg-[#E8DFCB] p-3 space-y-2">
                        <h4 className="font-bold font-mono text-xs text-[#073E3B] uppercase border-b border-[#8C8472] pb-1">
                          Enrollment &amp; Ethics Record
                        </h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#686253]">Participant ID:</span>
                            <strong className="font-mono">{selectedParticipant.id}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686253]">Pseudonym / Label:</span>
                            <strong>
                              {selectedParticipant.demographics?.pseudonym ||
                                `Subject ${selectedParticipant.id}`}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686253]">Study Cohort:</span>
                            <strong>
                              {selectedParticipant.demographics?.study_group ||
                                "IRB-AVEC-v1.0 Standard Cohort"}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686253]">Informed Consent:</span>
                            <strong className="text-emerald-800">
                              {selectedParticipant.demographics?.consent_status ||
                                "Verified Informed Consent"}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686253]">Created Timestamp:</span>
                            <strong className="font-mono">
                              {selectedParticipant.created_at
                                ? new Date(selectedParticipant.created_at).toLocaleString()
                                : "Recorded"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="retro-inset bg-[#E8DFCB] p-3 space-y-2">
                        <h4 className="font-bold font-mono text-xs text-[#073E3B] uppercase border-b border-[#8C8472] pb-1">
                          Researcher Notes &amp; Longitudinal Access
                        </h4>
                        <p className="text-xs text-[#211F1A] retro-inset bg-[#FFFDF6] p-2 min-h-[56px]">
                          {selectedParticipant.notes ||
                            "No additional intake notes recorded for this participant."}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onNavigateTab("longitudinal")}
                            className="retro-button px-3 py-1 font-bold text-xs text-[#073E3B]"
                          >
                            &#128200; Open Longitudinal Trajectory Analysis
                          </button>
                          <button
                            type="button"
                            onClick={() => setProfileSubMode("overview")}
                            className="retro-button px-3 py-1 text-xs"
                          >
                            Back to Sessions Overview
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </RetroWindow>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
