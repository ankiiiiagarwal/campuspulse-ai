import { stripForSpeech } from "./voice-text";

export { stripForSpeech };

type RecognitionCtor = new () => BrowserSpeechRecognition;

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface ListenHandle {
  stop: () => void;
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function canRecord(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function canListen(): boolean {
  return Boolean(recognitionCtor()) || canRecord();
}

export function canBrowserSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function canSpeak(): boolean {
  return typeof window !== "undefined";
}

export function warmupVoice() {
  if (!canBrowserSpeak()) return;
  try {
    window.speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
}

function pickVoice(lang?: string): SpeechSynthesisVoice | null {
  if (!canBrowserSpeak()) return null;
  const voices = window.speechSynthesis.getVoices();
  const prefer = (prefix: string) => voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  if (lang?.toLowerCase().startsWith("hi")) {
    return prefer("hi") || prefer("en-in") || voices[0] || null;
  }
  return prefer("en-in") || prefer("en-gb") || prefer("en-us") || prefer("en") || voices[0] || null;
}

let speakTimer: ReturnType<typeof setTimeout> | null = null;
let speakGen = 0;
let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  speakGen += 1;
  if (speakTimer) {
    clearTimeout(speakTimer);
    speakTimer = null;
  }
  if (canBrowserSpeak()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

function speakBrowser(text: string, lang?: string): boolean {
  const clean = stripForSpeech(text);
  if (!clean || !canBrowserSpeak()) return false;
  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(clean.slice(0, 1800));
  utter.rate = 1.02;
  utter.pitch = 1;
  const voice = pickVoice(lang);
  if (voice) {
    utter.voice = voice;
    utter.lang = lang || voice.lang;
  } else {
    utter.lang = lang || "en-IN";
  }
  speakTimer = setTimeout(() => {
    speakTimer = null;
    try {
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore */
    }
  }, 80);
  return true;
}

async function speakRemote(text: string, onError?: (message: string) => void) {
  const gen = speakGen;
  const res = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = (await res.json().catch(() => ({}))) as { audio?: string[]; error?: string };
  if (!res.ok || !data.audio?.length) {
    onError?.(data.error || "Could not read that aloud.");
    return;
  }
  for (const chunk of data.audio) {
    if (gen !== speakGen) return;
    const url = `data:audio/wav;base64,${chunk}`;
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Could not play speech."));
      void audio.play().catch(reject);
    }).catch((e) => onError?.(e instanceof Error ? e.message : "Could not play speech."));
  }
}

export function speak(text: string, onError?: (message: string) => void, lang?: string): boolean {
  if (!stripForSpeech(text)) return false;
  if (canBrowserSpeak()) return speakBrowser(text, lang);
  void speakRemote(text, onError);
  return true;
}

function listenError(code: string): string | null {
  if (code === "aborted") return null;
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "Allow the microphone in your browser, then tap the mic again.";
  }
  if (code === "no-speech") return "Did not hear anything. Tap the mic and speak again.";
  if (code === "audio-capture") return "No microphone found.";
  if (code === "network") return "Voice typing needs an internet connection.";
  return "Could not hear that. Type it, or try the mic again.";
}

function startWebSpeech(opts: {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  continuous?: boolean;
  lang?: string;
}): ListenHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang || "en-IN";
  rec.continuous = Boolean(opts.continuous);
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let wanted = true;

  rec.onstart = () => opts.onStart?.();
  rec.onerror = (ev) => {
    wanted = false;
    const message = listenError(String(ev.error || ""));
    if (message) opts.onError?.(message);
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed") wanted = false;
  };
  rec.onresult = (ev) => {
    let interim = "";
    let finals = "";
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const piece = ev.results[i];
      const text = piece[0]?.transcript || "";
      if (piece.isFinal) finals += `${text} `;
      else interim += text;
    }
    if (interim) opts.onInterim?.(interim.trim());
    const done = finals.trim();
    if (done) opts.onFinal(done);
  };
  rec.onend = () => {
    if (wanted && opts.continuous) {
      try {
        rec.start();
        return;
      } catch {
        /* already started */
      }
    }
    wanted = false;
    opts.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    opts.onError?.("Microphone is already in use. Tap stop, then try again.");
    opts.onEnd?.();
    return null;
  }

  return {
    stop() {
      wanted = false;
      try {
        rec.stop();
      } catch {
        rec.abort();
      }
    },
  };
}

function pickRecorderType(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function startRecorder(opts: {
  lang?: string;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onStatus?: (message: string) => void;
}): ListenHandle | null {
  if (!canRecord()) {
    opts.onError?.("Voice typing needs Chrome or Edge, or microphone access.");
    return null;
  }
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  const chunks: Blob[] = [];
  let stopped = false;
  let recordingTimer: ReturnType<typeof setTimeout> | undefined;
  const permissionTimer = setTimeout(() => {
    stopped = true;
    opts.onError?.("Microphone access is blocked or still waiting for permission. Open this page in Chrome or Edge and allow microphone access.");
    opts.onEnd?.();
  }, 15000);

  void navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((mic) => {
      clearTimeout(permissionTimer);
      if (stopped) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = mic;
      recorder = new MediaRecorder(mic, pickRecorderType() ? { mimeType: pickRecorderType() } : undefined);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        clearTimeout(recordingTimer);
        mic.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
        if (blob.size < 200) {
          opts.onError?.("Did not hear anything. Tap the mic and speak again.");
          opts.onEnd?.();
          return;
        }
        const fd = new FormData();
        fd.append("file", blob, blob.type.includes("mp4") ? "speech.mp4" : "speech.webm");
        fd.append("language", opts.lang?.startsWith("hi") ? "hi" : "en");
        opts.onStatus?.("Transcribing your recording…");
        fetch("/api/transcribe", { method: "POST", body: fd, signal: AbortSignal.timeout(30000) })
          .then(async (res) => {
            const data = (await res.json()) as { text?: string; error?: string };
            if (!res.ok || !data.text) throw new Error(data.error || "Could not transcribe that.");
            opts.onFinal(data.text);
          })
          .catch((e) => opts.onError?.(e instanceof Error ? e.message : "Could not transcribe that."))
          .finally(() => opts.onEnd?.());
      };
      recorder.start();
      recordingTimer = setTimeout(() => { if (recorder?.state === "recording") recorder.stop(); }, 60000);
      opts.onStart?.();
    })
    .catch(() => {
      clearTimeout(permissionTimer);
      clearTimeout(recordingTimer);
      stream?.getTracks().forEach((track) => track.stop());
      opts.onError?.("Allow the microphone, then tap the mic again.");
      opts.onEnd?.();
    });

  return {
    stop() {
      stopped = true;
      clearTimeout(permissionTimer);
      clearTimeout(recordingTimer);
      if (recorder && recorder.state !== "inactive") recorder.stop();
      else {
        stream?.getTracks().forEach((t) => t.stop());
        opts.onEnd?.();
      }
    },
  };
}

export function startListening(opts: {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onStatus?: (message: string) => void;
  continuous?: boolean;
  lang?: string;
}): ListenHandle | null {
  if (!canListen()) {
    opts.onError?.("This browser cannot access voice input. Open this page in Chrome or Edge, or type your report.");
    return null;
  }
  let stopped = false;
  let active: ListenHandle | null = null;
  // Chromium-based embedded browsers may expose Web Speech without an actual
  // recognition service. Prefer configured transcription over that false signal.
  opts.onStart?.();
  opts.onStatus?.("Preparing microphone. Allow access when your browser asks.");
  void fetch("/api/transcribe", { signal: AbortSignal.timeout(5000) })
    .then(response => response.ok ? response.json() : {available:false})
    .catch(() => ({available:false}))
    .then((status: {available?: boolean}) => {
      if (stopped) return;
      if (status.available && canRecord()) active = startRecorder(opts);
      else if (recognitionCtor()) active = startWebSpeech(opts);
      else {
        opts.onError?.("This browser has no speech recognition service. Open the site in Chrome or Edge, or configure cloud voice typing on the server.");
        opts.onEnd?.();
      }
    });
  return { stop() { stopped = true; if (active) active.stop(); else opts.onEnd?.(); } };
}
