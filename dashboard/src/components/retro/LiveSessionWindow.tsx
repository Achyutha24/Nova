import React, { useState, useRef, useEffect } from "react";
import { RetroWindow } from "./RetroWindow";
import type { SessionSummary } from "../../api";
import { audioRecorder } from "../../utils/audioRecorder";

interface LiveSessionWindowProps {
  session: SessionSummary | null;
  activeQuestionText?: string;
  transcriptHistory?: Array<{ sender: "NOVA" | "You"; text: string; time: string; isAudio?: boolean }>;
  onSendMessage?: (text: string) => void;
  onSendAudio?: (audioBlob: Blob, audioBase64: string) => Promise<void>;
  onEndSession?: () => void;
  durationSeconds?: number;
  submitting?: boolean;
}

export const LiveSessionWindow: React.FC<LiveSessionWindowProps> = ({
  session,
  activeQuestionText = "How have you been feeling overall this week? You can take your time to share.",
  transcriptHistory = [
    { sender: "NOVA", text: "How have you been feeling overall this week?", time: "10:18 AM" },
    { sender: "You", text: "I've been feeling a bit stressed because of my studies and sleep has not been good.", time: "10:19 AM" },
    { sender: "NOVA", text: "I see. Can you tell me more about what has been causing the most stress lately?", time: "10:19 AM" },
  ],
  onSendMessage,
  onSendAudio,
  onEndSession,
  durationSeconds = 332,
  submitting = false,
}) => {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recordSecs, setRecordSecs] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const recordIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    };
  }, []);

  const formatTimer = (seconds: number) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const handleStartSpeak = async () => {
    if (submitting || isRecording) return;
    setMicError(null);
    setRecordSecs(0);

    try {
      await audioRecorder.start((lvl) => {
        setMicLevel(lvl);
      });
      setIsRecording(true);
      recordIntervalRef.current = setInterval(() => {
        setRecordSecs((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Speak failed to start recording:", err);
      setMicError(err.message || "Failed to access microphone.");
      setIsRecording(false);
    }
  };

  const handleStopSpeak = async () => {
    if (!isRecording) return;
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    setIsRecording(false);

    try {
      const result = await audioRecorder.stop();
      if (onSendAudio) {
        await onSendAudio(result.blob, result.base64);
      }
    } catch (err: any) {
      console.error("Failed to process speech audio:", err);
      setMicError(err.message || "Failed to process audio recording.");
    } finally {
      setMicLevel(0);
      setRecordSecs(0);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || submitting || isRecording) return;
    onSendMessage?.(inputText);
    setInputText("");
  };

  return (
    <RetroWindow
      title="Live Research Session — Embodied Avatar & Interaction Console"
      icon={<span className="text-sm">&#128187;</span>}
      className="h-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1">
        {/* Left Column: Avatar & Video Stage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-1.5">
          {/* Video Viewport with Bevel */}
          <div className="retro-inset relative bg-[#091513] aspect-[16/10] overflow-hidden flex flex-col justify-between p-2 border border-[#00FF66]/30">
            {/* Top Badges */}
            <div className="flex items-center justify-between z-10 select-none">
              <div className="bg-black/85 px-2 py-0.5 rounded-[2px] font-mono text-[11px] text-[#00FF66] border border-[#00FF66]/40">
                {formatTimer(durationSeconds)}
              </div>
              <div className="flex items-center gap-1.5 bg-black/85 px-2 py-0.5 rounded-[2px] text-[10px] text-white border border-white/20 font-bold">
                <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-ping" : "bg-emerald-500"}`} />
                <span className={`w-2 h-2 rounded-full absolute ${isRecording ? "bg-red-600" : "bg-emerald-600"}`} />
                <span className="ml-2 font-mono text-[9px]">
                  {isRecording ? `RECORDING (${recordSecs}s)` : "UNITY 3D AVATAR ONLINE"}
                </span>
              </div>
            </div>

            {/* Embodied Avatar Stage (Retro Virtual Human Representation) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Styled Virtual Human Avatar Sphere */}
                <div className="w-56 h-56 rounded-full bg-gradient-to-t from-[#021816] via-[#083531] to-[#0d4f49] overflow-hidden relative border-2 border-teal-400/40 flex items-center justify-center shadow-[0_0_25px_rgba(7,62,59,0.8)]">
                  {/* Vector Avatar Figure */}
                  <svg className="w-40 h-44 drop-shadow-[0_0_10px_#00FF66]" viewBox="0 0 100 120" fill="none">
                    {/* Head Silhouette */}
                    <ellipse cx="50" cy="40" rx="22" ry="26" fill="#17675F" stroke="#38D9A9" strokeWidth="1.5" />
                    {/* Eyes */}
                    <ellipse cx="41" cy="38" rx="3.5" ry="2" fill="#00FFFF" />
                    <ellipse cx="59" cy="38" rx="3.5" ry="2" fill="#00FFFF" />
                    {/* Eyebrows */}
                    <path d="M37 32 Q41 30 45 32" stroke="#A9E34B" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M55 32 Q59 30 63 32" stroke="#A9E34B" strokeWidth="1.2" strokeLinecap="round" />
                    {/* Mouth (Reactive to prompt) */}
                    <path d="M43 52 Q50 56 57 52" stroke="#E6FCF5" strokeWidth="1.8" strokeLinecap="round" />
                    {/* Torso */}
                    <path d="M22 105 C25 75 75 75 78 105 Z" fill="#073E3B" stroke="#38D9A9" strokeWidth="1.5" />
                    {/* Subtle Neural Network Grid Lines */}
                    <line x1="50" y1="14" x2="50" y2="28" stroke="#00FF66" strokeWidth="0.8" strokeDasharray="1,2" opacity="0.6" />
                    <line x1="28" y1="40" x2="38" y2="40" stroke="#00FF66" strokeWidth="0.8" strokeDasharray="1,2" opacity="0.6" />
                    <line x1="62" y1="40" x2="72" y2="40" stroke="#00FF66" strokeWidth="0.8" strokeDasharray="1,2" opacity="0.6" />
                  </svg>

                  {/* Audio responsive wave ring around avatar */}
                  <div
                    className="absolute inset-0 rounded-full border border-teal-300/30 transition-all duration-150 pointer-events-none"
                    style={{
                      transform: `scale(${1 + micLevel * 0.15})`,
                      borderColor: isRecording ? "#FF4D4D" : "#38D9A9",
                    }}
                  />

                  {/* Retro CRT Scanlines */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[size:100%_4px] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Dialogue Prompt Overlay Bubble */}
            <div className="retro-window p-2 bg-[#FFFDF6] z-10 border border-[#453E32] text-left shadow-lg">
              <div className="text-[10px] font-bold text-[#073E3B] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>NOVA Virtual Human</span>
                <span className="text-[9px] text-[#686253] font-mono">PPO Adaptive Policy</span>
              </div>
              <p className="text-[11px] text-[#211F1A] leading-snug font-medium">
                {activeQuestionText}
              </p>
            </div>
          </div>

          {/* Avatar & Microphone Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartSpeak}
                  disabled={submitting}
                  className="retro-button px-3 py-1 flex items-center gap-1.5 font-bold text-[11px] text-blue-900 disabled:opacity-50"
                  title="Click to speak through microphone using Whisper ASR"
                >
                  <span className="text-blue-700">&#127908;</span> Speak (Mic)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopSpeak}
                  className="retro-button px-3 py-1 flex items-center gap-1.5 font-bold text-[11px] bg-red-100 text-red-900 border-red-700 animate-pulse"
                >
                  <span className="w-2.5 h-2.5 bg-red-600 inline-block border border-red-800" />
                  Stop &amp; Transcribe ({recordSecs}s)
                </button>
              )}

              {isRecording && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-mono text-red-700 font-bold">MIC:</span>
                  <div className="retro-progress-well w-20 h-2.5">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-100"
                      style={{ width: `${Math.min(100, micLevel * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {submitting && (
                <span className="text-[10px] font-mono text-[#073E3B] animate-pulse">
                  Processing pipeline...
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onEndSession}
              disabled={submitting}
              className="retro-button px-3 py-1 font-bold text-[11px] text-[#C94A4A] hover:bg-red-50 disabled:opacity-50"
            >
              End Session
            </button>
          </div>

          {micError && (
            <div className="p-1 px-2 bg-rose-100 border border-rose-300 text-rose-800 text-[10px] flex items-center justify-between">
              <span>{micError}</span>
              <button
                type="button"
                onClick={() => setMicError(null)}
                className="font-bold underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Conversation Log (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-1.5">
          <div className="retro-window flex-1 flex flex-col overflow-hidden bg-[#E8DFCB] p-1">
            {/* Sub-header */}
            <div className="px-1.5 py-0.5 bg-[#073E3B] text-white text-[10px] font-bold flex items-center justify-between mb-1">
              <span>&#128172; Conversational Turn Log</span>
              <span className="font-mono text-[9px] text-teal-200">
                {session ? `ID: ${session.id.slice(0, 8)}` : "Live Transcript"}
              </span>
            </div>

            {/* Chat Messages Well */}
            <div className="retro-inset flex-1 p-2 bg-[#FFFDF6] overflow-y-auto space-y-2 text-left max-h-[220px]">
              {transcriptHistory.map((item, idx) => {
                const isNova = item.sender === "NOVA";
                return (
                  <div
                    key={idx}
                    className={`p-1.5 text-[11px] border leading-tight ${
                      isNova
                        ? "bg-[#FFFDF6] border-[#D4CBBA] text-[#211F1A]"
                        : "bg-[#E6F0FA] border-[#A8C7E8] text-[#1D3B5C] ml-3"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            isNova ? "text-[#073E3B]" : "text-[#2B6094]"
                          }`}
                        >
                          {item.sender}
                        </span>
                        {!isNova && item.isAudio && (
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 rounded-[1px] font-mono">
                            ASR
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-[#8C8472] font-mono">{item.time}</span>
                    </div>
                    <p className="text-[#211F1A]">{item.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="flex gap-1 mt-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={submitting || isRecording}
                placeholder={
                  isRecording
                    ? "Recording live microphone audio..."
                    : "Type participant response (or click Speak above)..."
                }
                className="retro-inset flex-1 px-2 py-1 text-[11px] bg-white text-[#211F1A] focus:outline-none disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={submitting || isRecording || !inputText.trim()}
                className="retro-button px-3 py-1 font-bold text-[11px] disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </RetroWindow>
  );
};
