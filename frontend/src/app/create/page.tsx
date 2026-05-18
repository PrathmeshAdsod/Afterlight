"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, HeartHandshake, Languages, Sparkles, UserRound } from "lucide-react";
import { api } from "@/lib/api";

const RELATIONSHIP_TYPES = [
  "Mother", "Father", "Grandmother", "Grandfather", "Wife", "Husband",
  "Sister", "Brother", "Daughter", "Son", "Aunt", "Uncle",
  "Friend", "Mentor", "Partner", "Other",
];

const LANGUAGES = [
  "English", "Hindi", "Marathi", "Punjabi", "Bengali", "Telugu", "Tamil",
  "Kannada", "Gujarati", "Urdu", "Hinglish", "Multiple / Mixed", "Other",
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

  const handleSubmit = async (e: FormEvent) => {
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
        birth_year: form.birth_year ? parseInt(form.birth_year, 10) : undefined,
        death_year: !form.still_living && form.death_year ? parseInt(form.death_year, 10) : undefined,
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
    <div className="relative min-h-screen overflow-hidden app-shell px-5 py-10">
      <div className="archive-grid" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary">
          <ArrowLeft size={16} />
          Back to Afterlight
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mt-10 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"
        >
          <section className="flex flex-col justify-between rounded-lg border border-border-subtle bg-surface-1/55 p-8">
            <div>
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg border border-border-gold bg-gold-glow text-gold-bright">
                <Sparkles size={22} />
              </span>
              <p className="page-kicker">New Memory Space</p>
              <h1 className="mt-3 font-serif text-5xl text-text-primary">Start with the person.</h1>
              <p className="mt-5 text-sm leading-7 text-text-secondary">
                This creates the private workspace that will hold their media, reviewed memories, timeline, and conversation settings.
              </p>
            </div>
            <div className="mt-10 space-y-3 text-sm text-text-secondary">
              <div className="flex items-center gap-3">
                <UserRound size={17} className="text-sage-mid" />
                Identity and relationship
              </div>
              <div className="flex items-center gap-3">
                <Languages size={17} className="text-blue-mid" />
                Language and context
              </div>
              <div className="flex items-center gap-3">
                <HeartHandshake size={17} className="text-gold-mid" />
                Steward agreement next
              </div>
            </div>
          </section>

          <section className="card-glass p-7 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">Their name</label>
                <input
                  className="input-dark"
                  placeholder="Nani, Dad, Margaret, Rajan..."
                  value={form.presence_name}
                  onChange={(e) => setForm((f) => ({ ...f, presence_name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">Relationship to you</label>
                <select
                  className="input-dark"
                  value={form.relationship_type}
                  onChange={(e) => setForm((f) => ({ ...f, relationship_type: e.target.value }))}
                  required
                >
                  <option value="">Select relationship...</option>
                  {RELATIONSHIP_TYPES.map((relationship) => (
                    <option key={relationship} value={relationship}>{relationship}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">Birth year</label>
                  <input
                    className="input-dark"
                    type="number"
                    placeholder="1938"
                    min="1850"
                    max="2026"
                    value={form.birth_year}
                    onChange={(e) => setForm((f) => ({ ...f, birth_year: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">Passed year</label>
                  <input
                    className="input-dark"
                    type="number"
                    placeholder="2021"
                    min="1850"
                    max="2100"
                    value={form.death_year}
                    disabled={form.still_living}
                    onChange={(e) => setForm((f) => ({ ...f, death_year: e.target.value }))}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, still_living: !f.still_living, death_year: "" }))}
                className="flex w-full items-center gap-3 rounded-lg border border-border-subtle bg-bg-primary/40 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:border-border-gold hover:text-text-primary"
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${form.still_living ? "border-gold-mid bg-gold-mid text-bg-primary" : "border-border-gold"}`}>
                  {form.still_living && <Check size={14} />}
                </span>
                They are still living
              </button>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">Primary language</label>
                <select
                  className="input-dark"
                  value={form.primary_language}
                  onChange={(e) => setForm((f) => ({ ...f, primary_language: e.target.value }))}
                >
                  {LANGUAGES.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">A few details</label>
                <textarea
                  className="input-dark resize-none"
                  rows={4}
                  placeholder="Who they were, what they loved, what made them unmistakably themselves..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-gold w-full py-3.5 text-base">
                {loading ? "Creating..." : "Continue to Agreement"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
