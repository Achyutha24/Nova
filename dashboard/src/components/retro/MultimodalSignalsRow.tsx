import React, { useState } from "react";
import { RetroWindow } from "./RetroWindow";

interface MultimodalSignalsRowProps {
  currentTranscript?: string;
  acousticDetails?: {
    f0_mean?: number;
    hnr?: number;
    jitter?: number;
    shimmer?: number;
    spectral_centroid?: number;
    vocal_instability?: number;
    mfcc?: number[];
  };
  gazeDetails?: {
    gaze_aversion_index?: number;
    blink_rate?: number;
    pupil_diameter?: number;
    gaze_direction?: { x: number; y: number; z: number };
  };
  faceDetails?: {
    action_units?: Record<string, number>;
    au_distress_activation?: number;
  };
  isAudioSpeech?: boolean;
  isCameraActive?: boolean;
}

const generateSpeechOscilloscopePath = (width = 300, height = 70, isSpeech = true) => {
  if (!isSpeech) {
    return `M 0 ${height / 2} L ${width} ${height / 2}`;
  }
  const midY = height / 2;
  const maxAmp = (height / 2) - 10;
  const points: string[] = [];

  for (let x = 0; x <= width; x += 2) {
    const t = x / width;
    // Natural speech phoneme modulation envelope that smoothly starts and ends at zero
    const envelope = Math.sin(t * Math.PI) * (0.6 + 0.3 * Math.sin(t * 6 * Math.PI) + 0.1 * Math.cos(t * 12 * Math.PI));
    // Complex acoustic voice signal: Fundamental + Harmonics
    const wave = 0.58 * Math.sin(t * 26 * Math.PI) +
                 0.26 * Math.sin(t * 52 * Math.PI) +
                 0.16 * Math.sin(t * 78 * Math.PI);
    const y = midY + envelope * wave * maxAmp;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M " + points.join(" L ");
};

export const MultimodalSignalsRow: React.FC<MultimodalSignalsRowProps> = ({
  currentTranscript = "I've been feeling a bit stressed because of my studies and sleep has not been good. I find it hard to focus sometimes.",
  acousticDetails,
  gazeDetails,
  faceDetails,
  isAudioSpeech = false,
  isCameraActive = false,
}) => {
  const [faceTab, setFaceTab] = useState<"video" | "landmarks" | "aus">("video");
  const [audioTab, setAudioTab] = useState<"waveform" | "features" | "spectrogram">("waveform");
  const [gazeTab, setGazeTab] = useState<"plot" | "vector" | "pupil">("plot");
  const [textTab, setTextTab] = useState<"transcript" | "topics" | "semantics">("transcript");
  const [showLandmarks] = useState(true);

  // Extracted or fallback AU levels
  const facialAus = faceDetails?.action_units || {
    AU01: 0.12,
    AU02: 0.28,
    AU04: 0.35,
    AU06: 0.22,
    AU12: 0.15,
  };

  const gazeX = gazeDetails?.gaze_direction?.x ?? -0.12;
  const gazeY = gazeDetails?.gaze_direction?.y ?? 0.08;
  const gazeZ = gazeDetails?.gaze_direction?.z ?? 0.95;
  const blinkRate = gazeDetails?.blink_rate ?? 14.0;
  const pupilDiam = gazeDetails?.pupil_diameter ?? 3.1;
  const gazeAv = gazeDetails?.gaze_aversion_index ?? 0.38;

  const pitchHz = acousticDetails?.f0_mean;
  const hnrDb = acousticDetails?.hnr;
  const jitterVal = acousticDetails?.jitter;
  const shimmerVal = acousticDetails?.shimmer;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-left">
      {/* 1. Face Analysis Window */}
      <RetroWindow
        title="Face & Expression (MediaPipe)"
        icon={<span className="text-xs">&#128522;</span>}
      >
        {/* Tabs */}
        <div className="flex border-b border-[#453E32] gap-0.5 px-0.5 mb-1 overflow-x-auto">
          {["video", "landmarks", "aus"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFaceTab(tab as any)}
              className={`retro-tab capitalize text-[10px] px-1.5 py-0.5 ${
                faceTab === tab ? "active" : ""
              }`}
            >
              {tab === "landmarks" ? "Landmarks" : tab === "aus" ? "FACS AUs" : "Feed Stage"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-1.5 flex-1">
          {/* Face Vector Stage (7 cols) - Replaced stock photo with vector MediaPipe face wireframe */}
          <div className="col-span-7 retro-inset relative bg-[#091513] aspect-square overflow-hidden flex flex-col items-center justify-center p-1 border border-[#00FF66]/30">
            {/* Vector MediaPipe Face Wireframe */}
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Face Oval */}
              <ellipse cx="50" cy="50" rx="30" ry="38" fill="none" stroke="#00FF66" strokeWidth="0.8" opacity="0.6" />
              {/* Nose Bridge */}
              <line x1="50" y1="36" x2="50" y2="56" stroke="#00FF66" strokeWidth="0.6" opacity="0.7" />
              <line x1="46" y1="56" x2="54" y2="56" stroke="#00FF66" strokeWidth="0.6" opacity="0.7" />
              {/* Eyebrows */}
              <path d="M30 38 Q38 34 44 38" fill="none" stroke="#00FFFF" strokeWidth="0.9" />
              <path d="M56 38 Q62 34 70 38" fill="none" stroke="#00FFFF" strokeWidth="0.9" />
              {/* Eyes */}
              <ellipse cx="37" cy="43" rx="6" ry="3.5" fill="none" stroke="#00FFFF" strokeWidth="0.8" />
              <ellipse cx="63" cy="43" rx="6" ry="3.5" fill="none" stroke="#00FFFF" strokeWidth="0.8" />
              <circle cx="37" cy="43" r="1.5" fill="#00FF66" />
              <circle cx="63" cy="43" r="1.5" fill="#00FF66" />
              {/* Mouth */}
              <ellipse cx="50" cy="68" rx="10" ry="4" fill="none" stroke="#00FF66" strokeWidth="0.8" />

              {/* MediaPipe 468 Landmark Mesh Dots */}
              {showLandmarks && (
                <>
                  {[
                    [50, 20], [38, 25], [62, 25], [26, 36], [74, 36],
                    [20, 50], [80, 50], [24, 66], [76, 66], [34, 78],
                    [66, 78], [50, 84], [50, 48], [44, 48], [56, 48],
                  ].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="0.9" fill="#00FFFF" opacity="0.85" />
                  ))}
                </>
              )}
            </svg>

            {/* Bounding Box */}
            <div className="absolute inset-2 border border-[#00FF66]/50 pointer-events-none" />

            {/* Stage Status Badge */}
            <div className="absolute bottom-1 left-1 bg-black/85 px-1 py-0.2 text-[8px] font-mono text-[#00FF66] border border-[#00FF66]/30">
              {isCameraActive ? "FPS: 30 (LIVE)" : "STANDBY: UNITY/CAM"}
            </div>
          </div>

          {/* AU Intensity & Expression meters (5 cols) */}
          <div className="col-span-5 flex flex-col justify-between text-[10px] space-y-1">
            <div>
              <div className="text-[9px] font-bold text-[#073E3B] border-b border-[#453E32] pb-0.5 mb-1 text-left">
                Facial Action Units
              </div>
              <div className="space-y-0.5 font-mono text-[9px]">
                {Object.entries(facialAus).slice(0, 4).map(([au, val]) => (
                  <div key={au} className="flex items-center gap-1">
                    <span className="w-6 text-left">{au}</span>
                    <div className="retro-progress-well flex-1 h-2">
                      <div className="h-full bg-[#17675F]" style={{ width: `${Math.min(100, Number(val) * 100)}%` }} />
                    </div>
                    <span className="w-5 text-right font-bold">{Number(val).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-1 retro-inset bg-[#FFFDF6] text-[9px]">
              <div className="text-[#686253]">AU Distress:</div>
              <div className="font-bold text-[#073E3B] font-mono text-[10px]">
                {faceDetails?.au_distress_activation?.toFixed(3) || "0.280"}
              </div>
            </div>
          </div>
        </div>
      </RetroWindow>

      {/* 2. Audio & Speech Analysis Window */}
      <RetroWindow
        title="Audio & Speech Analysis"
        icon={<span className="text-xs">&#127908;</span>}
      >
        {/* Tabs */}
        <div className="flex border-b border-[#453E32] gap-0.5 px-0.5 mb-1 overflow-x-auto">
          {["waveform", "features", "spectrogram"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setAudioTab(tab as any)}
              className={`retro-tab capitalize text-[10px] px-1.5 py-0.5 ${
                audioTab === tab ? "active" : ""
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1 flex-1 justify-between">
          {/* TAB 1: WAVEFORM OSCILLOSCOPE */}
          {audioTab === "waveform" && (
            <>
              {/* Full Unclipped Oscilloscope Well */}
              <div className="retro-inset bg-[#05110d] p-1 h-20 relative overflow-hidden flex items-center justify-center border border-[#00FF66]/40 shadow-inner">
                {/* Calibration Scale Markings */}
                <div className="absolute top-1 left-1.5 text-[7px] font-mono text-[#00FF66]/80 select-none z-10">
                  +1.0
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 left-1.5 text-[7px] font-mono text-[#00FF66]/60 select-none z-10">
                  0.0
                </div>
                <div className="absolute bottom-1 left-1.5 text-[7px] font-mono text-[#00FF66]/80 select-none z-10">
                  -1.0
                </div>

                {/* Sweep Time Markers */}
                <div className="absolute bottom-0.5 right-2 text-[7px] font-mono text-[#00FF66]/60 select-none z-10 flex gap-4">
                  <span>0ms</span>
                  <span>50ms</span>
                  <span>100ms</span>
                  <span>150ms</span>
                  <span>200ms</span>
                </div>

                {/* Scope Reticle Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,102,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.08)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />

                {/* Center Zero-Crossing Baseline */}
                <div className="absolute inset-x-0 top-1/2 border-t border-[#00FF66]/20 border-dashed pointer-events-none" />

                {isAudioSpeech ? (
                  <svg className="w-full h-full relative z-0" viewBox="0 0 300 70" preserveAspectRatio="none">
                    {/* Soft Neon Glow Underline */}
                    <path
                      d={generateSpeechOscilloscopePath(300, 70, true)}
                      fill="none"
                      stroke="#00FF66"
                      strokeWidth="3.5"
                      strokeOpacity="0.3"
                    />
                    {/* Sharp Core Waveform */}
                    <path
                      d={generateSpeechOscilloscopePath(300, 70, true)}
                      fill="none"
                      stroke="#00FF66"
                      strokeWidth="1.5"
                      className="drop-shadow-[0_0_4px_#00FF66]"
                    />
                  </svg>
                ) : (
                  <div className="text-[9px] font-mono text-[#00FF66]/70 text-center z-10">
                    ACOUSTIC CHANNEL: STANDBY / MASKED
                  </div>
                )}
              </div>

              {/* 4 Real/Measured Quick Metrics */}
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                  <span className="text-[#686253]">F0 Pitch</span>
                  <span className="font-bold text-[#073E3B]">
                    {isAudioSpeech && pitchHz !== undefined ? `${pitchHz.toFixed(1)} Hz` : "Masked"}
                  </span>
                </div>
                <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                  <span className="text-[#686253]">HNR (dB)</span>
                  <span className="font-bold text-[#073E3B]">
                    {isAudioSpeech && hnrDb !== undefined ? hnrDb.toFixed(1) : "Masked"}
                  </span>
                </div>
                <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                  <span className="text-[#686253]">Jitter</span>
                  <span className="font-bold text-[#073E3B]">
                    {isAudioSpeech && jitterVal !== undefined ? jitterVal.toFixed(4) : "Masked"}
                  </span>
                </div>
                <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                  <span className="text-[#686253]">Shimmer</span>
                  <span className="font-bold text-[#073E3B]">
                    {isAudioSpeech && shimmerVal !== undefined ? shimmerVal.toFixed(4) : "Masked"}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DETAILED ACOUSTIC FEATURES */}
          {audioTab === "features" && (
            <div className="space-y-1 text-[10px] font-mono flex-1">
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span className="text-[#686253]">F0 Pitch Mean</span>
                <span className="font-bold text-[#073E3B]">
                  {isAudioSpeech && pitchHz !== undefined ? `${pitchHz.toFixed(1)} Hz` : "Masked"}
                </span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span className="text-[#686253]">Harmonics-to-Noise</span>
                <span className="font-bold text-[#073E3B]">
                  {isAudioSpeech && hnrDb !== undefined ? `${hnrDb.toFixed(1)} dB` : "Masked"}
                </span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span className="text-[#686253]">Jitter (Local)</span>
                <span className="font-bold text-[#073E3B]">
                  {isAudioSpeech && jitterVal !== undefined ? jitterVal.toFixed(4) : "Masked"}
                </span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span className="text-[#686253]">Shimmer (Local)</span>
                <span className="font-bold text-[#073E3B]">
                  {isAudioSpeech && shimmerVal !== undefined ? shimmerVal.toFixed(4) : "Masked"}
                </span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span className="text-[#686253]">Spectral Centroid</span>
                <span className="font-bold text-[#073E3B]">
                  {isAudioSpeech && acousticDetails?.spectral_centroid !== undefined
                    ? `${acousticDetails.spectral_centroid.toFixed(0)} Hz`
                    : "1850 Hz"}
                </span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span className="text-[#686253]">Vocal Instability</span>
                <span className="font-bold text-rose-700">
                  {isAudioSpeech && acousticDetails?.vocal_instability !== undefined
                    ? acousticDetails.vocal_instability.toFixed(3)
                    : "0.000"}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: SPECTROGRAM */}
          {audioTab === "spectrogram" && (
            <div className="space-y-1 flex-1 flex flex-col justify-between">
              <div className="retro-inset bg-black h-24 relative overflow-hidden flex items-end border border-[#00FF66]/30">
                {/* Frequency Axis Labels */}
                <div className="absolute top-1 left-1 text-[7px] font-mono text-white/80 z-10">8 kHz</div>
                <div className="absolute top-1/2 -translate-y-1/2 left-1 text-[7px] font-mono text-white/60 z-10">4 kHz</div>
                <div className="absolute bottom-1 left-1 text-[7px] font-mono text-white/80 z-10">0 Hz</div>

                {isAudioSpeech ? (
                  <div className="w-full h-full bg-gradient-to-t from-[#250b38] via-[#7e174b] to-[#e69f00] opacity-90 flex items-end">
                    <div className="w-full h-16 bg-gradient-to-r from-purple-800 via-pink-600 to-amber-400 opacity-80 blur-[1px]" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] font-mono text-gray-500">
                    SPECTROGRAM: NO AUDIO INPUT
                  </div>
                )}
                <div className="absolute top-0.5 right-1 text-[7px] font-mono text-white/70">
                  FFT SPECTRUM (0 - 8kHz)
                </div>
              </div>
              <div className="text-[9px] font-mono text-[#686253] text-center">
                Short-Time Fourier Transform (Hanning Window, 2048 FFT)
              </div>
            </div>
          )}
        </div>
      </RetroWindow>

      {/* 3. Gaze / Eye Analysis Window (STOCK PHOTO REMOVED!) */}
      <RetroWindow
        title="Gaze / Eye Analysis (Iris)"
        icon={<span className="text-xs">&#128065;</span>}
      >
        {/* Tabs */}
        <div className="flex border-b border-[#453E32] gap-0.5 px-0.5 mb-1 overflow-x-auto">
          {["plot", "vector", "pupil"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setGazeTab(tab as any)}
              className={`retro-tab capitalize text-[10px] px-1.5 py-0.5 ${
                gazeTab === tab ? "active" : ""
              }`}
            >
              {tab === "plot" ? "Iris Scope" : tab === "vector" ? "3D Vector" : "Pupillometry"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 flex-1 justify-between">
          <div className="grid grid-cols-12 gap-1.5">
            {/* Ocular Tracking Scope (Vector Diagram replacing stock eye photo) */}
            <div className="col-span-6 retro-inset bg-[#081410] aspect-square overflow-hidden relative flex flex-col items-center justify-center p-1 border border-[#00FF66]/30">
              <svg className="w-full h-full" viewBox="-40 -40 80 80">
                {/* Eye outline */}
                <path
                  d="M -35,0 Q 0,-25 35,0 Q 0,25 -35,0 Z"
                  fill="none"
                  stroke="#00FF66"
                  strokeWidth="0.8"
                  opacity="0.7"
                />
                {/* Iris boundary circle */}
                <circle cx={gazeX * 25} cy={-gazeY * 25} r="14" fill="none" stroke="#00FFFF" strokeWidth="0.8" strokeDasharray="2,1" />
                {/* Pupil circle */}
                <circle cx={gazeX * 25} cy={-gazeY * 25} r="6" fill="#00FF66" opacity="0.8" />
                {/* Gaze Vector Point */}
                <circle cx={gazeX * 25} cy={-gazeY * 25} r="2" fill="#FFFFFF" />
                {/* Crosshairs */}
                <line x1="-38" y1="0" x2="38" y2="0" stroke="#00FF66" strokeWidth="0.5" opacity="0.3" />
                <line x1="0" y1="-25" x2="0" y2="25" stroke="#00FF66" strokeWidth="0.5" opacity="0.3" />
              </svg>

              <div className="absolute bottom-0.5 left-1 text-[7px] font-mono text-[#00FF66]">
                IRIS TRACKER
              </div>
            </div>

            {/* Gaze Coordinates & Measurements (6 cols) */}
            <div className="col-span-6 text-left text-[10px] space-y-1">
              <div>
                <span className="font-bold text-[#073E3B] block">Gaze Direction</span>
                <div className="font-mono text-[9px] text-[#453E32] leading-tight">
                  <div>X: {gazeX.toFixed(2)}</div>
                  <div>Y: {gazeY.toFixed(2)}</div>
                  <div>Z: {gazeZ.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <span className="font-bold text-[#073E3B] block">Blink Rate</span>
                <span className="font-mono text-[10px] text-[#211F1A]">
                  &#9654; {blinkRate.toFixed(1)} / min
                </span>
              </div>

              <div>
                <span className="font-bold text-[#073E3B] block">Pupil Diameter</span>
                <span className="font-mono text-[10px] text-[#211F1A]">
                  &#9654; {pupilDiam.toFixed(1)} mm
                </span>
              </div>
            </div>
          </div>

          {/* 2D Gaze Aversion Indicator */}
          <div className="retro-inset p-1 bg-[#FFFDF6] flex items-center justify-between text-[10px]">
            <span className="text-[#686253]">Gaze Aversion Index:</span>
            <span className="font-bold font-mono text-sky-800">
              {gazeAv.toFixed(3)}
            </span>
          </div>
        </div>
      </RetroWindow>

      {/* 4. Text & NLP Analysis Window */}
      <RetroWindow
        title="Text & NLP Analysis (DistilRoBERTa)"
        icon={<span className="text-xs">&#128221;</span>}
      >
        {/* Tabs */}
        <div className="flex border-b border-[#453E32] gap-0.5 px-0.5 mb-1 overflow-x-auto">
          {["transcript", "topics", "semantics"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTextTab(tab as any)}
              className={`retro-tab capitalize text-[10px] px-1.5 py-0.5 ${
                textTab === tab ? "active" : ""
              }`}
            >
              {tab === "topics" ? "Topics" : tab === "semantics" ? "Affect" : "Transcript"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 flex-1 justify-between text-left">
          {/* Transcript Inset Well */}
          <div className="retro-inset p-2 bg-[#FFFDF6] text-[10px] leading-relaxed text-[#211F1A] max-h-24 overflow-y-auto italic">
            "{currentTranscript || "[Awaiting dialogue turn...]"}"
          </div>

          {/* Detected Topics Grid */}
          <div>
            <div className="text-[10px] font-bold text-[#073E3B] border-b border-[#453E32] pb-0.5 mb-1">
              Cognitive Markers (Research)
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span>Distress</span>
                <span className="font-bold text-[#C94A4A]">0.62</span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span>Fatigue</span>
                <span className="font-bold text-[#D97736]">0.48</span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span>Engagement</span>
                <span className="font-bold text-[#073E3B]">0.71</span>
              </div>
              <div className="retro-inset p-1 bg-[#FFFDF6] flex justify-between">
                <span>Affect</span>
                <span className="font-bold text-[#375F85]">0.35</span>
              </div>
            </div>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
};
