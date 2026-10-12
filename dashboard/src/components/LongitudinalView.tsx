import { useState, useEffect } from "react";
import { api } from "../api";
import type { LongitudinalProfile } from "../api";
import { TrendingUp } from "lucide-react";

interface LongitudinalViewProps {
  initialParticipantId?: string;
}

export const LongitudinalView = ({ initialParticipantId = "PART-NOVA-VALIDATION" }: LongitudinalViewProps) => {

  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedPartId, setSelectedPartId] = useState(initialParticipantId);
  const [profile, setProfile] = useState<LongitudinalProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listParticipants().then(setParticipants).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedPartId) return;
    setLoading(true);
    api.getLongitudinal(selectedPartId)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPartId]);

  return (
    <div className="space-y-3 text-left">
      {/* Top Header & Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 retro-inset bg-[#FFFDF6] p-3 text-[#211F1A]">
        <div>
          <h3 className="text-sm font-bold text-[#073E3B] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#17675F]" /> Longitudinal Participant Tracking
          </h3>
          <p className="text-[11px] text-[#686253] mt-0.5">
            Compare biomarker trajectories and assessment stability across multiple assessment sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[#453E32]">Select Participant:</label>
          <select
            value={selectedPartId}
            onChange={(e) => setSelectedPartId(e.target.value)}
            className="retro-inset bg-white border border-[#453E32] px-2.5 py-1 text-xs text-[#211F1A] font-mono focus:outline-none"
          >
            {participants.map((p) => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center text-[#686253] retro-inset bg-[#FFFDF6]">
          Loading longitudinal history...
        </div>
      )}

      {profile && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="retro-inset p-3 bg-[#E8DFCB] text-[#211F1A]">
              <span className="text-[11px] font-bold text-[#686253] block uppercase tracking-wider">Total Completed Sessions</span>
              <span className="text-2xl font-bold font-mono text-[#073E3B] mt-1 block">{profile.total_sessions}</span>
            </div>
            <div className="retro-inset p-3 bg-[#E8DFCB] text-[#211F1A]">
              <span className="text-[11px] font-bold text-[#686253] block uppercase tracking-wider">Latest Vocal Instability</span>
              <span className="text-2xl font-bold font-mono text-rose-800 mt-1 block">
                {profile.sessions[profile.sessions.length - 1]?.avg_vocal_instability ?? "N/A"}
              </span>
            </div>
            <div className="retro-inset p-3 bg-[#E8DFCB] text-[#211F1A]">
              <span className="text-[11px] font-bold text-[#686253] block uppercase tracking-wider">Latest Gaze Aversion</span>
              <span className="text-2xl font-bold font-mono text-sky-800 mt-1 block">
                {profile.sessions[profile.sessions.length - 1]?.avg_gaze_aversion ?? "N/A"}
              </span>
            </div>
            <div className="retro-inset p-3 bg-[#E8DFCB] text-[#211F1A]">
              <span className="text-[11px] font-bold text-[#686253] block uppercase tracking-wider">Latest Prediction Score</span>
              <span className="text-2xl font-bold font-mono text-purple-800 mt-1 block">
                {profile.sessions[profile.sessions.length - 1]?.avg_prediction_score ?? "N/A"}
              </span>
            </div>
          </div>

          {/* Longitudinal Trend Chart (SVG) */}
          <div className="retro-inset bg-[#FFFDF6] p-3 text-[#211F1A] space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#E8DFCB]">
              <h4 className="text-xs font-bold font-mono text-[#073E3B]">CROSS-SESSION TRAJECTORY (BIOMARKER PROGRESSION)</h4>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-600 inline-block border border-rose-800"></span> Vocal Instability
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-sky-600 inline-block border border-sky-800"></span> Gaze Aversion
                </span>
              </div>
            </div>
            
            {profile.sessions.length < 2 ? (
              <div className="p-8 text-center text-[#686253] border border-dashed border-[#D4CBBA] bg-[#E8DFCB]/40">
                Participant has {profile.sessions.length} session. Multi-session trend comparison will render when 2 or more sessions are recorded.
              </div>
            ) : (
              <div className="w-full overflow-x-auto bg-[#FFFDF6] p-2">
                <svg viewBox="0 0 700 240" className="w-full h-auto font-sans">
                  {/* Grid lines */}
                  <line x1="60" y1="30" x2="660" y2="30" stroke="#D4CBBA" strokeDasharray="3,3" />
                  <line x1="60" y1="105" x2="660" y2="105" stroke="#D4CBBA" strokeDasharray="3,3" />
                  <line x1="60" y1="180" x2="660" y2="180" stroke="#8C8472" />
                  <text x="50" y="34" textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">1.0</text>
                  <text x="50" y="109" textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.5</text>
                  <text x="50" y="184" textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.0</text>

                  {/* Connect lines */}
                  {(() => {
                    const voicePts = profile.sessions.map((s, idx) => {
                      const x = 60 + (idx / (profile.sessions.length - 1)) * 600;
                      const yVoice = 180 - s.avg_vocal_instability * 150;
                      return `${x},${yVoice}`;
                    }).join(" ");
                    const gazePts = profile.sessions.map((s, idx) => {
                      const x = 60 + (idx / (profile.sessions.length - 1)) * 600;
                      const yGaze = 180 - s.avg_gaze_aversion * 150;
                      return `${x},${yGaze}`;
                    }).join(" ");
                    return (
                      <>
                        <polyline points={voicePts} fill="none" stroke="#e11d48" strokeWidth="2" strokeDasharray="4,2" />
                        <polyline points={gazePts} fill="none" stroke="#0284c7" strokeWidth="2" />
                      </>
                    );
                  })()}

                  {/* Points for Vocal and Gaze */}
                  {profile.sessions.map((s, idx) => {
                    const x = 60 + (idx / (profile.sessions.length - 1)) * 600;
                    const yVoice = 180 - s.avg_vocal_instability * 150;
                    const yGaze = 180 - s.avg_gaze_aversion * 150;
                    return (
                      <g key={s.session_id}>
                        <circle cx={x} cy={yVoice} r="4.5" fill="#e11d48" stroke="#881337" strokeWidth="1" />
                        <circle cx={x} cy={yGaze} r="4.5" fill="#0284c7" stroke="#0369a1" strokeWidth="1" />
                        <text x={x} y="205" textAnchor="middle" fill="#211F1A" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          Sess {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Historical Sessions Table */}
          <div className="retro-inset bg-[#FFFDF6] overflow-hidden text-[#211F1A]">
            <div className="p-2.5 bg-[#E8DFCB] border-b border-[#453E32]">
              <h4 className="text-xs font-bold font-mono text-[#073E3B]">HISTORICAL ASSESSMENTS</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#211F1A]">
                <thead className="bg-[#073E3B] text-white font-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Session ID</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-right">Turns</th>
                    <th className="py-2 px-3 text-right">Vocal Instability</th>
                    <th className="py-2 px-3 text-right">Gaze Aversion</th>
                    <th className="py-2 px-3 text-right">AU Distress</th>
                    <th className="py-2 px-3 text-right">Prediction Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCB]">
                  {profile.sessions.map((s) => (
                    <tr key={s.session_id} className="hover:bg-[#F3EAD7] transition-colors">
                      <td className="py-2 px-3 font-mono text-[#073E3B] font-bold">{s.session_id}</td>
                      <td className="py-2 px-3 text-[#686253] font-mono">{s.date}</td>
                      <td className="py-2 px-3 text-right font-mono">{s.turn_count}</td>
                      <td className="py-2 px-3 text-right text-rose-700 font-semibold font-mono">{s.avg_vocal_instability}</td>
                      <td className="py-2 px-3 text-right text-sky-700 font-semibold font-mono">{s.avg_gaze_aversion}</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-semibold font-mono">{s.avg_au_distress}</td>
                      <td className="py-2 px-3 text-right text-purple-700 font-semibold font-mono">{s.avg_prediction_score}</td>
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
