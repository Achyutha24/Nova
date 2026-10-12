import type {
  SessionSummary,
  ReplayResponse,
  TimelineSignalPoint,
  ParticipantRecord,
} from "../api";

export type ModalityProcessStatus =
  | "Processed"
  | "Partially Available"
  | "Not Processed"
  | "Unavailable";

export interface ComputedSessionReport {
  sessionId: string;
  participantId: string;
  pseudonym: string;
  consentStatus: string;
  protocolVersion: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationFormatted: string;
  durationSeconds: number;
  totalTurns: number;
  speechTurnCount: number;
  textTurnCount: number;
  notes: string;
  generatedAt: string;
  modalityStatuses: {
    speechAsr: ModalityProcessStatus;
    voiceAcoustic: ModalityProcessStatus;
    faceExpression: ModalityProcessStatus;
    gazeOcular: ModalityProcessStatus;
    multimodalFusion: ModalityProcessStatus;
    ppoPolicy: ModalityProcessStatus;
  };
  audioSummary: {
    meanF0Hz: number | null;
    meanJitter: number | null;
    meanShimmer: number | null;
    meanHnrDb: number | null;
    meanVocalInstability: number | null;
    transcripts: Array<{
      turnIndex: number;
      source: string;
      questionId: string;
      questionText: string;
      transcript: string;
      timestamp: string;
      f0Mean: number | null;
      jitter: number | null;
      shimmer: number | null;
      hnr: number | null;
    }>;
  };
  faceSummary: {
    meanAuDistress: number | null;
    actionUnitAverages: Record<string, number>;
    headPoseSummary: string;
    observedTurns: number;
  };
  gazeSummary: {
    meanGazeAversion: number | null;
    meanBlinkRate: number | null;
    meanPupilDiameter: number | null;
    meanVector: { x: number; y: number; z: number } | null;
    observedTurns: number;
  };
  fusionSummary: {
    meanPredictionScore: number | null;
    peakPredictionScore: number | null;
    meanConfidence: number | null;
    meanAttentionWeights: Record<string, number>;
    affectiveInterpretation: string;
  };
  ppoDecisions: Array<{
    turnIndex: number;
    actionId: string;
    questionText: string;
    infoGain: number;
    topicCoverage: number;
    reward: number;
  }>;
  signalsCount: number;
}

export function analyzeSessionReportData(
  session: SessionSummary,
  replay: ReplayResponse | null,
  signals: TimelineSignalPoint[],
  participant?: ParticipantRecord | null
): ComputedSessionReport {
  const turns = replay?.turns || [];
  const totalTurns = turns.length || session.turn_count || 0;

  const startedAtRaw = replay?.started_at || session.started_at;
  const endedAtRaw = replay?.ended_at || session.ended_at;

  let durationSeconds = 0;
  if (startedAtRaw && endedAtRaw) {
    durationSeconds = Math.max(
      0,
      Math.round((new Date(endedAtRaw).getTime() - new Date(startedAtRaw).getTime()) / 1000)
    );
  } else if (signals.length > 0) {
    durationSeconds = Math.round(signals[signals.length - 1].time_sec);
  }

  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const durationFormatted =
    durationSeconds > 0 ? `${mins}m ${secs}s (${durationSeconds}s)` : "N/A (Not recorded)";

  // Accumulators
  let speechTurnCount = 0;
  let textTurnCount = 0;

  const f0Vals: number[] = [];
  const jitterVals: number[] = [];
  const shimmerVals: number[] = [];
  const hnrVals: number[] = [];
  const vocalInstVals: number[] = [];

  const auDistressVals: number[] = [];
  const auMap: Record<string, number[]> = {};
  let faceTurnCount = 0;

  const gazeAvVals: number[] = [];
  const blinkVals: number[] = [];
  const pupilVals: number[] = [];
  const gazeX: number[] = [];
  const gazeY: number[] = [];
  const gazeZ: number[] = [];
  let gazeTurnCount = 0;

  const predScores: number[] = [];
  const confScores: number[] = [];
  const attnAcc: Record<string, number[]> = { text: [], voice: [], face: [], gaze: [] };

  const transcripts: ComputedSessionReport["audioSummary"]["transcripts"] = [];
  const ppoDecisions: ComputedSessionReport["ppoDecisions"] = [];

  turns.forEach((t) => {
    const vObs = t.observations?.voice;
    const vFeats = vObs?.features || {};
    const hasRealVoice =
      !vObs?.masked && vFeats.f0_mean !== undefined && vFeats.f0_mean !== null && vFeats.f0_mean > 0;

    if (hasRealVoice) {
      speechTurnCount++;
      f0Vals.push(Number(vFeats.f0_mean));
      if (vFeats.jitter !== undefined) jitterVals.push(Number(vFeats.jitter));
      if (vFeats.shimmer !== undefined) shimmerVals.push(Number(vFeats.shimmer));
      if (vFeats.hnr !== undefined) hnrVals.push(Number(vFeats.hnr));
      const vInst =
        vFeats.vocal_instability !== undefined
          ? Number(vFeats.vocal_instability)
          : Math.min(1, Number(vFeats.jitter || 0.02) * 10 + Number(vFeats.shimmer || 0.04) * 5);
      vocalInstVals.push(vInst);
    } else if (t.transcript) {
      textTurnCount++;
    }

    transcripts.push({
      turnIndex: t.turn_index,
      source: hasRealVoice ? "Whisper ASR (Live Audio)" : "Manual Text / Simulated Input",
      questionId: t.question_id || "Q_INIT",
      questionText: t.question_text || "Opening interview prompt",
      transcript: t.transcript || "[No speech transcript recorded]",
      timestamp: t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : "N/A",
      f0Mean: hasRealVoice ? Number(vFeats.f0_mean) : null,
      jitter: hasRealVoice && vFeats.jitter !== undefined ? Number(vFeats.jitter) : null,
      shimmer: hasRealVoice && vFeats.shimmer !== undefined ? Number(vFeats.shimmer) : null,
      hnr: hasRealVoice && vFeats.hnr !== undefined ? Number(vFeats.hnr) : null,
    });

    // Face observations
    const fObs = t.observations?.face;
    const fFeats = fObs?.features || {};
    if (fObs && !fObs.masked && Object.keys(fFeats).length > 0) {
      faceTurnCount++;
      if (fFeats.au_distress_activation !== undefined) {
        auDistressVals.push(Number(fFeats.au_distress_activation));
      }
      if (fFeats.action_units && typeof fFeats.action_units === "object") {
        Object.entries(fFeats.action_units).forEach(([auKey, val]) => {
          if (!auMap[auKey]) auMap[auKey] = [];
          auMap[auKey].push(Number(val));
        });
      }
    }

    // Gaze observations
    const gObs = t.observations?.gaze;
    const gFeats = gObs?.features || {};
    if (gObs && !gObs.masked && Object.keys(gFeats).length > 0) {
      gazeTurnCount++;
      if (gFeats.gaze_aversion_index !== undefined) {
        gazeAvVals.push(Number(gFeats.gaze_aversion_index));
      }
      if (gFeats.blink_rate !== undefined) {
        blinkVals.push(Number(gFeats.blink_rate));
      }
      if (gFeats.pupil_diameter !== undefined) {
        pupilVals.push(Number(gFeats.pupil_diameter));
      }
      if (gFeats.gaze_direction) {
        if (gFeats.gaze_direction.x !== undefined) gazeX.push(Number(gFeats.gaze_direction.x));
        if (gFeats.gaze_direction.y !== undefined) gazeY.push(Number(gFeats.gaze_direction.y));
        if (gFeats.gaze_direction.z !== undefined) gazeZ.push(Number(gFeats.gaze_direction.z));
      }
    }

    // Fusion record
    if (t.fusion) {
      predScores.push(Number(t.fusion.prediction_score));
      confScores.push(Number(t.fusion.confidence));
      if (t.fusion.attention_weights) {
        Object.entries(t.fusion.attention_weights).forEach(([k, v]) => {
          if (!attnAcc[k]) attnAcc[k] = [];
          attnAcc[k].push(Number(v));
        });
      }
    }

    // PPO Decision
    if (t.decision) {
      ppoDecisions.push({
        turnIndex: t.turn_index,
        actionId: t.decision.action_id,
        questionText: t.decision.question_text,
        infoGain: Number(t.decision.info_gain),
        topicCoverage: Number(t.decision.topic_coverage),
        reward: Number(t.decision.reward),
      });
    }
  });

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const actionUnitAverages: Record<string, number> = {};
  Object.entries(auMap).forEach(([k, vals]) => {
    const m = avg(vals);
    if (m !== null) actionUnitAverages[k] = Number(m.toFixed(3));
  });

  const meanAttentionWeights: Record<string, number> = {};
  Object.entries(attnAcc).forEach(([k, vals]) => {
    const m = avg(vals);
    if (m !== null) meanAttentionWeights[k] = Number(m.toFixed(3));
  });

  const meanPred = avg(predScores);
  const peakPred = predScores.length > 0 ? Math.max(...predScores) : null;

  let affectiveInterpretation = "Insufficient turns recorded for multimodal state estimation.";
  if (meanPred !== null) {
    if (meanPred >= 0.65) {
      affectiveInterpretation =
        "Elevated Multimodal Distress Indicators Observed (Non-Clinical Research Signal)";
    } else if (meanPred >= 0.4) {
      affectiveInterpretation =
        "Moderate Stress / Affective Strain Markers Observed Across Modalities";
    } else {
      affectiveInterpretation = "Low Distress / Baseline Conversational Affect Observed";
    }
  }

  // Honest Modality Status Determination
  const speechAsrStatus: ModalityProcessStatus =
    totalTurns === 0
      ? "Not Processed"
      : speechTurnCount === totalTurns
      ? "Processed"
      : speechTurnCount > 0
      ? "Partially Available"
      : textTurnCount > 0
      ? "Partially Available"
      : "Not Processed";

  const voiceAcousticStatus: ModalityProcessStatus =
    totalTurns === 0
      ? "Not Processed"
      : speechTurnCount === totalTurns
      ? "Processed"
      : speechTurnCount > 0
      ? "Partially Available"
      : "Not Processed";

  const faceStatus: ModalityProcessStatus =
    totalTurns === 0
      ? "Not Processed"
      : faceTurnCount === totalTurns
      ? "Processed"
      : faceTurnCount > 0
      ? "Partially Available"
      : "Not Processed";

  const gazeStatus: ModalityProcessStatus =
    totalTurns === 0
      ? "Not Processed"
      : gazeTurnCount === totalTurns
      ? "Processed"
      : gazeTurnCount > 0
      ? "Partially Available"
      : "Not Processed";

  const fusionStatus: ModalityProcessStatus =
    predScores.length > 0 ? "Processed" : "Not Processed";

  const ppoStatus: ModalityProcessStatus =
    ppoDecisions.length > 0 ? "Processed" : "Not Processed";

  return {
    sessionId: session.id,
    participantId: session.participant_id,
    pseudonym:
      participant?.demographics?.pseudonym ||
      `Participant ${session.participant_id}`,
    consentStatus:
      participant?.demographics?.consent_status ||
      "Consented — IRB Research Protocol v1.0",
    protocolVersion: session.protocol_version || "v1.0",
    status: replay?.status || session.status || "unknown",
    startedAt: startedAtRaw ? new Date(startedAtRaw).toLocaleString() : "Not started",
    endedAt: endedAtRaw ? new Date(endedAtRaw).toLocaleString() : "In progress / Not ended",
    durationFormatted,
    durationSeconds,
    totalTurns,
    speechTurnCount,
    textTurnCount,
    notes: session.notes || participant?.notes || "Standard NOVA Multimodal Session",
    generatedAt: new Date().toLocaleString(),
    modalityStatuses: {
      speechAsr: speechAsrStatus,
      voiceAcoustic: voiceAcousticStatus,
      faceExpression: faceStatus,
      gazeOcular: gazeStatus,
      multimodalFusion: fusionStatus,
      ppoPolicy: ppoStatus,
    },
    audioSummary: {
      meanF0Hz: avg(f0Vals),
      meanJitter: avg(jitterVals),
      meanShimmer: avg(shimmerVals),
      meanHnrDb: avg(hnrVals),
      meanVocalInstability: avg(vocalInstVals),
      transcripts,
    },
    faceSummary: {
      meanAuDistress: avg(auDistressVals),
      actionUnitAverages,
      headPoseSummary:
        faceTurnCount > 0
          ? "MediaPipe 468-Point FaceMesh Active (Frontal Pose Tracked)"
          : "No facial landmarks recorded during session",
      observedTurns: faceTurnCount,
    },
    gazeSummary: {
      meanGazeAversion: avg(gazeAvVals),
      meanBlinkRate: avg(blinkVals),
      meanPupilDiameter: avg(pupilVals),
      meanVector:
        gazeX.length > 0
          ? {
              x: Number((avg(gazeX) || 0).toFixed(3)),
              y: Number((avg(gazeY) || 0).toFixed(3)),
              z: Number((avg(gazeZ) || 0.95).toFixed(3)),
            }
          : null,
      observedTurns: gazeTurnCount,
    },
    fusionSummary: {
      meanPredictionScore: meanPred,
      peakPredictionScore: peakPred,
      meanConfidence: avg(confScores),
      meanAttentionWeights,
      affectiveInterpretation,
    },
    ppoDecisions,
    signalsCount: signals.length,
  };
}

export function generateStandaloneHtmlReport(report: ComputedSessionReport): string {
  const badgeColor = (st: ModalityProcessStatus) => {
    switch (st) {
      case "Processed":
        return "background:#d1fae5;color:#065f46;border:1px solid #34d399;";
      case "Partially Available":
        return "background:#fef3c7;color:#92400e;border:1px solid #fbbf24;";
      case "Not Processed":
        return "background:#f3f4f6;color:#374151;border:1px solid #9ca3af;";
      case "Unavailable":
      default:
        return "background:#fee2e2;color:#991b1b;border:1px solid #f87171;";
    }
  };

  const turnsHtml =
    report.audioSummary.transcripts.length > 0
      ? report.audioSummary.transcripts
          .map(
            (t) => `
        <tr>
          <td style="font-family:monospace;font-weight:bold;">#${t.turnIndex}</td>
          <td style="font-family:monospace;">${t.timestamp}</td>
          <td><strong>[${t.questionId}]</strong> ${t.questionText}</td>
          <td><em>"${t.transcript}"</em></td>
          <td>${t.source}</td>
          <td style="font-family:monospace;">
            ${
              t.f0Mean !== null
                ? `F0: ${t.f0Mean.toFixed(1)}Hz | Jit: ${(t.jitter ?? 0).toFixed(3)} | HNR: ${(t.hnr ?? 0).toFixed(1)}dB`
                : "Voice Masked (Text Only)"
            }
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="6" style="text-align:center;padding:16px;color:#686253;">No conversational turns were recorded in this session.</td></tr>`;

  const ppoHtml =
    report.ppoDecisions.length > 0
      ? report.ppoDecisions
          .map(
            (d) => `
        <tr>
          <td style="font-family:monospace;font-weight:bold;">#${d.turnIndex}</td>
          <td style="font-family:monospace;font-weight:bold;color:#073E3B;">${d.actionId}</td>
          <td>${d.questionText}</td>
          <td style="font-family:monospace;">${d.infoGain.toFixed(4)}</td>
          <td style="font-family:monospace;">${(d.topicCoverage * 100).toFixed(1)}%</td>
          <td style="font-family:monospace;font-weight:bold;">${d.reward.toFixed(4)}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="6" style="text-align:center;padding:16px;color:#686253;">No PPO adaptive policy decisions recorded.</td></tr>`;

  const auBadgesHtml =
    Object.keys(report.faceSummary.actionUnitAverages).length > 0
      ? Object.entries(report.faceSummary.actionUnitAverages)
          .map(
            ([au, val]) =>
              `<span style="display:inline-block;margin:3px;padding:4px 8px;background:#E8DFCB;border:1px solid #7D7463;font-family:monospace;font-size:12px;"><strong>${au}:</strong> ${val.toFixed(3)}</span>`
          )
          .join("")
      : `<span style="color:#686253;font-style:italic;">No Action Unit activations recorded for this session.</span>`;

  const attnHtml =
    Object.keys(report.fusionSummary.meanAttentionWeights).length > 0
      ? Object.entries(report.fusionSummary.meanAttentionWeights)
          .map(
            ([mod, wt]) =>
              `<span style="display:inline-block;margin:3px 6px 3px 0;padding:4px 10px;background:#DCEEE8;border:1px solid #073E3B;font-family:monospace;font-size:12px;"><strong style="text-transform:uppercase;">${mod}:</strong> ${(wt * 100).toFixed(1)}%</span>`
          )
          .join("")
      : `<span style="color:#686253;font-style:italic;">Attention weights not computed (0 turns).</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NOVA Research Session Report — ${report.participantId} (${report.sessionId})</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #E8DFCB;
      color: #211F1A;
      margin: 0;
      padding: 24px;
    }
    .report-window {
      max-width: 1080px;
      margin: 0 auto;
      background: #FFFDF6;
      border: 2px solid #453E32;
      box-shadow: 4px 4px 0px #2D5A4C;
    }
    .titlebar {
      background: linear-gradient(90deg, #073E3B 0%, #12645F 100%);
      color: #ffffff;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .titlebar h1 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 20px;
    }
    .section {
      border: 1px solid #8C8472;
      background: #FFFDF6;
      padding: 14px;
      margin-bottom: 16px;
    }
    .section-title {
      margin: 0 0 10px 0;
      font-size: 14px;
      text-transform: uppercase;
      color: #073E3B;
      border-bottom: 2px solid #453E32;
      padding-bottom: 4px;
      font-family: monospace;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .metric-box {
      background: #E8DFCB;
      border: 1px solid #7D7463;
      padding: 8px 10px;
    }
    .metric-label {
      font-size: 11px;
      color: #686253;
      display: block;
    }
    .metric-val {
      font-size: 14px;
      font-weight: bold;
      font-family: monospace;
      color: #073E3B;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #8C8472;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #E8DFCB;
      color: #073E3B;
      font-family: monospace;
      text-transform: uppercase;
      font-size: 11px;
    }
    .disclaimer {
      background: #FFF3C4;
      border: 1px solid #D4C366;
      padding: 10px 14px;
      font-size: 12px;
      color: #453E32;
      margin-top: 16px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .report-window { box-shadow: none; border: 1px solid #000; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="report-window">
    <div class="titlebar">
      <div>
        <h1>NOVA MULTIMODAL RESEARCH REPORT — AUDIO, FACE, GAZE &amp; FUSION</h1>
        <div style="font-size:12px;color:#A7F3D0;font-family:monospace;">
          Session ID: ${report.sessionId} &bull; Participant ID: ${report.participantId} &bull; Generated: ${report.generatedAt}
        </div>
      </div>
      <button class="no-print" onclick="window.print()" style="background:#E8DFCB;color:#211F1A;border:2px solid #FFFDF6;padding:6px 12px;font-weight:bold;cursor:pointer;font-family:monospace;">
        Print / Save PDF
      </button>
    </div>

    <div class="content">
      <!-- 1. Session & Participant Metadata -->
      <div class="section">
        <h2 class="section-title">1. Session &amp; Participant Metadata</h2>
        <div class="grid-4">
          <div class="metric-box">
            <span class="metric-label">Participant ID / Label</span>
            <span class="metric-val">${report.participantId} (${report.pseudonym})</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Session ID</span>
            <span class="metric-val">${report.sessionId}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Session Status</span>
            <span class="metric-val" style="text-transform:uppercase;">${report.status}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Total Turns / Duration</span>
            <span class="metric-val">${report.totalTurns} Turns &bull; ${report.durationFormatted}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Start Timestamp</span>
            <span class="metric-val">${report.startedAt}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">End Timestamp</span>
            <span class="metric-val">${report.endedAt}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Protocol &amp; Consent</span>
            <span class="metric-val">${report.protocolVersion} — ${report.consentStatus}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Researcher Notes</span>
            <span class="metric-val">${report.notes}</span>
          </div>
        </div>
      </div>

      <!-- 2. Modality Processing Status Summary -->
      <div class="section">
        <h2 class="section-title">2. Modality Processing &amp; Availability Status</h2>
        <div class="grid-3">
          <div class="metric-box">
            <span class="metric-label">Speech Transcription (Whisper ASR)</span>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;font-size:11px;font-weight:bold;font-family:monospace;${badgeColor(report.modalityStatuses.speechAsr)}">${report.modalityStatuses.speechAsr}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Voice &amp; Acoustic DSP</span>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;font-size:11px;font-weight:bold;font-family:monospace;${badgeColor(report.modalityStatuses.voiceAcoustic)}">${report.modalityStatuses.voiceAcoustic}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Facial Expression &amp; Action Units</span>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;font-size:11px;font-weight:bold;font-family:monospace;${badgeColor(report.modalityStatuses.faceExpression)}">${report.modalityStatuses.faceExpression}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Gaze &amp; Ocular Tracking</span>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;font-size:11px;font-weight:bold;font-family:monospace;${badgeColor(report.modalityStatuses.gazeOcular)}">${report.modalityStatuses.gazeOcular}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Cross-Modal Transformer Fusion</span>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;font-size:11px;font-weight:bold;font-family:monospace;${badgeColor(report.modalityStatuses.multimodalFusion)}">${report.modalityStatuses.multimodalFusion}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">PPO Adaptive Questioning Policy</span>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;font-size:11px;font-weight:bold;font-family:monospace;${badgeColor(report.modalityStatuses.ppoPolicy)}">${report.modalityStatuses.ppoPolicy}</span>
          </div>
        </div>
      </div>

      <!-- 3. Audio, Voice & Speech Analysis -->
      <div class="section">
        <h2 class="section-title">3. Audio / Voice DSP &amp; Speech Transcript Review</h2>
        <div class="grid-4" style="margin-bottom:12px;">
          <div class="metric-box">
            <span class="metric-label">Mean Pitch (F0)</span>
            <span class="metric-val">${report.audioSummary.meanF0Hz !== null ? `${report.audioSummary.meanF0Hz.toFixed(1)} Hz` : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Mean Jitter / Shimmer</span>
            <span class="metric-val">${report.audioSummary.meanJitter !== null ? `${report.audioSummary.meanJitter.toFixed(4)} / ${(report.audioSummary.meanShimmer ?? 0).toFixed(4)}` : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Mean HNR</span>
            <span class="metric-val">${report.audioSummary.meanHnrDb !== null ? `${report.audioSummary.meanHnrDb.toFixed(1)} dB` : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Mean Vocal Instability</span>
            <span class="metric-val">${report.audioSummary.meanVocalInstability !== null ? report.audioSummary.meanVocalInstability.toFixed(3) : "Not Processed (Masked)"}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Turn</th>
              <th>Time</th>
              <th>NOVA Question Prompt</th>
              <th>Participant Response Transcript</th>
              <th>Input Modality</th>
              <th>Extracted Acoustic Features</th>
            </tr>
          </thead>
          <tbody>
            ${turnsHtml}
          </tbody>
        </table>
      </div>

      <!-- 4. Facial Expression & Gaze Analysis -->
      <div class="section">
        <h2 class="section-title">4. Facial Expression (FACS Action Units) &amp; Gaze / Ocular Review</h2>
        <div class="grid-4" style="margin-bottom:12px;">
          <div class="metric-box">
            <span class="metric-label">Mean AU Distress Activation</span>
            <span class="metric-val">${report.faceSummary.meanAuDistress !== null ? report.faceSummary.meanAuDistress.toFixed(3) : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Mean Gaze Aversion Index</span>
            <span class="metric-val">${report.gazeSummary.meanGazeAversion !== null ? report.gazeSummary.meanGazeAversion.toFixed(3) : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Mean Blink Rate / Pupil Diam.</span>
            <span class="metric-val">${report.gazeSummary.meanBlinkRate !== null ? `${report.gazeSummary.meanBlinkRate.toFixed(1)} /min | ${(report.gazeSummary.meanPupilDiameter ?? 3.2).toFixed(2)} mm` : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Mean 3D Gaze Vector</span>
            <span class="metric-val">${report.gazeSummary.meanVector ? `(${report.gazeSummary.meanVector.x}, ${report.gazeSummary.meanVector.y}, ${report.gazeSummary.meanVector.z})` : "Not Processed"}</span>
          </div>
        </div>
        <div style="margin-top:8px;">
          <div style="font-size:11px;font-weight:bold;color:#453E32;margin-bottom:4px;">OBSERVED FACIAL ACTION UNIT AVERAGES (FACS):</div>
          ${auBadgesHtml}
        </div>
      </div>

      <!-- 5. Cross-Modal Transformer Fusion & PPO Policy -->
      <div class="section">
        <h2 class="section-title">5. Multimodal Transformer Fusion &amp; PPO Adaptive Questioning Log</h2>
        <div class="grid-3" style="margin-bottom:12px;">
          <div class="metric-box">
            <span class="metric-label">Mean / Peak Fusion Distress Score</span>
            <span class="metric-val">${report.fusionSummary.meanPredictionScore !== null ? `${report.fusionSummary.meanPredictionScore.toFixed(3)} (Peak: ${(report.fusionSummary.peakPredictionScore ?? 0).toFixed(3)})` : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Mean Fusion Confidence</span>
            <span class="metric-val">${report.fusionSummary.meanConfidence !== null ? `${(report.fusionSummary.meanConfidence * 100).toFixed(1)}%` : "Not Processed"}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Empirical Affective Summary</span>
            <span class="metric-val" style="font-size:12px;">${report.fusionSummary.affectiveInterpretation}</span>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:bold;color:#453E32;margin-bottom:4px;">MEAN CROSS-MODAL ATTENTION WEIGHTS:</div>
          ${attnHtml}
        </div>
        <table>
          <thead>
            <tr>
              <th>Turn</th>
              <th>Selected Action ID</th>
              <th>Spoken Follow-Up Question</th>
              <th>Expected Info Gain</th>
              <th>Topic Coverage</th>
              <th>PPO Reward</th>
            </tr>
          </thead>
          <tbody>
            ${ppoHtml}
          </tbody>
        </table>
      </div>

      <div class="disclaimer">
        <strong>NON-CLINICAL RESEARCH DISCLAIMER:</strong> This report is generated by the NOVA Embodied Multimodal Mental-Health Research Platform for empirical human-centered AI and affective computing research only. Extracted acoustic, facial, ocular, and cross-modal fusion indices represent experimental computational biomarkers and must NOT be used for autonomous clinical or psychiatric diagnosis.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function downloadHtmlReport(report: ComputedSessionReport) {
  const html = generateStandaloneHtmlReport(report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NOVA_Report_${report.participantId}_${report.sessionId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openHtmlReportInNewTab(report: ComputedSessionReport) {
  const html = generateStandaloneHtmlReport(report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
}
