"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

interface ElevenLabsStatus {
  configured: boolean;
  voice_id_set: boolean;
  voice_id: string | null;
  key_preview: string | null;
}

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ElevenLabs state
  const [elStatus, setElStatus] = useState<ElevenLabsStatus | null>(null);
  const [elKey, setElKey] = useState("");
  const [elSaving, setElSaving] = useState(false);
  const [elSaved, setElSaved] = useState(false);
  const [elError, setElError] = useState<string | null>(null);
  const [elDeleting, setElDeleting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    api.getSettings(id).then(s => setSettings(s as Record<string, string>)).catch(() => {});
    fetchElStatus();
  }, [id]);

  const fetchElStatus = async () => {
    try {
      const res = await fetch("/api/app-settings/elevenlabs");
      if (res.ok) setElStatus(await res.json());
    } catch {}
  };

  const set = (k: string, v: string) => setSettings(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings(id, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  const saveElKey = async () => {
    if (!elKey.trim()) return;
    setElSaving(true);
    setElError(null);
    try {
      const res = await fetch("/api/app-settings/elevenlabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: elKey.trim() }),
      });
      const data = await res.json();
      if (data.error) { setElError(data.error); return; }
      setElKey("");
      setElSaved(true);
      setTimeout(() => setElSaved(false), 2000);
      fetchElStatus();
    } catch { setElError("Failed to save key"); } finally { setElSaving(false); }
  };

  const deleteElKey = async () => {
    if (!confirm("Remove ElevenLabs API key? Voice will revert to browser Web Speech.")) return;
    setElDeleting(true);
    try {
      await fetch("/api/app-settings/elevenlabs", { method: "DELETE" });
      setElStatus(s => s ? { ...s, configured: false, voice_id_set: false, key_preview: null } : null);
    } catch {} finally { setElDeleting(false); }
  };

  const toggleKeys = [
    { key: "block_medical_advice", label: "Block medical & legal advice requests" },
    { key: "block_financial_advice", label: "Block financial advice requests" },
    { key: "block_explicit_content", label: "Block explicit content" },
  ];

  return (
    <div className="p-10 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="font-serif text-4xl text-text-primary mb-2">Settings</h1>
          <p className="text-text-secondary text-sm">Manage safety boundaries, voice, and data.</p>
        </div>

        {/* ── Voice Mode ─────────────────────────────────────────── */}
        <div className="card-glass p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-serif text-lg text-text-primary">Voice Mode</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              elStatus?.configured
                ? "text-green-400 bg-green-400/10 border border-green-400/20"
                : "text-text-muted bg-white/4 border border-white/8"
            }`}>
              {elStatus?.configured ? "ElevenLabs Active" : "Browser Voice"}
            </span>
          </div>
          <p className="text-xs text-text-muted mb-5">
            Without a key: browser Web Speech is used (free, built-in Chrome).<br />
            With ElevenLabs: the persona speaks in their <span className="text-gold-dim">real cloned voice</span>.
          </p>

          {elStatus?.configured ? (
            /* Key is set */
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div className="flex-1">
                  <p className="text-xs text-green-400 font-medium">ElevenLabs API key configured</p>
                  <p className="text-xs text-text-muted mt-0.5">Key ending in {elStatus.key_preview}</p>
                </div>
                <button
                  onClick={deleteElKey}
                  disabled={elDeleting}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
                >
                  {elDeleting ? "Removing..." : "Remove key"}
                </button>
              </div>

              {elStatus.voice_id_set && (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="text-gold-dim">🎙</span>
                  Voice clone active — voice ID: <code className="text-gold-dim">{elStatus.voice_id}</code>
                </div>
              )}
              {!elStatus.voice_id_set && (
                <p className="text-xs text-text-muted">
                  No voice clone set yet. Upload audio samples in Capture Studio, then use the
                  clone-voice API to generate a voice ID.
                </p>
              )}
            </div>
          ) : (
            /* No key set */
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(201,154,69,0.04)", border: "1px solid rgba(201,154,69,0.12)" }}>
                <div className="w-2 h-2 rounded-full bg-text-muted" />
                <p className="text-xs text-text-muted flex-1">
                  Voice mode uses browser Web Speech — robotic but free. Add an ElevenLabs key for real voice.
                </p>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1.5 block">
                  ElevenLabs API key{" "}
                  <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer"
                    className="text-gold-dim hover:underline">
                    Get free key →
                  </a>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="el-api-key-input"
                      type={showKey ? "text" : "password"}
                      value={elKey}
                      onChange={e => setElKey(e.target.value)}
                      placeholder="sk_..."
                      className="input-dark w-full pr-10 text-sm"
                      onKeyDown={e => e.key === "Enter" && saveElKey()}
                    />
                    <button
                      onClick={() => setShowKey(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
                    >
                      {showKey ? "hide" : "show"}
                    </button>
                  </div>
                  <button
                    id="el-save-key-btn"
                    onClick={saveElKey}
                    disabled={elSaving || !elKey.trim()}
                    className="btn-gold text-sm px-4 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {elSaved ? "✓ Saved" : elSaving ? "Saving..." : "Save"}
                  </button>
                </div>
                {elError && <p className="text-xs text-red-400 mt-1.5">{elError}</p>}
                <p className="text-xs text-text-muted mt-1.5">
                  Stored locally in your database. Never shared externally.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Safety Boundaries ──────────────────────────────────── */}
        <div className="card-glass p-6">
          <h2 className="font-serif text-lg text-text-primary mb-4">Safety Boundaries</h2>
          <div className="space-y-4">
            {toggleKeys.map(t => {
              const enabled = settings[t.key] !== "false";
              return (
                <label key={t.key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-text-secondary">{t.label}</span>
                  <div onClick={() => set(t.key, enabled ? "false" : "true")}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${enabled ? "bg-gold-dim" : "bg-surface-2"}`}
                    style={{ border: "1px solid rgba(201,154,69,0.3)" }}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${enabled ? "left-5 bg-bg-primary" : "left-0.5 bg-text-muted"}`} />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Data Management ────────────────────────────────────── */}
        <div className="card-glass p-6">
          <h2 className="font-serif text-lg text-text-primary mb-4">Data</h2>
          <div className="space-y-3 text-sm text-text-secondary">
            <p>All data is stored locally on your device. Nothing is sent to external servers except ElevenLabs TTS (if configured).</p>
            <p>Gemma 4 runs entirely on your machine via Ollama.</p>
            <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <button className="text-red-400 text-xs hover:underline">
                Delete this memory space and all data
              </button>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="btn-gold w-full py-3 flex items-center justify-center gap-2">
          {saved ? "✓ Saved" : saving ? "Saving..." : "Save Settings"}
        </button>
      </motion.div>
    </div>
  );
}
