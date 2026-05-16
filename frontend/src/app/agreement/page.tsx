"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";
import { Suspense } from "react";

const CHECKBOXES = [
  { key: "is_authorized_steward", label: "I am an authorized memory steward for this person." },
  { key: "has_upload_rights", label: "I have permission or rights to upload these materials." },
  { key: "understands_preserved_presence", label: "I understand this creates a preserved presence, not a living person." },
  { key: "understands_unsupported_facts", label: "I understand unsupported memories must not be treated as fact." },
  { key: "understands_sensitive_topics", label: "I understand sensitive topics may be blocked or restricted." },
  { key: "allows_persona_adapter", label: "I allow Afterlight to create a private persona adapter from approved memories." },
];

function AgreementForm() {
  const router = useRouter();
  const params = useSearchParams();
  const spaceId = params.get("space_id");

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allChecked = CHECKBOXES.every(c => checked[c.key]);

  const toggle = (key: string) => setChecked(p => ({ ...p, [key]: !p[key] }));

  const handleSubmit = async () => {
    if (!allChecked || !spaceId) return;
    setLoading(true);
    setError("");
    try {
      await api.submitAgreement(spaceId, {
        is_authorized_steward: true,
        has_upload_rights: true,
        understands_preserved_presence: true,
        understands_unsupported_facts: true,
        understands_sensitive_topics: true,
        allows_persona_adapter: true,
      });
      router.push(`/spaces/${spaceId}/capture`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit agreement.");
    } finally {
      setLoading(false);
    }
  };

  if (!spaceId) {
    return (
      <div className="text-center py-20 text-text-secondary">
        No memory space specified. <Link href="/create" className="text-gold-dim underline">Create one first.</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20" style={{ background: "#05070B" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #C99A45 0%, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-lg">

        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-gold-dim mb-8">
            <span>✦</span><span className="font-serif text-lg">Afterlight</span>
          </Link>
          <h1 className="font-serif text-4xl text-text-primary mb-3">Memory Steward Agreement</h1>
          <p className="text-text-secondary text-sm max-w-sm mx-auto">
            Please read and accept each commitment before we begin preserving this presence.
          </p>
        </div>

        <div className="card-glass p-8 mb-4">
          <div className="p-4 rounded-lg mb-6 text-sm text-text-secondary"
            style={{ background: "rgba(201,154,69,0.05)", border: "1px solid rgba(201,154,69,0.15)" }}>
            <p className="font-medium text-gold-dim mb-2">What this creates</p>
            <p>Afterlight creates a <strong className="text-text-primary">preserved presence</strong> from approved memories. It does not recreate consciousness or guarantee unsupported facts.</p>
          </div>

          <div className="space-y-4">
            {CHECKBOXES.map(({ key, label }) => (
              <label key={key} className="flex items-start gap-4 cursor-pointer group" onClick={() => toggle(key)}>
                <div className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${checked[key] ? "bg-gold-dim border-gold-dim" : "border-border-gold group-hover:border-gold-dim"}`}>
                  {checked[key] && <span className="text-bg-primary text-xs font-bold">✓</span>}
                </div>
                <span className="text-sm text-text-secondary leading-relaxed group-hover:text-text-primary transition-colors">
                  {label}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg text-xs text-text-muted"
            style={{ background: "rgba(22,119,255,0.05)", border: "1px solid rgba(56,163,255,0.1)" }}>
            <p className="font-medium text-blue-mid mb-1">About the persona adapter</p>
            <p>The persona adapter learns tone, phrases, values, and response behaviour. Facts remain stored in the reviewable memory graph and source vault — never hidden inside the model.</p>
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm p-3 rounded-lg mb-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={!allChecked || loading}
          className={`w-full py-4 rounded-lg text-base font-semibold transition-all flex items-center justify-center gap-2 ${
            allChecked ? "btn-gold" : "opacity-40 cursor-not-allowed"
          }`}
          style={{ background: allChecked ? undefined : "rgba(201,154,69,0.1)", color: allChecked ? undefined : "#B8AA96",
            border: allChecked ? undefined : "1px solid rgba(201,154,69,0.2)" }}>
          {loading ? "Signing..." : allChecked ? <><span>✓</span> I agree — Begin Capturing Memories</> : `Accept all ${CHECKBOXES.length} items to continue`}
        </button>
      </motion.div>
    </div>
  );
}

export default function AgreementPage() {
  return <Suspense><AgreementForm /></Suspense>;
}
