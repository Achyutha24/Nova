import { useState, useEffect } from "react";
import { api, wsManager } from "./api";
import type {
  SessionSummary,
  TimelineSignalPoint,
  SystemHealth,
  ModelStatus,
  ParticipantRecord,
} from "./api";

// Retro 1990s Desktop UI Components
import { RetroTopBar } from "./components/retro/RetroTopBar";
import { RetroSidebar } from "./components/retro/RetroSidebar";
import { RetroTaskbar } from "./components/retro/RetroTaskbar";
import { HomeConsoleView } from "./components/retro/HomeConsoleView";
import { RetroSettingsWindow } from "./components/retro/RetroSettingsWindow";
import { RetroWindow } from "./components/retro/RetroWindow";
import { ResearcherLoginWindow } from "./components/retro/ResearcherLoginWindow";
import type { ResearcherAuthSession } from "./components/retro/ResearcherLoginWindow";
import { ParticipantWorkflowView } from "./components/retro/ParticipantWorkflowView";
import type { WorkflowMode, ProfileSubMode } from "./components/retro/ParticipantWorkflowView";
import { SessionHtmlReportModal } from "./components/retro/SessionHtmlReportModal";

// Existing Research Sub-Views
import { LiveSessionView } from "./components/LiveSessionView";
import { TimelineView } from "./components/TimelineView";
import { ReplayView } from "./components/ReplayView";
import { LongitudinalView } from "./components/LongitudinalView";
import { BenchmarksView } from "./components/BenchmarksView";

const AUTH_STORAGE_KEY = "nova_researcher_session_v1";

export function App() {
  const [researcherSession, setResearcherSession] = useState<ResearcherAuthSession | null>(() => {
    try {
      const saved = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  const [activeTab, setActiveTab] = useState<string>("home");
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRecord | null>(null);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("profile");
  const [profileSubMode, setProfileSubMode] = useState<ProfileSubMode>("overview");

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [timelineSignals, setTimelineSignals] = useState<TimelineSignalPoint[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // HTML Report Modal State
  const [reportModalTarget, setReportModalTarget] = useState<{
    session: SessionSummary;
    participant?: ParticipantRecord | null;
  } | null>(null);

  const loadAllData = async () => {
    try {
      const [sessList, partList] = await Promise.all([
        api.listSessions().catch(() => [] as SessionSummary[]),
        api.listParticipants().catch(() => [] as ParticipantRecord[]),
      ]);

      setSessions(sessList);
      setParticipants(partList);

      let activeSess = selectedSession;
      if (sessList.length > 0) {
        if (!activeSess) {
          activeSess = sessList[0];
          setSelectedSession(activeSess);
        } else {
          const updated = sessList.find((s) => s.id === activeSess?.id);
          if (updated) {
            activeSess = updated;
            setSelectedSession(updated);
          }
        }
      }

      if (partList.length > 0 && !selectedParticipant) {
        const matchPart = activeSess
          ? partList.find((p) => p.id === activeSess?.participant_id)
          : null;
        setSelectedParticipant(matchPart || partList[0]);
      } else if (selectedParticipant) {
        const updatedPart = partList.find((p) => p.id === selectedParticipant.id);
        if (updatedPart) setSelectedParticipant(updatedPart);
      }
    } catch (err) {
      console.error("Error loading sessions/participants:", err);
    }
  };

  const loadTelemetry = () => {
    api.getHealth().then(setHealth).catch(console.error);
    api.getModelStatus().then(setModelStatus).catch(console.error);
  };

  useEffect(() => {
    if (!researcherSession) {
      wsManager.disconnect();
      setWsConnected(false);
      return;
    }
    loadAllData();
    loadTelemetry();
  }, [researcherSession]);

  useEffect(() => {
    if (!researcherSession || !selectedSession) {
      wsManager.disconnect();
      setWsConnected(false);
      return;
    }

    api
      .getSignals(selectedSession.id)
      .then((res) => {
        setTimelineSignals(res.signals || []);
      })
      .catch((err) => console.error("Error loading signals:", err));

    wsManager.connect(selectedSession.id);
    const unsubscribe = wsManager.subscribe(
      (msg) => {
        if (msg.type === "turn_completed") {
          api
            .getSignals(selectedSession.id)
            .then((r) => {
              if (r.signals) setTimelineSignals(r.signals);
            })
            .catch(console.error);
          loadAllData();
        }
      },
      (connected) => setWsConnected(connected)
    );

    return () => {
      unsubscribe();
    };
  }, [researcherSession, selectedSession?.id]);

  // --- RESEARCHER LOGIN / LOGOUT HANDLERS ---
  const handleLoginSuccess = (session: ResearcherAuthSession) => {
    setResearcherSession(session);
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch (_) {}
    setActiveTab("home");
  };

  const handleLogout = () => {
    wsManager.disconnect();
    setWsConnected(false);
    setResearcherSession(null);
    setParticipants([]);
    setSessions([]);
    setSelectedParticipant(null);
    setSelectedSession(null);
    setTimelineSignals([]);
    setReportModalTarget(null);
    setShowHelpModal(false);
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (_) {}
  };

  // --- WORKFLOW NAVIGATION HELPERS ---
  const handleOpenAddParticipant = () => {
    if (!researcherSession) return;
    setWorkflowMode("add");
    setActiveTab("participants");
  };

  const handleOpenSelectParticipant = () => {
    if (!researcherSession) return;
    setWorkflowMode("select");
    setActiveTab("participants");
  };

  const handleOpenParticipantProfile = (
    participantId?: string,
    subMode: ProfileSubMode = "overview"
  ) => {
    if (!researcherSession) return;
    if (participantId) {
      const existing = participants.find((p) => p.id === participantId);
      if (existing) {
        setSelectedParticipant(existing);
      } else {
        setSelectedParticipant({
          id: participantId,
          created_at: new Date().toISOString(),
          notes: "Enrolled Participant",
          demographics: { pseudonym: `Subject ${participantId}` },
          session_count: sessions.filter((s) => s.participant_id === participantId).length,
        });
      }
      // Also focus the latest session for this participant if available
      const partSessions = sessions.filter((s) => s.participant_id === participantId);
      if (partSessions.length > 0) {
        setSelectedSession(partSessions[0]);
      }
    }
    setProfileSubMode(subMode);
    setWorkflowMode("profile");
    setActiveTab("participants");
  };

  const handleOpenStartSessionWizard = () => {
    if (!researcherSession) return;
    if (!selectedParticipant && participants.length > 0) {
      setSelectedParticipant(participants[0]);
    }
    setProfileSubMode("start_session_wizard");
    setWorkflowMode("profile");
    setActiveTab("participants");
  };

  const handleOpenReportForSession = (
    sess: SessionSummary,
    part?: ParticipantRecord | null
  ) => {
    if (!researcherSession) return;
    const matchedParticipant =
      part ||
      participants.find((p) => p.id === sess.participant_id) ||
      selectedParticipant;
    setReportModalTarget({
      session: sess,
      participant: matchedParticipant,
    });
  };

  const handleExportData = () => {
    if (!researcherSession || !selectedSession) {
      return;
    }
    const exportPayload = {
      session: selectedSession,
      signals: timelineSignals,
      export_timestamp: new Date().toISOString(),
      platform: "NOVA Multimodal Research Console",
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NOVA_Session_${selectedSession.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dedicated Full-Page Login Gate: Do not render any dashboard backdrop or protected research data before authentication
  if (!researcherSession) {
    return <ResearcherLoginWindow onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen retro-desktop-bg flex flex-col font-sans select-none text-[#211F1A]">
      {/* Top Retro Application Title Bar & Menus */}
      <div className="p-1 pb-0">
        <RetroTopBar
          onNewSession={handleOpenStartSessionWizard}
          onAddParticipant={handleOpenAddParticipant}
          onSelectParticipant={handleOpenSelectParticipant}
          onGenerateReport={() => {
            if (selectedSession) {
              handleOpenReportForSession(selectedSession);
            }
          }}
          onExportData={handleExportData}
          onRefresh={() => {
            loadAllData();
            loadTelemetry();
          }}
          onOpenSettings={() => setActiveTab("settings")}
          onOpenHelp={() => setShowHelpModal(true)}
          onLogout={handleLogout}
          researcherSession={researcherSession}
          sessions={sessions}
          selectedSession={selectedSession}
          onSelectSession={(s) => {
            setSelectedSession(s);
            const matchPart = participants.find((p) => p.id === s.participant_id);
            if (matchPart) setSelectedParticipant(matchPart);
          }}
        />
      </div>

      {/* Main Desktop Workspace Area */}
      <div className="flex-1 flex gap-1.5 p-1 pt-0 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <RetroSidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === "participants" && !selectedParticipant && participants.length > 0) {
              setSelectedParticipant(participants[0]);
            }
            setActiveTab(tab);
          }}
          health={health}
          modelStatus={modelStatus}
          wsConnected={wsConnected}
        />

        {/* Center / Right Content Pane */}
        <main className="flex-1 overflow-y-auto pr-0.5">
          {activeTab === "home" && (
            <HomeConsoleView
              session={selectedSession}
              sessions={sessions}
              participants={participants}
              selectedParticipant={selectedParticipant}
              signals={timelineSignals}
              onRefreshData={() => {
                loadAllData();
                if (selectedSession) {
                  api
                    .getSignals(selectedSession.id)
                    .then((r) => setTimelineSignals(r.signals || []));
                }
              }}
              onAddNewParticipant={handleOpenAddParticipant}
              onSelectExistingParticipant={handleOpenSelectParticipant}
              onOpenParticipantProfile={(pid) => handleOpenParticipantProfile(pid, "overview")}
              onStartNewSessionWizard={handleOpenStartSessionWizard}
              onOpenSessionHistory={() => setActiveTab("replay")}
              onSelectSession={(s) => {
                setSelectedSession(s);
                const matchPart = participants.find((p) => p.id === s.participant_id);
                if (matchPart) setSelectedParticipant(matchPart);
              }}
              onOpenReportModal={(s) => handleOpenReportForSession(s)}
              researcherId={researcherSession?.researcherId || "RES-NOVA-01"}
            />
          )}

          {activeTab === "participants" && (
            <ParticipantWorkflowView
              mode={workflowMode}
              onModeChange={setWorkflowMode}
              participants={participants}
              sessions={sessions}
              selectedParticipant={selectedParticipant}
              onSelectParticipant={(p) => {
                setSelectedParticipant(p);
                const pSessions = sessions.filter((s) => s.participant_id === p.id);
                if (pSessions.length > 0) {
                  setSelectedSession(pSessions[0]);
                }
              }}
              selectedSession={selectedSession}
              onSelectSession={setSelectedSession}
              onRefreshAll={loadAllData}
              onOpenReportModal={handleOpenReportForSession}
              onNavigateTab={setActiveTab}
              health={health}
              modelStatus={modelStatus}
              wsConnected={wsConnected}
              researcherId={researcherSession?.researcherId || "RES-NOVA-01"}
              initialProfileSubMode={profileSubMode}
            />
          )}

          {activeTab === "live" && (
            <div className="pb-14">
              <RetroWindow
                title="Live Research Session — Interactive Console"
                icon={<span>&#128187;</span>}
              >
                <LiveSessionView
                  activeSession={selectedSession}
                  onRefreshSessions={loadAllData}
                  onOpenReportModal={(s) => handleOpenReportForSession(s)}
                  onOpenParticipantProfile={(pid) =>
                    handleOpenParticipantProfile(pid, "overview")
                  }
                />
              </RetroWindow>
            </div>
          )}

          {activeTab === "replay" && (
            <div className="pb-14">
              <RetroWindow
                title="Session History &amp; Chronological Replay"
                icon={<span>&#128194;</span>}
              >
                {selectedSession ? (
                  <ReplayView
                    sessionId={selectedSession.id}
                    sessions={sessions}
                    showHistoryTable={true}
                    onSelectSession={setSelectedSession}
                    onOpenReportModal={(s) => handleOpenReportForSession(s)}
                    onOpenParticipantProfile={(pid) =>
                      handleOpenParticipantProfile(pid, "overview")
                    }
                  />
                ) : (
                  <div className="p-6 text-center text-[#686253] retro-inset bg-[#FFFDF6]">
                    No session selected.
                  </div>
                )}
              </RetroWindow>
            </div>
          )}

          {activeTab === "multimodal" && (
            <div className="pb-14">
              <RetroWindow
                title="Multimodal Signal Tracks &amp; Figure 7 Analysis"
                icon={<span>&#128202;</span>}
              >
                <TimelineView
                  signals={timelineSignals}
                  sessionId={selectedSession?.id}
                  participantId={selectedSession?.participant_id}
                />
              </RetroWindow>
            </div>
          )}

          {activeTab === "benchmarks" && (
            <div className="pb-14">
              <RetroWindow
                title="DAIC-WOZ Benchmark Evaluation &amp; Ablation Suite"
                icon={<span>&#129504;</span>}
              >
                <BenchmarksView />
              </RetroWindow>
            </div>
          )}

          {activeTab === "longitudinal" && (
            <div className="pb-14">
              <RetroWindow
                title="Longitudinal Trajectory Analysis"
                icon={<span>&#128200;</span>}
              >
                <LongitudinalView
                  initialParticipantId={
                    selectedParticipant?.id || selectedSession?.participant_id
                  }
                />
              </RetroWindow>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="pb-14">
              <RetroSettingsWindow health={health} modelStatus={modelStatus} />
            </div>
          )}
        </main>
      </div>

      {/* In-Dashboard Retro HTML Report Review Modal */}
      {reportModalTarget && (
        <SessionHtmlReportModal
          session={reportModalTarget.session}
          participant={reportModalTarget.participant}
          onClose={() => setReportModalTarget(null)}
          onReturnToProfile={(pid) => handleOpenParticipantProfile(pid, "overview")}
          onReturnToHistory={() => setActiveTab("replay")}
        />
      )}

      {/* Help / About Modal Dialog */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <RetroWindow
              title="About NOVA Research Platform"
              icon={<span>&#8505;</span>}
              onClose={() => setShowHelpModal(false)}
            >
              <div className="retro-inset p-3 bg-[#FFFDF6] text-left text-xs space-y-3">
                <div className="flex items-center gap-3 border-b border-[#453E32] pb-2">
                  <div className="w-10 h-10 bg-[#073E3B] text-teal-200 font-mono font-black text-xl flex items-center justify-center rounded">
                    NOVA
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-[#073E3B]">
                      NOVA Research Console v1.0
                    </h2>
                    <p className="text-[11px] text-[#686253]">
                      Embodied Multimodal Affective Computing Platform
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#211F1A]">
                  <p>
                    <strong>Architecture:</strong> Whisper Speech-to-Text &bull; DistilRoBERTa NLP &bull; Acoustic DSP &bull; MediaPipe FaceMesh &amp; Iris &bull; Cross-Modal Transformer &bull; PPO Adaptive Policy.
                  </p>
                  <p>
                    <strong>Mandate:</strong> Computational mental health research benchmarking against DAIC-WOZ / E-DAIC AVEC protocols.
                  </p>
                </div>

                <div className="retro-window p-2 bg-[#FFF3C4] border border-[#D4C366] text-[10px] text-[#453E32]">
                  <strong>Non-Clinical Disclaimer:</strong> All model outputs and scores represent empirical research signals. Not for autonomous psychiatric diagnosis.
                </div>

                <div className="text-right pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(false)}
                    className="retro-button px-4 py-1 font-bold text-xs"
                  >
                    OK
                  </button>
                </div>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* Classic 90s Bottom Taskbar */}
      <RetroTaskbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        participantId={
          selectedParticipant?.id || selectedSession?.participant_id || "P_0012"
        }
      />
    </div>
  );
}

export default App;
