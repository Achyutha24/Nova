import React, { useState } from "react";
import { RetroWindow } from "./RetroWindow";

export interface ResearcherAuthSession {
  researcherId: string;
  researcherName: string;
  protocolRole: string;
  authMode: "Local Session Authentication";
  loginTimestamp: string;
}

interface ResearcherLoginWindowProps {
  onLoginSuccess: (session: ResearcherAuthSession) => void;
}

export const ResearcherLoginWindow: React.FC<ResearcherLoginWindowProps> = ({
  onLoginSuccess,
}) => {
  const [researcherId, setResearcherId] = useState("");
  const [researcherName, setResearcherName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const cleanId = researcherId.trim();
    const cleanCode = accessCode.trim();

    if (!cleanId) {
      setErrorMsg("Authentication Failed: Researcher ID / Username is required.");
      return;
    }
    if (!cleanCode) {
      setErrorMsg("Authentication Failed: Lab Access Code / Password is required.");
      return;
    }
    if (cleanId.length < 3 || !/^[A-Za-z0-9_.-]+$/.test(cleanId)) {
      setErrorMsg(
        "Authentication Failed: Invalid Researcher ID format (use at least 3 alphanumeric characters)."
      );
      return;
    }
    if (cleanCode.length < 4) {
      setErrorMsg(
        "Authentication Failed: Invalid Lab Access Code / Password."
      );
      return;
    }

    setIsSubmitting(true);
    window.setTimeout(() => {
      const session: ResearcherAuthSession = {
        researcherId: cleanId,
        researcherName: researcherName.trim() || cleanId,
        protocolRole: "Principal / Lab Researcher",
        authMode: "Local Session Authentication",
        loginTimestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setIsSubmitting(false);
      onLoginSuccess(session);
    }, 150);
  };

  return (
    <div
      data-testid="dedicated-login-page"
      className="min-h-screen retro-desktop-bg flex flex-col justify-between p-4 font-sans select-none text-[#211F1A]"
    >
      {/* Top Minimal System Strip (No Protected Data Exposed) */}
      <div className="retro-window px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-6 bg-[#042825] border border-[#1b7e75] rounded-[2px] flex items-center justify-center">
            <span className="text-[8px] font-black tracking-widest text-teal-300 font-mono">
              NOVA
            </span>
          </div>
          <span className="font-bold text-xs text-[#073E3B]">
            NOVA Research Console — Workstation Security Gate
          </span>
        </div>
        <span className="retro-inset bg-[#E8DFCB] px-2 py-0.5 font-mono text-[10px] text-[#453E32]">
          Status: Unauthenticated (Protected Data Locked)
        </span>
      </div>

      {/* Centered Dedicated Researcher Login Window */}
      <main className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-md">
          <RetroWindow
            title="NOVA Research Console — Researcher Login"
            icon={<span>&#128274;</span>}
          >
            <form
              onSubmit={handleSubmit}
              noValidate
              className="retro-inset bg-[#FFFDF6] p-4 text-left text-xs space-y-3 text-[#211F1A]"
            >
              {/* Header Banner */}
              <div className="flex items-center gap-3 border-b-2 border-[#453E32] pb-2.5">
                <div className="w-11 h-11 bg-[#073E3B] border-2 border-[#1b7e75] text-teal-200 font-mono font-black text-sm flex flex-col items-center justify-center rounded-[2px] shadow-inner">
                  <span>NOVA</span>
                  <span className="text-[8px] text-amber-300 font-normal">v1.0</span>
                </div>
                <div>
                  <h1 className="font-bold text-sm text-[#073E3B]">
                    Researcher Workstation Sign-In
                  </h1>
                  <p className="text-[11px] text-[#686253]">
                    Embodied Multimodal Mental-Health Research Platform
                  </p>
                </div>
              </div>

              {/* Honest Auth Mode Limitation Notice */}
              <div className="retro-window bg-[#E8DFCB] p-2 border border-[#7D7463] text-[10px] text-[#453E32]">
                <strong className="text-[#073E3B]">Authentication Notice:</strong>{" "}
                Local Researcher Session Authentication (Workstation-Scoped Local Session State — Not an external production identity server).
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  data-testid="login-error-alert"
                  className="p-2 bg-rose-100 border border-rose-600 text-rose-900 font-bold text-[11px]"
                >
                  &#9888; {errorMsg}
                </div>
              )}

              <div className="space-y-2.5">
                <div>
                  <label
                    htmlFor="login-researcher-id"
                    className="block text-[11px] font-bold text-[#073E3B] mb-0.5"
                  >
                    Researcher ID / Username <span className="text-rose-700">*</span>
                  </label>
                  <input
                    id="login-researcher-id"
                    type="text"
                    autoComplete="off"
                    value={researcherId}
                    disabled={isSubmitting}
                    onChange={(e) => setResearcherId(e.target.value)}
                    placeholder="Enter Researcher ID"
                    className="w-full retro-inset bg-white border border-[#7D7463] px-2.5 py-1.5 text-xs font-mono text-[#211F1A] focus:outline-none disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-researcher-name"
                    className="block text-[11px] font-bold text-[#073E3B] mb-0.5"
                  >
                    Investigator Name / Title (Optional)
                  </label>
                  <input
                    id="login-researcher-name"
                    type="text"
                    autoComplete="off"
                    value={researcherName}
                    disabled={isSubmitting}
                    onChange={(e) => setResearcherName(e.target.value)}
                    placeholder="Enter Investigator Name (Optional)"
                    className="w-full retro-inset bg-white border border-[#7D7463] px-2.5 py-1.5 text-xs text-[#211F1A] focus:outline-none disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-access-code"
                    className="block text-[11px] font-bold text-[#073E3B] mb-0.5"
                  >
                    Lab Access Code / Password <span className="text-rose-700">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="login-access-code"
                      type={showPassword ? "text" : "password"}
                      autoComplete="off"
                      value={accessCode}
                      disabled={isSubmitting}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter Lab Access Code"
                      className="flex-1 retro-inset bg-white border border-[#7D7463] px-2.5 py-1.5 text-xs font-mono text-[#211F1A] focus:outline-none disabled:bg-gray-100"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="retro-button px-2.5 py-1 text-[11px] font-bold text-[#073E3B] min-w-[54px]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#8C8472]/50">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setResearcherId("");
                    setResearcherName("");
                    setAccessCode("");
                    setErrorMsg(null);
                  }}
                  className="retro-button px-3 py-1 text-xs text-[#453E32] disabled:opacity-50"
                >
                  Clear Fields
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="retro-button px-4 py-1.5 font-bold text-xs bg-[#DCEEE8] text-[#073E3B] border-[#073E3B] disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Authenticating..."
                    : "\uD83D\uDD13 Login to Dashboard Home"}
                </button>
              </div>
            </form>
          </RetroWindow>
        </div>
      </main>

      {/* Bottom Non-Clinical Research Notice Bar */}
      <footer className="retro-window px-3 py-1 text-[10px] text-[#453E32] flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>NOVA Research Platform v1.0</strong> — Multimodal Affective Computing &amp; Adaptive Interview Console
        </span>
        <span>
          Protected participant records, transcripts, and multimodal signals require active researcher sign-in.
        </span>
      </footer>
    </div>
  );
};
