"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { trustChipLabel, trustChipClass } from "@/lib/utils";
import type { MemorySpace, TalkResponse, MemoryCard, TrustChip } from "@/types";

// ─── Web Speech API type helpers ──────────────────────────────────────────────
type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
    .SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
    .webkitSpeechRecognition || null;
}

interface ChatMessage {
  id: string;
  role: "user" | "presence";
  content: string;
  trust_chip?: TrustChip;
  source_memory_ids?: string[];
  is_unknown?: boolean;
  is_safety_redirect?: boolean;
  model_used?: string;
  timestamp: Date;
  via_voice?: boolean;
}

// ─── Source Drawer ───────────────────────────────────────────────────────────
interface SourceDrawerProps {
  memoryIds: string[];
  spaceId: string;
  chip?: TrustChip;
  onClose: () => void;
}

function SourceDrawer({ memoryIds, spaceId, chip, onClose }: SourceDrawerProps) {
  const [memories, setMemories] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listMemories(spaceId).then(data => {
      const all = data as MemoryCard[];
      setMemories(all.filter(m => memoryIds.includes(m.id)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [memoryIds, spaceId]);

  return (
    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-80 z-50 overflow-y-auto flex flex-col"
      style={{ background: "#111318", borderLeft: "1px solid rgba(201,154,69,0.15)", boxShadow: "-20px 0 60px rgba(0,0,0,0.5)" }}>
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "rgba(201,154,69,0.1)" }}>
        <h2 className="font-serif text-lg text-text-primary">Source Memories</h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors text-lg">✕</button>
      </div>

      {chip && (
        <div className="px-5 pt-4">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${trustChipClass(chip)}`}>
            {trustChipLabel(chip)}
          </span>
        </div>
      )}

      <div className="p-5 flex-1">
        {loading && <p className="text-text-muted text-sm">Loading sources...</p>}
        {!loading && memories.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">No specific memory sources found.</p>
            <p className="text-xs text-text-muted mt-2">This reply was generated from tone and style signals.</p>
          </div>
        )}
        <div className="space-y-4">
          {memories.map(m => (
            <div key={m.id} className="rounded-xl p-4" style={{ background: "rgba(201,154,69,0.05)", border: "1px solid rgba(201,154,69,0.12)" }}>
              <h3 className="text-sm font-medium text-text-primary mb-2">{m.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-3">{m.summary}</p>
              {m.source_quote && (
                <blockquote className="border-l-2 pl-3 text-xs text-gold-dim italic"
                  style={{ borderColor: "#C99A45" }}>
                  "{m.source_quote}"
                </blockquote>
              )}
              <div className="flex flex-wrap gap-1 mt-3">
                {m.themes?.slice(0, 3).map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "rgba(56,163,255,0.06)", border: "1px solid rgba(56,163,255,0.1)", color: "#64B5FF" }}>{t}</span>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-2">Confidence: {Math.round(m.confidence * 100)}%</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Pending Memory Form ─────────────────────────────────────────────────────
function PendingMemoryForm({ spaceId, trigger, onClose }: { spaceId: string; trigger: string; onClose: () => void }) {
  const [form, setForm] = useState({ title: `Memory about: ${trigger.slice(0, 60)}`, description: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.createPendingMemory(spaceId, { title: form.title, description: trigger });
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="p-4 rounded-xl mt-3" style={{ background: "rgba(201,154,69,0.05)", border: "1px solid rgba(201,154,69,0.15)" }}>
      <p className="text-xs text-gold-dim font-medium mb-3">Save this memory</p>
      <input className="input-dark text-xs py-2 mb-2" value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Memory title" />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-gold text-xs py-1.5 px-3">
          {saving ? "Saving..." : "Preserve it"}
        </button>
        <button onClick={onClose} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
      </div>
    </div>
  );
}

// ─── Mic Button ──────────────────────────────────────────────────────────────
function MicButton({ onTranscript, disabled }: { onTranscript: (t: string) => void; disabled: boolean }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<{ stop(): void } | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const toggle = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onTranscript(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, onTranscript]);


  if (!supported) return null;

  return (
    <button
      id="mic-btn"
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Stop listening" : "Speak your message"}
      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: listening
          ? "rgba(239,68,68,0.15)"
          : "rgba(201,154,69,0.08)",
        border: `1px solid ${listening ? "rgba(239,68,68,0.4)" : "rgba(201,154,69,0.2)"}`,
        boxShadow: listening ? "0 0 12px rgba(239,68,68,0.3)" : "none",
      }}
    >
      {listening ? (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-3 h-3 rounded-full bg-red-400"
        />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" className="text-gold-dim">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}

// ─── TTS Hook ────────────────────────────────────────────────────────────────
function useTTS(spaceId: string) {
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(async (text: string, voiceId?: string) => {
    if (!voiceEnabled) return;
    stopSpeaking();

    try {
      // Try backend TTS (ElevenLabs if configured)
      const resp = await fetch(`/api/memory-spaces/${spaceId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice_id: voiceId }),
      });

      if (resp.ok) {
        const contentType = resp.headers.get("Content-Type") || "";
        if (contentType.includes("audio")) {
          // ElevenLabs audio blob
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          setSpeaking(true);
          audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
          audio.onerror = () => setSpeaking(false);
          await audio.play();
          return;
        }
        // JSON response → use_browser_tts: true
        const data = await resp.json();
        if (data.use_browser_tts) {
          speakBrowser(text);
        }
      }
    } catch {
      // Fallback to browser TTS
      speakBrowser(text);
    }
  }, [voiceEnabled, spaceId]);

  const speakBrowser = (text: string) => {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    // Pick a warm voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Google"))
    );
    if (preferred) utter.voice = preferred;
    utteranceRef.current = utter;
    setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const stopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return { speak, stopSpeaking, speaking, voiceEnabled, setVoiceEnabled };
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function TalkPage() {
  const { id } = useParams<{ id: string }>();
  const [space, setSpace] = useState<MemorySpace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ memoryIds: string[]; chip?: TrustChip } | null>(null);
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [elConfigured, setElConfigured] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { speak, stopSpeaking, speaking, voiceEnabled, setVoiceEnabled } = useTTS(id);

  useEffect(() => {
    api.getSpace(id).then(s => setSpace(s as MemorySpace)).catch(() => {});
    // Check if ElevenLabs is configured (for the voice mode indicator)
    fetch("/api/app-settings/elevenlabs")
      .then(r => r.json())
      .then(d => setElConfigured(d.configured))
      .catch(() => {});
  }, [id]);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (userMsg: string) => {
    if (!userMsg.trim() || sending) return;
    setSending(true);
    setOllamaError(null);
    stopSpeaking(); // stop any current speech when user sends

    const tempId = Date.now().toString();
    setMessages(m => [...m, { id: tempId, role: "user", content: userMsg, timestamp: new Date() }]);

    try {
      const res = await api.talk(id, {
        message: userMsg,
        conversation_id: convId ?? undefined,
        tts: false, // STT/TTS handled client-side
      }) as TalkResponse;

      if (res.error || res.ollama_not_connected) {
        setOllamaError(res.setup_instruction || res.error || "Ollama not connected.");
        return;
      }

      if (res.conversation_id) setConvId(res.conversation_id);

      if (res.reply) {
        const presenceMsg: ChatMessage = {
          id: Date.now().toString() + "-p",
          role: "presence",
          content: res.reply.content,
          trust_chip: res.reply.trust_chip,
          source_memory_ids: res.reply.source_memory_ids,
          is_unknown: res.reply.is_unknown,
          is_safety_redirect: res.reply.is_safety_redirect,
          model_used: res.reply.model_used,
          timestamp: new Date(),
        };
        setMessages(m => [...m, presenceMsg]);

        // Auto-speak the response if voice is enabled
        if (voiceEnabled) {
          speak(res.reply.content);
        }
      }
    } catch (err: unknown) {
      setOllamaError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
      setInput("");
    }
  }, [sending, id, convId, voiceEnabled, speak, stopSpeaking]);

  const send = () => {
    const msg = input.trim();
    if (msg) sendMessage(msg);
  };

  return (
    <div className="flex flex-col h-screen relative">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ background: "rgba(5,7,11,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(201,154,69,0.1)" }}>
        <div>
          <h1 className="font-serif text-2xl text-text-primary">
            Talk with {space?.presence_name || "..."}
          </h1>
          <p className="text-xs text-text-muted">Powered by Gemma 4 · Local · Private</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Voice toggle */}
          <div className="flex items-center gap-2">
            <button
              id="voice-toggle-btn"
              onClick={() => { setVoiceEnabled(v => !v); stopSpeaking(); }}
              title={voiceEnabled ? "Voice on — click to mute" : "Voice off — click to enable"}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                background: voiceEnabled ? "rgba(201,154,69,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${voiceEnabled ? "rgba(201,154,69,0.3)" : "rgba(255,255,255,0.08)"}`,
                color: voiceEnabled ? "#C99A45" : "#6B7280",
              }}
            >
              {speaking ? (
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}>🔊</motion.span>
              ) : voiceEnabled ? "🔊" : "🔇"}
              <span>{speaking ? "Speaking..." : voiceEnabled ? "Voice On" : "Voice Off"}</span>
            </button>
            {voiceEnabled && (
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: elConfigured ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.04)",
                  color: elConfigured ? "#34D399" : "#6B7280",
                  border: `1px solid ${elConfigured ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}>
                {elConfigured ? "ElevenLabs" : "Browser"}
              </span>
            )}
          </div>


          {/* Ollama status */}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: ollamaError ? "#EF4444" : "#34D399" }} />
            {ollamaError ? "Ollama not connected" : "Gemma 4 ready"}
          </div>
        </div>
      </div>

      {/* Ollama error banner */}
      {ollamaError && (
        <div className="mx-8 mt-4 p-4 rounded-xl text-sm flex-shrink-0"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-red-400 font-medium mb-1">⚠ Ollama not connected</p>
          <p className="text-text-secondary text-xs">{ollamaError}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-20">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="text-6xl mb-4"
            >✦</motion.div>
            <h2 className="font-serif text-2xl text-text-primary mb-2">
              {space?.presence_name ? `Talk with ${space.presence_name}` : "Begin the conversation"}
            </h2>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-4">
              Speak naturally. Ask anything. Their presence will respond from their memories.
            </p>
            <p className="text-xs text-text-muted">
              {voiceEnabled
                ? "🎤 Click the mic to speak, or type below · 🔊 Replies will be spoken aloud"
                : "Type your message below · Enable voice for spoken replies"}
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xl ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
                {msg.role === "presence" && (
                  <span className="text-xs text-text-muted px-1">
                    {space?.presence_name || "Presence"}
                  </span>
                )}
                <div className={`px-5 py-4 text-sm leading-relaxed ${msg.role === "user" ? "message-user text-text-primary" : "message-presence text-text-secondary"}`}>
                  {msg.content}
                </div>

                {/* Actions row for presence messages */}
                {msg.role === "presence" && (
                  <div className="flex items-center gap-3 px-1">
                    {/* Trust chip */}
                    {msg.trust_chip && (
                      <button onClick={() => setDrawer({ memoryIds: msg.source_memory_ids || [], chip: msg.trust_chip })}
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-opacity hover:opacity-80 cursor-pointer ${trustChipClass(msg.trust_chip)}`}>
                        {trustChipLabel(msg.trust_chip)}
                      </button>
                    )}

                    {/* Replay audio for this message */}
                    {voiceEnabled && (
                      <button
                        onClick={() => speak(msg.content)}
                        title="Replay this response"
                        className="text-xs text-text-muted hover:text-gold-dim transition-colors"
                      >
                        ↻
                      </button>
                    )}

                    {msg.model_used && (
                      <span className="text-xs text-text-muted opacity-50">{msg.model_used}</span>
                    )}
                  </div>
                )}

                {/* Unknown memory — invite to save */}
                {msg.role === "presence" && msg.is_unknown && (
                  <div className="mt-1">
                    {pendingFor === msg.id ? (
                      <PendingMemoryForm spaceId={id}
                        trigger={messages[messages.indexOf(msg) - 1]?.content || ""}
                        onClose={() => setPendingFor(null)} />
                    ) : (
                      <button onClick={() => setPendingFor(msg.id)}
                        className="text-xs text-gold-dim hover:underline">
                        + Help preserve this memory
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="message-presence px-5 py-4 flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-gold-dim animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-8 py-5"
        style={{ background: "rgba(5,7,11,0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(201,154,69,0.1)" }}>
        <div className="flex gap-3 max-w-3xl mx-auto items-center">
          {/* Mic button (STT) */}
          <MicButton
            onTranscript={(t) => {
              setInput(t);
              // Auto-send after brief delay so user sees the transcript
              setTimeout(() => sendMessage(t), 300);
            }}
            disabled={sending}
          />

          {/* Text input */}
          <input
            id="talk-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={`Say something to ${space?.presence_name || "them"}...`}
            className="input-dark flex-1"
            disabled={sending}
          />

          {/* Send button */}
          <button
            id="talk-send-btn"
            onClick={send}
            disabled={sending || !input.trim()}
            className="btn-gold px-6 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "●" : "→"}
          </button>
        </div>

        <p className="text-center text-xs text-text-muted mt-3">
          {voiceEnabled
            ? "🎤 Mic · 🔊 Voice replies · Responses grounded in approved memories · Gemma 4 E2B · Private"
            : "Responses grounded in approved memories · Gemma 4 E2B · Local and private"}
        </p>
      </div>

      {/* Source drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDrawer(null)} />
            <SourceDrawer memoryIds={drawer.memoryIds} spaceId={id} chip={drawer.chip}
              onClose={() => setDrawer(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
