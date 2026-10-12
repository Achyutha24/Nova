import { useState, useEffect } from "react";
import { api } from "../api";
import type { SystemHealth, ModelStatus, SessionSummary } from "../api";
import { Activity, Server, Plus, Cpu, CheckCircle2 } from "lucide-react";

interface OverviewViewProps {
  onSelectSession: (session: SessionSummary, targetTab?: string) => void;
}

export const OverviewView = ({ onSelectSession }: OverviewViewProps) => {

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [newPartId, setNewPartId] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAll = () => {
    api.getHealth().then(setHealth).catch(console.error);
    api.getModelStatus().then(setModelStatus).catch(console.error);
    api.listSessions().then(setSessions).catch(console.error);
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateSession = async () => {
    const partId = newPartId.trim() || `PART-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setCreating(true);
    try {
      const sess = await api.createSession(partId, "Intake interview");
      await api.startSession(sess.id);
      loadAll();
      setNewPartId("");
      onSelectSession(sess, "live");
    } catch (e) {
      alert("Error creating session: " + e);
    } finally {
      setCreating(false);
    }
  };

  const activeCount = sessions.filter((s) => s.status === "active").length;
  const completedCount = sessions.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active Sessions</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-1 block">{activeCount}</span>
          </div>
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Completed Sessions</span>
            <span className="text-3xl font-extrabold text-slate-100 mt-1 block">{completedCount}</span>
          </div>
          <div className="p-3 bg-indigo-950/60 border border-indigo-800/80 rounded-xl text-indigo-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Inference Device</span>
            <span className="text-lg font-bold text-slate-200 mt-1 block truncate max-w-[140px]">
              {health?.torch_device || "Detecting..."}
            </span>
          </div>
          <div className="p-3 bg-purple-950/60 border border-purple-800/80 rounded-xl text-purple-400">
            <Cpu className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">System Health</span>
            <span className="text-lg font-bold text-emerald-400 mt-1 block flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Operational
            </span>
          </div>
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300">
            <Server className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Model Registry Health Center */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" /> Model Registry Telemetry (Locked Documented Components)
        </h3>

        {modelStatus?.models ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(modelStatus.models).map(([key, m]) => (
              <div key={key} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200 capitalize">{key}</span>
                    <span className={`w-2 h-2 rounded-full ${m.loaded ? "bg-emerald-400" : "bg-slate-600"}`}></span>
                  </div>
                  <span className="text-[11px] text-slate-400 block truncate">{m.name}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-800/80">
                  <span>v{m.version}</span>
                  <span className="uppercase font-semibold">{m.device}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Loading model telemetry...</p>
        )}
      </div>

      {/* New Session Creation & Recent Sessions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">Research Assessment Sessions</h3>
            <p className="text-xs text-slate-400 mt-0.5">Start a new participant assessment session or inspect completed logs.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Pseudonymous ID (e.g. PART-002)"
              value={newPartId}
              onChange={(e) => setNewPartId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleCreateSession}
              disabled={creating}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Start New Session
            </button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg text-xs">
            No assessment sessions created yet. Enter an ID above to create the first session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Session ID</th>
                  <th className="py-3 px-4">Participant</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Started At</th>
                  <th className="py-3 px-4">Turns Logged</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-400">{s.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-200">{s.participant_id}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        s.status === "active" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                        s.status === "completed" ? "bg-indigo-950 text-indigo-300 border border-indigo-800" :
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {s.started_at ? new Date(s.started_at).toLocaleString() : "Not started"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-300">{s.turn_count}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onSelectSession(s, "live")}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] transition"
                      >
                        Live Monitor
                      </button>
                      <button
                        onClick={() => onSelectSession(s, "timeline")}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] transition"
                      >
                        Timeline
                      </button>
                      <button
                        onClick={() => onSelectSession(s, "replay")}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] transition"
                      >
                        Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
