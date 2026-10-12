import React, { useState } from "react";
import { RetroWindow } from "./RetroWindow";

interface ModelOutputsWindowProps {
  unimodalPredictions?: Array<{
    model: string;
    prediction: string;
    confidence: number;
    highlight?: boolean;
  }>;
}

export const ModelOutputsWindow: React.FC<ModelOutputsWindowProps> = ({
  unimodalPredictions = [
    { model: "Voice Model", prediction: "Elevated Stress", confidence: 0.71 },
    { model: "Text Model", prediction: "Moderate Anxiety", confidence: 0.63 },
    { model: "Face Model", prediction: "Neutral - Slight Stress", confidence: 0.58 },
    { model: "Gaze Model", prediction: "Reduced Attention", confidence: 0.55 },
    { model: "Multimodal (Transformer)", prediction: "Moderate Stress", confidence: 0.76, highlight: true },
  ],
}) => {
  const [activeTab, setActiveTab] = useState<"unimodal" | "fusion" | "rl">("unimodal");

  return (
    <RetroWindow
      title="Model Outputs"
      icon={<span className="text-xs">&#129504;</span>}
      className="h-full"
    >
      {/* Tabs */}
      <div className="flex border-b border-[#453E32] gap-0.5 px-0.5 mb-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("unimodal")}
          className={`retro-tab text-[10px] px-2 py-0.5 ${
            activeTab === "unimodal" ? "active" : ""
          }`}
        >
          Unimodal
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("fusion")}
          className={`retro-tab text-[10px] px-2 py-0.5 ${
            activeTab === "fusion" ? "active" : ""
          }`}
        >
          Fusion (Transformer)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rl")}
          className={`retro-tab text-[10px] px-2 py-0.5 ${
            activeTab === "rl" ? "active" : ""
          }`}
        >
          Question Selection (RL)
        </button>
      </div>

      {activeTab === "unimodal" && (
        <div className="retro-inset bg-[#FFFDF6] overflow-x-auto flex-1">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#073E3B] text-white border-b border-[#453E32]">
                <th className="py-1 px-2 font-bold">Model</th>
                <th className="py-1 px-2 font-bold">Prediction</th>
                <th className="py-1 px-2 font-bold font-mono text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {unimodalPredictions.map((row) => (
                <tr
                  key={row.model}
                  className={`border-b border-[#E8DFCB] transition-none ${
                    row.highlight
                      ? "bg-[#FFF2B2] font-bold text-[#073E3B] border-y border-[#D4C366]"
                      : "hover:bg-[#FAF4E8] text-[#211F1A]"
                  }`}
                >
                  <td className="py-1 px-2">{row.model}</td>
                  <td className="py-1 px-2">{row.prediction}</td>
                  <td className="py-1 px-2 font-mono text-right">{row.confidence.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "fusion" && (
        <div className="retro-inset bg-[#FFFDF6] p-2 text-left text-[11px] space-y-2 flex-1">
          <div className="font-bold text-[#073E3B] border-b border-[#453E32] pb-0.5">
            Cross-Modal Transformer Synthesis
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="p-1 bg-[#E8DFCB]">
              <span className="text-[#686253] block">Fusion Head AUROC:</span>
              <span className="font-bold text-base text-[#073E3B]">0.884</span>
            </div>
            <div className="p-1 bg-[#E8DFCB]">
              <span className="text-[#686253] block">Macro F1 Score:</span>
              <span className="font-bold text-base text-[#073E3B]">0.862</span>
            </div>
          </div>
          <p className="text-[10px] text-[#453E32]">
            Joint multi-head cross-attention dynamically weights salient verbal and non-verbal channels while masking missing/low-SNR modalities.
          </p>
        </div>
      )}

      {activeTab === "rl" && (
        <div className="retro-inset bg-[#FFFDF6] p-2 text-left text-[11px] space-y-1.5 flex-1">
          <div className="font-bold text-[#073E3B] border-b border-[#453E32] pb-0.5">
            PPO Adaptive Policy Status
          </div>
          <div className="text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#686253]">Selected Question:</span>
              <span className="font-bold text-[#073E3B]">Q_STR_01</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#686253]">Clinical Construct:</span>
              <span className="font-bold">Stressful Life Event</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#686253]">Information Gain Reward:</span>
              <span className="font-mono font-bold text-emerald-800">+0.82</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#686253]">Repetition Penalty:</span>
              <span className="font-mono text-gray-500">0.00</span>
            </div>
          </div>
        </div>
      )}
    </RetroWindow>
  );
};
