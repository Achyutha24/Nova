import type { TimelineSignalPoint } from "../api";

interface TimelineViewProps {
  signals: TimelineSignalPoint[];
  participantId?: string;
  sessionId?: string;
}

export const TimelineView = ({ signals }: TimelineViewProps) => {

  if (!signals || signals.length === 0) {
    return (
      <div className="p-8 text-center text-[#686253] retro-inset bg-[#FFFDF6]">
        <p className="text-sm font-bold text-[#073E3B]">No continuous biomarker signals recorded for this session yet.</p>
        <p className="text-xs text-[#686253] mt-1">Signals will populate dynamically as conversational turns are processed.</p>
      </div>
    );
  }

  const maxTime = Math.max(300, ...signals.map(s => s.time_sec));
  const svgWidth = 920;
  const svgHeight = 530;
  const paddingLeft = 165;
  const paddingRight = 35;
  const plotWidth = svgWidth - paddingLeft - paddingRight;

  const scaleX = (t: number) => paddingLeft + (t / maxTime) * plotWidth;
  
  // Track heights
  // Track 1: Gaze aversion [0, 1] (y: 50 to 140)
  // Track 2: Vocal instability [0, 1] (y: 160 to 250)
  // Track 3: Facial AU [0, 1] (y: 270 to 360)
  // Track 4: Modality availability bars (y: 380 to 470)

  const makePath = (key: "gaze_aversion" | "vocal_instability" | "au_distress", yTop: number, yBottom: number) => {
    if (signals.length === 1) {
      const s = signals[0];
      const x = scaleX(s.time_sec);
      const y = yBottom - s[key] * (yBottom - yTop);
      return `M ${x-10} ${y} L ${x+10} ${y}`;
    }
    return signals.reduce((acc, s, i) => {
      const x = scaleX(s.time_sec);
      const val = Math.max(0, Math.min(1, s[key]));
      const y = yBottom - val * (yBottom - yTop);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, "");
  };

  const pathGaze = makePath("gaze_aversion", 50, 140);
  const pathVoice = makePath("vocal_instability", 160, 250);
  const pathAU = makePath("au_distress", 270, 360);

  const getStatusColor = (status: "available" | "degraded" | "masked") => {
    switch (status) {
      case "available": return "#2e7d32"; // green
      case "degraded": return "#c67d0a";  // gold/yellow
      case "masked": return "#94a3b8";    // gray
      default: return "#94a3b8";
    }
  };

  return (
    <div className="retro-inset bg-[#FFFDF6] p-4 text-[#211F1A]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2.5 border-b border-[#453E32]">
        <div>
          <h3 className="text-sm font-bold text-[#073E3B] flex items-center gap-2">
            Multimodal Session Timeline (Figure 7 Reproduction)
          </h3>
          <p className="text-[11px] text-[#686253] mt-0.5">
            Synchronized continuous biomarker traces &amp; modality availability tracks aligned across session time.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <span className="w-3 h-3 rounded-[2px] bg-[#2e7d32] border border-[#1b5e20]"></span> Available (&ge;0.70)
          </span>
          <span className="flex items-center gap-1.5 text-amber-800 font-medium">
            <span className="w-3 h-3 rounded-[2px] bg-[#c67d0a] border border-[#8c5404]"></span> Degraded (0.40 - 0.70)
          </span>
          <span className="flex items-center gap-1.5 text-[#686253] font-medium">
            <span className="w-3 h-3 rounded-[2px] bg-[#94a3b8] border border-[#64748b]"></span> Masked out (&lt;0.40)
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto retro-inset bg-[#FFFDF6] p-2">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[850px] h-auto select-none font-sans">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#453E32" />
            </marker>
          </defs>

          {/* Explicit cream background for chart canvas */}
          <rect width={svgWidth} height={svgHeight} fill="#FFFDF6" />

          {/* Question Presentation Annotations & Dashed Markers */}
          {signals.map((s, idx) => {
            if (!s.question_id) return null;
            const x = scaleX(s.time_sec);
            const isRL = s.turn_index && s.turn_index > 2;
            return (
              <g key={`q_mark_${idx}`}>
                <line x1={x} y1={30} x2={x} y2={470} stroke="#A39A88" strokeDasharray="3 3" strokeWidth="1" />
                <rect x={x - 42} y={6} width={84} height={22} rx={2} fill="#E8DFCB" stroke="#7D7463" strokeWidth="1" />
                <text x={x} y={21} textAnchor="middle" fill="#073E3B" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  {s.question_id} {isRL ? "(RL)" : ""}
                </text>
              </g>
            );
          })}

          {/* Callout Arrow on elevated gaze aversion */}
          <g>
            <path d="M 450 65 L 560 48" stroke="#453E32" strokeWidth="1.2" markerEnd="url(#arrow)" />
            <text x={455} y={44} fill="#211F1A" fontSize="10.5" fontWeight="600">
              elevated gaze aversion logged as evidence, not as a diagnosis
            </text>
          </g>

          {/* ================= TRACK 1: GAZE AVERSION ================= */}
          <g>
            <text x={paddingLeft - 35} y={95} textAnchor="end" fill="#211F1A" fontSize="11" fontWeight="bold">
              Gaze aversion index
            </text>
            <line x1={paddingLeft} y1={50} x2={paddingLeft + plotWidth} y2={50} stroke="#D4CBBA" strokeDasharray="2 2" />
            <line x1={paddingLeft} y1={95} x2={paddingLeft + plotWidth} y2={95} stroke="#D4CBBA" strokeDasharray="2 2" />
            <line x1={paddingLeft} y1={140} x2={paddingLeft + plotWidth} y2={140} stroke="#8C8472" strokeWidth="1" />
            <text x={paddingLeft - 8} y={54} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">1.0</text>
            <text x={paddingLeft - 8} y={99} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.5</text>
            <text x={paddingLeft - 8} y={144} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.0</text>
            {/* Shaded area */}
            <path d={`${pathGaze} L ${scaleX(signals[signals.length-1].time_sec)} 140 L ${scaleX(signals[0].time_sec)} 140 Z`} fill="#0284c7" fillOpacity="0.15" />
            <path d={pathGaze} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* ================= TRACK 2: VOCAL INSTABILITY ================= */}
          <g>
            <text x={paddingLeft - 35} y={195} textAnchor="end" fill="#211F1A" fontSize="11" fontWeight="bold">
              Vocal instability
            </text>
            <text x={paddingLeft - 35} y={210} textAnchor="end" fill="#686253" fontSize="9.5">
              (jitter / shimmer / HNR)
            </text>
            <line x1={paddingLeft} y1={160} x2={paddingLeft + plotWidth} y2={160} stroke="#D4CBBA" strokeDasharray="2 2" />
            <line x1={paddingLeft} y1={205} x2={paddingLeft + plotWidth} y2={205} stroke="#D4CBBA" strokeDasharray="2 2" />
            <line x1={paddingLeft} y1={250} x2={paddingLeft + plotWidth} y2={250} stroke="#8C8472" strokeWidth="1" />
            <text x={paddingLeft - 8} y={164} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">1.0</text>
            <text x={paddingLeft - 8} y={209} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.5</text>
            <text x={paddingLeft - 8} y={254} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.0</text>
            {/* Shaded area */}
            <path d={`${pathVoice} L ${scaleX(signals[signals.length-1].time_sec)} 250 L ${scaleX(signals[0].time_sec)} 250 Z`} fill="#e11d48" fillOpacity="0.12" />
            <path d={pathVoice} fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* ================= TRACK 3: FACIAL AU ACTIVATION ================= */}
          <g>
            <text x={paddingLeft - 35} y={305} textAnchor="end" fill="#211F1A" fontSize="11" fontWeight="bold">
              Facial AU activation
            </text>
            <text x={paddingLeft - 35} y={320} textAnchor="end" fill="#686253" fontSize="9.5">
              (AU04 / AU07)
            </text>
            <line x1={paddingLeft} y1={270} x2={paddingLeft + plotWidth} y2={270} stroke="#D4CBBA" strokeDasharray="2 2" />
            <line x1={paddingLeft} y1={315} x2={paddingLeft + plotWidth} y2={315} stroke="#D4CBBA" strokeDasharray="2 2" />
            <line x1={paddingLeft} y1={360} x2={paddingLeft + plotWidth} y2={360} stroke="#8C8472" strokeWidth="1" />
            <text x={paddingLeft - 8} y={274} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">1.0</text>
            <text x={paddingLeft - 8} y={319} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.5</text>
            <text x={paddingLeft - 8} y={364} textAnchor="end" fill="#686253" fontSize="9" fontFamily="monospace">0.0</text>
            {/* Shaded area */}
            <path d={`${pathAU} L ${scaleX(signals[signals.length-1].time_sec)} 360 L ${scaleX(signals[0].time_sec)} 360 Z`} fill="#059669" fillOpacity="0.12" />
            <path d={pathAU} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* ================= TRACK 4: MODALITY AVAILABILITY BARS ================= */}
          <g transform="translate(0, 375)">
            <text x={paddingLeft - 48} y={42} textAnchor="end" fill="#211F1A" fontSize="11" fontWeight="bold">
              Modality availability
            </text>

            {[
              { label: "Face", key: "face_status", y: 5 },
              { label: "Gaze", key: "gaze_status", y: 20 },
              { label: "Voice", key: "voice_status", y: 35 },
              { label: "Text", key: "text_status", y: 50 },
              { label: "rPPG", key: "rppg_status", y: 65 },
            ].map((row) => (
              <g key={row.label}>
                <text x={paddingLeft - 8} y={row.y + 8} textAnchor="end" fill="#453E32" fontSize="10" fontFamily="monospace" fontWeight="600">
                  {row.label}
                </text>
                {/* Horizontal status segment */}
                {signals.map((s, idx) => {
                  const startX = scaleX(idx === 0 ? 0 : signals[idx - 1].time_sec);
                  const endX = scaleX(s.time_sec);
                  const w = Math.max(8, endX - startX);
                  const status = (s as any)[row.key];
                  return (
                    <rect
                      key={`${row.label}_${idx}`}
                      x={startX}
                      y={row.y}
                      width={w}
                      height={9}
                      fill={getStatusColor(status)}
                      stroke="#453E32"
                      strokeWidth="0.5"
                      rx={1}
                    />
                  );
                })}
              </g>
            ))}
          </g>

          {/* Time axis at bottom */}
          <g transform="translate(0, 475)">
            <line x1={paddingLeft} y1={0} x2={paddingLeft + plotWidth} y2={0} stroke="#8C8472" strokeWidth="1.2" />
            {[0, 50, 100, 150, 200, 250, 300].map((t) => {
              if (t > maxTime) return null;
              const x = scaleX(t);
              return (
                <g key={`axis_${t}`}>
                  <line x1={x} y1={0} x2={x} y2={5} stroke="#8C8472" strokeWidth="1.2" />
                  <text x={x} y={18} textAnchor="middle" fill="#453E32" fontSize="10" fontFamily="monospace" fontWeight="600">
                    {t}
                  </text>
                </g>
              );
            })}
            <text x={paddingLeft + plotWidth / 2} y={35} textAnchor="middle" fill="#073E3B" fontSize="11" fontWeight="bold" fontFamily="monospace">
              Session time (s)
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};
