import React, { useState, useEffect } from "react";
import type { SessionSummary } from "../../api";
import type { ResearcherAuthSession } from "./ResearcherLoginWindow";

interface RetroTopBarProps {
  onNewSession?: () => void;
  onAddParticipant?: () => void;
  onSelectParticipant?: () => void;
  onGenerateReport?: () => void;
  onExportData?: () => void;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onLogout?: () => void;
  researcherSession?: ResearcherAuthSession | null;
  sessions?: SessionSummary[];
  selectedSession?: SessionSummary | null;
  onSelectSession?: (session: SessionSummary) => void;
}

export const RetroTopBar: React.FC<RetroTopBarProps> = ({
  onNewSession,
  onAddParticipant,
  onSelectParticipant,
  onGenerateReport,
  onExportData,
  onRefresh,
  onOpenSettings,
  onOpenHelp,
  onLogout,
  researcherSession,
  sessions = [],
  selectedSession,
  onSelectSession,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const dayName = days[now.getDay()];
      const dayNum = String(now.getDate()).padStart(2, "0");
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, "0");
      setCurrentTime(
        `${dayName}, ${dayNum} ${monthName} ${year}   ${hoursStr}:${minutes} ${ampm}`
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      window.addEventListener("click", handleClickOutside);
    }
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeMenu]);

  const handleMenuClick = (e: React.MouseEvent, menuName: string) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  return (
    <header className="retro-window select-none border-b-2 border-[#453E32] mb-1">
      {/* Upper Main Title Bar */}
      <div className="retro-titlebar px-2 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Pixelated Logo Badge */}
          <div className="w-8 h-7 bg-[#042825] border border-[#1b7e75] rounded-[2px] flex flex-col items-center justify-center p-0.5 shadow-inner">
            <span className="text-[9px] font-black tracking-widest text-teal-300 font-mono">
              NOVA
            </span>
            <div className="w-full h-[1px] bg-teal-500/50 my-[1px]" />
            <div className="flex gap-[2px]">
              <div className="w-1 h-1 bg-teal-400 rounded-full animate-pulse" />
              <div className="w-1 h-1 bg-emerald-400 rounded-full" />
              <div className="w-1 h-1 bg-cyan-400 rounded-full" />
            </div>
          </div>

          <div>
            <h1 className="font-bold text-[13px] text-white tracking-wide leading-tight drop-shadow-[1px_1px_0px_#000]">
              NOVA Research Console
            </h1>
            <p className="text-[10px] text-teal-200 tracking-normal font-sans opacity-90 leading-none">
              Multimodal Mental Health Research Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Session Well */}
          {sessions.length > 0 && (
            <div className="retro-inset px-1.5 py-0.5 bg-[#E8DFCB] text-[#211F1A] text-[10px] hidden md:flex items-center gap-1 font-mono">
              <span className="font-bold text-[#073E3B]">Focus:</span>
              <select
                value={selectedSession?.id || ""}
                onChange={(e) => {
                  const s = sessions.find((item) => item.id === e.target.value);
                  if (s) onSelectSession?.(s);
                }}
                className="bg-[#FFFDF6] border border-[#8C8472] px-1 py-0 text-[10px] font-mono focus:outline-none"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.participant_id} ({s.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* System Date & Time Inset Well */}
          <div className="retro-inset px-2.5 py-0.5 bg-[#E8DFCB] text-[#211F1A] text-[11px] font-mono font-medium hidden sm:block">
            {currentTime}
          </div>

          {/* Window Control Buttons */}
          <div className="flex items-center gap-1">
            <button type="button" className="retro-ctrl-btn" title="Minimize">
              _
            </button>
            <button type="button" className="retro-ctrl-btn" title="Maximize">
              &#9633;
            </button>
            <button type="button" className="retro-ctrl-btn" title="Close">
              &#10005;
            </button>
          </div>
        </div>
      </div>

      {/* Classic Menu Toolbar */}
      <div className="bg-[#E8DFCB] px-1 py-0.5 border-t border-[#FFFDF6] flex items-center justify-between text-[11px] text-[#211F1A]">
        <div className="flex items-center gap-1">
          {/* Floppy Disk Icon */}
          <div
            className="px-1.5 py-0.5 flex items-center justify-center cursor-default text-[#073E3B]"
            title="NOVA Storage System"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5l-2-3zm-7 2h4v4h-4V4zm5 16H7v-6h10v6z" />
            </svg>
          </div>

          {/* Menu Items */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, "file")}
              className={`px-2 py-0.5 hover:bg-[#073E3B] hover:text-white cursor-pointer ${
                activeMenu === "file" ? "bg-[#073E3B] text-white" : ""
              }`}
            >
              <u>F</u>ile
            </button>
            {activeMenu === "file" && (
              <div className="absolute left-0 top-full mt-0.5 z-50 bg-[#E8DFCB] retro-window min-w-[185px] py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    onAddParticipant?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Add New Participant...
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectParticipant?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Select Existing Participant...
                </button>
                <div className="h-[1px] bg-[#453E32] my-1 mx-2" />
                <button
                  type="button"
                  onClick={() => {
                    onNewSession?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  New Research Session...
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onGenerateReport?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Generate HTML Report...
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportData?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Export Session (JSON/CSV)
                </button>
                <div className="h-[1px] bg-[#453E32] my-1 mx-2" />
                <button
                  type="button"
                  onClick={() => {
                    onRefresh?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Reload Data
                </button>
                {onLogout && (
                  <>
                    <div className="h-[1px] bg-[#453E32] my-1 mx-2" />
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1 hover:bg-rose-800 hover:text-white block text-[11px] font-bold text-rose-900"
                    >
                      Logout Researcher Session
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, "view")}
              className={`px-2 py-0.5 hover:bg-[#073E3B] hover:text-white cursor-pointer ${
                activeMenu === "view" ? "bg-[#073E3B] text-white" : ""
              }`}
            >
              <u>V</u>iew
            </button>
            {activeMenu === "view" && (
              <div className="absolute left-0 top-full mt-0.5 z-50 bg-[#E8DFCB] retro-window min-w-[160px] py-1 shadow-xl">
                <span className="w-full text-left px-3 py-1 text-slate-700 block text-[11px] font-semibold">
                  ✓ Multimodal Grid View
                </span>
                <span className="w-full text-left px-3 py-1 text-slate-700 block text-[11px] font-semibold">
                  ✓ Real-time Analysis Panel
                </span>
                <span className="w-full text-left px-3 py-1 text-slate-700 block text-[11px] font-semibold">
                  ✓ Timeline View
                </span>
                <div className="h-[1px] bg-[#453E32] my-1 mx-2" />
                <button
                  type="button"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      document.documentElement.requestFullscreen();
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Toggle Fullscreen (F11)
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, "session")}
              className={`px-2 py-0.5 hover:bg-[#073E3B] hover:text-white cursor-pointer ${
                activeMenu === "session" ? "bg-[#073E3B] text-white" : ""
              }`}
            >
              <u>S</u>ession
            </button>
            {activeMenu === "session" && (
              <div className="absolute left-0 top-full mt-0.5 z-50 bg-[#E8DFCB] retro-window min-w-[180px] py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    onNewSession?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Start New Session (Wizard)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onGenerateReport?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Generate HTML Report
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRefresh?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Sync Timeline Signals
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, "analysis")}
              className={`px-2 py-0.5 hover:bg-[#073E3B] hover:text-white cursor-pointer ${
                activeMenu === "analysis" ? "bg-[#073E3B] text-white" : ""
              }`}
            >
              <u>A</u>nalysis
            </button>
            {activeMenu === "analysis" && (
              <div className="absolute left-0 top-full mt-0.5 z-50 bg-[#E8DFCB] retro-window min-w-[180px] py-1 shadow-xl">
                <span className="w-full text-left px-3 py-1 text-slate-800 block text-[11px]">
                  Cross-Modal Transformer: Active
                </span>
                <span className="w-full text-left px-3 py-1 text-slate-800 block text-[11px]">
                  Missing Modality Mask: Enabled
                </span>
                <span className="w-full text-left px-3 py-1 text-slate-800 block text-[11px]">
                  PPO Adaptive Questioning: Ready
                </span>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, "tools")}
              className={`px-2 py-0.5 hover:bg-[#073E3B] hover:text-white cursor-pointer ${
                activeMenu === "tools" ? "bg-[#073E3B] text-white" : ""
              }`}
            >
              <u>T</u>ools
            </button>
            {activeMenu === "tools" && (
              <div className="absolute left-0 top-full mt-0.5 z-50 bg-[#E8DFCB] retro-window min-w-[160px] py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Platform Diagnostics
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRefresh?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  Model Checkpoint Status
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, "help")}
              className={`px-2 py-0.5 hover:bg-[#073E3B] hover:text-white cursor-pointer ${
                activeMenu === "help" ? "bg-[#073E3B] text-white" : ""
              }`}
            >
              <u>H</u>elp
            </button>
            {activeMenu === "help" && (
              <div className="absolute left-0 top-full mt-0.5 z-50 bg-[#E8DFCB] retro-window min-w-[220px] py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    onOpenHelp?.();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#073E3B] hover:text-white block text-[11px]"
                >
                  About NOVA Research Platform
                </button>
                <div className="h-[1px] bg-[#453E32] my-1 mx-2" />
                <div className="px-3 py-1 text-[10px] text-slate-700 leading-tight">
                  <strong>Clinical Disclaimer:</strong> Research assessment platform only. Not an autonomous clinical diagnostic tool.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side of Menu Bar: Active Researcher Session & Logout Button */}
        {researcherSession && (
          <div className="flex items-center gap-2 pr-1">
            <span
              className="retro-inset bg-[#FFFDF6] px-2 py-0.5 font-mono text-[10px] text-[#073E3B] hidden lg:inline-block"
              title="Local Workstation Session Authentication"
            >
              Researcher: <strong>{researcherSession.researcherId}</strong> (Local Auth)
            </span>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="retro-button px-2 py-0.5 text-[10px] font-bold text-[#453E32]"
                title="Logout Researcher Session"
              >
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
