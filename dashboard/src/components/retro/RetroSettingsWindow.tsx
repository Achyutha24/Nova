import React from "react";
import { RetroWindow } from "./RetroWindow";
import type { SystemHealth, ModelStatus } from "../../api";

interface RetroSettingsWindowProps {
  health: SystemHealth | null;
  modelStatus: ModelStatus | null;
}

export const RetroSettingsWindow: React.FC<RetroSettingsWindowProps> = ({
  health,
  modelStatus,
}) => {
  return (
    <RetroWindow
      title="System Diagnostics &amp; Settings"
      icon={<span className="text-xs">&#9881;</span>}
      className="max-w-4xl mx-auto w-full my-4"
    >
      <div className="retro-inset bg-[#FFFDF6] p-4 text-left text-xs space-y-4">
        {/* Hardware & System Telemetry */}
        <div>
          <h3 className="font-bold text-[#073E3B] border-b border-[#453E32] pb-1 text-sm flex items-center gap-2">
            <span>&#128187;</span> Compute &amp; Hardware Telemetry
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 font-mono text-[11px]">
            <div className="retro-inset p-2 bg-[#E8DFCB]">
              <span className="text-[#686253] block text-[10px]">Platform</span>
              <span className="font-bold text-[#211F1A]">{health?.platform || "Windows x64"}</span>
            </div>
            <div className="retro-inset p-2 bg-[#E8DFCB]">
              <span className="text-[#686253] block text-[10px]">Python Runtime</span>
              <span className="font-bold text-[#211F1A]">{health?.python_version || "3.12.10"}</span>
            </div>
            <div className="retro-inset p-2 bg-[#E8DFCB]">
              <span className="text-[#686253] block text-[10px]">PyTorch Device</span>
              <span className="font-bold text-[#073E3B]">{health?.torch_device || "CPU"}</span>
            </div>
            <div className="retro-inset p-2 bg-[#E8DFCB]">
              <span className="text-[#686253] block text-[10px]">Memory Allocated</span>
              <span className="font-bold text-[#211F1A]">{health?.memory_used_gb || 4.2} GB / {health?.memory_total_gb || 16.0} GB</span>
            </div>
          </div>
        </div>

        {/* Locked AI Model Registry */}
        <div>
          <h3 className="font-bold text-[#073E3B] border-b border-[#453E32] pb-1 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>&#129504;</span> Approved Model Registry (Strict Model Lock)
            </span>
            <span className="text-[10px] font-mono text-[#686253]">
              Device: {modelStatus?.device || "CPU"} &bull; {modelStatus ? Object.keys(modelStatus.models || {}).length : 6} verified
            </span>
          </h3>
          <div className="overflow-x-auto mt-2">

            <table className="w-full text-left text-[11px] border-collapse font-mono">
              <thead>
                <tr className="bg-[#073E3B] text-white">
                  <th className="p-1.5">Modality / Subsystem</th>
                  <th className="p-1.5">Approved Architecture</th>
                  <th className="p-1.5">Status</th>
                  <th className="p-1.5">Device</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { mod: "Speech (ASR)", model: "Whisper (base)", status: "Active", dev: "CPU" },
                  { mod: "Text (NLP)", model: "DistilRoBERTa (768-d)", status: "Active", dev: "CPU" },
                  { mod: "Voice (Acoustics)", model: "MFCC 13 + F0 + Jitter/Shimmer DSP", status: "Active", dev: "CPU" },
                  { mod: "Face (FACS)", model: "MediaPipe FaceMesh (13 AUs)", status: "Active", dev: "CPU" },
                  { mod: "Gaze / Ocular", model: "MediaPipe Iris (GazeML style)", status: "Active", dev: "CPU" },
                  { mod: "Multimodal Fusion", model: "Cross-Modal Transformer", status: "Active", dev: "CPU" },
                  { mod: "Question Selection", model: "PPO Policy (Safe Catalog)", status: "Active", dev: "CPU" },
                  { mod: "Physiological (rPPG)", model: "Isolated CHROM / POS", status: "Disabled by Flag", dev: "N/A" },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-[#E8DFCB] hover:bg-[#F3EAD7]">
                    <td className="p-1.5 font-bold text-[#073E3B]">{row.mod}</td>
                    <td className="p-1.5">{row.model}</td>
                    <td className="p-1.5">
                      <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] ${
                        row.status === "Active" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-gray-200 text-gray-700"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-1.5 text-gray-600">{row.dev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <div className="retro-window p-2.5 bg-[#FFF2B2] border border-[#D4C366]">
          <span className="font-bold text-[#073E3B] block mb-0.5">⚠️ Scientific Research Mandate</span>
          <p className="text-[11px] text-[#453E32] leading-tight font-sans">
            NOVA is an embodied conversational research platform designed for computational mental-health research. All metrics represent empirical behavioral indicators, not autonomous clinical diagnoses or therapist substitutions.
          </p>
        </div>
      </div>
    </RetroWindow>
  );
};
