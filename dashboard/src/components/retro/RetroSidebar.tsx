import React from "react";
import type { SystemHealth, ModelStatus } from "../../api";

interface RetroSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  health: SystemHealth | null;
  modelStatus: ModelStatus | null;
  wsConnected: boolean;
}

export const RetroSidebar: React.FC<RetroSidebarProps> = ({
  activeTab,
  onTabChange,
  health,
  modelStatus,
  wsConnected,
}) => {
  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#3D8B5D" fillOpacity="0.3" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: "participants",
      label: "Participants",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="#375F85" fillOpacity="0.25" />
          <circle cx="9" cy="7" r="4" fill="#375F85" fillOpacity="0.25" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "live",
      label: "Live Session",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="20" height="14" x="2" y="3" rx="2" fill="#375F85" fillOpacity="0.3" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      ),
    },
    {
      id: "replay",
      label: "Session History",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" fill="#D9A736" fillOpacity="0.4" />
        </svg>
      ),
    },
    {
      id: "multimodal",
      label: "Multimodal Analysis",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" x2="18" y1="20" y2="10" />
          <line x1="12" x2="12" y1="20" y2="4" />
          <line x1="6" x2="6" y1="20" y2="14" />
        </svg>
      ),
    },
    {
      id: "benchmarks",
      label: "Model Evaluation",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      id: "longitudinal",
      label: "Longitudinal Analysis",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ];

  const isConnected = !!health && health.status === "healthy";
  const aiModelsReady = !!modelStatus && Object.values(modelStatus.models || {}).some((m) => m.loaded);

  return (
    <aside className="w-40 flex-shrink-0 flex flex-col gap-2 select-none">
      {/* Navigation Well / Window */}
      <div className="retro-window p-1 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full text-left px-2 py-1.5 flex items-center gap-2 text-[11px] font-medium transition-none ${
                isActive
                  ? "retro-inset bg-[#DCEEE8] border-[#073E3B] text-[#073E3B] font-bold shadow-inner"
                  : "retro-button hover:bg-[#F0E8D7] text-[#211F1A]"
              }`}
            >
              <span className="flex-shrink-0 text-[#073E3B]">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* System Status Window */}
      <div className="retro-window p-2 flex flex-col gap-1.5 mt-auto">
        <div className="text-[10px] font-bold text-[#073E3B] uppercase tracking-wider pb-1 border-b border-[#453E32]">
          System Status
        </div>
        <div className="space-y-1.5 text-[10px] text-[#211F1A]">
          <div className="flex items-center gap-2">
            <span className={isConnected ? "retro-led" : "retro-led-amber"} />
            <span>Camera</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={isConnected ? "retro-led" : "retro-led-amber"} />
            <span>Microphone</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={aiModelsReady ? "retro-led" : "retro-led-amber"} />
            <span>AI Models</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="retro-led" />
            <span>Unity Avatar</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={isConnected ? "retro-led" : "retro-led-red"} />
            <span>Database</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-[#8C8472]/40">
            <span className={wsConnected ? "retro-led" : "retro-led-amber"} />
            <span className="font-semibold">{wsConnected ? "Connected" : "Standby"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
