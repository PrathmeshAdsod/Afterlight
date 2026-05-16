"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ events: unknown[]; memory_cards?: unknown[] } | null>(null);

  useEffect(() => {
    api.getTimeline(id).then(d => setData(d as { events: unknown[]; memory_cards?: unknown[] })).catch(() => {});
  }, [id]);

  const events = (data?.events || []) as Array<{ id: string; title: string; year?: number; description?: string; people?: string[]; place?: string }>;
  const cards = (data?.memory_cards || []) as Array<{ id: string; title: string; summary: string; places?: string[]; people?: string[]; themes?: string[] }>;

  return (
    <div className="p-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-4xl text-text-primary mb-2">Life Timeline</h1>
        <p className="text-text-secondary text-sm mb-8">A chronological view of memories and events.</p>

        {events.length > 0 ? (
          <div className="relative pl-8">
            <div className="absolute left-3 top-0 bottom-0 w-px"
              style={{ background: "linear-gradient(180deg, #C99A45, transparent)" }} />
            {events.map((e, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }} className="relative mb-8">
                <div className="absolute -left-8 top-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: "#C99A45", border: "2px solid #05070B" }} />
                {e.year && <p className="text-xs text-gold-dim font-medium mb-1">{e.year}</p>}
                <div className="card-glass p-4">
                  <h3 className="font-serif text-base text-text-primary mb-1">{e.title}</h3>
                  {e.description && <p className="text-sm text-text-secondary">{e.description}</p>}
                  {e.place && <p className="text-xs text-text-muted mt-2">📍 {e.place}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div>
            {cards.length > 0 ? (
              <div className="space-y-3">
                {cards.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }} className="card-glass p-4">
                    <h3 className="font-serif text-base text-text-primary mb-1">{c.title}</h3>
                    <p className="text-sm text-text-secondary">{c.summary}</p>
                    {(c.places?.length ?? 0) > 0 && <p className="text-xs text-text-muted mt-2">📍 {c.places!.join(", ")}</p>}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 card-glass">
                <p className="text-text-muted text-sm">No timeline data yet. Process your uploads to generate memories.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
