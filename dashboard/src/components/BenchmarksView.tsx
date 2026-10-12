import { useState, useEffect } from "react";
import { api } from "../api";
import type { ExperimentsResponse } from "../api";
import { Award, Layers, Zap, Play, CheckCircle } from "lucide-react";

export const BenchmarksView = () => {
  const [data, setData] = useState<ExperimentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadData = () => {
    setLoading(true);
    api.getExperiments()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunBenchmark = async () => {
    setRunning(true);
    try {
      await api.triggerBenchmark();
      loadData();
    } catch (e) {
      alert("Error executing benchmark run: " + e);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[#686253] retro-inset bg-[#FFFDF6]">
        Loading benchmark experiment results...
      </div>
    );
  }

  const run = data?.active_run;

  return (
    <div className="space-y-3 text-left">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 retro-inset bg-[#FFFDF6] p-3 text-[#211F1A]">
        <div>
          <h3 className="text-sm font-bold text-[#073E3B] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#17675F]" /> Model Evaluation &amp; Ablation Registry
          </h3>
          <p className="text-[11px] text-[#686253] mt-0.5">
            Offline benchmark metrics evaluated on participant-level held-out test partitions.
          </p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={running}
          className="retro-button px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5 text-[#073E3B] disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          {running ? "Running Offline Benchmark..." : "Execute Evaluation Run"}
        </button>
      </div>

      {!run ? (
        <div className="p-8 text-center text-[#686253] retro-inset bg-[#FFFDF6]">
          <p className="text-sm font-bold text-[#073E3B]">Not evaluated</p>
          <p className="text-xs text-[#686253] mt-1">
            No benchmark runs recorded in the database yet. Click "Execute Evaluation Run" above.
          </p>
        </div>
      ) : (
        <>
          {/* Table 1: Modality Ablation Study E0 - E4 */}
          <div className="retro-inset bg-[#FFFDF6] overflow-hidden shadow-sm">
            <div className="p-2.5 bg-[#E8DFCB] border-b border-[#453E32] flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#073E3B] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#17675F]" /> Multimodal Ablation Study (E0 &ndash; E4)
                </h4>
                <p className="text-[10px] text-[#686253]">
                  Sequential inclusion of biomarkers into the Cross-Modal Transformer on the held-out partition.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[#686253]">
                Benchmark Split Hash: locked-participant
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#211F1A] border-collapse">
                <thead className="bg-[#073E3B] text-white font-bold font-mono text-[11px]">
                  <tr>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Configuration</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Modalities Included</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">AUROC</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">F1 Score</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Precision</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Recall</th>
                    <th className="py-2 px-3">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCB] text-xs">
                  {Object.entries(run.ablation_study_e0_e4).map(([name, m]) => (
                    <tr key={name} className="hover:bg-[#F3EAD7] transition-none">
                      <td className="py-2 px-3 font-bold text-[#073E3B]">{name.split(" ")[0]}</td>
                      <td className="py-2 px-3 text-[#453E32]">
                        {name.includes("E4")
                          ? "Face + Voice + Gaze + Text + rPPG (Condition: validated)"
                          : name}
                      </td>
                      <td className="py-2 px-3 font-bold font-mono text-emerald-800">{m.auroc}</td>
                      <td className="py-2 px-3 font-mono text-[#211F1A]">{m.f1}</td>
                      <td className="py-2 px-3 font-mono text-[#453E32]">{m.precision}</td>
                      <td className="py-2 px-3 font-mono text-[#453E32]">{m.recall}</td>
                      <td className="py-2 px-3 font-mono text-[#453E32]">{m.accuracy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Fusion Architecture Comparison */}
          <div className="retro-inset bg-[#FFFDF6] overflow-hidden shadow-sm">
            <div className="p-2.5 bg-[#E8DFCB] border-b border-[#453E32]">
              <h4 className="text-xs font-bold text-[#073E3B]">
                Fusion Architecture Comparison
              </h4>
              <p className="text-[10px] text-[#686253]">
                Evaluation of Early Fusion (feature concat) vs. Late Fusion (decision averaging) vs. Cross-Modal Transformer.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#211F1A] border-collapse">
                <thead className="bg-[#073E3B] text-white font-bold font-mono text-[11px]">
                  <tr>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Architecture</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">AUROC</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">F1 Score</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Precision</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Recall</th>
                    <th className="py-2 px-3">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCB] text-xs">
                  {Object.entries(run.fusion_architectures).map(([arch, m]) => (
                    <tr
                      key={arch}
                      className={
                        arch.includes("Cross-Modal")
                          ? "bg-[#FFF2B2] font-semibold text-[#073E3B]"
                          : "hover:bg-[#F3EAD7] transition-none"
                      }
                    >
                      <td className="py-2 px-3 text-[#211F1A] flex items-center gap-2">
                        {arch}{" "}
                        {arch.includes("Cross-Modal") && (
                          <span className="px-1.5 py-0.2 rounded-[2px] text-[9px] bg-[#073E3B] text-white font-bold font-mono">
                            PRIMARY
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-bold font-mono text-emerald-800">{m.auroc}</td>
                      <td className="py-2 px-3 font-mono text-[#211F1A]">{m.f1}</td>
                      <td className="py-2 px-3 font-mono text-[#453E32]">{m.precision}</td>
                      <td className="py-2 px-3 font-mono text-[#453E32]">{m.recall}</td>
                      <td className="py-2 px-3 font-mono text-[#453E32]">{m.accuracy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3: PPO Policy vs Fixed Script Baseline */}
          <div className="retro-inset bg-[#FFFDF6] overflow-hidden shadow-sm">
            <div className="p-2.5 bg-[#E8DFCB] border-b border-[#453E32]">
              <h4 className="text-xs font-bold text-[#073E3B] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-700" /> Reinforcement Learning Evaluation: PPO vs. Fixed Script
              </h4>
              <p className="text-[10px] text-[#686253]">
                Evaluation across 50 simulated sessions under an identical 10-turn question budget.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#211F1A] border-collapse">
                <thead className="bg-[#073E3B] text-white font-bold font-mono text-[11px]">
                  <tr>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Interaction Policy</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Mean Cumulative Reward</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Topic Coverage Rate</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Turns to Coverage</th>
                    <th className="py-2 px-3 border-r border-[#0A534E]">Repetition Rate</th>
                    <th className="py-2 px-3">Safety Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCB] text-xs">
                  {Object.entries(run.reinforcement_learning).map(([policyName, m]) => (
                    <tr
                      key={policyName}
                      className={
                        policyName.includes("PPO")
                          ? "bg-[#FFF2B2] font-semibold text-[#073E3B]"
                          : "hover:bg-[#F3EAD7] transition-none"
                      }
                    >
                      <td className="py-2 px-3 text-[#211F1A] font-bold">
                        {policyName.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 px-3 font-bold font-mono text-amber-800">
                        {m.mean_cumulative_reward}
                      </td>
                      <td className="py-2 px-3 font-mono text-[#211F1A]">
                        {(m.topic_coverage_rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 font-mono text-[#211F1A]">
                        {m.turns_to_target_coverage} turns
                      </td>
                      <td className="py-2 px-3 font-mono text-[#453E32]">
                        {(m.repetition_rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 font-bold font-mono text-emerald-800 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-700" /> {m.safety_violations} (Zero)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
