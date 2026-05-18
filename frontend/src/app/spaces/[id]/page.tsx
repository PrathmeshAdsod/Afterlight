"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle, UploadCloud, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import type { MemorySpace, SetupStatus } from "@/types";

export default function SpaceDashboard() {
  const { id } = useParams<{ id: string }>();
  const [space, setSpace] = useState<MemorySpace | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSpace(id).then((s) => setSpace(s as MemorySpace)),
      api.getSetupStatus(id).then((s) => setStatus(s as SetupStatus)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-surface text-text-secondary animate-pulse">Loading...</div>;
  if (!space) return <div className="page-surface text-red-300">Space not found.</div>;

  const pipelineDone = status?.summary.completed_steps || 0;
  const totalSteps = status?.summary.total_steps || 13;
  const progress = Math.min(100, Math.round((pipelineDone / totalSteps) * 100));

  const actions = [
    { href: "capture", icon: UploadCloud, label: "Capture Memories", desc: "Upload audio, video, photos, and documents." },
    { href: "setup", icon: Workflow, label: "View Setup", desc: "Track transcription, extraction, and capsule progress." },
    { href: "talk", icon: MessageCircle, label: `Talk with ${space.presence_name}`, desc: "Start a grounded conversation from approved memories." },
  ];

  return (
    <div className="page-surface">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="page-kicker">{space.relationship_type}</p>
            <h1 className="page-title mt-2">{space.presence_name}</h1>
            <p className="page-subtitle mt-2">
              {space.birth_year && `${space.birth_year}`}
              {space.death_year && ` - ${space.death_year}`}
              {space.still_living && " - Still living"}
              {" - "}{space.primary_language}
            </p>
          </div>
          <Link href={`/spaces/${id}/talk`} className="btn-gold">
            Open Talk <ArrowRight size={17} />
          </Link>
        </div>

        <div className="card-glass mb-6 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-text-primary">Processing Pipeline</h2>
              <p className="mt-1 text-sm text-text-secondary">Memory extraction status for this space.</p>
            </div>
            <span className="rounded-md border border-border-subtle bg-bg-primary/50 px-3 py-2 text-sm text-text-secondary">
              {pipelineDone}/{totalSteps}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg-primary/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-mid via-sage-mid to-blue-mid transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Memory cards", status?.summary.memory_cards_created || 0],
              ["Approved", status?.summary.approved_cards || 0],
              ["Persona capsule", status?.summary.has_persona_capsule ? "Ready" : "Pending"],
            ].map(([label, value]) => (
              <div key={label} className="panel-muted p-4">
                <p className="text-xs text-text-muted">{label}</p>
                <p className="mt-1 font-serif text-2xl text-gold-bright">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={`/spaces/${id}/${action.href}`}>
                <motion.div whileHover={{ y: -2 }} className="card-glass h-full p-6">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary/60 text-gold-bright">
                    <Icon size={19} />
                  </div>
                  <h3 className="font-serif text-xl text-text-primary">{action.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{action.desc}</p>
                </motion.div>
              </Link>
            );
          })}
        </div>

        {space.description && (
          <div className="card-glass mt-6 p-6">
            <div className="mb-3 flex items-center gap-2 text-sm text-sage-bright">
              <CheckCircle2 size={16} />
              Profile note
            </div>
            <p className="text-sm italic leading-7 text-text-secondary">&quot;{space.description}&quot;</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
