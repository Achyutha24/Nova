# NOVA Unity 3D Virtual Human Integration Guide

## Overview

The Unity 3D virtual avatar is an embodied interface for conversational assessment.
As specified in the NOVA design and Figure 6 of the architecture documentation:
- The Unity 3D Avatar remains completely independent in visual presentation and rigging.
- Communication with the backend is strictly handled via HTTP REST and WebSockets.
- Unity acts as the client: capturing participant microphone audio / webcam frames, streaming them to FastAPI, and receiving the next safe clinical question selected by the PPO policy.

## Fast Integration Steps

1. **Attach Script**:
   Attach `NovaAvatarClient.cs` to the root Avatar GameObject or your Network Manager GameObject in Unity.

2. **Configure Backend URL**:
   Default endpoint: `http://localhost:8000/api` (or your remote IP/port).

3. **Event Subscriptions**:
   Subscribe your Avatar TTS (e.g., Unity TTS / existing lip sync controller) to `OnNewQuestionReceived(string questionId, string questionText)`:
   ```csharp
   avatarClient.OnNewQuestionReceived += (qId, text) => {
       avatarSpeechController.Speak(text);
       avatarAnimationController.TriggerListeningStance();
   };
   ```

4. **Sending Turn Data**:
   When the participant finishes speaking, call:
   ```csharp
   StartCoroutine(avatarClient.SubmitTurnRoutine(audioBytes, videoFrameJpg, transcriptText));
   ```

5. **Lifecycle Endpoints**:
   - `POST /api/sessions/`: Creates new session ID.
   - `POST /api/sessions/{session_id}/start`: Retrieves initial warm-up rapport question.
   - `POST /api/sessions/{session_id}/turn`: Executes Whisper ASR, MediaPipe Face & Iris, Acoustic DSP, Cross-Modal Transformer fusion, and PPO safe question selection.
   - `POST /api/sessions/{session_id}/end`: Concludes session and persists summary metrics.
   - `GET /api/system/health`: Telemetry and model health monitoring.
