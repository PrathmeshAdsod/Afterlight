"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Clock3, MapPin } from "lucide-react";
import { api } from "@/lib/api";

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ events: unknown[]; memory_cards?: unknown[] } | null>(null);

  useEffect(() => {
    api.getTimeline(id).then((timeline) => setData(timeline as { events: unknown[]; memory_cards?: unknown[] })).catch(() => {});
  }, [id]);

  const events = (data?.events || []) as Array<{ id: string; title: string; year?: number; description?: string; people?: string[]; place?: string }>;
  const cards = (data?.memory_cards || []) as Array<{ id: string; title: string; summary: string; places?: string[]; people?: string[]; themes?: string[] }>;

  return (
    <div className="page-surface max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <p className="page-kicker">Timeline</p>
          <h1 className="page-title mt-2">Life Timeline</h1>
          <p className="page-subtitle mt-2">A chronological view of memories, places, and events.</p>
        </div>

        {events.length > 0 ? (
          <div className="relative pl-9">
            <div className="absolute bottom-0 left-3 top-0 w-px bg-gradient-to-b from-gold-mid via-sage-mid to-transparent" />
            {events.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative mb-8"
              >
                <div className="absolute -left-9 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-border-gold bg-bg-primary text-gold-bright">
                  <Clock3 size={14} />
                </div>
                {event.year && <p className="mb-1 text-xs font-semibold text-gold-bright">{event.year}</p>}
                <div className="card-glass p-5">
                  <h3 className="font-serif text-xl text-text-primary">{event.title}</h3>
                  {event.description && <p className="mt-2 text-sm leading-6 text-text-secondary">{event.description}</p>}
                  {event.place && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                      <MapPin size={13} /> {event.place}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : cards.length > 0 ? (
          <div className="space-y-3">
            {cards.map((card, index) => (
              <motion.div key={card.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.04 }} className="card-glass p-5">
                <h3 className="font-serif text-xl text-text-primary">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{card.summary}</p>
                {(card.places?.length ?? 0) > 0 && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                    <MapPin size={13} /> {card.places!.join(", ")}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="card-glass py-20 text-center">
            <Clock3 className="mx-auto mb-4 text-text-muted" size={34} />
            <p className="text-sm text-text-muted">No timeline data yet. Process your uploads to generate memories.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
