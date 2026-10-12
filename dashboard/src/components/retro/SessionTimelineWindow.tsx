import React from "react";
import { RetroWindow } from "./RetroWindow";
import type { TimelineSignalPoint } from "../../api";

interface SessionTimelineWindowProps {
  signals?: TimelineSignalPoint[];
}

export const SessionTimelineWindow: React.FC<SessionTimelineWindowProps> = ({
  signals = [],
}) => {
  const timeLabels = ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00"];

  return (
    <RetroWindow
      title="Session Timeline"
      icon={<span className="text-xs">&#9201;</span>}
      className="h-full"
    >
      <div className="retro-inset bg-[#FFFDF6] p-2 flex flex-col justify-between h-full space-y-1.5 select-none">
        {/* Time Axis Ruler */}
        <div className="flex items-center text-[9px] font-mono text-[#686253] border-b border-[#453E32] pb-1">
          <span className="w-24 text-left font-bold text-[#073E3B]">
            Track / Time {signals.length > 0 ? `(${signals.length} pts)` : ""}
          </span>
          <div className="flex-1 flex justify-between px-2">

            {timeLabels.map((time) => (
              <span key={time} className="flex flex-col items-center">
                <span>{time}</span>
                <span className="w-[1px] h-1.5 bg-[#8C8472]" />
              </span>
            ))}
          </div>
        </div>

        {/* 1. Questions Track */}
        <div className="flex items-center text-[10px]">
          <span className="w-24 text-left font-medium text-[#211F1A] truncate">Questions</span>
          <div className="flex-1 h-3.5 bg-[#E8DFCB] relative flex items-center px-2 border border-[#C5BBAA]">
            {/* Diamond markers */}
            <span className="absolute left-[15%] text-amber-600 text-xs transform -translate-y-0.5" title="Q1: Rapport">&#9670;</span>
            <span className="absolute left-[38%] text-amber-600 text-xs transform -translate-y-0.5" title="Q2: Sleep">&#9670;</span>
            <span className="absolute left-[62%] text-amber-600 text-xs transform -translate-y-0.5" title="Q3: Stressful Event">&#9670;</span>
            <span className="absolute left-[84%] text-amber-600 text-xs transform -translate-y-0.5" title="Q4: Coping">&#9670;</span>
          </div>
        </div>

        {/* 2. Voice (Energy) Track */}
        <div className="flex items-center text-[10px]">
          <span className="w-24 text-left font-medium text-[#211F1A] truncate">Voice (Energy)</span>
          <div className="flex-1 h-3.5 bg-[#E8DFCB] relative flex items-center px-1 border border-[#C5BBAA] overflow-hidden">
            <div className="absolute left-[12%] w-[22%] h-2 bg-[#375F85] rounded-[1px]" />
            <div className="absolute left-[40%] w-[18%] h-2 bg-[#375F85] rounded-[1px]" />
            <div className="absolute left-[65%] w-[24%] h-2 bg-[#375F85] rounded-[1px]" />
          </div>
        </div>

        {/* 3. Facial Expression Track */}
        <div className="flex items-center text-[10px]">
          <span className="w-24 text-left font-medium text-[#211F1A] truncate">Facial Expression</span>
          <div className="flex-1 h-3.5 bg-[#E8DFCB] relative flex items-center px-1 border border-[#C5BBAA] overflow-hidden">
            <div className="absolute left-[5%] w-[35%] h-2 bg-[#3D8B5D] rounded-[1px]" />
            <div className="absolute left-[45%] w-[20%] h-2 bg-[#3D8B5D] rounded-[1px]" />
            <div className="absolute left-[70%] w-[25%] h-2 bg-[#3D8B5D] rounded-[1px]" />
          </div>
        </div>

        {/* 4. Gaze Attention Track */}
        <div className="flex items-center text-[10px]">
          <span className="w-24 text-left font-medium text-[#211F1A] truncate">Gaze Attention</span>
          <div className="flex-1 h-3.5 bg-[#E8DFCB] relative flex items-center px-1 border border-[#C5BBAA] overflow-hidden">
            <div className="absolute left-[10%] w-[30%] h-2 bg-[#17675F] rounded-[1px]" />
            <div className="absolute left-[50%] w-[42%] h-2 bg-[#17675F] rounded-[1px]" />
          </div>
        </div>

        {/* 5. Model Output Track */}
        <div className="flex items-center text-[10px]">
          <span className="w-24 text-left font-medium text-[#211F1A] truncate">Model Output</span>
          <div className="flex-1 h-3.5 bg-[#E8DFCB] relative flex items-center px-1 border border-[#C5BBAA] overflow-hidden">
            {/* Continuous assessment gradient track */}
            <div className="w-full h-2 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 opacity-80" />
            <div className="absolute right-[12%] w-1.5 h-3 bg-black border border-white" title="Current Cursor" />
          </div>
        </div>
      </div>
    </RetroWindow>
  );
};
