"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Mic, Plus, RotateCcw, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { api } from "@/lib/api";
import { trustChipClass, trustChipLabel } from "@/lib/utils";
import type { MemoryCard, MemorySpace, TalkResponse, TrustChip } from "@/types";

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
}

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
    api.listMemories(spaceId).then((data) => {
      const all = data as MemoryCard[];
      setMemories(all.filter((memory) => memoryIds.includes(memory.id)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [memoryIds, spaceId]);

  return (
    <motion.aside
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 z-50 flex h-full w-[22rem] max-w-[92vw] flex-col overflow-y-auto border-l border-border-subtle bg-surface-1 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border-subtle p-5">
        <h2 className="font-serif text-2xl text-text-primary">Source Memories</h2>
        <button onClick={onClose} className="icon-button" title="Close source drawer">
          <X size={17} />
        </button>
      </div>

      {chip && (
        <div className="px-5 pt-4">
          <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${trustChipClass(chip)}`}>
            {trustChipLabel(chip)}
          </span>
        </div>
      )}

      <div className="flex-1 p-5">
        {loading && <p className="text-sm text-text-muted">Loading sources...</p>}
        {!loading && memories.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-text-muted">No specific memory sources found.</p>
            <p className="mt-2 text-xs text-text-muted">This reply was generated from tone and style signals.</p>
          </div>
        )}
        <div className="space-y-4">
          {memories.map((memory) => (
            <div key={memory.id} className="panel-muted p-4">
              <h3 className="mb-2 text-sm font-medium text-text-primary">{memory.title}</h3>
              <p className="mb-3 text-xs leading-5 text-text-secondary">{memory.summary}</p>
              {memory.source_quote && (
                <blockquote className="border-l-2 border-gold-mid pl-3 text-xs italic leading-5 text-gold-bright">
                  &quot;{memory.source_quote}&quot;
                </blockquote>
              )}
              <div className="mt-3 flex flex-wrap gap-1">
                {memory.themes?.slice(0, 3).map((theme) => (
                  <span key={theme} className="rounded-md border border-blue-mid/20 bg-blue-mid/10 px-2 py-1 text-xs text-blue-bright">
                    {theme}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-text-muted">Confidence: {Math.round(memory.confidence * 100)}%</p>
            </div>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}

function PendingMemoryForm({ spaceId, trigger, onClose }: { spaceId: string; trigger: string; onClose: () => void }) {
  const [title, setTitle] = useState(`Memory about: ${trigger.slice(0, 60)}`);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.createPendingMemory(spaceId, { title, description: trigger });
      onClose();
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel-muted mt-3 p-4">
      <p className="mb-3 text-xs font-semibold text-gold-bright">Save this memory for review</p>
      <input className="input-dark mb-2 py-2 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Memory title" />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-gold px-3 py-2 text-xs">
          {saving ? "Saving..." : "Preserve it"}
        </button>
        <button onClick={onClose} className="btn-ghost px-3 py-2 text-xs">Cancel</button>
      </div>
    </div>
  );
}

function MicButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled: boolean }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => typeof window !== "undefined" && !!getSpeechRecognition());
  const recognitionRef = useRef<{ stop(): void } | null>(null);

  const toggle = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
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
      className={`icon-button ${listening ? "border-red-400/40 bg-red-400/15 text-red-200" : ""}`}
    >
      {listening ? <span className="h-3 w-3 rounded-sm bg-red-300" /> : <Mic size={17} />}
    </button>
  );
}

function useTTS(spaceId: string) {
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  const speakBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) =>
      voice.lang.startsWith("en") && (voice.name.includes("Female") || voice.name.includes("Samantha") || voice.name.includes("Google"))
    );
    if (preferred) utterance.voice = preferred;

    utteranceRef.current = utterance;
    setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string, voiceId?: string) => {
    if (!voiceEnabled) return;
    stopSpeaking();

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/memory-spaces/${spaceId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice_id: voiceId }),
      });

      if (response.ok) {
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("audio")) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          setSpeaking(true);
          audio.onended = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => setSpeaking(false);
          await audio.play();
          return;
        }

        const data = await response.json().catch(() => null);
        if (data?.use_browser_tts) {
          speakBrowser(text);
          return;
        }
      }
    } catch {}

    speakBrowser(text);
  }, [spaceId, speakBrowser, stopSpeaking, voiceEnabled]);

  return { speak, stopSpeaking, speaking, voiceEnabled, setVoiceEnabled };
}

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
    api.getSpace(id).then((data) => setSpace(data as MemorySpace)).catch(() => {});
    api.getElevenLabsStatus()
      .then((data) => setElConfigured(Boolean((data as { configured?: boolean }).configured)))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (userMsg: string) => {
    if (!userMsg.trim() || sending) return;
    setSending(true);
    setOllamaError(null);
    stopSpeaking();

    const tempId = Date.now().toString();
    setMessages((current) => [...current, { id: tempId, role: "user", content: userMsg, timestamp: new Date() }]);

    try {
      const response = await api.talk(id, {
        message: userMsg,
        conversation_id: convId ?? undefined,
        tts: false,
      }) as TalkResponse;

      if (response.error || response.ollama_not_connected) {
        setOllamaError(response.setup_instruction || response.error || "Ollama not connected.");
        return;
      }

      if (response.conversation_id) setConvId(response.conversation_id);

      if (response.reply) {
        const presenceMsg: ChatMessage = {
          id: `${Date.now()}-p`,
          role: "presence",
          content: response.reply.content,
          trust_chip: response.reply.trust_chip,
          source_memory_ids: response.reply.source_memory_ids,
          is_unknown: response.reply.is_unknown,
          is_safety_redirect: response.reply.is_safety_redirect,
          model_used: response.reply.model_used,
          timestamp: new Date(),
        };
        setMessages((current) => [...current, presenceMsg]);
        speak(response.reply.content);
      }
    } catch (err: unknown) {
      setOllamaError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
      setInput("");
    }
  }, [convId, id, sending, speak, stopSpeaking]);

  const send = () => {
    const message = input.trim();
    if (message) sendMessage(message);
  };

  return (
    <div className="relative flex h-screen flex-col">
      <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border-subtle bg-bg-primary/84 px-8 py-4 backdrop-blur-xl">
        <div>
          <p className="page-kicker">Talk</p>
          <h1 className="font-serif text-3xl text-text-primary">Talk with {space?.presence_name || "..."}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="voice-toggle-btn"
            onClick={() => {
              setVoiceEnabled((enabled) => !enabled);
              stopSpeaking();
            }}
            title={voiceEnabled ? "Voice on. Click to mute." : "Voice off. Click to enable."}
            className={`btn-ghost px-3 py-2 text-xs ${voiceEnabled ? "border-border-gold text-gold-bright" : ""}`}
          >
            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {speaking ? "Speaking..." : voiceEnabled ? "Voice On" : "Voice Off"}
          </button>
          {voiceEnabled && (
            <span className={`rounded-md border px-2 py-1 text-xs ${elConfigured ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-border-subtle text-text-muted"}`}>
              {elConfigured ? "ElevenLabs" : "Browser"}
            </span>
          )}
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className={`h-2 w-2 rounded-sm ${ollamaError ? "bg-red-300" : "bg-sage-mid"}`} />
            {ollamaError ? "Ollama issue" : "Gemma 4 ready"}
          </span>
        </div>
      </header>

      {ollamaError && (
        <div className="mx-8 mt-4 flex-shrink-0 rounded-lg border border-red-400/25 bg-red-400/10 p-4 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-red-200">
            <AlertTriangle size={16} />
            Ollama not connected
          </p>
          <p className="text-xs text-text-secondary">{ollamaError}</p>
        </div>
      )}

      <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
        {messages.length === 0 && (
          <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-border-gold bg-gold-glow text-gold-bright">
              <Sparkles size={24} />
            </div>
            <h2 className="font-serif text-3xl text-text-primary">
              {space?.presence_name ? `Talk with ${space.presence_name}` : "Begin the conversation"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Ask naturally. Replies are grounded in approved memories and marked with trust chips.
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div key={message.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-xl flex-col gap-1.5 ${message.role === "user" ? "items-end" : "items-start"}`}>
                {message.role === "presence" && (
                  <span className="px-1 text-xs text-text-muted">{space?.presence_name || "Presence"}</span>
                )}
                <div className={`px-5 py-4 text-sm leading-7 ${message.role === "user" ? "message-user text-text-primary" : "message-presence text-text-secondary"}`}>
                  {message.content}
                </div>

                {message.role === "presence" && (
                  <div className="flex items-center gap-3 px-1">
                    {message.trust_chip && (
                      <button
                        onClick={() => setDrawer({ memoryIds: message.source_memory_ids || [], chip: message.trust_chip })}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-85 ${trustChipClass(message.trust_chip)}`}
                      >
                        {trustChipLabel(message.trust_chip)}
                      </button>
                    )}
                    {voiceEnabled && (
                      <button onClick={() => speak(message.content)} title="Replay this response" className="text-text-muted transition-colors hover:text-gold-bright">
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {message.model_used && <span className="text-xs text-text-muted opacity-60">{message.model_used}</span>}
                  </div>
                )}

                {message.role === "presence" && message.is_unknown && (
                  <div className="mt-1">
                    {pendingFor === message.id ? (
                      <PendingMemoryForm
                        spaceId={id}
                        trigger={messages[index - 1]?.content || ""}
                        onClose={() => setPendingFor(null)}
                      />
                    ) : (
                      <button onClick={() => setPendingFor(message.id)} className="flex items-center gap-1 text-xs text-gold-bright hover:underline">
                        <Plus size={13} />
                        Help preserve this memory
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
            <div className="message-presence flex items-center gap-2 px-5 py-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-1.5 w-1.5 animate-bounce rounded-sm bg-gold-mid" style={{ animationDelay: `${item * 0.15}s` }} />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t border-border-subtle bg-bg-primary/88 px-8 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <MicButton
            onTranscript={(transcript) => {
              setInput(transcript);
              setTimeout(() => sendMessage(transcript), 300);
            }}
            disabled={sending}
          />
          <input
            id="talk-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && send()}
            placeholder={`Say something to ${space?.presence_name || "them"}...`}
            className="input-dark flex-1"
            disabled={sending}
          />
          <button id="talk-send-btn" onClick={send} disabled={sending || !input.trim()} className="btn-gold px-4">
            <Send size={17} />
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-text-muted">
          Responses are grounded in approved memories. Gemma 4 E2B runs locally through Ollama.
        </p>
      </div>

      <AnimatePresence>
        {drawer && (
          <>
            <div className="fixed inset-0 z-40 bg-black/45" onClick={() => setDrawer(null)} />
            <SourceDrawer memoryIds={drawer.memoryIds} spaceId={id} chip={drawer.chip} onClose={() => setDrawer(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
