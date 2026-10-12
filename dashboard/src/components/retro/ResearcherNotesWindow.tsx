import React, { useState } from "react";
import { RetroWindow } from "./RetroWindow";
import type { SessionSummary } from "../../api";

interface ResearcherNotesWindowProps {
  session?: SessionSummary | null;
  participantId?: string;
  notes?: string;
  onSaveNotes?: (notes: string) => void;
}

export const ResearcherNotesWindow: React.FC<ResearcherNotesWindowProps> = ({
  session,
  participantId = "P_0012",
  notes = "",
  onSaveNotes,
}) => {
  const [activeTab, setActiveTab] = useState<"info" | "notes">("info");
  const [currentNotes, setCurrentNotes] = useState(notes || "Participant exhibited notable vocal hesitation during turn 3 questions regarding sleep disruption. Recommended follow-up review.");
  const [savedBadge, setSavedBadge] = useState(false);

  const handleSave = () => {
    onSaveNotes?.(currentNotes);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  return (
    <RetroWindow
      title="Researcher Notes"
      icon={<span className="text-xs">&#128221;</span>}
      className="h-full"
    >
      {/* Tabs */}
      <div className="flex border-b border-[#453E32] gap-0.5 px-0.5 mb-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`retro-tab text-[10px] px-2 py-0.5 ${
            activeTab === "info" ? "active" : ""
          }`}
        >
          Session Info
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`retro-tab text-[10px] px-2 py-0.5 ${
            activeTab === "notes" ? "active" : ""
          }`}
        >
          Notes
        </button>
      </div>

      <div className="retro-inset bg-[#FFFDF6] p-2 flex flex-col justify-between flex-1 text-left text-[11px] space-y-2">
        {activeTab === "info" ? (
          <div className="space-y-1 text-[#211F1A]">
            <div className="flex justify-between border-b border-[#E8DFCB] pb-0.5">
              <span className="text-[#686253]">Participant ID</span>
              <span className="font-mono font-bold text-[#073E3B]">
                {session?.participant_id || participantId}
              </span>
            </div>
            <div className="flex justify-between border-b border-[#E8DFCB] pb-0.5">
              <span className="text-[#686253]">Date &amp; Time</span>
              <span className="font-mono text-[10px]">
                {session?.started_at
                  ? new Date(session.started_at).toLocaleString()
                  : "06 Oct 2026, 10:18 AM"}
              </span>
            </div>

            <div className="flex justify-between border-b border-[#E8DFCB] pb-0.5">
              <span className="text-[#686253]">Session Duration</span>
              <span className="font-mono font-bold">00:05:32</span>
            </div>
            <div className="flex justify-between border-b border-[#E8DFCB] pb-0.5">
              <span className="text-[#686253]">Dataset</span>
              <span className="font-medium text-[#073E3B]">Internal Study</span>
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-[#686253]">Status</span>
              <span className="px-2 py-0.5 bg-[#C6E9D2] border border-[#237A4B] text-[#135A33] text-[10px] font-bold rounded-[2px]">
                {session?.status === "active" ? "Active" : "Completed"}
              </span>
            </div>

            <div className="pt-1.5">
              <span className="text-[10px] text-[#686253] block mb-0.5">Notes</span>
              <div className="relative">
                <textarea
                  value={currentNotes}
                  onChange={(e) => setCurrentNotes(e.target.value)}
                  placeholder="Add notes about this session..."
                  rows={2}
                  className="w-full retro-inset p-1.5 text-[10px] bg-white text-[#211F1A] focus:outline-none resize-none font-sans"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  className="retro-button mt-1 px-2 py-0.5 text-[10px] font-bold float-right"
                >
                  {savedBadge ? "✓ Saved" : "Save Notes"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#073E3B] block mb-1">
                Clinical Research Observations
              </span>
              <textarea
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                placeholder="Enter detailed observation notes..."
                rows={6}
                className="w-full retro-inset p-1.5 text-[10px] bg-white text-[#211F1A] focus:outline-none resize-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="retro-button px-3 py-1 text-[11px] font-bold self-end"
            >
              {savedBadge ? "✓ Saved" : "Save Notes"}
            </button>
          </div>
        )}
      </div>
    </RetroWindow>
  );
};
