"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";
import type { MemorySpace, SetupStatus } from "@/types";

export default function SpaceDashboard() {
  const { id } = useParams<{ id: string }>();
  const [space, setSpace] = useState<MemorySpace | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSpace(id).then(s => setSpace(s as MemorySpace)),
      api.getSetupStatus(id).then(s => setStatus(s as SetupStatus)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-10 text-text-secondary animate-pulse">Loading...</div>;
  if (!space) return <div className="p-10 text-red-400">Space not found.</div>;

  const pipelineDone = status?.summary.completed_steps || 0;
  const totalSteps = status?.summary.total_steps || 13;

  return (
    <div className="p-10 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">{space.relationship_type}</p>
          <h1 className="font-serif text-5xl text-text-primary mb-1">{space.presence_name}</h1>
          <p className="text-text-secondary text-sm">
            {space.birth_year && `${space.birth_year}`}
            {space.death_year && ` — ${space.death_year}`}
            {space.still_living && " · Still living"}
            {" · "}{space.primary_language}
          </p>
        </div>

        {/* Pipeline progress */}
        <div className="card-glass p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-text-primary">Processing Pipeline</h2>
            <span className="text-sm text-text-secondary">{pipelineDone}/{totalSteps} steps complete</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(201,154,69,0.1)" }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(pipelineDone / totalSteps) * 100}%`, background: "linear-gradient(90deg, #C99A45, #38A3FF)" }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="text-text-secondary">Memory cards: <span className="text-gold-dim">{status?.summary.memory_cards_created || 0}</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-text-secondary">Approved: <span className="text-gold-dim">{status?.summary.approved_cards || 0}</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-text-secondary">Persona capsule: <span className={status?.summary.has_persona_capsule ? "text-emerald-400" : "text-text-muted"}>{status?.summary.has_persona_capsule ? "Ready" : "Not yet"}</span></span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { href: `capture`, icon: "⊕", label: "Capture Memories", desc: "Upload audio, video, photos, documents" },
            { href: `setup`, icon: "◎", label: "View Setup", desc: "Track processing pipeline progress" },
            { href: `talk`, icon: "◉", label: `Talk with ${space.presence_name}`, desc: "Start a presence conversation" },
          ].map(a => (
            <Link key={a.href} href={`/spaces/${id}/${a.href}`}>
              <motion.div whileHover={{ scale: 1.02 }} className="card-glass p-6 cursor-pointer h-full">
                <span className="text-2xl text-gold-dim mb-3 block">{a.icon}</span>
                <h3 className="font-serif text-lg text-text-primary mb-1">{a.label}</h3>
                <p className="text-xs text-text-secondary">{a.desc}</p>
              </motion.div>
            </Link>
          ))}
        </div>

        {space.description && (
          <div className="mt-6 card-glass p-6">
            <p className="text-sm text-text-secondary italic leading-relaxed">"{space.description}"</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
