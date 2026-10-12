import React, { useState } from "react";
import { RetroWindow } from "./RetroWindow";

interface BiomarkerValues {
  stress: number;
  anxiety: number;
  arousal: number;
  engagement: number;
  positiveAffect: number;
  overallState: string;
  confidence: number;
  dataQuality: string;
}

interface RealtimeAnalysisWindowProps {
  biomarkers?: BiomarkerValues;
  facialAus?: Record<string, number>;
  vocalFeatures?: Record<string, number>;
  gazeFeatures?: Record<string, number>;
  attentionWeights?: Record<string, number>;
}

export const RealtimeAnalysisWindow: React.FC<RealtimeAnalysisWindowProps> = ({
  biomarkers = {
    stress: 0.68,
    anxiety: 0.52,
    arousal: 0.46,
    engagement: 0.71,
    positiveAffect: 0.32,
    overallState: "Moderate Stress",
    confidence: 0.76,
    dataQuality: "Good",
  },
  facialAus = { AU01: 0.12, AU02: 0.34, AU04: 0.28, AU06: 0.41, AU12: 0.22 },
  vocalFeatures = { f0_mean: 142.3, jitter: 0.018, shimmer: 0.045, hnr: 18.2, energy: 0.68 },
  gazeFeatures = { gaze_aversion_index: 0.42, blink_rate: 14.0, pupil_diameter: 3.1 },
  attentionWeights = { voice: 0.32, face: 0.28, gaze: 0.22, text: 0.18 },
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "face" | "gaze" | "voice" | "text" | "fusion">("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "face", label: "Face" },
    { id: "gaze", label: "Gaze/Eyes" },
    { id: "voice", label: "Voice" },
    { id: "text", label: "Text" },
    { id: "fusion", label: "Fusion Output" },
  ];

  const stateItems = [
    { label: "Stress", val: biomarkers.stress, color: "#C94A4A", icon: "💀" },
    { label: "Anxiety", val: biomarkers.anxiety, color: "#D97736", icon: "😡" },
    { label: "Emotional Arousal", val: biomarkers.arousal, color: "#D9A736", icon: "🥱" },
    { label: "Engagement", val: biomarkers.engagement, color: "#3D8B5D", icon: "🔋" },
    { label: "Positive Affect", val: biomarkers.positiveAffect, color: "#375F85", icon: "😃" },
  ];

  return (
    <RetroWindow
      title="Real-time Analysis"
      icon={<span className="text-sm">&#128202;</span>}
      className="h-full"
    >
      {/* Folder Tabs Row */}
      <div className="flex border-b border-[#453E32] gap-1 px-1 mb-1.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`retro-tab ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col justify-between">
        {activeTab === "overview" && (
          <div className="space-y-2">
            {/* Dark Teal Header Band */}
            <div className="bg-[#073E3B] text-white px-2 py-1 text-[11px] font-bold tracking-wide flex items-center justify-between shadow-sm">
              <span>Current Emotional State (Research Output)</span>
              <span className="text-[9px] text-teal-200 font-mono">Multimodal Fusion</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Progress Bars (7 cols) */}
              <div className="md:col-span-7 space-y-1.5 px-1">
                {stateItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-4 text-center select-none">{item.icon}</span>
                    <span className="w-28 text-left font-medium text-[#211F1A] truncate">
                      {item.label}
                    </span>
                    <div className="retro-progress-well flex-1">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, item.val * 100))}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                    <span className="w-8 font-mono text-right text-[10px] font-bold text-[#453E32]">
                      {item.val.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Overall State Circular Gauge (5 cols) */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-2 retro-window bg-[#FFFDF6] border border-[#453E32]">
                <span className="text-[10px] font-bold text-[#453E32] uppercase mb-1">
                  Overall State
                </span>

                {/* SVG Donut Gauge */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#D4CBBA" strokeWidth="12" />
                    {/* Green Segment (Low) */}
                    <circle
                      cx="50" cy="50" r="38" fill="none"
                      stroke="#3D8B5D" strokeWidth="12"
                      strokeDasharray="60 240" strokeDashoffset="0"
                    />
                    {/* Orange Segment (Moderate) */}
                    <circle
                      cx="50" cy="50" r="38" fill="none"
                      stroke="#D97736" strokeWidth="12"
                      strokeDasharray="80 240" strokeDashoffset="-60"
                    />
                    {/* Red Segment (Elevated) */}
                    <circle
                      cx="50" cy="50" r="38" fill="none"
                      stroke="#C94A4A" strokeWidth="12"
                      strokeDasharray="60 240" strokeDashoffset="-140"
                    />
                  </svg>
                  {/* Gauge Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
                    <span className="text-[10px] font-black leading-tight text-[#211F1A]">
                      {biomarkers.overallState}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-center text-[10px] space-y-0.5">
                  <div className="font-mono text-[#453E32]">
                    Confidence : <span className="font-bold text-[#073E3B]">{biomarkers.confidence.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 pt-0.5">
                    <span className="retro-led" />
                    <span className="font-semibold text-[10px] text-[#211F1A]">
                      Data Quality : {biomarkers.dataQuality}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "face" && (
          <div className="p-2 space-y-2 text-left">
            <div className="text-[11px] font-bold text-[#073E3B] border-b border-[#453E32] pb-1">
              FACS Action Unit Activations (MediaPipe Mesh)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(facialAus).map(([au, val]) => (
                <div key={au} className="retro-inset p-1.5 bg-[#FFFDF6]">
                  <div className="flex justify-between font-mono text-[11px] mb-1">
                    <span className="font-bold text-[#073E3B]">{au}</span>
                    <span>{typeof val === "number" ? val.toFixed(2) : val}</span>
                  </div>
                  <div className="retro-progress-well h-2">
                    <div className="h-full bg-teal-700" style={{ width: `${Math.min(100, Number(val) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "gaze" && (
          <div className="p-2 space-y-2 text-left">
            <div className="text-[11px] font-bold text-[#073E3B] border-b border-[#453E32] pb-1">
              Ocular Tracking &amp; Gaze Aversion (MediaPipe Iris)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="retro-inset p-2 bg-[#FFFDF6] text-center">
                <span className="text-[10px] text-[#686253] block">Gaze Aversion</span>
                <span className="text-sm font-bold font-mono text-[#073E3B]">
                  {gazeFeatures.gaze_aversion_index?.toFixed(2) || "0.42"}
                </span>
              </div>
              <div className="retro-inset p-2 bg-[#FFFDF6] text-center">
                <span className="text-[10px] text-[#686253] block">Blink Rate</span>
                <span className="text-sm font-bold font-mono text-[#073E3B]">
                  {gazeFeatures.blink_rate || 14} / min
                </span>
              </div>
              <div className="retro-inset p-2 bg-[#FFFDF6] text-center">
                <span className="text-[10px] text-[#686253] block">Pupil Size</span>
                <span className="text-sm font-bold font-mono text-[#073E3B]">
                  {gazeFeatures.pupil_diameter || 3.1} mm
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "voice" && (
          <div className="p-2 space-y-2 text-left">
            <div className="text-[11px] font-bold text-[#073E3B] border-b border-[#453E32] pb-1">
              Acoustic DSP Features (Librosa / SciPy)
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="retro-inset p-1.5 bg-[#FFFDF6]">
                <span className="text-[10px] text-[#686253] block">F0 Fundamental Pitch</span>
                <span className="font-bold text-[#073E3B]">{vocalFeatures.f0_mean || 142.3} Hz</span>
              </div>
              <div className="retro-inset p-1.5 bg-[#FFFDF6]">
                <span className="text-[10px] text-[#686253] block">Harmonics-to-Noise</span>
                <span className="font-bold text-[#073E3B]">{vocalFeatures.hnr || 18.2} dB</span>
              </div>
              <div className="retro-inset p-1.5 bg-[#FFFDF6]">
                <span className="text-[10px] text-[#686253] block">Jitter / Shimmer</span>
                <span className="font-bold text-[#073E3B]">{vocalFeatures.jitter || 0.018} / {vocalFeatures.shimmer || 0.045}</span>
              </div>
              <div className="retro-inset p-1.5 bg-[#FFFDF6]">
                <span className="text-[10px] text-[#686253] block">RMS Energy</span>
                <span className="font-bold text-[#073E3B]">{vocalFeatures.energy || 0.68}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "text" && (
          <div className="p-2 space-y-2 text-left">
            <div className="text-[11px] font-bold text-[#073E3B] border-b border-[#453E32] pb-1">
              Natural Language Semantics (DistilRoBERTa 768-d)
            </div>
            <p className="text-[11px] text-[#211F1A]">
              Pooled contextual representation aligned to conversational turns. Evaluates cognitive affective markers and stress topic relevance.
            </p>
          </div>
        )}

        {activeTab === "fusion" && (
          <div className="p-2 space-y-2 text-left">
            <div className="text-[11px] font-bold text-[#073E3B] border-b border-[#453E32] pb-1">
              Cross-Modal Transformer Attention Distribution
            </div>
            <div className="space-y-1.5">
              {Object.entries(attentionWeights).map(([mod, weight]) => (
                <div key={mod} className="flex items-center gap-2 text-xs">
                  <span className="w-16 font-medium capitalize">{mod}:</span>
                  <div className="retro-progress-well flex-1">
                    <div className="h-full bg-teal-800" style={{ width: `${Math.round(weight * 100)}%` }} />
                  </div>
                  <span className="font-mono text-[11px] w-8 text-right font-bold">
                    {(weight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </RetroWindow>
  );
};
