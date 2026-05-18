"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

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

  const allChecked = CHECKBOXES.every((item) => checked[item.key]);
  const toggle = (key: string) => setChecked((previous) => ({ ...previous, [key]: !previous[key] }));

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
      <div className="relative z-10 mx-auto max-w-lg py-24 text-center text-text-secondary">
        No memory space specified.{" "}
        <Link href="/create" className="text-gold-bright underline">
          Create one first.
        </Link>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto max-w-5xl">
      <Link href="/create" className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary">
        <ArrowLeft size={16} />
        Back to details
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="mt-10 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"
      >
        <section className="rounded-lg border border-border-subtle bg-surface-1/55 p-8">
          <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg border border-border-gold bg-gold-glow text-gold-bright">
            <FileCheck2 size={22} />
          </span>
          <p className="page-kicker">Steward Agreement</p>
          <h1 className="mt-3 font-serif text-5xl text-text-primary">Care before capture.</h1>
          <p className="mt-5 text-sm leading-7 text-text-secondary">
            Afterlight preserves memories from evidence you provide and approve. These commitments keep the workspace honest, respectful, and reviewable.
          </p>

          <div className="mt-10 space-y-4">
            <div className="panel-muted flex gap-3 p-4">
              <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-sage-mid" />
              <p className="text-sm leading-6 text-text-secondary">
                Replies should be grounded in approved memories, not treated as a replacement for the person.
              </p>
            </div>
            <div className="panel-muted flex gap-3 p-4">
              <LockKeyhole size={18} className="mt-0.5 flex-shrink-0 text-blue-mid" />
              <p className="text-sm leading-6 text-text-secondary">
                The adapter learns tone and phrasing while source facts remain visible in the memory graph.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="card-glass p-7 md:p-8">
            <div className="mb-6 rounded-lg border border-border-gold bg-gold-glow p-4">
              <p className="mb-2 text-sm font-semibold text-gold-bright">What this creates</p>
              <p className="text-sm leading-6 text-text-secondary">
                A preserved presence based on approved memories. It does not recreate consciousness or guarantee unsupported facts.
              </p>
            </div>

            <div className="space-y-3">
              {CHECKBOXES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-start gap-4 rounded-lg border border-border-subtle bg-bg-primary/35 p-4 text-left transition-colors hover:border-border-gold"
                >
                  <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${checked[key] ? "border-gold-mid bg-gold-mid text-bg-primary" : "border-border-gold text-transparent"}`}>
                    <Check size={14} />
                  </span>
                  <span className="text-sm leading-6 text-text-secondary">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!allChecked || loading}
            className="btn-gold mt-4 w-full py-3.5 text-base"
          >
            {loading ? "Signing..." : allChecked ? "I agree. Begin capturing memories" : `Accept all ${CHECKBOXES.length} items to continue`}
            {allChecked && !loading && <ArrowRight size={18} />}
          </button>
        </section>
      </motion.div>
    </div>
  );
}

export default function AgreementPage() {
  return (
    <div className="relative min-h-screen overflow-hidden app-shell px-5 py-10">
      <div className="archive-grid" />
      <Suspense>
        <AgreementForm />
      </Suspense>
    </div>
  );
}
