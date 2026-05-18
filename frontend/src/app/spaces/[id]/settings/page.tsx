"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Database, Eye, EyeOff, Save, ShieldCheck, Trash2, Volume2 } from "lucide-react";
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

  const [elStatus, setElStatus] = useState<ElevenLabsStatus | null>(null);
  const [elKey, setElKey] = useState("");
  const [elSaving, setElSaving] = useState(false);
  const [elSaved, setElSaved] = useState(false);
  const [elError, setElError] = useState<string | null>(null);
  const [elDeleting, setElDeleting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const fetchElStatus = async () => {
    try {
      setElStatus(await api.getElevenLabsStatus() as ElevenLabsStatus);
    } catch {}
  };

  useEffect(() => {
    api.getSettings(id).then((data) => setSettings(data as Record<string, string>)).catch(() => {});
    api.getElevenLabsStatus()
      .then((data) => setElStatus(data as ElevenLabsStatus))
      .catch(() => {});
  }, [id]);

  const setSetting = (key: string, value: string) => setSettings((previous) => ({ ...previous, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings(id, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally {
      setSaving(false);
    }
  };

  const saveElKey = async () => {
    if (!elKey.trim()) return;
    setElSaving(true);
    setElError(null);
    try {
      const data = await api.saveElevenLabsKey(elKey.trim()) as { error?: string };
      if (data.error) {
        setElError(data.error);
        return;
      }
      setElKey("");
      setElSaved(true);
      setTimeout(() => setElSaved(false), 2000);
      fetchElStatus();
    } catch {
      setElError("Failed to save key");
    } finally {
      setElSaving(false);
    }
  };

  const deleteElKey = async () => {
    if (!confirm("Remove ElevenLabs API key? Voice will revert to browser Web Speech.")) return;
    setElDeleting(true);
    try {
      await api.deleteElevenLabsKey();
      setElStatus((status) => status ? { ...status, configured: false, voice_id_set: false, key_preview: null } : null);
    } catch {} finally {
      setElDeleting(false);
    }
  };

  const toggleKeys = [
    { key: "block_medical_advice", label: "Block medical and legal advice requests" },
    { key: "block_financial_advice", label: "Block financial advice requests" },
    { key: "block_explicit_content", label: "Block explicit content" },
  ];

  return (
    <div className="page-surface max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <p className="page-kicker">Settings</p>
          <h1 className="page-title mt-2">Settings</h1>
          <p className="page-subtitle mt-2">Manage voice, safety boundaries, and local data.</p>
        </div>

        <div className="card-glass p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary/60 text-gold-bright">
                <Volume2 size={18} />
              </span>
              <div>
                <h2 className="font-serif text-2xl text-text-primary">Voice Mode</h2>
                <p className="mt-1 text-sm leading-6 text-text-muted">Browser voice works by default. ElevenLabs adds a cloned voice when configured.</p>
              </div>
            </div>
            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
              elStatus?.configured ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-border-subtle text-text-muted"
            }`}>
              {elStatus?.configured ? "ElevenLabs Active" : "Browser Voice"}
            </span>
          </div>

          {elStatus?.configured ? (
            <div className="space-y-4">
              <div className="panel-muted flex items-center gap-3 p-4">
                <div className="h-2.5 w-2.5 rounded-sm bg-emerald-300" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-200">ElevenLabs API key configured</p>
                  <p className="mt-1 text-xs text-text-muted">Key ending in {elStatus.key_preview}</p>
                </div>
                <button onClick={deleteElKey} disabled={elDeleting} className="btn-ghost px-3 py-2 text-xs text-red-200">
                  <Trash2 size={14} />
                  {elDeleting ? "Removing..." : "Remove"}
                </button>
              </div>

              {elStatus.voice_id_set ? (
                <p className="text-xs text-text-muted">
                  Voice clone active. Voice ID: <code className="text-gold-bright">{elStatus.voice_id}</code>
                </p>
              ) : (
                <p className="text-xs leading-5 text-text-muted">
                  No voice clone set yet. Upload audio samples in Capture Studio, then use the clone-voice API to generate a voice ID.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="panel-muted p-4 text-sm leading-6 text-text-muted">
                Voice mode currently uses browser Web Speech. Add an ElevenLabs key for cloned voice output.
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">
                  ElevenLabs API key{" "}
                  <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-gold-bright hover:underline">
                    Get free key
                  </a>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="el-api-key-input"
                      type={showKey ? "text" : "password"}
                      value={elKey}
                      onChange={(e) => setElKey(e.target.value)}
                      placeholder="sk_..."
                      className="input-dark w-full pr-11 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && saveElKey()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((visible) => !visible)}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text-primary"
                      title={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button id="el-save-key-btn" onClick={saveElKey} disabled={elSaving || !elKey.trim()} className="btn-gold flex-shrink-0 px-4 text-sm">
                    {elSaved ? "Saved" : elSaving ? "Saving..." : "Save"}
                  </button>
                </div>
                {elError && <p className="mt-2 text-xs text-red-300">{elError}</p>}
                <p className="mt-2 text-xs text-text-muted">Stored locally in your database.</p>
              </div>
            </div>
          )}
        </div>

        <div className="card-glass p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary/60 text-sage-bright">
              <ShieldCheck size={18} />
            </span>
            <h2 className="font-serif text-2xl text-text-primary">Safety Boundaries</h2>
          </div>
          <div className="space-y-4">
            {toggleKeys.map((toggle) => {
              const enabled = settings[toggle.key] !== "false";
              return (
                <button key={toggle.key} type="button" onClick={() => setSetting(toggle.key, enabled ? "false" : "true")} className="flex w-full items-center justify-between gap-4 text-left">
                  <span className="text-sm text-text-secondary">{toggle.label}</span>
                  <span className={`relative h-6 w-11 rounded-full border transition-colors ${enabled ? "border-gold-mid bg-gold-mid" : "border-border-subtle bg-surface-2"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${enabled ? "left-5 bg-bg-primary" : "left-0.5 bg-text-muted"}`} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-glass p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary/60 text-blue-bright">
              <Database size={18} />
            </span>
            <h2 className="font-serif text-2xl text-text-primary">Data</h2>
          </div>
          <div className="space-y-3 text-sm leading-6 text-text-secondary">
            <p>All memory-space data is stored locally on your device. Gemma 4 runs through Ollama on your machine.</p>
            <p>External services are only used when you configure them, such as ElevenLabs voice.</p>
            <div className="border-t border-border-subtle pt-3">
              <button className="inline-flex items-center gap-2 text-xs text-red-200 transition-colors hover:text-red-100">
                <Trash2 size={14} />
                Delete this memory space and all data
              </button>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="btn-gold w-full py-3">
          <Save size={17} />
          {saved ? "Saved" : saving ? "Saving..." : "Save Settings"}
        </button>
      </motion.div>
    </div>
  );
}
