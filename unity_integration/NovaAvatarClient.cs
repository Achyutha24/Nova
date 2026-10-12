using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Nova.Avatar
{
    /// <summary>
    /// NOVA Unity 3D Avatar Client Integration Script.
    /// Connects the functional Unity Avatar to the Python FastAPI backend.
    /// Handles session lifecycle, microphone/camera capture streaming, and safe question bank responses.
    /// </summary>
    public class NovaAvatarClient : MonoBehaviour
    {
        [Header("Backend Configuration")]
        [SerializeField] private string backendUrl = "http://localhost:8000/api";
        [SerializeField] private string participantId = "PART-UNITY-001";
        [SerializeField] private bool autoStartSession = false;

        [Header("Session State")]
        public string currentSessionId = "";
        public string currentQuestionId = "";
        public string currentQuestionText = "";
        public bool isProcessingTurn = false;

        // Events for Avatar Animation & Speech
        public event Action<string, string> OnNewQuestionReceived; // questionId, text
        public event Action<string> OnSessionEnded;

        private void Start()
        {
            if (autoStartSession)
            {
                StartCoroutine(CreateAndStartSessionRoutine(participantId));
            }
        }

        /// <summary>
        /// Starts a new research session for the given participant.
        /// </summary>
        public void StartSession(string participant)
        {
            StartCoroutine(CreateAndStartSessionRoutine(participant));
        }

        private IEnumerator CreateAndStartSessionRoutine(string pId)
        {
            Debug.Log($"[NOVA Avatar] Creating session for participant: {pId}");

            // 1. Create Session
            string createJson = $"{{\"participant_id\":\"{pId}\",\"environment_metadata\":{{\"client\":\"Unity Avatar v1.0\"}}}}";
            using (UnityWebRequest createReq = new UnityWebRequest($"{backendUrl}/sessions/", "POST"))
            {
                byte[] bodyRaw = Encoding.UTF8.GetBytes(createJson);
                createReq.uploadHandler = new UploadHandlerRaw(bodyRaw);
                createReq.downloadHandler = new DownloadHandlerBuffer();
                createReq.SetRequestHeader("Content-Type", "application/json");

                yield return createReq.SendWebRequest();

                if (createReq.result != UnityWebRequest.Result.Success)
                {
                    Debug.LogError($"[NOVA Avatar] Failed to create session: {createReq.error}");
                    yield break;
                }

                SessionResponse sessionRes = JsonUtility.FromJson<SessionResponse>(createReq.downloadHandler.text);
                currentSessionId = sessionRes.session_id;
                Debug.Log($"[NOVA Avatar] Session created: {currentSessionId}");
            }

            // 2. Start Session (Retrieves initial safe question)
            using (UnityWebRequest startReq = new UnityWebRequest($"{backendUrl}/sessions/{currentSessionId}/start", "POST"))
            {
                startReq.downloadHandler = new DownloadHandlerBuffer();
                yield return startReq.SendWebRequest();

                if (startReq.result == UnityWebRequest.Result.Success)
                {
                    StartSessionResponse startRes = JsonUtility.FromJson<StartSessionResponse>(startReq.downloadHandler.text);
                    currentQuestionId = startRes.initial_question.question_id;
                    currentQuestionText = startRes.initial_question.text;

                    Debug.Log($"[NOVA Avatar] Initial Question ({currentQuestionId}): {currentQuestionText}");
                    OnNewQuestionReceived?.Invoke(currentQuestionId, currentQuestionText);
                }
            }
        }

        /// <summary>
        /// Submits participant turn (audio/video/transcript) to the FastAPI backend.
        /// Backend executes Whisper, MediaPipe Face & Iris, Acoustic DSP, Cross-Modal Fusion, and PPO Policy.
        /// Returns the next safe question for the Avatar to speak.
        /// </summary>
        public IEnumerator SubmitTurnRoutine(byte[] audioWavBytes = null, byte[] videoJpgBytes = null, string transcript = null)
        {
            if (string.IsNullOrEmpty(currentSessionId))
            {
                Debug.LogError("[NOVA Avatar] No active session to submit turn.");
                yield break;
            }

            isProcessingTurn = true;
            Debug.Log("[NOVA Avatar] Submitting multimodal turn to FastAPI backend...");

            WWWForm form = new WWWForm();
            if (audioWavBytes != null && audioWavBytes.Length > 0)
            {
                form.AddBinaryData("audio_file", audioWavBytes, "participant_mic.wav", "audio/wav");
            }
            if (videoJpgBytes != null && videoJpgBytes.Length > 0)
            {
                form.AddBinaryData("video_file", videoJpgBytes, "participant_cam.jpg", "image/jpeg");
            }
            if (!string.IsNullOrEmpty(transcript))
            {
                form.AddField("transcript_text", transcript);
            }

            using (UnityWebRequest req = UnityWebRequest.Post($"{backendUrl}/sessions/{currentSessionId}/turn", form))
            {
                yield return req.SendWebRequest();

                isProcessingTurn = false;
                if (req.result != UnityWebRequest.Result.Success)
                {
                    Debug.LogError($"[NOVA Avatar] Error submitting turn: {req.error}");
                    yield break;
                }

                TurnResponse turnRes = JsonUtility.FromJson<TurnResponse>(req.downloadHandler.text);
                if (turnRes.next_question != null)
                {
                    currentQuestionId = turnRes.next_question.question_id;
                    currentQuestionText = turnRes.next_question.text;
                    Debug.Log($"[NOVA Avatar] Next Safe Question [{currentQuestionId}]: {currentQuestionText}");
                    OnNewQuestionReceived?.Invoke(currentQuestionId, currentQuestionText);
                }
            }
        }

        /// <summary>
        /// Ends the active research session and compiles metrics.
        /// </summary>
        public void EndSession()
        {
            if (!string.IsNullOrEmpty(currentSessionId))
            {
                StartCoroutine(EndSessionRoutine());
            }
        }

        private IEnumerator EndSessionRoutine()
        {
            using (UnityWebRequest req = new UnityWebRequest($"{backendUrl}/sessions/{currentSessionId}/end", "POST"))
            {
                req.downloadHandler = new DownloadHandlerBuffer();
                yield return req.SendWebRequest();

                if (req.result == UnityWebRequest.Result.Success)
                {
                    Debug.Log($"[NOVA Avatar] Session {currentSessionId} completed successfully.");
                    OnSessionEnded?.Invoke(currentSessionId);
                }
            }
        }

        [Serializable]
        public class SessionResponse
        {
            public string session_id;
            public string participant_id;
            public string status;
        }

        [Serializable]
        public class SafeQuestionData
        {
            public string question_id;
            public string text;
            public string topic;
            public int difficulty_tier;
        }

        [Serializable]
        public class StartSessionResponse
        {
            public string session_id;
            public string status;
            public SafeQuestionData initial_question;
        }

        [Serializable]
        public class TurnResponse
        {
            public int turn_number;
            public string transcript;
            public SafeQuestionData next_question;
            public float assessment_score;
        }
    }
}
