export interface AudioRecordingResult {
  blob: Blob;
  base64: string;
  durationMs: number;
  sampleRate: number;
  waveform: number[]; // 50 normalized amplitude points
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private pcmChunks: Float32Array[] = [];
  public recording: boolean = false;
  private onLevelUpdate?: (level: number) => void;

  async start(onLevelUpdate?: (level: number) => void): Promise<void> {
    if (this.recording) return;
    this.onLevelUpdate = onLevelUpdate;
    this.pcmChunks = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone API (navigator.mediaDevices.getUserMedia) is not supported in this browser environment.");
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        throw new Error("Microphone permission was denied. Please allow microphone access in your browser settings to speak.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        throw new Error("No microphone device was found on this computer. Please connect a microphone and retry.");
      } else {
        throw new Error(`Microphone initialization error: ${err.message || err.name}`);
      }
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // Buffer size 4096 gives ~0.25s chunks at 16kHz
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      this.pcmChunks.push(new Float32Array(inputData));

      if (this.onLevelUpdate) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.onLevelUpdate(Math.min(1.0, rms * 5.0));
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.recording = true;
  }

  async stop(): Promise<AudioRecordingResult> {
    this.recording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }

    let totalLength = 0;
    for (const chunk of this.pcmChunks) {
      totalLength += chunk.length;
    }

    if (totalLength === 0) {
      throw new Error("No audio samples were recorded. Please ensure your microphone is working and speak clearly.");
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Compute waveform visualization points (50 samples)
    const waveformPoints: number[] = [];
    const step = Math.max(1, Math.floor(merged.length / 50));
    for (let i = 0; i < 50; i++) {
      const start = i * step;
      const end = Math.min(merged.length, (i + 1) * step);
      let maxVal = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(merged[j]);
        if (abs > maxVal) maxVal = abs;
      }
      waveformPoints.push(Math.round(maxVal * 100) / 100);
    }

    // Encode to 16-bit PCM WAV (16000 Hz, mono)
    const wavBuffer = this.encodeWAV(merged, 16000);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    const base64 = await this.blobToBase64(blob);

    return {
      blob,
      base64,
      durationMs: Math.round((totalLength / 16000) * 1000),
      sampleRate: 16000,
      waveform: waveformPoints,
    };
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, "WAVE");

    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    this.writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    let index = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      index += 2;
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const b64 = dataUrl.split(",")[1] || "";
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const audioRecorder = new AudioRecorder();
