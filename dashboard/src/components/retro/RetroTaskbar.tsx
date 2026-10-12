import React, { useState, useEffect } from "react";

interface RetroTaskbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  participantId?: string;
}

export const RetroTaskbar: React.FC<RetroTaskbarProps> = ({
  activeTab,
  onTabChange,
  participantId = "P_0012",
}) => {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [timeStr, setTimeStr] = useState("10:24 AM");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      setTimeStr(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close start menu when clicking outside
  useEffect(() => {
    const handleOutside = () => setStartMenuOpen(false);
    if (startMenuOpen) {
      window.addEventListener("click", handleOutside);
    }
    return () => window.removeEventListener("click", handleOutside);
  }, [startMenuOpen]);

  const tasks = [
    {
      id: "home",
      label: "NOVA Console",
      icon: (
        <span className="w-3.5 h-3.5 bg-[#073E3B] text-teal-200 text-[8px] font-bold rounded-[1px] flex items-center justify-center font-mono">
          N
        </span>
      ),
    },
    {
      id: "live",
      label: `Session - ${participantId}`,
      icon: <span className="text-amber-700 text-xs">&#128193;</span>,
    },
    {
      id: "multimodal",
      label: "Multimodal Analysis",
      icon: <span className="text-teal-800 text-xs">&#128202;</span>,
    },
    {
      id: "benchmarks",
      label: "Model Evaluation",
      icon: <span className="text-indigo-800 text-xs">&#129504;</span>,
    },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#E8DFCB] border-t-2 border-[#FFFDF6] shadow-md select-none px-1 py-0.5 flex items-center justify-between text-[11px] text-[#211F1A]">
      {/* Start Button & Active Tasks */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {/* Start Button */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStartMenuOpen(!startMenuOpen);
            }}
            className={`px-2.5 py-1 flex items-center gap-1.5 font-bold retro-button ${
              startMenuOpen ? "active bg-[#D8CFBC]" : ""
            }`}
          >
            <div className="w-3.5 h-3.5 bg-[#073E3B] border border-[#1b7e75] rounded-[1px] flex items-center justify-center text-[7px] text-white font-mono font-bold">
              N
            </div>
            <span>Start</span>
          </button>

          {/* Start Menu Dropdown */}
          {startMenuOpen && (
            <div className="absolute left-0 bottom-full mb-1 w-52 retro-window bg-[#E8DFCB] p-1 shadow-2xl z-50">
              <div className="bg-gradient-to-r from-[#073E3B] to-[#12645F] p-2 text-white font-bold text-xs mb-1 flex items-center gap-2">
                <span className="text-amber-300 font-mono">NOVA</span>
                <span>Research OS</span>
              </div>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => { onTabChange("home"); setStartMenuOpen(false); }}
                  className="w-full text-left px-2.5 py-1 hover:bg-[#073E3B] hover:text-white flex items-center gap-2 text-[11px]"
                >
                  <span>&#127968;</span> Console Home
                </button>
                <button
                  type="button"
                  onClick={() => { onTabChange("live"); setStartMenuOpen(false); }}
                  className="w-full text-left px-2.5 py-1 hover:bg-[#073E3B] hover:text-white flex items-center gap-2 text-[11px]"
                >
                  <span>&#128187;</span> Live Session
                </button>
                <button
                  type="button"
                  onClick={() => { onTabChange("replay"); setStartMenuOpen(false); }}
                  className="w-full text-left px-2.5 py-1 hover:bg-[#073E3B] hover:text-white flex items-center gap-2 text-[11px]"
                >
                  <span>&#128194;</span> Session History
                </button>
                <button
                  type="button"
                  onClick={() => { onTabChange("benchmarks"); setStartMenuOpen(false); }}
                  className="w-full text-left px-2.5 py-1 hover:bg-[#073E3B] hover:text-white flex items-center gap-2 text-[11px]"
                >
                  <span>&#129504;</span> Model Evaluation
                </button>
                <div className="h-[1px] bg-[#453E32] my-1" />
                <button
                  type="button"
                  onClick={() => { onTabChange("settings"); setStartMenuOpen(false); }}
                  className="w-full text-left px-2.5 py-1 hover:bg-[#073E3B] hover:text-white flex items-center gap-2 text-[11px]"
                >
                  <span>&#9881;</span> Settings &amp; Telemetry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Vertical divider */}
        <div className="w-[2px] h-5 bg-[#453E32] border-r border-[#FFFDF6] mx-0.5" />

        {/* Task Buttons */}
        {tasks.map((task) => {
          const isActive = activeTab === task.id;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onTabChange(task.id)}
              className={`px-2.5 py-1 flex items-center gap-1.5 font-medium max-w-[170px] truncate ${
                isActive
                  ? "retro-inset bg-[#DFD5C0] font-bold text-[#073E3B] border-[#073E3B]"
                  : "retro-button text-[#211F1A]"
              }`}
            >
              {task.icon}
              <span className="truncate">{task.label}</span>
            </button>
          );
        })}
      </div>

      {/* System Tray (Clock & Volume) */}
      <div className="retro-inset px-2.5 py-1 bg-[#E8DFCB] flex items-center gap-2 font-mono text-[11px]">
        {/* Speaker Icon */}
        <span className="text-[#453E32]" title="System Audio Available">&#128266;</span>
        <span>{timeStr}</span>
      </div>
    </footer>
  );
};
