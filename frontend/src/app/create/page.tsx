"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";

const RELATIONSHIP_TYPES = [
  "Mother","Father","Grandmother","Grandfather","Wife","Husband",
  "Sister","Brother","Daughter","Son","Aunt","Uncle",
  "Friend","Mentor","Partner","Other",
];

const LANGUAGES = [
  "English","Hindi","Marathi","Punjabi","Bengali","Telugu","Tamil",
  "Kannada","Gujarati","Urdu","Hinglish","Multiple / Mixed","Other",
];

export default function CreateSpacePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    presence_name: "",
    relationship_type: "",
    birth_year: "",
    death_year: "",
    still_living: false,
    primary_language: "English",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.presence_name || !form.relationship_type) {
      setError("Please fill in the name and relationship.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const space = await api.createSpace({
        presence_name: form.presence_name,
        relationship_type: form.relationship_type,
        birth_year: form.birth_year ? parseInt(form.birth_year) : undefined,
        death_year: !form.still_living && form.death_year ? parseInt(form.death_year) : undefined,
        still_living: form.still_living,
        primary_language: form.primary_language,
        description: form.description,
      }) as { id: string };
      router.push(`/agreement?space_id=${space.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create memory space. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20" style={{ background: "#05070B" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #C99A45 0%, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-xl">

        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-gold-dim mb-8">
            <span>✦</span><span className="font-serif text-lg">Afterlight</span>
          </Link>
          <h1 className="font-serif text-4xl md:text-5xl text-text-primary mb-3">Create a Memory Space</h1>
          <p className="text-text-secondary text-sm">This space will hold their stories, voice, and presence.</p>
        </div>

        <div className="card-glass p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
                Their name
              </label>
              <input className="input-dark" placeholder="e.g. Nani, Dad, Margaret, Rajan..." value={form.presence_name}
                onChange={e => setForm(f => ({ ...f, presence_name: e.target.value }))} required />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
                Relationship to you
              </label>
              <select className="input-dark" value={form.relationship_type}
                onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))} required
                style={{ appearance: "none" }}>
                <option value="">Select relationship...</option>
                {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
                  Birth year
                </label>
                <input className="input-dark" type="number" placeholder="e.g. 1938" min="1850" max="2025"
                  value={form.birth_year} onChange={e => setForm(f => ({ ...f, birth_year: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
                  {form.still_living ? "—" : "Passed year"}
                </label>
                <input className="input-dark" type="number" placeholder="e.g. 2021" min="1850" max="2100"
                  value={form.death_year} disabled={form.still_living}
                  onChange={e => setForm(f => ({ ...f, death_year: e.target.value }))}
                  style={{ opacity: form.still_living ? 0.4 : 1 }} />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.still_living ? "bg-gold-dim border-gold-dim" : "border-border-gold"}`}
                onClick={() => setForm(f => ({ ...f, still_living: !f.still_living, death_year: "" }))}>
                {form.still_living && <span className="text-bg-primary text-xs font-bold">✓</span>}
              </div>
              <span className="text-sm text-text-secondary">They are still living</span>
            </label>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
                Primary language(s)
              </label>
              <select className="input-dark" value={form.primary_language}
                onChange={e => setForm(f => ({ ...f, primary_language: e.target.value }))}
                style={{ appearance: "none" }}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <p className="text-xs text-text-muted mt-1.5">
                Gemma 4 supports all major languages. Multilingual personas are fully supported.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
                Tell us a little about them (optional)
              </label>
              <textarea className="input-dark resize-none" rows={3}
                placeholder="A brief description — who they were, what they loved, what made them unique..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {error && (
              <div className="text-red-400 text-sm p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-gold w-full text-base py-3.5 flex items-center justify-center gap-2">
              {loading ? "Creating..." : <><span>→</span> Continue to Agreement</>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
